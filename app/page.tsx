"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {ArrowLeft,ArrowRight,ArrowDown,ArrowUp,ChevronRight,Expand,Flag,Hand,HelpCircle,Keyboard,Lightbulb,List,Menu,Pause,Pencil,Play,RotateCcw,Settings2,Skull,Star,Volume2,VolumeX,X} from "lucide-react";
import {PLATFORM_LEVELS} from "../lib/trait/platform-levels";
import {appendPlayerStroke,beginPlayerStroke,cancelPlayerDrawing,createWorld,finishPlayerStroke,getAvailableDrawing,getDrawingPlan,getDrawingChoice,selectDrawingChoice,undoPlayerStroke,resetPlayerStroke,restartAtCheckpoint,updateWorld,beginMechanismInteraction,moveMechanismInteraction,endMechanismInteraction,getAvailableMechanism,getMechanismHandlePosition,getMechanismPositions,getMechanismInterlock,getGoalInterlock,type GameEvent,type PlatformInput,type PlatformPoint,type PlatformLevel} from "../lib/trait/platformer";
import {strokeLength} from "../lib/trait/platform-drawing";
import {inspectPlayerRoute} from "../lib/trait/route-planning";
import {DrawingPalette} from "../components/trait/drawing-palette";
import {drawPlatformScene,drawPassageAnchors,PLATFORM_PALETTES} from "../lib/trait/platform-renderer";
import {GameAudio} from "../lib/trait/audio";
import {DrawingHand} from "../lib/trait/hand";
import {createCamera,updateCamera} from "../lib/trait/camera";
import {createAmbientState,updateAmbient,drawAmbient} from "../lib/trait/ambient-life";
import {actionForKey,keyLabel,normalizeKey,sanitizeBindings,type ActionId,type KeyBindings} from "../lib/trait/controls";
import {ControlsConfig} from "../components/trait/controls-config";
import {createCompanionState,updateCompanion} from "../lib/trait/companion";
import {ADVENTURE_SAVE_KEY,readAdventure,restoreProgress,saveProgress,type SavedProgress} from "../lib/trait/progress";
import {createCampaignRun,readRunStats,readChapterScores,recordChapterCompletion,isChapterUnlocked,type ChapterScore} from "../lib/trait/campaign";
import {ChapterNotebook,PuzzleNotebook,RunChallenges} from "../components/trait/campaign-notebook";

type Panel="menu"|"levels"|"help"|"settings"|"controls"|"clues"|null;
type Score=ChapterScore;
const SAVE_KEY="un-seul-trait-platformer-v1";
const emptyScores=()=>readChapterScores(null,PLATFORM_LEVELS);
const emptyInput=():PlatformInput=>({left:false,right:false,crouch:false,draw:false});
const initialWorld=createWorld(PLATFORM_LEVELS[0]);
const puzzleAt=(level:PlatformLevel,x:number)=>level.puzzles?.find(p=>x>=p.fromX-90&&x<=p.toX+90)??null;
type View={phase:typeof initialWorld.phase;stars:number;deaths:number;checkpoint:number;drawn:number;available:string|null;percent:number;editing:string|null;hasStroke:boolean;redrawing:boolean;mechanism:string|null;handling:boolean;solved:number;crouching:boolean;choiceId:string|null;stroking:boolean;inkPercent:number|null;reading:string;puzzle:string|null;lockMessage:string;goalMessage:string;goalPuzzle:string|null};
const snapshot=(world:typeof initialWorld,level:typeof PLATFORM_LEVELS[number]):View=>{
  const source=level.drawings.find(d=>d.id===world.activeDrawing?.id)??getAvailableDrawing(world,level);
  const plan=source?getDrawingPlan(world,source):null;
  const route=world.activeDrawing?.path??(source?world.constructions[source.id]:null);
  const reading=route?.length?inspectPlayerRoute(world,level,route):null;
  const nearby=getAvailableMechanism(world,level);
  const interlock=nearby?getMechanismInterlock(world,level,nearby):null;
  const goalLock=getGoalInterlock(world,level);
  const missingContact=goalLock.items.find(item=>!item.satisfied);
  const requirement=missingContact?.requirement;
  const missingMachine=requirement&&'mechanismId' in requirement?level.mechanisms?.find(item=>item.id===requirement.mechanismId):null;
  return {
  phase:world.phase,stars:world.collected.length,deaths:world.deaths,checkpoint:world.checkpointIndex,
  drawn:world.drawn.length,available:getAvailableDrawing(world,level)?.id??null,
  percent:Math.max(0,Math.min(100,Math.round(world.player.x/level.goal.x*100))),
  editing:world.activeDrawing?.id??null,hasStroke:(world.activeDrawing?.path.length??0)>1,
  redrawing:world.drawn.includes(getAvailableDrawing(world,level)?.id??""),
  mechanism:getAvailableMechanism(world,level)?.id??null,handling:!!world.handInteraction,
  solved:(level.mechanisms??[]).filter(m=>Math.abs((world.mechanisms[m.id]?.progress??0)-(m.initialProgress??0))>.05).length,crouching:world.player.crouching,
  choiceId:source?getDrawingChoice(world,source)?.id??null:null,stroking:!!world.activeDrawing?.started,
  inkPercent:plan?.inkLimit?Math.round(strokeLength(world.activeDrawing?.path??[])/plan.inkLimit*100):null,
  reading:reading&&(world.activeDrawing||reading.kind!=='clear')?reading.message:'',
  puzzle:puzzleAt(level,world.player.x)?.id??null,
  lockMessage:interlock?.locked?interlock.message:'',
  goalMessage:goalLock.locked&&Math.abs(world.player.x-level.goal.x)<210?`La sortie attend encore : ${missingContact?.label??goalLock.message}.`:'',
  goalPuzzle:missingMachine?puzzleAt(level,missingMachine.from.x)?.id??null:null,
};};

