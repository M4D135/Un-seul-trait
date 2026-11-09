"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {ArrowLeft,ArrowRight,ArrowDown,Check,ChevronRight,Expand,Flag,Hand,HelpCircle,Keyboard,List,Pause,Pencil,Play,RotateCcw,Settings2,Skull,Star,Volume2,VolumeX,X} from "lucide-react";
import {PLATFORM_LEVELS} from "../lib/trait/platform-levels";
import {appendPlayerStroke,beginPlayerStroke,cancelPlayerDrawing,createWorld,finishPlayerStroke,getAvailableDrawing,resetPlayerStroke,restartAtCheckpoint,updateWorld,beginMechanismInteraction,moveMechanismInteraction,endMechanismInteraction,getAvailableMechanism,getMechanismHandlePosition,type GameEvent,type PlatformInput,type PlatformPoint} from "../lib/trait/platformer";
import {drawPlatformScene,drawPassageAnchors,PLATFORM_PALETTES} from "../lib/trait/platform-renderer";
import {GameAudio} from "../lib/trait/audio";
import {DrawingHand} from "../lib/trait/hand";
import {actionForKey,keyLabel,normalizeKey,sanitizeBindings,type ActionId,type KeyBindings} from "../lib/trait/controls";
import {ControlsConfig} from "../components/trait/controls-config";
import {createCompanionState,updateCompanion} from "../lib/trait/companion";
import {ADVENTURE_SAVE_KEY,readAdventure,restoreProgress,saveProgress,type SavedProgress} from "../lib/trait/progress";

type Panel="levels"|"help"|"settings"|"controls"|null;
type Score={done:boolean;stars:number;deaths:number};
const SAVE_KEY="un-seul-trait-platformer-v1";
const emptyScores=()=>PLATFORM_LEVELS.map(()=>({done:false,stars:0,deaths:0}));
const emptyInput=():PlatformInput=>({left:false,right:false,crouch:false,draw:false,interact:false});
const initialWorld=createWorld(PLATFORM_LEVELS[0]);
type View={phase:typeof initialWorld.phase;stars:number;deaths:number;checkpoint:number;drawn:number;available:string|null;percent:number;editing:string|null;hasStroke:boolean;redrawing:boolean;mechanism:string|null;handling:boolean;solved:number;crouching:boolean};
const snapshot=(world:typeof initialWorld,level:typeof PLATFORM_LEVELS[number]):View=>({
  phase:world.phase,stars:world.collected.length,deaths:world.deaths,checkpoint:world.checkpointIndex,
  drawn:world.drawn.length,available:getAvailableDrawing(world,level)?.id??null,
  percent:Math.max(0,Math.min(100,Math.round(world.player.x/level.goal.x*100))),
  editing:world.activeDrawing?.id??null,hasStroke:(world.activeDrawing?.path.length??0)>1,
  redrawing:world.drawn.includes(getAvailableDrawing(world,level)?.id??""),
  mechanism:getAvailableMechanism(world,level)?.id??null,handling:!!world.handInteraction,
  solved:Object.values(world.mechanisms).filter(m=>m.progress>.95).length,crouching:world.player.crouching,
});

function BrandMark(){
  return <svg viewBox="0 0 64 44" fill="none" aria-hidden="true"><path d="M1 36h21l-1-10 2-11c-1-7 9-12 15-9 6 4-2 7-7 6l6 3-6 3 2 9-2 9h32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function LevelThumbnail({index}:{index:number}){
  const l=PLATFORM_LEVELS[index],x=(n:number)=>n/l.width*200,y=(n:number)=>20+n*.1;
  return <svg viewBox="0 0 200 88" fill="none" aria-hidden="true">
    {l.surfaces.map((s,i)=><path key={i} d={`M${x(s.a.x)} ${y(s.a.y)}L${x(s.b.x)} ${y(s.b.y)}`} stroke="#fffdf6" strokeWidth="1.8" strokeLinecap="round"/>)}
    {l.drawings.map(d=><path key={d.id} d={d.path.map((p,i)=>`${i?'L':'M'}${x(p.x)} ${y(p.y)}`).join(' ')} stroke="#fffdf6" strokeWidth="1.2" strokeDasharray="2 3" opacity=".45"/>)}
    {l.mechanisms?.map(m=><g key={m.id}><path d={`M${x(m.from.x)} ${y(m.from.y)-8}L${x(m.to.x)} ${y(m.to.y)-8}`} stroke="#f6d89a" strokeWidth="1"/><circle cx={x(m.from.x)} cy={y(m.from.y)-8} r="2.8" stroke="#f6d89a" strokeWidth="1.2"/></g>)}
    {l.stars.map((s,i)=><path key={i} d={`M${x(s.x)} ${y(s.y)-5}v5m-2.5-2.5h5`} stroke="#f6d89a" strokeWidth="1.2"/>)}
  </svg>;
}

export default function Home(){
  const [levelIndex,setLevelIndex]=useState(0);
  const [view,setView]=useState<View>(()=>snapshot(initialWorld,PLATFORM_LEVELS[0]));
  const [paused,setPaused]=useState(false);
  const [panel,setPanel]=useState<Panel>(null);
  const [muted,setMuted]=useState(false);
  const [volume,setVolume]=useState(45);
  const [voiceMode,setVoiceMode]=useState<'original'|'grammelot'|'italian'>('original');
  const [scores,setScores]=useState<Score[]>(emptyScores);
  const [bindings,setBindings]=useState<KeyBindings>(()=>sanitizeBindings(null));
  const [storageReady,setStorageReady]=useState(false);
  const [storageOk,setStorageOk]=useState(true);
  const [reducedMotion,setReducedMotion]=useState(false);
  const [fullScreen,setFullScreen]=useState(false);
  const [tip,setTip]=useState("Avance sur la ligne et dessine toi-même les passages manquants.");
  const [drawingError,setDrawingError]=useState(false);
  const [cinema,setCinema]=useState(false);
  const [blood,setBlood]=useState(true);
  const [ready,setReady]=useState(false);
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const stageRef=useRef<HTMLElement>(null);
  const dialogRef=useRef<HTMLDialogElement>(null);
  const worldRef=useRef(createWorld(PLATFORM_LEVELS[0]));
  const controlsRef=useRef<PlatformInput>(emptyInput());
  const audioRef=useRef<GameAudio|null>(null);
  const handRef=useRef<DrawingHand|null>(null);
  const cameraRef=useRef(0);
  const bindingsRef=useRef(bindings);bindingsRef.current=bindings;
  const pressedKeysRef=useRef(new Map<string,string>());
  const touchDirectionsRef=useRef({left:false,right:false,crouch:false});
  const strokePointerRef=useRef<number|null>(null);
  const mechanismPointerRef=useRef<number|null>(null);
  const pointerRef=useRef<PlatformPoint|null>(null);
  const pointerClientRef=useRef<{clientX:number;clientY:number}|null>(null);
  const companionRef=useRef(createCompanionState(worldRef.current));
  const touchCompanionRef=useRef(false);
  const tapRef=useRef<{point:PlatformPoint;remaining:number}|null>(null);
  const companionEventsRef=useRef<GameEvent[]>([]);
  const lastSpeechRef=useRef(-1);
  const lastPencilRef=useRef<{point:PlatformPoint;at:number}|null>(null);
  const progressRef=useRef<Record<string,SavedProgress>>({});
  const saveReadyRef=useRef(false);
  const frameViewRef=useRef({scale:1,offsetY:0,cameraX:0});
  const latestRef=useRef({levelIndex,paused,panel,reducedMotion,cinema,blood});
  latestRef.current={levelIndex,paused,panel,reducedMotion,cinema,blood};
  const level=PLATFORM_LEVELS[levelIndex],palette=PLATFORM_PALETTES[level.palette];
  const available=level.drawings.find(d=>d.id===view.available);
  const mechanism=level.mechanisms?.find(m=>m.id===view.mechanism);
  const completed=scores.filter(s=>s.done).length;
  const totalStars=scores.reduce((sum,s)=>sum+s.stars,0);
  const bindingText=(action:ActionId)=>bindings[action].filter((key):key is string=>key!==null).map(keyLabel).join(" / ");
  const focusGame=()=>canvasRef.current?.focus({preventScroll:true});

  const unlock=useCallback(()=>{
    if(!audioRef.current)audioRef.current=new GameAudio();
    audioRef.current.unlock();
  },[]);
  const clearInput=useCallback(()=>{
    controlsRef.current=emptyInput();pressedKeysRef.current.clear();touchDirectionsRef.current={left:false,right:false,crouch:false};
  },[]);
  const persistAdventure=useCallback(()=>{
    if(!saveReadyRef.current)return;
    const w=worldRef.current,l=PLATFORM_LEVELS[latestRef.current.levelIndex];
    progressRef.current[String(l.id)]=saveProgress(w,l);
    try{localStorage.setItem(ADVENTURE_SAVE_KEY,JSON.stringify(progressRef.current));}
    catch{setStorageOk(false);}
  },[]);
  const releaseHand=useCallback(()=>{
    const stroke=strokePointerRef.current,mechanism=mechanismPointerRef.current;
    strokePointerRef.current=null;mechanismPointerRef.current=null;
    endMechanismInteraction(worldRef.current);
    if(stroke!==null){resetPlayerStroke(worldRef.current);handRef.current?.clear();}
    const canvas=canvasRef.current;
    for(const pointer of [stroke,mechanism])if(pointer!==null&&canvas?.hasPointerCapture(pointer))canvas.releasePointerCapture(pointer);
    audioRef.current?.endPencil();lastPencilRef.current=null;
  },[]);
  const syncHeldControls=useCallback(()=>{
    const actions=[...pressedKeysRef.current.values()].map(key=>actionForKey(key,bindingsRef.current));
    controlsRef.current.left=touchDirectionsRef.current.left||actions.includes("left");
    controlsRef.current.right=touchDirectionsRef.current.right||actions.includes("right");
    controlsRef.current.crouch=touchDirectionsRef.current.crouch||actions.includes("crouch");
  },[]);
  const startLevel=useCallback((index:number,fresh=false)=>{
    persistAdventure();
    const bounded=Math.max(0,Math.min(PLATFORM_LEVELS.length-1,index));
    audioRef.current?.hush();handRef.current?.clear();clearInput();releaseHand();pointerRef.current=null;pointerClientRef.current=null;
    const resumed=fresh?null:restoreProgress(progressRef.current[String(PLATFORM_LEVELS[bounded].id)],PLATFORM_LEVELS[bounded]);
    worldRef.current=resumed??createWorld(PLATFORM_LEVELS[bounded]);cameraRef.current=Math.max(0,worldRef.current.player.x-340);
    companionRef.current=createCompanionState(worldRef.current);companionEventsRef.current=[];lastSpeechRef.current=-1;
    latestRef.current.levelIndex=bounded;
    setLevelIndex(bounded);setView(snapshot(worldRef.current,PLATFORM_LEVELS[bounded]));
    setPaused(false);setPanel(null);
    setDrawingError(false);setTip(resumed?"Aventure reprise au dernier drapeau. Tes dessins et tes mécanismes sont conservés.":"Marche sur la ligne, baisse-toi et dessine les passages. Les poignées dorées permettent de déplacer le décor.");
    if(fresh)delete progressRef.current[String(PLATFORM_LEVELS[bounded].id)];
  },[clearInput,releaseHand,persistAdventure]);
  const retry=useCallback(()=>{
    audioRef.current?.hush();handRef.current?.clear();clearInput();releaseHand();strokePointerRef.current=null;setDrawingError(false);
    const l=PLATFORM_LEVELS[latestRef.current.levelIndex];
    restartAtCheckpoint(worldRef.current,l);
    cameraRef.current=Math.max(0,worldRef.current.player.x-340);
    setView(snapshot(worldRef.current,l));setPaused(false);setTip("C’est reparti depuis le point de contrôle.");
    canvasRef.current?.focus({preventScroll:true});
    companionRef.current=createCompanionState(worldRef.current);persistAdventure();
  },[clearInput,releaseHand,persistAdventure]);
  const togglePause=useCallback(()=>{
    clearInput();releaseHand();audioRef.current?.hush();persistAdventure();setPaused(v=>!v);
  },[clearInput,releaseHand,persistAdventure]);

  useEffect(()=>{
    audioRef.current=new GameAudio();handRef.current=new DrawingHand();
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion=()=>setReducedMotion(media.matches);onMotion();media.addEventListener("change",onMotion);
    const readSaved=(key:string)=>{
      let raw:string|null;
      try{raw=localStorage.getItem(key);}catch{setStorageOk(false);return null;}
      if(!raw)return null;
      try{return JSON.parse(raw);}catch{return null;}
    };
    {
      const rawSaved=readSaved(SAVE_KEY);
      const saved=rawSaved&&typeof rawSaved==="object"&&!Array.isArray(rawSaved)?rawSaved:null;
      const prefs=saved??readSaved("un-seul-trait-v1");
      progressRef.current=readAdventure(readSaved(ADVENTURE_SAVE_KEY),PLATFORM_LEVELS);
      if(prefs){
        if(typeof prefs.muted==="boolean")setMuted(prefs.muted);
        if(typeof prefs.volume==="number"&&Number.isFinite(prefs.volume))setVolume(Math.max(0,Math.min(100,prefs.volume)));
        if(typeof prefs.cinema==="boolean")setCinema(prefs.cinema);
        if(typeof prefs.blood==="boolean")setBlood(prefs.blood);
        if(prefs.voiceEdition===2&&(prefs.voiceMode==='original'||prefs.voiceMode==='grammelot'||prefs.voiceMode==='italian'))setVoiceMode(prefs.voiceMode);
      }
      if(saved){
        setBindings(sanitizeBindings(saved.bindings));
        if(Array.isArray(saved.scores))setScores(emptyScores().map((_,i)=>({
          done:saved.scores[i]?.done===true,stars:Math.max(0,Math.min(3,Number(saved.scores[i]?.stars)||0)),
          deaths:Math.max(0,Number(saved.scores[i]?.deaths)||0),
        })));
      }
      // A damaged preference or legacy audio key must not discard a valid adventure.
      startLevel(saved&&Number.isInteger(saved.levelIndex)&&saved.levelIndex>=0&&saved.levelIndex<PLATFORM_LEVELS.length?saved.levelIndex:0);
    }
    saveReadyRef.current=true;setStorageReady(true);
    return()=>{audioRef.current?.dispose();media.removeEventListener("change",onMotion);};
  },[startLevel]);

  useEffect(()=>{
    audioRef.current?.setEnabled(!muted);audioRef.current?.setVolume(volume/100);audioRef.current?.setVoiceMode(voiceMode);
    if(!storageReady)return;
    try{localStorage.setItem(SAVE_KEY,JSON.stringify({levelIndex,scores,muted,volume,bindings,cinema,blood,voiceMode,voiceEdition:2}));}
    catch{setStorageOk(false);}
  },[levelIndex,scores,muted,volume,bindings,cinema,blood,voiceMode,storageReady]);

  useEffect(()=>{
    const dialog=dialogRef.current;
    if(panel){clearInput();releaseHand();persistAdventure();audioRef.current?.hush();if(dialog&&!dialog.open)dialog.showModal();}
    else {if(dialog?.open)dialog.close();canvasRef.current?.focus({preventScroll:true});}
  },[panel,clearInput,releaseHand,persistAdventure]);

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");if(!ctx)return;
    let frame=0,last=0,lastSnapshot="",lastStep=0,lastProgressAt=0;
    let width=1100,height=600,scale=1,baseScale=1,offsetY=0,dpr=1,viewWidth=1250;
    const resize=()=>{
      const rect=canvas.getBoundingClientRect();
      if(Math.abs(width-rect.width)>.5||Math.abs(height-rect.height)>.5){
        // Rotation changes the mapping under a finger. Keep the last valid bridge,
        // and let the player restart the unfinished stroke in the new viewport.
        if(strokePointerRef.current!==null){
          releaseHand();
          setDrawingError(false);setTip("Écran tourné : repars de A ou B pour tracer ton passage.");
        }
        if(mechanismPointerRef.current!==null)releaseHand();
      }
      width=Math.max(1,rect.width);height=Math.max(1,rect.height);
      dpr=Math.min(window.devicePixelRatio||1,2);
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
      baseScale=Math.min(width/(width<600?660:1250),height/560);scale=baseScale;
      viewWidth=width/scale;offsetY=(height-560*scale)*.5;
    };
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();setReady(true);
    const event=(kind:GameEvent)=>{
      const w=worldRef.current;
      if(kind==="land")audioRef.current?.play("step");
      if(kind==="star")audioRef.current?.play("star");
      if(kind==="draw-start"){clearInput();setDrawingError(false);audioRef.current?.speak("waiting");setTip("Relie A et B avec ton trait. Relâche pour valider.");}
      if(kind==="draw-complete"){audioRef.current?.play("ready");audioRef.current?.speak("ready");setTip("Le passage est prêt. À toi de traverser !");}
      if(kind==="death"){audioRef.current?.hush();audioRef.current?.speak("grumble");setTip("Touché ! Retour au dernier point de contrôle.");}
      if(kind==="respawn")setTip("C’est reparti. Tes passages dessinés et tes étoiles sont conservés.");
      if(kind==="checkpoint"){audioRef.current?.play("ready");setTip("Point de contrôle atteint.");}
      if(kind==="mechanism-start"){
        const mechanism=laterMechanism();
        setTip(mechanism?.prompt??"Déplace la poignée dorée. Tu peux continuer à marcher et te baisser.");
        audioRef.current?.play("click");
      }
      if(kind==="mechanism-settle"){audioRef.current?.play("ready");setTip("En place. À vous deux de poursuivre le chemin.");}
      if(kind==="win"){
        audioRef.current?.play("win");audioRef.current?.speak("win");clearInput();
        setTip("Niveau terminé !");
        setScores(old=>old.map((s,i)=>i===latestRef.current.levelIndex?{
          done:true,stars:Math.max(s.stars,w.collected.length),deaths:s.done?Math.min(s.deaths,w.deaths):w.deaths,
        }:s));
      }
      if(kind==="checkpoint"||kind==="star"||kind==="mechanism-settle"||kind==="respawn"||kind==="win")persistAdventure();
    };
    const laterMechanism=()=>PLATFORM_LEVELS[latestRef.current.levelIndex].mechanisms?.find(m=>m.id===worldRef.current.handInteraction?.id);
    const animate=(now:number)=>{
      const dt=Math.min((now-(last||now))/1000,.2);last=now;
      const current=latestRef.current,l=PLATFORM_LEVELS[current.levelIndex],w=worldRef.current;
      const frozen=current.paused||!!current.panel;
      const events=new Set<GameEvent>(companionEventsRef.current);companionEventsRef.current=[];
      if(!frozen){
        // Catch up a slow display without slowing the character or skipping collisions.
        // Physics substeps stay small; drawing and interaction are consumed only once.
        const steps=Math.max(1,Math.ceil(dt/.05));
        for(let i=0;i<steps;i++){
          updateWorld(w,l,controlsRef.current,dt/steps).forEach(kind=>events.add(kind));
          controlsRef.current.draw=false;controlsRef.current.interact=false;
        }
        events.forEach(event);
        const step=Math.floor(w.player.travel/29.6);
        if(w.player.grounded&&Math.abs(w.player.vx)>15&&step!==lastStep)audioRef.current?.play("step");
        lastStep=step;
        if(now-lastProgressAt>3000){lastProgressAt=now;persistAdventure();}
      }
      const drawing=w.activeDrawing?l.drawings.find(d=>d.id===w.activeDrawing?.id):getAvailableDrawing(w,l);
      const handling=w.handInteraction?l.mechanisms?.find(m=>m.id===w.handInteraction?.id):null;
      const nearbyMechanism=handling??(!drawing?getAvailableMechanism(w,l):null);
      const lookAhead=drawing&&w.drawn.includes(drawing.id)?220:45;
      const drawingLeft=drawing?Math.min(drawing.path[0].x,w.player.x-(w.player.facing<0?lookAhead:45))-75:handling?Math.min(handling.from.x,handling.to.x,w.player.x-45)-90:0;
      const drawingRight=drawing?Math.max(drawing.path[drawing.path.length-1].x,w.player.x+(w.player.facing>0?lookAhead:45))+75:handling?Math.max(handling.from.x,handling.to.x,w.player.x+45)+90:0;
      const pointerHeld=mechanismPointerRef.current!==null||strokePointerRef.current!==null;
      // A short landscape screen uses its height for the playable band. A nearby
      // mechanism also frames both ends of its rail before the finger lands.
      let sceneTop=height<380?Math.min(180,w.player.y-150):0;
      if(height<380&&drawing)sceneTop=Math.min(sceneTop,...drawing.path.map(p=>p.y-135));
      if(height<380&&nearbyMechanism){
        const handle=getMechanismHandlePosition(w,nearbyMechanism);
        const positionY=nearbyMechanism.from.y+(nearbyMechanism.to.y-nearbyMechanism.from.y)*(w.mechanisms[nearbyMechanism.id]?.progress??0);
        sceneTop=Math.min(sceneTop,Math.min(nearbyMechanism.from.y,nearbyMechanism.to.y)+handle.y-positionY-45);
      }
      const sceneHeight=(height<380?490:560)-sceneTop;
      baseScale=Math.min(width/(width<600?660:1250),height/sceneHeight);
      scale=pointerHeld?frameViewRef.current.scale:drawing||handling?Math.min(baseScale,width/(drawingRight-drawingLeft)):baseScale;
      viewWidth=width/scale;offsetY=pointerHeld?frameViewRef.current.offsetY:(height-sceneHeight*scale)*.5-sceneTop*scale;
      const drawCentre=drawing||handling?(drawingLeft+drawingRight)/2:null;
      const target=Math.max(0,Math.min(l.width-viewWidth,drawCentre!==null?drawCentre-viewWidth*.5:w.player.x-viewWidth*.33));
      // Keep both pencil anchors visible and the drawing coordinates immobile.
      if(!frozen&&!pointerHeld)cameraRef.current+=(target-cameraRef.current)*(drawing||current.reducedMotion?1:Math.min(1,dt*7));
      cameraRef.current=Math.max(0,Math.min(Math.max(0,l.width-viewWidth),cameraRef.current));
      frameViewRef.current={scale,offsetY,cameraX:cameraRef.current};
      if(pointerClientRef.current){
        const rect=canvas.getBoundingClientRect(),p=pointerClientRef.current;
        pointerRef.current={x:(p.clientX-rect.left)/scale+cameraRef.current,y:(p.clientY-rect.top-offsetY)/scale};
      }
      const companion=updateCompanion(companionRef.current,w,l,frozen?0:dt,{pointer:pointerRef.current,events:[...events],touched:touchCompanionRef.current});
      touchCompanionRef.current=false;
      if(companion.sequence!==lastSpeechRef.current){
        lastSpeechRef.current=companion.sequence;
        if(companion.speech&&!frozen)audioRef.current?.speak(companion.speech);
      }
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
      ctx.save();ctx.translate(0,offsetY);ctx.scale(scale,scale);
      drawPlatformScene(ctx,l,w,{cameraX:cameraRef.current,viewWidth,pixelScale:scale,talkAmount:frozen?0:audioRef.current?.getTalkAmount()??0,reducedMotion:current.reducedMotion,companion,pointer:pointerRef.current,blood:current.blood});
      if(tapRef.current&&!frozen){tapRef.current.remaining-=dt;if(tapRef.current.remaining<=0)tapRef.current=null;}
      const handTip=w.activeDrawing?.started?w.activeDrawing.path.at(-1)??null:handling?getMechanismHandlePosition(w,handling):tapRef.current?.point??null;
      ctx.save();ctx.translate(-cameraRef.current,0);handRef.current?.draw(ctx,handTip,frozen?0:dt,current.reducedMotion,{mode:w.activeDrawing?'draw':handling?'point':'tap',hero:w.player,bottom:(height-offsetY)/scale});ctx.restore();
      drawPassageAnchors(ctx,l,w,{cameraX:cameraRef.current,pixelScale:scale});
      ctx.restore();
      const next=snapshot(w,l),key=JSON.stringify(next);
      if(key!==lastSnapshot){lastSnapshot=key;setView(next);}
      frame=requestAnimationFrame(animate);
    };
    frame=requestAnimationFrame(animate);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();};
  },[clearInput,releaseHand,persistAdventure]);

  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{
      if(e.isComposing||e.altKey||e.ctrlKey||e.metaKey||e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||latestRef.current.panel)return;
      const key=normalizeKey(e.key);if(!key)return;
      const action=actionForKey(key,bindingsRef.current);
      if(!action){
        if(e.target===canvasRef.current&&(key===" "||key==="ArrowUp"))e.preventDefault();
        return;
      }
      const button=e.target instanceof HTMLElement?e.target.closest("button"):null;
      // A focused button keeps native Space/Enter activation, including the dock.
      if((key===" "||key==="Enter")&&button)return;
      if(action==="pause"){e.preventDefault();if(!e.repeat)togglePause();return;}
      if(latestRef.current.paused||worldRef.current.phase==="won")return;
      e.preventDefault();unlock();canvasRef.current?.focus({preventScroll:true});
      if(action==="restart"){if(!e.repeat)retry();return;}
      if(worldRef.current.phase==="drawing"){
        if(action==="draw"&&!e.repeat){releaseHand();cancelPlayerDrawing(worldRef.current);handRef.current?.clear();setDrawingError(false);setTip("Dessin annulé. Tu peux reprendre ta traversée.");}
        return;
      }
      if(action==="left"||action==="right"||action==="crouch"){
        const physicalKey=e.code||key;
        if(!pressedKeysRef.current.has(physicalKey))pressedKeysRef.current.set(physicalKey,key);
        syncHeldControls();
      }
      if(action==="draw"&&!e.repeat)controlsRef.current.draw=true;
      if(action==="interact"&&!e.repeat)controlsRef.current.interact=true;
    };
    const up=(e:KeyboardEvent)=>{
      // Shift may change e.key between down/up; release the same physical key.
      const key=e.code||normalizeKey(e.key);if(key)pressedKeysRef.current.delete(key);syncHeldControls();
    };
    const blur=()=>{clearInput();releaseHand();persistAdventure();};
    const hidden=()=>{if(document.hidden)blur();};
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);
    window.addEventListener("blur",blur);document.addEventListener("visibilitychange",hidden);window.addEventListener("pagehide",persistAdventure);
    return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);window.removeEventListener("blur",blur);document.removeEventListener("visibilitychange",hidden);window.removeEventListener("pagehide",persistAdventure);};
  },[clearInput,releaseHand,persistAdventure,retry,syncHeldControls,togglePause,unlock]);

  const hold=(direction:"left"|"right"|"crouch",e:React.PointerEvent<HTMLButtonElement>)=>{
    e.preventDefault();unlock();focusGame();e.currentTarget.setPointerCapture(e.pointerId);touchDirectionsRef.current[direction]=true;syncHeldControls();
  };
  const release=(direction:"left"|"right"|"crouch")=>{touchDirectionsRef.current[direction]=false;syncHeldControls();};
  const callHand=()=>{unlock();focusGame();controlsRef.current.draw=true;};
  const manipulate=()=>{unlock();focusGame();controlsRef.current.interact=true;};
  const cancelDrawing=()=>{
    releaseHand();cancelPlayerDrawing(worldRef.current);handRef.current?.clear();setDrawingError(false);
    setTip("Dessin annulé. Ton passage précédent est conservé.");focusGame();
  };
  const clearDrawing=()=>{
    releaseHand();resetPlayerStroke(worldRef.current);handRef.current?.clear();setDrawingError(false);
    setTip("Relie A et B avec ton trait. Relâche pour valider.");focusGame();
  };
  const pointerPoint=(e:{clientX:number;clientY:number}):PlatformPoint=>{
    const rect=canvasRef.current!.getBoundingClientRect(),transform=frameViewRef.current;
    return {x:(e.clientX-rect.left)/transform.scale+transform.cameraX,y:(e.clientY-rect.top-transform.offsetY)/transform.scale};
  };
  const anchorRadius=()=>Math.min(72,Math.max(24,24/frameViewRef.current.scale));
  const snapStrokeEnd=(point:PlatformPoint):PlatformPoint=>{
    const w=worldRef.current,l=PLATFORM_LEVELS[latestRef.current.levelIndex];
    const drawing=l.drawings.find(d=>d.id===w.activeDrawing?.id),start=w.activeDrawing?.path[0];
    if(!drawing||!start)return point;
    const a=drawing.path[0],b=drawing.path[drawing.path.length-1];
    const end=Math.hypot(start.x-a.x,start.y-a.y)<Math.hypot(start.x-b.x,start.y-b.y)?b:a;
    return Math.hypot(point.x-end.x,point.y-end.y)<=anchorRadius()?{...end}:point;
  };
  const startStroke=(e:React.PointerEvent<HTMLCanvasElement>)=>{
    unlock();focusGame();
    if(e.button!==0||latestRef.current.paused||latestRef.current.panel||strokePointerRef.current!==null||mechanismPointerRef.current!==null)return;
    pointerClientRef.current={clientX:e.clientX,clientY:e.clientY};pointerRef.current=pointerPoint(e);
    const w=worldRef.current,l=PLATFORM_LEVELS[latestRef.current.levelIndex],wasPlaying=w.phase==="playing";
    const stroke=beginPlayerStroke(w,l,pointerRef.current,anchorRadius());
    if(stroke.ok){
      e.preventDefault();clearInput();strokePointerRef.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);
      setDrawingError(false);setTip(stroke.message);setView(snapshot(w,l));
      if(wasPlaying)companionEventsRef.current.push("draw-start");
      audioRef.current?.startPencil();lastPencilRef.current={point:pointerRef.current,at:e.timeStamp};
      return;
    }
    if(wasPlaying){
      const nearby=l.mechanisms?.find(m=>{const h=getMechanismHandlePosition(w,m);return Math.hypot(h.x-pointerRef.current!.x,h.y-pointerRef.current!.y)<=anchorRadius();});
      const result=beginMechanismInteraction(w,l,nearby?getMechanismHandlePosition(w,nearby):pointerRef.current);
      if(result.ok){
        e.preventDefault();mechanismPointerRef.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);
        companionEventsRef.current.push("mechanism-start");setDrawingError(false);setTip(result.message);
      }else{
        touchCompanionRef.current=true;
        const p=worldRef.current.player;
        if(Math.hypot(pointerRef.current.x-p.x,pointerRef.current.y-(p.y-(p.crouching?43:78)))<45)tapRef.current={point:{...pointerRef.current},remaining:.35};
      }
      return;
    }
    if(w.phase==="drawing"){e.preventDefault();setDrawingError(true);setTip(stroke.message);}
  };
  const moveStroke=(e:React.PointerEvent<HTMLCanvasElement>)=>{
    pointerClientRef.current={clientX:e.clientX,clientY:e.clientY};pointerRef.current=pointerPoint(e);
    if(latestRef.current.paused||latestRef.current.panel)return;
    const w=worldRef.current,l=PLATFORM_LEVELS[latestRef.current.levelIndex];
    if(mechanismPointerRef.current===e.pointerId){
      e.preventDefault();moveMechanismInteraction(w,l,pointerRef.current);e.currentTarget.style.cursor="grabbing";return;
    }
    if(w.phase==="playing"){
      const passage=getAvailableDrawing(w,l);
      const anchor=passage&&[passage.path[0],passage.path.at(-1)!].some(p=>Math.hypot(p.x-pointerRef.current!.x,p.y-pointerRef.current!.y)<=anchorRadius());
      const near=l.mechanisms?.some(m=>{const h=getMechanismHandlePosition(w,m);return Math.hypot(h.x-pointerRef.current!.x,h.y-pointerRef.current!.y)<=anchorRadius();});
      e.currentTarget.style.cursor=anchor?"crosshair":near?"grab":"default";
    }else e.currentTarget.style.cursor=w.phase==="drawing"?"crosshair":"default";
    if(strokePointerRef.current!==e.pointerId)return;
    e.preventDefault();
    const samples=e.nativeEvent.getCoalescedEvents?.()??[e.nativeEvent];
    for(const sample of samples.length?samples:[e.nativeEvent]){
      const result=appendPlayerStroke(worldRef.current,PLATFORM_LEVELS[latestRef.current.levelIndex],snapStrokeEnd(pointerPoint(sample)));
      if(!result.ok){setDrawingError(true);setTip(result.message);}
    }
    const old=lastPencilRef.current;
    if(old){const seconds=Math.max(.001,(e.timeStamp-old.at)/1000);audioRef.current?.updatePencil(Math.hypot(pointerRef.current.x-old.point.x,pointerRef.current.y-old.point.y)/seconds,e.pressure||.5);}
    lastPencilRef.current={point:pointerRef.current,at:e.timeStamp};
  };
  const finishStroke=(e:React.PointerEvent<HTMLCanvasElement>)=>{
    if(mechanismPointerRef.current===e.pointerId){
      e.preventDefault();moveMechanismInteraction(worldRef.current,PLATFORM_LEVELS[latestRef.current.levelIndex],pointerPoint(e));
      releaseHand();e.currentTarget.style.cursor="grab";
      if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
      persistAdventure();return;
    }
    if(strokePointerRef.current!==e.pointerId)return;
    e.preventDefault();strokePointerRef.current=null;audioRef.current?.endPencil();lastPencilRef.current=null;
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    if(latestRef.current.paused||latestRef.current.panel){resetPlayerStroke(worldRef.current);return;}
    const l=PLATFORM_LEVELS[latestRef.current.levelIndex];
    const point=snapStrokeEnd(pointerPoint(e));
    const stroke=worldRef.current.activeDrawing?.path;
    // A tap may simply reveal the drawing tools; it is not a failed bridge.
    if(stroke&&stroke.length<2&&Math.hypot(point.x-stroke[0].x,point.y-stroke[0].y)<anchorRadius()){
      resetPlayerStroke(worldRef.current);setDrawingError(false);setTip("Maintiens le doigt sur A ou B, puis trace jusqu’à l’autre point.");return;
    }
    appendPlayerStroke(worldRef.current,l,point);
    const result=finishPlayerStroke(worldRef.current,l);
    setDrawingError(!result.ok);setTip(result.message);
    if(result.ok){companionEventsRef.current.push("draw-complete");persistAdventure();}
    setView(snapshot(worldRef.current,l));focusGame();
  };
  const interruptedStroke=(e:React.PointerEvent<HTMLCanvasElement>)=>{
    if(mechanismPointerRef.current===e.pointerId){releaseHand();persistAdventure();}
    if(strokePointerRef.current!==e.pointerId)return;
    strokePointerRef.current=null;resetPlayerStroke(worldRef.current);handRef.current?.clear();audioRef.current?.endPencil();
    setDrawingError(true);setTip("Trait interrompu. Repars d’un des deux points.");
  };
  const fullscreen=async()=>{
    unlock();
    try{
      if(document.fullscreenElement){await document.exitFullscreen();setFullScreen(false);}
      else if(stageRef.current?.requestFullscreen){await stageRef.current.requestFullscreen();setFullScreen(true);}
      else setFullScreen(v=>!v);
    }catch{setFullScreen(v=>!v);}
  };
  useEffect(()=>{
    const change=()=>setFullScreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange",change);return()=>document.removeEventListener("fullscreenchange",change);
  },[]);

  const frozen=paused||!!panel;
  return <main className="app-shell platform-app">
    <header className="site-header">
      <a href="#" className="brand" onClick={e=>{e.preventDefault();setPanel("levels");}} aria-label="Un seul trait — choisir un niveau"><span className="brand-mark"><BrandMark/></span><span>un seul trait<span className="brand-period">.</span></span></a>
      <nav aria-label="Navigation du jeu"><button className="nav-link active" onClick={()=>{setPanel(null);canvasRef.current?.focus();}}>Jouer<span className="nav-dot"/></button><button className="nav-link" onClick={()=>setPanel("levels")}>Les niveaux <span className="nav-count">{PLATFORM_LEVELS.length}</span></button><button className="nav-link desktop-only" onClick={()=>setPanel("controls")}>Commandes</button></nav>
      <div className="header-right"><span className="platform-edition">AVENTURE</span><button className="icon-button header-keys" onClick={()=>setPanel("controls")} aria-label="Configurer les touches"><Keyboard size={19}/></button><button className="icon-button" onClick={()=>{unlock();setMuted(v=>!v);}} aria-label={muted?"Activer le son":"Couper le son"}>{muted?<VolumeX size={19}/>:<Volume2 size={19}/>}</button></div>
    </header>
    <div className="game-wrap">
      <section className="scene-heading" aria-label="Niveau actuel">
        <div className="scene-title"><span className="chapter">NIVEAU <strong>{String(levelIndex+1).padStart(2,"0")}</strong><span>/ {String(PLATFORM_LEVELS.length).padStart(2,"0")}</span></span><div className="heading-divider"/><h1>{level.title}</h1></div>
        <button className="progress-summary" onClick={()=>setPanel("levels")} aria-label={completed+" niveaux terminés, "+totalStars+" étoiles. Choisir un niveau."}><span className="progress-dots">{scores.map((s,i)=><i key={i} className={s.done?"done":i===levelIndex?"current":""}/>)}</span><span><b>{completed}</b> / {PLATFORM_LEVELS.length} niveaux</span><List size={18}/></button>
      </section>
      <section ref={stageRef} className={"game-section platform-section"+(fullScreen?" expanded":"")+(cinema?" cinema-mode":"")} style={{"--scene-bg":palette.background} as React.CSSProperties} aria-label="Aventure dessinée Un seul trait">
        <div className="stage platform-stage">
          <canvas ref={canvasRef} className={view.phase==="drawing"?"player-drawing":""} tabIndex={0} role="application" aria-label={"Niveau "+(levelIndex+1)+", "+level.title+". "+bindingText("left")+" et "+bindingText("right")+" pour marcher. "+bindingText("crouch")+" pour te baisser. Trace directement de A à B à la souris ou au doigt. "+bindingText("interact")+" pour manipuler une poignée."} onPointerDown={startStroke} onPointerMove={moveStroke} onPointerUp={finishStroke} onPointerCancel={interruptedStroke} onLostPointerCapture={interruptedStroke} onPointerLeave={()=>{if(strokePointerRef.current===null&&mechanismPointerRef.current===null){pointerRef.current=null;pointerClientRef.current=null;}}}/>
          {!ready&&<div className="canvas-loading">Le niveau se dessine…</div>}
          <div className="platform-hud">
            <div className="platform-hud-left"><span className="status-pill"><i/>{paused?"PAUSE":view.phase==="drawing"?"À TOI DE DESSINER":view.phase==="dead"?"TOUCHÉ":view.phase==="won"?"BIEN ARRIVÉ":view.handling?"UN COUP DE MAIN":"EN ROUTE"}</span><span className="death-count" aria-label={view.deaths+" morts"}><Skull size={15}/>{view.deaths}</span></div>
            <div className="stage-stars" aria-label={view.stars+" étoiles sur 3"}>{[0,1,2].map(i=><Star key={i} size={19} fill={i<view.stars?"currentColor":"none"} className={i<view.stars?"collected":""}/>)}</div>
          </div>
          <div className="journey-track" aria-label={"Progression "+view.percent+" pour cent"}><span style={{width:view.percent+"%"}}/></div>
          {available&&view.phase==="playing"&&!paused&&<div className="hand-callout"><Pencil size={17}/><span>{view.redrawing?"Redessine de A à B":"Trace de A à B"}</span></div>}
          {mechanism&&!available&&view.phase==="playing"&&!paused&&<div className="hand-callout mechanism-callout"><Hand size={17}/><span>{view.handling?"Déplace la poignée, puis traverse":mechanism.title}</span><kbd>{keyLabel(bindings.interact[0]??bindings.interact[1])}</kbd></div>}
          {view.phase==="drawing"&&!paused&&<div className="player-drawing-tools"><div><Pencil size={18}/><span>Relie les points A et B<small>Maintiens le clic ou le doigt. Relâche pour valider.</small></span></div><div className="drawing-tool-actions"><button onClick={clearDrawing} disabled={!view.hasStroke} aria-label="Effacer le trait"><RotateCcw size={16}/><span>Effacer</span></button><button onClick={cancelDrawing} aria-label="Annuler le dessin"><X size={16}/><span>Annuler</span></button></div></div>}
          {view.phase==="dead"&&<div className="death-caption" role="status">Aïe !<span>Retour au point de contrôle…</span></div>}
          <div className="platform-stage-actions"><button className="stage-settings-button" onClick={()=>setPanel("settings")} aria-label="Réglages du jeu"><Settings2 size={17}/></button><button className="stage-retry-button" onClick={retry} aria-label="Revenir au drapeau"><RotateCcw size={17}/></button><button className="stage-cinema-button" onClick={()=>setCinema(v=>!v)} aria-label={cinema?"Afficher les indications":"Mode cinéma"} aria-pressed={cinema}><span className="cinema-icon"/></button><button onClick={togglePause} aria-label={paused?"Reprendre":"Mettre en pause"}>{paused?<Play size={17}/>:<Pause size={17}/>}</button><button onClick={fullscreen} aria-label={fullScreen?"Quitter le plein écran":"Plein écran"}><Expand size={17}/></button></div>
          {paused&&<div className="pause-layer"><div className="pause-actions"><button onClick={togglePause} className="pause-resume"><Play size={24} fill="currentColor"/><span>Reprendre</span></button><button className="pause-secondary" onClick={()=>startLevel(levelIndex,true)}><RotateCcw size={15}/>Recommencer le chapitre</button><button className="pause-secondary" onClick={()=>setPanel("help")}><HelpCircle size={15}/>Comment jouer</button></div></div>}
          {view.phase==="won"&&<div className="win-layer"><div className="win-card"><span className="eyebrow">NIVEAU TERMINÉ</span><div className="win-stars" aria-label={view.stars+" étoiles sur 3"}>{[0,1,2].map(i=><Star key={i} size={38} fill={i<view.stars?"currentColor":"none"} className={i<view.stars?"earned":""}/>)}</div><h2>{levelIndex===PLATFORM_LEVELS.length-1?"Le dernier trait.":"Bien arrivé !"}</h2><p>{view.deaths===0?"Traversée sans une égratignure.":view.deaths+" "+(view.deaths===1?"chute.":"chutes.")+" Vous avez trouvé le chemin."}</p><div className="win-cooperation"><Pencil size={15}/><span>{view.drawn} passages dessinés</span><Hand size={15}/><span>{view.solved} mécanismes en place</span></div><div className="win-buttons"><button className="quiet-button" onClick={()=>startLevel(levelIndex,true)}><RotateCcw size={17}/>Rejouer</button><button className="primary-button" onClick={()=>levelIndex<PLATFORM_LEVELS.length-1?startLevel(levelIndex+1):setPanel("levels")}>{levelIndex<PLATFORM_LEVELS.length-1?"Niveau suivant":"Les niveaux"}<ArrowRight size={18}/></button></div></div></div>}
        </div>
        <div className="platform-dock">
          <div className="movement-controls">
            <span className="control-caption">SE DÉPLACER</span>
            <div className="direction-buttons">{(["left","right"] as const).map(d=><button key={d} className="direction-button" aria-label={d==="left"?"Aller à gauche":"Aller à droite"} disabled={frozen||view.phase!=="playing"} onPointerDown={e=>hold(d,e)} onPointerUp={()=>release(d)} onPointerCancel={()=>release(d)} onLostPointerCapture={()=>release(d)}>{d==="left"?<ArrowLeft size={22}/>:<ArrowRight size={22}/>}</button>)}</div>
          </div>
          <button className={"crouch-button"+(view.crouching?" is-active":"")} aria-pressed={view.crouching} disabled={frozen||view.phase!=="playing"} onPointerDown={e=>hold("crouch",e)} onPointerUp={()=>release("crouch")} onPointerCancel={()=>release("crouch")} onLostPointerCapture={()=>release("crouch")} onClick={e=>{if(e.detail===0){unlock();focusGame();touchDirectionsRef.current.crouch=!touchDirectionsRef.current.crouch;syncHeldControls();}}}><ArrowDown size={21}/><span>Se baisser<small>{bindingText("crouch")} · maintenir</small></span></button>
          <div className="platform-dock-divider"/>
          <button className={"hand-button"+(available||view.phase==="drawing"?" is-available":"")+(view.phase==="drawing"?" is-cancel":"")} disabled={frozen||(!available&&view.phase!=="drawing")} onClick={view.phase==="drawing"?cancelDrawing:callHand}><Pencil size={22}/><span>{view.phase==="drawing"?"Annuler":view.redrawing?"Redessiner":"Dessiner un passage"}<small>{bindingText("draw")+" · "+(view.phase==="drawing"?"ANNULER":available?"À LA SOURIS OU AU DOIGT":"PRÈS D’UN PASSAGE")}</small></span><ChevronRight size={17}/></button>
          <button className={"manipulate-button"+(mechanism?" is-available":"")} disabled={frozen||view.phase!=="playing"||!mechanism} onClick={manipulate}><Hand size={21}/><span>Manipuler<small>{bindingText("interact")}</small></span></button>
          <div className="platform-utility"><button className="icon-button" aria-label="Revenir au point de contrôle" title={"Revenir au point de contrôle ("+bindingText("restart")+")"} onClick={retry}><RotateCcw size={18}/></button><button className="icon-button" aria-label="Configurer les touches" onClick={()=>setPanel("controls")}><Keyboard size={20}/></button></div>
        </div>
      </section>
      <div className={"feedback-row"+(drawingError?" error":"")}><p role="status" aria-live="polite">{view.phase==="drawing"||available?<Pencil size={16}/>:<Flag size={16}/>}<span>{available&&view.phase==="playing"?(view.redrawing?"Tu peux redessiner ce passage si besoin.":"Pose le doigt ou la souris sur A ou B, puis trace ton passage."):mechanism&&view.phase==="playing"?mechanism.prompt:tip}</span></p><button className="settings-button" onClick={()=>setPanel("settings")} aria-label="Réglages"><Settings2 size={16}/><span>Réglages</span></button></div>
      <footer className="site-footer"><span>D’après <a href="https://www.youtube.com/watch?v=8IHHHXIzDpA" target="_blank" rel="noreferrer">La Linea</a> d’Osvaldo Cavandoli.</span><span>{storageOk?"Aventure et commandes sauvegardées dans ce navigateur.":"Progression conservée pour cette session."}</span></footer>
    </div>
    <dialog ref={dialogRef} className={"game-dialog"+(panel==="levels"?" levels-dialog":"")} aria-labelledby="dialog-title" onCancel={()=>setPanel(null)} onClick={e=>{if(e.target===e.currentTarget)setPanel(null);}}>
      <div className="dialog-inner"><div className="dialog-top"><span className="eyebrow">UN SEUL TRAIT</span><button className="icon-button" aria-label="Fermer" onClick={()=>setPanel(null)}><X size={21}/></button></div>
      {panel==="levels"&&<><h2 id="dialog-title">Les niveaux<span>.</span></h2><p className="dialog-intro">Six chapitres : passages à dessiner, mécanismes à déplacer et chemins à découvrir. Choisis un chapitre pour continuer ; Rejouer recommence le parcours.</p><div className="notebook-summary"><span><Check size={16}/>{completed} / {PLATFORM_LEVELS.length} terminés</span><span><Star size={17}/>{totalStars} / {PLATFORM_LEVELS.length*3} étoiles</span></div><div className="level-grid">{PLATFORM_LEVELS.map((l,i)=><button className={"level-card"+(i===levelIndex?" current":"")} key={l.id} onClick={()=>startLevel(i)} aria-label={"Niveau "+(i+1)+", "+l.title}><div className="level-preview" style={{background:PLATFORM_PALETTES[l.palette].background}}><LevelThumbnail index={i}/><span>{String(i+1).padStart(2,"0")}</span>{scores[i]?.done&&<i><Check size={13}/></i>}</div><div className="level-info"><strong>{l.title}</strong><small className="level-mechanics">{l.drawings.length} traits · {l.mechanisms?.length??0} mécanismes</small><span className="mini-stars">{[0,1,2].map(s=><Star key={s} size={12} fill={scores[i]?.stars>s?"currentColor":"none"}/>)}</span></div></button>)}</div></>}
      {panel==="help"&&<><h2 id="dialog-title">À toi de jouer<span>.</span></h2><p className="dialog-intro">Vous avancez à deux : lui sur la ligne, toi avec le crayon et la main.</p><div className="help-steps"><div><span>01</span><section><h3>Marche et baisse-toi.</h3><p>{bindingText("left")} et {bindingText("right")} pour marcher ; {bindingText("crouch")} pour te baisser. Sur mobile, utilise les boutons sous le jeu.</p></section></div><div><span>02</span><section><h3>Dessine ton passage.</h3><p>Approche d’un passage : A et B apparaissent. Pose le doigt ou la souris sur l’un des points, puis trace jusqu’à l’autre. La main suit ton geste. Relâche pour traverser. Tu peux redessiner ensuite ; {bindingText("draw")} reste un raccourci facultatif.</p></section></div><div><span>03</span><section><h3>Donne-lui un coup de main.</h3><p>Attrape une poignée dorée et déplace-la le long de son rail : plateforme, porte ou roue. Tu peux marcher et te baisser pendant la manipulation. Au clavier ou sur mobile, {bindingText("interact")} ou Manipuler déplace le mécanisme voisin jusqu’à l’autre extrémité.</p></section></div></div><div className="help-companion-note"><Hand size={18}/><p>Le personnage regarde ce qui manque, réclame ton aide et réagit quand tu touches sa tête. Baisse-toi sous les obstacles suspendus. Les étoiles se ramassent le long du chemin. Une chute te ramène au dernier drapeau avec tes dessins.</p></div><div className="keyboard-help"><h3>Raccourcis</h3><p><kbd>{bindingText("crouch")}</kbd> Se baisser <kbd>{bindingText("draw")}</kbd> Dessiner</p><p><kbd>{bindingText("interact")}</kbd> Manipuler</p><p><kbd>{bindingText("pause")}</kbd> Pause <kbd>{bindingText("restart")}</kbd> Point de contrôle</p><button className="configure-controls-link" onClick={()=>setPanel("controls")}><Keyboard size={17}/>Configurer mes touches</button></div><button className="primary-button help-close" onClick={()=>setPanel(null)}>Jouer<ArrowRight size={18}/></button></>}
      {panel==="controls"&&<><h2 id="dialog-title">Les commandes<span>.</span></h2><p className="dialog-intro">Deux touches au choix par action. Clique sur une case, puis appuie sur la touche voulue.</p><ControlsConfig bindings={bindings} onChange={next=>{clearInput();setBindings(next);}}/><div className="controls-dialog-actions"><button className="quiet-button" onClick={()=>setPanel("help")}><HelpCircle size={17}/>Comment jouer</button><button className="primary-button" onClick={()=>{setPanel(null);focusGame();}}>Retour au jeu<ArrowRight size={18}/></button></div></>}
      {panel==="settings"&&<><h2 id="dialog-title">Les réglages<span>.</span></h2><p className="dialog-intro">Image, réactions et confort de jeu.</p><button className="configure-controls-link" onClick={()=>setPanel("controls")}><Keyboard size={18}/>Configurer les touches<ChevronRight size={17}/></button><div className="setting-row"><div><h3>Voix et bruitages</h3><p>Courts extraits du dessin animé et sons du jeu.</p></div><button className={"toggle"+(!muted?" on":"")} role="switch" aria-checked={!muted} aria-label="Voix et bruitages" onClick={()=>{unlock();setMuted(v=>!v);}}><span/></button></div><div className="voice-choice" role="group" aria-label="Type de voix"><button aria-pressed={voiceMode==="original"} onClick={()=>{unlock();setVoiceMode("original");}}>Extraits originaux</button><button aria-pressed={voiceMode==="grammelot"} onClick={()=>{unlock();setVoiceMode("grammelot");}}>Grammelot synthétique</button><button aria-pressed={voiceMode==="italian"} onClick={()=>{unlock();setVoiceMode("italian");}}>Italien synthétique</button></div><div className="setting-row"><div><h3>Mode cinéma</h3><p>Masque le compteur et les indications pendant la traversée.</p></div><button className={"toggle"+(cinema?" on":"")} role="switch" aria-checked={cinema} aria-label="Mode cinéma" onClick={()=>setCinema(v=>!v)}><span/></button></div><div className="setting-row"><div><h3>Éclaboussures rouges</h3><p>Désactive pour retrouver des particules blanches.</p></div><button className={"toggle"+(blood?" on":"")} role="switch" aria-checked={blood} aria-label="Éclaboussures rouges" onClick={()=>setBlood(v=>!v)}><span/></button></div><div className="setting-volume"><label htmlFor="volume">Volume <b>{volume}%</b></label><input id="volume" type="range" min="0" max="100" value={volume} onChange={e=>setVolume(Number(e.target.value))} onPointerUp={()=>{unlock();audioRef.current?.play("star");}}/></div><div className="setting-note"><Check size={17}/><p>Tes dessins, étoiles, mécanismes et commandes sont sauvegardés. En revenant, tu reprends au dernier drapeau. Clique sur Rejouer après une victoire pour repartir de zéro dans ce chapitre.</p></div><button className="primary-button help-close" onClick={()=>setPanel(null)}>Retour au jeu<ArrowRight size={18}/></button></>}
      </div>
    </dialog>
  </main>;
}