function BrandMark(){
  return <svg viewBox="0 0 64 44" fill="none" aria-hidden="true"><path d="M1 36h21l-1-10 2-11c-1-7 9-12 15-9 6 4-2 7-7 6l6 3-6 3 2 9-2 9h32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
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
  const [showGuide,setShowGuide]=useState(false);
  const [revealedHints,setRevealedHints]=useState<Record<string,number>>({});
  const [ready,setReady]=useState(false);
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const stageRef=useRef<HTMLElement>(null);
  const dialogRef=useRef<HTMLDialogElement>(null);
  const worldRef=useRef(createWorld(PLATFORM_LEVELS[0]));
  const controlsRef=useRef<PlatformInput>(emptyInput());
  const audioRef=useRef<GameAudio|null>(null);
  const handRef=useRef<DrawingHand|null>(null);
  const cameraRef=useRef(createCamera());
  const bindingsRef=useRef(bindings);bindingsRef.current=bindings;
  const pressedKeysRef=useRef(new Map<string,string>());
  const touchDirectionsRef=useRef({left:false,right:false,crouch:false});
  const strokePointerRef=useRef<number|null>(null);
  const mechanismPointerRef=useRef<number|null>(null);
  const pointerRef=useRef<PlatformPoint|null>(null);
  const pointerClientRef=useRef<{clientX:number;clientY:number}|null>(null);
  const companionRef=useRef(createCompanionState(worldRef.current));
  const [initialAmbient]=useState(()=>createAmbientState(PLATFORM_LEVELS[0]));
  const ambientRef=useRef(initialAmbient);
  const ambientTouchRef=useRef(false);
  const touchCompanionRef=useRef(false);
  const tapRef=useRef<{point:PlatformPoint;remaining:number}|null>(null);
  const companionEventsRef=useRef<GameEvent[]>([]);
  const lastSpeechRef=useRef(-1);
  const lastPencilRef=useRef<{point:PlatformPoint;at:number}|null>(null);
  const progressRef=useRef<Record<string,SavedProgress>>({});
  const runRef=useRef(createCampaignRun());
  const scoresRef=useRef(scores);scoresRef.current=scores;
  const saveReadyRef=useRef(false);
  const frameViewRef=useRef({scale:1,offsetY:0,cameraX:0});
  const latestRef=useRef({levelIndex,paused,panel,reducedMotion,cinema,blood,showGuide});
  latestRef.current={levelIndex,paused,panel,reducedMotion,cinema,blood,showGuide};
  const level=PLATFORM_LEVELS[levelIndex],palette=PLATFORM_PALETTES[level.palette];
  const available=level.drawings.find(d=>d.id===view.available);
  const editing=level.drawings.find(d=>d.id===view.editing);
  const planning=editing??available;
  const mechanism=level.mechanisms?.find(m=>m.id===view.mechanism);
  const puzzle=level.puzzles?.find(p=>p.id===view.puzzle)??null;
  const clueScene=(view.goalMessage?level.puzzles?.find(p=>p.id===view.goalPuzzle):null)??puzzle??level.puzzles?.find(p=>p.toX>=worldRef.current.player.x)??level.puzzles?.at(-1)??null;
  const clueKey=`${level.id}:${clueScene?.id??'scene'}`;
  const completed=scores.filter(s=>s.done).length;
  const bindingText=(action:ActionId)=>bindings[action].filter((key):key is string=>key!==null).map(keyLabel).join(" / ");
  const focusGame=()=>canvasRef.current?.focus({preventScroll:true});

  const unlock=useCallback(()=>{
    if(!audioRef.current)audioRef.current=new GameAudio();
    audioRef.current.unlock();
  },[]);
  const clearInput=useCallback(()=>{
    controlsRef.current=emptyInput();pressedKeysRef.current.clear();touchDirectionsRef.current={left:false,right:false,crouch:false};
    ambientTouchRef.current=false;
  },[]);
  const persistAdventure=useCallback(()=>{
    if(!saveReadyRef.current)return;
    const w=worldRef.current,l=PLATFORM_LEVELS[latestRef.current.levelIndex];
    progressRef.current[String(l.id)]=saveProgress(w,l,runRef.current);
    try{localStorage.setItem(ADVENTURE_SAVE_KEY,JSON.stringify(progressRef.current));}
    catch{setStorageOk(false);}
  },[]);
  const releaseHand=useCallback((silent=false)=>{
    const stroke=strokePointerRef.current,mechanism=mechanismPointerRef.current;
    strokePointerRef.current=null;mechanismPointerRef.current=null;
    endMechanismInteraction(worldRef.current);
    if(silent){
      // A cancelled pointer during pause, blur or rotation is not a new
      // completed gesture to thank the player for when the scene resumes.
      for(const state of Object.values(worldRef.current.mechanisms))delete state.pendingSettle;
      companionRef.current.heldId=null;companionRef.current.heldFrom=0;
    }
    if(stroke!==null){if(worldRef.current.activeDrawing)worldRef.current.activeDrawing.started=false;handRef.current?.clear();}
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
  const choosePosture=useCallback((crouching:boolean)=>{
    touchDirectionsRef.current.crouch=crouching;
    // An explicit ↑ also releases a previous touch latch or held-down request.
    // The physics engine still keeps the body low when the head is obstructed.
    if(!crouching)for(const [code,key] of pressedKeysRef.current){
      if(actionForKey(key,bindingsRef.current)==="crouch")pressedKeysRef.current.delete(code);
    }
    syncHeldControls();
  },[syncHeldControls]);
  const startLevel=useCallback((index:number,fresh=false)=>{
    persistAdventure();
    let bounded=Math.max(0,Math.min(PLATFORM_LEVELS.length-1,index));
    if(!isChapterUnlocked(bounded,PLATFORM_LEVELS,scoresRef.current,progressRef.current))bounded=6;
    audioRef.current?.hush();handRef.current?.clear();clearInput();releaseHand();pointerRef.current=null;pointerClientRef.current=null;
    const savedChapter=progressRef.current[String(PLATFORM_LEVELS[bounded].id)];
    const resumed=fresh?null:restoreProgress(savedChapter,PLATFORM_LEVELS[bounded]);
    runRef.current=resumed?readRunStats(savedChapter):createCampaignRun();
    setShowGuide(false);
    if(fresh)setRevealedHints(old=>Object.fromEntries(Object.entries(old).filter(([key])=>!key.startsWith(`${PLATFORM_LEVELS[bounded].id}:`))));
    worldRef.current=resumed??createWorld(PLATFORM_LEVELS[bounded]);cameraRef.current=createCamera();
    ambientRef.current=createAmbientState(PLATFORM_LEVELS[bounded]);
    companionRef.current=createCompanionState(worldRef.current);companionEventsRef.current=[];lastSpeechRef.current=-1;
    latestRef.current.levelIndex=bounded;
    setLevelIndex(bounded);setView(snapshot(worldRef.current,PLATFORM_LEVELS[bounded]));
    setPaused(false);setPanel(null);
    setDrawingError(false);setTip(resumed?"Aventure reprise au dernier drapeau. Tes dessins et tes mécanismes sont conservés.":bounded>=6?PLATFORM_LEVELS[bounded].subtitle:"Marche sur la ligne, baisse-toi et dessine les passages. Les poignées dorées permettent de déplacer le décor.");
    if(fresh)delete progressRef.current[String(PLATFORM_LEVELS[bounded].id)];
  },[clearInput,releaseHand,persistAdventure]);
  const retry=useCallback(()=>{
    audioRef.current?.hush();handRef.current?.clear();clearInput();releaseHand();strokePointerRef.current=null;setDrawingError(false);
    const l=PLATFORM_LEVELS[latestRef.current.levelIndex];
    runRef.current.checkpointReturns++;
    restartAtCheckpoint(worldRef.current,l);
    cameraRef.current=createCamera();
    ambientRef.current=createAmbientState(l);
    setView(snapshot(worldRef.current,l));setPaused(false);setTip("C’est reparti depuis le point de contrôle.");
    canvasRef.current?.focus({preventScroll:true});
    companionRef.current=createCompanionState(worldRef.current);persistAdventure();
  },[clearInput,releaseHand,persistAdventure]);
  const togglePause=useCallback(()=>{
    clearInput();releaseHand(true);audioRef.current?.hush();persistAdventure();setPaused(v=>!v);
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
        const restoredScores=readChapterScores(saved.scores,PLATFORM_LEVELS);
        scoresRef.current=restoredScores;setScores(restoredScores);
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
    if(panel){clearInput();releaseHand(true);persistAdventure();audioRef.current?.hush();if(dialog&&!dialog.open)dialog.showModal();}
    else {if(dialog?.open)dialog.close();canvasRef.current?.focus({preventScroll:true});}
  },[panel,clearInput,releaseHand,persistAdventure]);

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");if(!ctx)return;
    let frame=0,last=0,lastSnapshot="",lastStep=0,lastProgressAt=0;
    let width=1100,height=600,dpr=1;
    const resize=()=>{
      const rect=canvas.getBoundingClientRect();
      if(Math.abs(width-rect.width)>.5||Math.abs(height-rect.height)>.5){
        // Rotation changes the mapping under a finger. Keep the last valid bridge,
        // and let the player resume the unfinished stroke in the new viewport.
        if(strokePointerRef.current!==null){
          releaseHand(true);
          setDrawingError(false);setTip("Écran tourné : le trait est conservé. Reprends sur son extrémité dorée.");
        }
        if(mechanismPointerRef.current!==null)releaseHand(true);
      }
      width=Math.max(1,rect.width);height=Math.max(1,rect.height);
      dpr=Math.min(window.devicePixelRatio||1,2);
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    };
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();setReady(true);
    const event=(kind:GameEvent)=>{
      const w=worldRef.current;
      if(kind==="land")audioRef.current?.play("step");
      if(kind==="star")audioRef.current?.play("star");
      if(kind==="draw-start"){clearInput();setDrawingError(false);audioRef.current?.speak("waiting");setTip("Relie A et B. Tu peux lever le doigt puis reprendre au bout du trait.");}
      if(kind==="draw-complete"){audioRef.current?.play("ready");setTip("Le passage est prêt. À toi de traverser !");}
      if(kind==="death"){audioRef.current?.hush();audioRef.current?.speak("grumble");setTip("Touché ! Retour au dernier point de contrôle.");}
      if(kind==="respawn"){cameraRef.current=createCamera();setTip("C’est reparti. Tes passages dessinés et tes étoiles sont conservés.");}
      if(kind==="checkpoint"){audioRef.current?.play("ready");setTip("Point de contrôle atteint.");}
      if(kind==="mechanism-start"){
        const mechanism=laterMechanism();
        setTip(mechanism?.prompt??"Déplace la poignée dorée. Tu peux continuer à marcher et te baisser.");
        audioRef.current?.play("click");
      }
      if(kind==="mechanism-settle"){audioRef.current?.play("mechanism-ready");setTip(PLATFORM_LEVELS[latestRef.current.levelIndex].puzzles?.length?"Position conservée. Observe les liaisons et essaie le passage.":"En place. À vous deux de poursuivre le chemin.");}
      if(kind==="win"){
        audioRef.current?.play("win");clearInput();
        setTip("Niveau terminé !");
        const index=latestRef.current.levelIndex,chapter=PLATFORM_LEVELS[index];
        setScores(old=>old.map((score,i)=>i===index?recordChapterCompletion(score,w,chapter,runRef.current):score));
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
        // Physics substeps stay small; drawing requests are consumed only once.
        const steps=Math.max(1,Math.ceil(dt/.05));
        for(let i=0;i<steps;i++){
          updateWorld(w,l,controlsRef.current,dt/steps).forEach(kind=>events.add(kind));
          controlsRef.current.draw=false;
        }
        events.forEach(event);
        const step=Math.floor(w.player.travel/29.6);
        if(w.player.grounded&&Math.abs(w.player.vx)>15&&step!==lastStep)audioRef.current?.play("step");
        lastStep=step;
        if(now-lastProgressAt>3000){lastProgressAt=now;persistAdventure();}
      }
      const handling=w.handInteraction?l.mechanisms?.find(m=>m.id===w.handInteraction?.id):null;
      const pointerHeld=mechanismPointerRef.current!==null||strokePointerRef.current!==null;
      const {scale,offsetY,cameraX}=updateCamera(cameraRef.current,w,l,{
        width,height,dt,locked:pointerHeld,frozen,reducedMotion:current.reducedMotion,
      });
      const viewWidth=width/scale;
      frameViewRef.current={scale,offsetY,cameraX};
      if(pointerClientRef.current){
        const rect=canvas.getBoundingClientRect(),p=pointerClientRef.current;
        pointerRef.current={x:(p.clientX-rect.left)/scale+cameraX,y:(p.clientY-rect.top-offsetY)/scale};
      }
      const companion=updateCompanion(companionRef.current,w,l,frozen?0:dt,{pointer:pointerRef.current,events:[...events],touched:touchCompanionRef.current});
      touchCompanionRef.current=false;
      const ambientViewport={cameraX,viewWidth,top:-offsetY/scale,bottom:(height-offsetY)/scale,pixelScale:scale};
      updateAmbient(ambientRef.current,w,l,frozen?0:dt,{pointer:pointerRef.current,touched:ambientTouchRef.current,reducedMotion:current.reducedMotion,viewport:ambientViewport});
      ambientTouchRef.current=false;
      audioRef.current?.updateFoley({
        levelId:l.id,dt:frozen?0:dt,active:!frozen,reducedMotion:current.reducedMotion,
        viewport:{cameraX,viewWidth,top:ambientViewport.top,height:height/scale},
        listener:{x:w.player.x,y:w.player.y-40},birds:ambientRef.current.birds,
        mechanisms:getMechanismPositions(w,l).map(m=>({id:m.mechanism.id,type:m.mechanism.type,x:m.position.x,y:m.position.y,progress:m.progress})),
      });
      if(companion.sequence!==lastSpeechRef.current){
        lastSpeechRef.current=companion.sequence;
        if(companion.speech&&!frozen)audioRef.current?.speak(companion.speech);
      }
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
      ctx.save();ctx.translate(0,offsetY);ctx.scale(scale,scale);
      drawPlatformScene(ctx,l,w,{cameraX,viewWidth,pixelScale:scale,talkAmount:frozen?0:audioRef.current?.getTalkAmount()??0,reducedMotion:current.reducedMotion,companion,pointer:pointerRef.current,blood:current.blood,showGuide:current.showGuide});
      const scenePalette=PLATFORM_PALETTES[l.palette];
      drawAmbient(ctx,ambientRef.current,l,w,{...ambientViewport,ink:scenePalette.ink,background:scenePalette.background,reducedMotion:current.reducedMotion});
      if(tapRef.current&&!frozen){tapRef.current.remaining-=dt;if(tapRef.current.remaining<=0)tapRef.current=null;}
      const handTip=w.activeDrawing?.started?w.activeDrawing.path.at(-1)??null:handling?getMechanismHandlePosition(w,handling):tapRef.current?.point??null;
      ctx.save();ctx.translate(-cameraX,0);handRef.current?.draw(ctx,handTip,frozen?0:dt,current.reducedMotion,{mode:w.activeDrawing?'draw':handling?'point':'tap',hero:w.player,bottom:(height-offsetY)/scale});ctx.restore();
      drawPassageAnchors(ctx,l,w,{cameraX,pixelScale:scale});
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
      // A focused control keeps native Space/Enter activation.
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
        if(action==="crouch")touchDirectionsRef.current.crouch=false;
        const physicalKey=e.code||key;
        if(!pressedKeysRef.current.has(physicalKey))pressedKeysRef.current.set(physicalKey,key);
        syncHeldControls();
      }
      if(action==="draw"&&!e.repeat)controlsRef.current.draw=true;
      if(action==="stand"&&!e.repeat)choosePosture(false);
    };
    const up=(e:KeyboardEvent)=>{
      // Shift may change e.key between down/up; release the same physical key.
      const key=e.code||normalizeKey(e.key);if(key)pressedKeysRef.current.delete(key);syncHeldControls();
    };
    const blur=()=>{clearInput();releaseHand(true);audioRef.current?.hush();persistAdventure();};
    const hidden=()=>{if(document.hidden)blur();};
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);
    window.addEventListener("blur",blur);document.addEventListener("visibilitychange",hidden);window.addEventListener("pagehide",persistAdventure);
    return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);window.removeEventListener("blur",blur);document.removeEventListener("visibilitychange",hidden);window.removeEventListener("pagehide",persistAdventure);};
  },[clearInput,releaseHand,persistAdventure,retry,syncHeldControls,choosePosture,togglePause,unlock]);

  const hold=(direction:"left"|"right"|"crouch",e:React.PointerEvent<HTMLButtonElement>)=>{
    e.preventDefault();unlock();focusGame();e.currentTarget.setPointerCapture(e.pointerId);touchDirectionsRef.current[direction]=true;syncHeldControls();
  };
  const release=(direction:"left"|"right"|"crouch")=>{touchDirectionsRef.current[direction]=false;syncHeldControls();};
  const callHand=()=>{unlock();focusGame();controlsRef.current.draw=true;};
  const revealClue=()=>{
    if(!clueScene||(revealedHints[clueKey]??0)>=3)return;
    runRef.current.hintsUsed++;
    setRevealedHints(old=>({...old,[clueKey]:Math.min(3,(old[clueKey]??0)+1)}));
    persistAdventure();
  };
  const toggleGuide=()=>{
    if(!showGuide){runRef.current.hintsUsed++;persistAdventure();}
    setShowGuide(value=>!value);
  };
  const cancelDrawing=()=>{
    releaseHand();cancelPlayerDrawing(worldRef.current);handRef.current?.clear();setDrawingError(false);
    setTip("Dessin annulé. Ton passage précédent est conservé.");focusGame();
  };
  const clearDrawing=()=>{
    releaseHand();resetPlayerStroke(worldRef.current);handRef.current?.clear();setDrawingError(false);
    setTip("Relie A et B avec ton trait. Relâche pour valider.");focusGame();
  };
  const chooseRoute=(choiceId:string)=>{
    if(!planning)return;
    unlock();clearInput();releaseHand();
    const result=selectDrawingChoice(worldRef.current,level,planning.id,choiceId);
    setDrawingError(!result.ok);setTip(result.message);setView(snapshot(worldRef.current,level));focusGame();
  };
  const undoStroke=()=>{
    undoPlayerStroke(worldRef.current);setDrawingError(false);
    setTip('Reprends au bout du trait pour corriger cette portion.');setView(snapshot(worldRef.current,level));focusGame();
  };
  const pointerPoint=(e:{clientX:number;clientY:number}):PlatformPoint=>{
    const rect=canvasRef.current!.getBoundingClientRect(),transform=frameViewRef.current;
    return {x:(e.clientX-rect.left)/transform.scale+transform.cameraX,y:(e.clientY-rect.top-transform.offsetY)/transform.scale};
  };
  const anchorRadius=()=>Math.min(96,Math.max(34,34/frameViewRef.current.scale));
  const snapStrokeEnd=(point:PlatformPoint):PlatformPoint=>{
    const w=worldRef.current,l=PLATFORM_LEVELS[latestRef.current.levelIndex];
    const source=l.drawings.find(d=>d.id===w.activeDrawing?.id),drawing=source?getDrawingPlan(w,source):null,start=w.activeDrawing?.path[0];
    if(!drawing||!start)return point;
    const a=drawing.path[0],b=drawing.path[drawing.path.length-1];
    const end=Math.hypot(start.x-a.x,start.y-a.y)<Math.hypot(start.x-b.x,start.y-b.y)?b:a;
    return Math.hypot(point.x-end.x,point.y-end.y)<=anchorRadius()?{...end}:point;
  };
  const startStroke=(e:React.PointerEvent<HTMLCanvasElement>)=>{
    unlock();focusGame();
    if(e.button!==0||latestRef.current.paused||latestRef.current.panel||strokePointerRef.current!==null||mechanismPointerRef.current!==null)return;
    pointerClientRef.current={clientX:e.clientX,clientY:e.clientY};pointerRef.current=pointerPoint(e);
    ambientTouchRef.current=true;
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
      const result=beginMechanismInteraction(w,l,pointerRef.current,anchorRadius());
      if(result.ok){
        e.preventDefault();mechanismPointerRef.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);
        companionEventsRef.current.push("mechanism-start");setDrawingError(false);setTip(result.message);
      }else if(result.id){
        setDrawingError(true);setTip(result.message);setView(snapshot(w,l));
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
    if(latestRef.current.paused||latestRef.current.panel){if(worldRef.current.activeDrawing)worldRef.current.activeDrawing.started=false;return;}
    const l=PLATFORM_LEVELS[latestRef.current.levelIndex];
    const point=snapStrokeEnd(pointerPoint(e));
    const stroke=worldRef.current.activeDrawing?.path;
    // A tap may simply reveal the drawing tools; it is not a failed bridge.
    if(stroke&&stroke.length<2&&Math.hypot(point.x-stroke[0].x,point.y-stroke[0].y)<anchorRadius()){
      if(worldRef.current.activeDrawing)worldRef.current.activeDrawing.started=false;
      setDrawingError(false);setTip("Trace vers l’autre rive. Tu peux reprendre ton trait après avoir levé le doigt.");return;
    }
    appendPlayerStroke(worldRef.current,l,point);
    const result=finishPlayerStroke(worldRef.current,l);
    setDrawingError(!result.ok&&!result.incomplete);setTip(result.message);
    if(result.ok){
      companionEventsRef.current.push("draw-complete");persistAdventure();
    }
    setView(snapshot(worldRef.current,l));focusGame();
  };
  const interruptedStroke=(e:React.PointerEvent<HTMLCanvasElement>)=>{
    if(mechanismPointerRef.current===e.pointerId){releaseHand(true);persistAdventure();}
    if(strokePointerRef.current!==e.pointerId)return;
    strokePointerRef.current=null;if(worldRef.current.activeDrawing)worldRef.current.activeDrawing.started=false;handRef.current?.clear();audioRef.current?.endPencil();
    setDrawingError(false);setTip("Trait conservé. Reprends sur son extrémité dorée.");
  };
  const fullscreen=async()=>{
    unlock();
    try{
      if(document.fullscreenElement){await document.exitFullscreen();setFullScreen(false);}
      else if(document.documentElement.requestFullscreen){await document.documentElement.requestFullscreen();setFullScreen(true);}
    }catch{setFullScreen(!!document.fullscreenElement);}
  };
  useEffect(()=>{
    const change=()=>setFullScreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange",change);return()=>document.removeEventListener("fullscreenchange",change);
  },[]);

  const frozen=paused||!!panel;
  const movingDisabled=frozen||view.phase!=="playing";
  const guidance=drawingError?tip:view.goalMessage?view.goalMessage:view.phase==="drawing"
    ? (view.hasStroke&&!view.stroking?tip:view.reading||"Trace ton chemin. Le doigt peut se lever : le trait reste en place.")
    :available&&view.phase==="playing"
    ? (view.redrawing?view.reading||"Ton trait est là. Tu peux changer de chemin et le redessiner.":"Choisis ton passage, puis dessine-le au doigt ou à la souris.")
    : mechanism&&view.phase==="playing"
      ? (view.handling?"Garde la poignée en main et déplace-la le long du rail.":view.lockMessage||"Attrape la poignée dorée pour déplacer le décor.")
      : puzzle?.title??tip;
  return <main className={"app-shell platform-app"+(cinema?" cinema-mode":"")} style={{"--scene-bg":palette.background} as React.CSSProperties}>
    <section ref={stageRef} className={"game-section platform-section"+(fullScreen?" expanded":"")} aria-label="Aventure dessinée Un seul trait">
      <div className="stage platform-stage">
        <canvas ref={canvasRef} className={view.phase==="drawing"?"player-drawing":""} tabIndex={0} role="application" aria-label={"Niveau "+(levelIndex+1)+", "+level.title+". "+bindingText("left")+" et "+bindingText("right")+" pour marcher. "+bindingText("crouch")+" pour se baisser, "+bindingText("stand")+" pour se redresser. Trace de A à B et déplace les poignées directement à la souris ou au doigt."} onPointerDown={startStroke} onPointerMove={moveStroke} onPointerUp={finishStroke} onPointerCancel={interruptedStroke} onLostPointerCapture={interruptedStroke} onPointerLeave={()=>{if(strokePointerRef.current===null&&mechanismPointerRef.current===null){pointerRef.current=null;pointerClientRef.current=null;}}}/>
        {!ready&&<div className="canvas-loading"><BrandMark/><span>Le monde prend forme…</span></div>}

        <div className="journey-track" role="progressbar" aria-label="Avancée dans le niveau" aria-valuenow={view.percent} aria-valuemin={0} aria-valuemax={100}><span style={{width:view.percent+"%"}}/></div>
        <header className="game-topbar">
          <button className="level-trigger" onClick={()=>setPanel("levels")} aria-label={"Niveau "+(levelIndex+1)+", "+level.title+". Choisir un niveau."}><span className="game-mark"><BrandMark/></span><span><small>CHAPITRE {String(levelIndex+1).padStart(2,"0")} / {String(PLATFORM_LEVELS.length).padStart(2,"0")}</small><strong>{level.title}</strong></span></button>
          <div className="game-stars" aria-label={view.stars+" étoiles sur 3"}>{[0,1,2].map(i=><Star key={i} size={18} fill={i<view.stars?"currentColor":"none"} className={i<view.stars?"collected":""}/>)}</div>
          <div className="game-top-tools"><button className="game-icon-button sound-control" onClick={()=>{unlock();setMuted(v=>!v);}} aria-label={muted?"Activer le son":"Couper le son"}>{muted?<VolumeX size={19}/>:<Volume2 size={19}/>}</button><button className="game-icon-button" onClick={togglePause} aria-label={paused?"Reprendre":"Mettre en pause"}>{paused?<Play size={18}/>:<Pause size={18}/>}</button><button className="game-icon-button menu-control" onClick={()=>setPanel("menu")} aria-label="Menu du jeu"><Menu size={22}/></button></div>
        </header>

        {level.puzzles?.length&&!frozen&&view.phase!=="won"&&view.phase!=="dead"&&<button className="puzzle-help-button" onClick={()=>setPanel("clues")} aria-label="Ouvrir le carnet d’indices" title="Un indice, si tu en veux un"><Lightbulb size={18}/><span>Un indice ?</span></button>}
        {planning&&!frozen&&(view.phase==="drawing"||!view.redrawing)&&<DrawingPalette drawing={planning} choiceId={view.choiceId} editing={view.phase==="drawing"} held={view.stroking} hasStroke={view.hasStroke} guide={showGuide} concealHints={level.id>=7&&!showGuide} inkPercent={view.inkPercent} onChoose={chooseRoute} onGuide={toggleGuide} onUndo={undoStroke} onClear={clearDrawing} onCancel={cancelDrawing}/>}
        {available&&view.redrawing&&view.phase==="playing"&&!paused&&<button className="redraw-context" onClick={callHand} aria-label="Recadrer et redessiner ce passage"><Pencil size={15}/><span>Redessiner</span></button>}
        {view.phase==="dead"&&<div className="death-caption" role="status">Aïe !<span>Retour au dernier drapeau…</span></div>}

        <div className={"game-guidance"+(drawingError?" error":"")+(view.phase==="drawing"?" drawing-guidance":"")} role="status" aria-live="polite"><span className="guidance-mark">{view.phase==="drawing"||available?<Pencil size={14}/>:view.handling||mechanism?<Hand size={15}/>:<span className="little-line"/>}</span><p>{guidance}</p></div>

        <div className="game-pad movement-pad" role="group" aria-label="Déplacements">
          <span className="pad-caption">MARCHER</span>
          <div className="pad-buttons">{(["left","right"] as const).map(direction=><button key={direction} className="pad-button" aria-label={direction==="left"?"Aller à gauche":"Aller à droite"} disabled={movingDisabled} onPointerDown={e=>hold(direction,e)} onPointerUp={()=>release(direction)} onPointerCancel={()=>release(direction)} onLostPointerCapture={()=>release(direction)}>{direction==="left"?<ArrowLeft size={27}/>:<ArrowRight size={27}/>}</button>)}</div>
          <span className="pad-key-hint">{keyLabel(bindings.left[0])} <span>·</span> {keyLabel(bindings.right[0])}</span>
        </div>
        <div className="game-pad posture-pad" role="group" aria-label="Posture">
          <span className="pad-caption">{view.crouching?"À RAS DU TRAIT":"SE BAISSER / SE REDRESSER"}</span>
          <div className="pad-buttons"><button className={"pad-button"+(view.crouching?" is-active":"")} aria-label="Se baisser" aria-pressed={view.crouching} disabled={movingDisabled} onPointerDown={e=>{e.preventDefault();unlock();focusGame();choosePosture(true);}} onClick={e=>{if(e.detail===0){unlock();focusGame();choosePosture(true);}}}><ArrowDown size={27}/></button><button className={"pad-button"+(!view.crouching?" is-upright":"")} aria-label="Se redresser" aria-pressed={!view.crouching} disabled={movingDisabled} onPointerDown={e=>{e.preventDefault();unlock();focusGame();choosePosture(false);}} onClick={e=>{if(e.detail===0){unlock();focusGame();choosePosture(false);}}}><ArrowUp size={27}/></button></div>
          <span className="pad-key-hint">{keyLabel(bindings.crouch[0])} <span>·</span> {keyLabel(bindings.stand[0])}</span>
        </div>
        <div className="game-bottom-meta"><span className="death-count" aria-label={view.deaths+" morts"}><Skull size={12}/>{view.deaths}</span><button onClick={fullscreen} aria-label={fullScreen?"Quitter le plein écran":"Plein écran"}><Expand size={15}/></button></div>

        {paused&&<div className="pause-layer"><div className="pause-content"><span className="eyebrow">UN INSTANT SUR LA LIGNE</span><h2>On reprend ?</h2><button onClick={togglePause} className="primary-button"><Play size={19} fill="currentColor"/>Continuer</button><div className="pause-links"><button onClick={()=>setPanel("menu")}><Menu size={16}/>Menu</button><button onClick={retry}><Flag size={16}/>Dernier drapeau</button></div></div></div>}
        {view.phase==="won"&&<div className="win-layer"><div className="win-card"><span className="eyebrow">CHAPITRE {String(levelIndex+1).padStart(2,"0")} TERMINÉ</span><div className="win-stars" aria-label={view.stars+" étoiles sur 3"}>{[0,1,2].map(i=><Star key={i} size={36} fill={i<view.stars?"currentColor":"none"} className={i<view.stars?"earned":""}/>)}</div><h2>{levelIndex===PLATFORM_LEVELS.length-1?"Le dernier trait.":"Bien arrivé !"}</h2><p>{view.deaths===0?"Vous avez trouvé le chemin, sans une égratignure.":"Un peu de caractère. Et un chemin dessiné à deux."}</p><div className="win-cooperation"><span><Pencil size={15}/>{view.drawn} passages</span><span><Hand size={15}/>{view.solved} réglages</span></div><RunChallenges score={scores[levelIndex]} run={runRef.current} stars={view.stars} deaths={view.deaths}/><div className="win-buttons"><button className="quiet-button" onClick={()=>startLevel(levelIndex,true)}><RotateCcw size={16}/>Rejouer</button><button className="primary-button" onClick={()=>levelIndex<PLATFORM_LEVELS.length-1?startLevel(levelIndex+1):setPanel("levels")}>{levelIndex<PLATFORM_LEVELS.length-1?"Le chapitre suivant":"Les chapitres"}<ArrowRight size={18}/></button></div></div></div>}
      </div>
    </section>

    <dialog ref={dialogRef} className={"game-dialog"+(panel==="levels"?" levels-dialog":"")+(panel==="menu"?" main-menu-dialog":"")} aria-labelledby="dialog-title" onCancel={()=>setPanel(null)} onClick={e=>{if(e.target===e.currentTarget)setPanel(null);}}>
      <div className="dialog-inner">
        <div className="dialog-top">{panel!=="menu"?<button className="back-to-menu" onClick={()=>setPanel("menu")}><ArrowLeft size={16}/><span>Le jeu</span></button>:<span className="eyebrow">UNE LIGNE, DEUX COMPLICES</span>}<button className="game-icon-button" aria-label="Fermer" onClick={()=>setPanel(null)}><X size={22}/></button></div>
        {panel==="menu"&&<><div className="menu-title-mark"><BrandMark/></div><h2 id="dialog-title" className="main-game-title">un seul trait<span>.</span></h2><p className="menu-subtitle">Lui, le caractère. Toi, les idées.</p><button className="primary-button menu-continue" onClick={()=>{setPanel(null);setPaused(false);focusGame();}}><Play size={18} fill="currentColor"/>Continuer l’aventure</button><button className="new-act-link" onClick={()=>startLevel(6)}><span>ACTE II · CHAPITRES 07 — 12<strong>La mécanique des idées</strong></span><ArrowRight size={19}/></button><nav className="game-menu-list" aria-label="Menu du jeu"><button onClick={()=>setPanel("levels")}><List size={18}/><span>Les chapitres<small>{completed} / {PLATFORM_LEVELS.length} terminés</small></span><ChevronRight size={18}/></button><button onClick={()=>setPanel("controls")}><Keyboard size={18}/><span>Mes commandes<small>Deux touches par action</small></span><ChevronRight size={18}/></button><button onClick={()=>setPanel("settings")}><Settings2 size={18}/><span>Les réglages<small>Voix, image et confort</small></span><ChevronRight size={18}/></button><button onClick={()=>setPanel("help")}><HelpCircle size={18}/><span>Comment jouer<small>Des gestes et des idées</small></span><ChevronRight size={18}/></button></nav><div className="menu-footer"><button onClick={()=>startLevel(levelIndex,true)}><RotateCcw size={14}/>Recommencer ce chapitre</button><p>{storageOk?"Tes dessins et ta progression sont sauvegardés.":"Ta progression est conservée pour cette session."}</p><p>D’après <a href="https://www.youtube.com/watch?v=8IHHHXIzDpA" target="_blank" rel="noreferrer">La Linea</a> d’Osvaldo Cavandoli.</p><p aria-label="Version du jeu">Version 1.6.0</p></div></>}
        {panel==="levels"&&<ChapterNotebook scores={scores} current={levelIndex} adventure={progressRef.current} onStart={startLevel}/>}
        {panel==="clues"&&<PuzzleNotebook scene={clueScene} revealed={revealedHints[clueKey]??0} onReveal={revealClue} onClose={()=>{setPanel(null);focusGame();}}/>}
        {panel==="help"&&<><h2 id="dialog-title">À deux, sur un trait<span>.</span></h2><p className="dialog-intro">Tu le guides. Tu dessines. Lui ne manque jamais une occasion de te le faire savoir.</p><div className="help-steps"><div><span>01</span><section><h3>Un pouce pour marcher.</h3><p>Maintiens ← ou → en bas à gauche. Au clavier : {bindingText("left")} et {bindingText("right")}. Pas de saut : c’est la ligne qui fait le chemin.</p></section></div><div><span>02</span><section><h3>L’autre pour se baisser.</h3><p>↓ en bas à droite le garde baissé ; ↑ lui demande de se redresser quand il y a la place. Au clavier, maintiens {bindingText("crouch")} pour te baisser, ou utilise {bindingText("stand")} pour te redresser.</p></section></div><div><span>03</span><section><h3>Le passage est dans tes mains.</h3><p>Choisis un itinéraire, puis relie A et B au doigt ou à la souris. Le guide peut être demandé si tu bloques. Tu peux lever le doigt, reprendre au bout doré et reculer pour corriger une portion. Un passage haut, un raccourci ou un chemin à traverser baissé : à toi de décider.</p></section></div><div><span>04</span><section><h3>Attrape le décor.</h3><p>Saisis directement une poignée dorée et fais-la glisser : porte, ascenseur, plateforme ou roue. Tu peux déplacer le personnage avec l’autre main pendant que tu tiens la poignée. Les petits contacts reliés indiquent ce qui verrouille un mécanisme : observe leur couleur et essaie plusieurs positions.</p></section></div><div><span>05</span><section><h3>Comprendre avant de traverser.</h3><p>Dans le deuxième acte, une position intermédiaire, un retour en arrière ou une porte refermée peuvent libérer la suite. Les marques du rail aident à régler sans précision pénible. Le petit carnet propose trois indices progressifs, seulement si tu les demandes.</p></section></div></div><div className="help-companion-note"><Hand size={20}/><p>Il réclame, s’impatiente, remercie et réagit quand tu touches sa tête. Les drapeaux conservent tes dessins, tes étoiles et les mécanismes déplacés. Pour maîtriser un chapitre, réunis ses trois étoiles sans chute, retour au drapeau ni indice. Un guide de dessin compte comme un indice.</p></div><button className="configure-controls-link" onClick={()=>setPanel("controls")}><Keyboard size={17}/>Personnaliser mes touches<ChevronRight size={17}/></button><button className="primary-button help-close" onClick={()=>{setPanel(null);setPaused(false);}}>C’est parti<ArrowRight size={18}/></button></>}
        {panel==="controls"&&<><h2 id="dialog-title">Tes commandes<span>.</span></h2><p className="dialog-intro">Deux touches au choix pour chaque mouvement. Le crayon et les poignées suivent toujours ta souris ou ton doigt.</p><ControlsConfig bindings={bindings} onChange={next=>{clearInput();setBindings(next);}}/><div className="controls-dialog-actions"><button className="quiet-button" onClick={()=>setPanel("help")}><HelpCircle size={17}/>Comment jouer</button><button className="primary-button" onClick={()=>{setPanel(null);focusGame();}}>Revenir au jeu<ArrowRight size={18}/></button></div></>}
        {panel==="settings"&&<><h2 id="dialog-title">À ta façon<span>.</span></h2><p className="dialog-intro">Garde la ligne. Ajuste le reste.</p><div className="setting-row"><div><h3>Voix et bruitages</h3><p>Répliques originales et sons du jeu.</p></div><button className={"toggle"+(!muted?" on":"")} role="switch" aria-checked={!muted} aria-label="Voix et bruitages" onClick={()=>{unlock();setMuted(v=>!v);}}><span/></button></div><div className="voice-choice" role="group" aria-label="Type de voix"><button aria-pressed={voiceMode==="original"} onClick={()=>{unlock();setVoiceMode("original");}}>Voix originale</button><button aria-pressed={voiceMode==="grammelot"} onClick={()=>{unlock();setVoiceMode("grammelot");}}>Grammelot synthétique</button><button aria-pressed={voiceMode==="italian"} onClick={()=>{unlock();setVoiceMode("italian");}}>Italien synthétique</button></div><div className="setting-volume"><label htmlFor="volume">Volume <b>{volume}%</b></label><input id="volume" type="range" min="0" max="100" value={volume} onChange={e=>setVolume(Number(e.target.value))} onPointerUp={()=>{unlock();audioRef.current?.play("star");}}/></div><div className="setting-row"><div><h3>Mode cinéma</h3><p>Épure les indications. Garde les commandes.</p></div><button className={"toggle"+(cinema?" on":"")} role="switch" aria-checked={cinema} aria-label="Mode cinéma" onClick={()=>setCinema(v=>!v)}><span/></button></div><div className="setting-row"><div><h3>Éclaboussures rouges</h3><p>Désactive pour des éclats de trait blanc.</p></div><button className={"toggle"+(blood?" on":"")} role="switch" aria-checked={blood} aria-label="Éclaboussures rouges" onClick={()=>setBlood(v=>!v)}><span/></button></div><button className="configure-controls-link" onClick={fullscreen}><Expand size={18}/>{fullScreen?"Quitter le plein écran":"Passer en plein écran"}<ChevronRight size={17}/></button><p className="setting-note">{reducedMotion?"Les mouvements réduits de ton appareil sont respectés.":"L’animation respecte le réglage de mouvements réduits de ton appareil."}</p><button className="primary-button help-close" onClick={()=>setPanel(null)}>Revenir au jeu<ArrowRight size={18}/></button></>}
      </div>
    </dialog>
  </main>;
}
