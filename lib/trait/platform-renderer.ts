import { drawCartoonCharacter, getCharacterGroundSpan } from './cartoon-character';
import type { CompanionActing } from './companion';
import { getAvailableDrawing, getMechanismPositions, getWorldHazardPosition, getWorldSurfaces, type GameWorld, type PlatformLevel, type PlatformPoint, type PlatformSurface } from './platformer';

export const PLATFORM_PALETTES = {
  blue: { background: '#064b8e', ink: '#fffdf6', accent: '#f6d89a' },
  teal: { background: '#176a4b', ink: '#fffdf6', accent: '#f6d89a' },
  plum: { background: '#55376e', ink: '#fffdf6', accent: '#f6d89a' },
  terracotta: { background: '#d84208', ink: '#fffdf6', accent: '#ffe4ac' },
};
const STROKE = 3.8;
const TAU = Math.PI * 2;

export function sampleDrawing(path: PlatformPoint[], progress: number) {
  if (!path.length) return { point: { x: 0, y: 0 }, prefix: [] as PlatformPoint[] };
  let total = 0;
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i].x - path[i-1].x, path[i].y - path[i-1].y);
  let remaining = Math.max(0, Math.min(1, progress)) * total;
  const prefix = [{ ...path[0] }];
  for (let i = 1; i < path.length; i++) {
    const a = path[i-1], b = path[i], length = Math.hypot(b.x-a.x, b.y-a.y);
    if (remaining >= length) { prefix.push({ ...b }); remaining -= length; }
    else {
      const fraction = length ? remaining / length : 0;
      prefix.push({ x: a.x+(b.x-a.x)*fraction, y: a.y+(b.y-a.y)*fraction });
      break;
    }
  }
  return { point: prefix[prefix.length-1], prefix };
}

function line(ctx: CanvasRenderingContext2D, surface: PlatformSurface, gaps: {left:number;right:number}[]) {
  const {a,b} = surface;
  const relevant = gaps.filter(gap => Math.max(a.x,b.x) >= gap.left && Math.min(a.x,b.x) <= gap.right)
    .sort((one,two)=>one.left-two.left);
  if (!relevant.length) {
    ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); return;
  }
  // A stair riser inside the contour is part of the same interrupted ground.
  if (Math.abs(b.x-a.x) < .001) {
    if (!relevant.some(gap=>a.x>gap.left&&a.x<gap.right)) { ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); }
    return;
  }
  const yAt = (x:number) => a.y + (b.y-a.y)*(x-a.x)/(b.x-a.x);
  const left = a.x < b.x ? a : b, right = a.x < b.x ? b : a;
  let cursor=left.x;
  for(const gap of relevant) {
    const end=Math.min(right.x,gap.left);
    if(cursor<end){ctx.moveTo(cursor,yAt(cursor));ctx.lineTo(end,yAt(end));}
    cursor=Math.max(cursor,gap.right);
  }
  if(cursor<right.x){ctx.moveTo(cursor,yAt(cursor));ctx.lineTo(right.x,right.y);}
}

/** Follow only the local, connected piece of ground that supports the player. */
function groundJoin(surfaces: PlatformSurface[], feet: PlatformPoint, span: {left:number;right:number}) {
  const epsilon=.1;
  const yAt=(surface:PlatformSurface,x:number) => {
    const {a,b}=surface,dx=b.x-a.x;
    if(Math.abs(dx)<epsilon || x<Math.min(a.x,b.x)-epsilon || x>Math.max(a.x,b.x)+epsilon)return null;
    return a.y+(b.y-a.y)*(x-a.x)/dx;
  };
  const support=surfaces.find(surface=>{
    const y=yAt(surface,feet.x);
    return y!==null&&Math.abs(y-feet.y)<epsilon;
  });
  if(!support)return null;
  const nearby=surfaces.filter(s=>Math.max(s.a.x,s.b.x)>=span.left-epsilon&&Math.min(s.a.x,s.b.x)<=span.right+epsilon);
  const connected=new Set<PlatformSurface>([support]);
  const touches=(a:PlatformPoint,b:PlatformPoint)=>Math.abs(a.x-b.x)<epsilon&&Math.abs(a.y-b.y)<epsilon;
  for(const current of connected)for(const next of nearby) {
    if(!connected.has(next)&&(touches(current.a,next.a)||touches(current.a,next.b)||touches(current.b,next.a)||touches(current.b,next.b)))connected.add(next);
  }
  const chain=[...connected];
  const minX=Math.min(...chain.flatMap(s=>[s.a.x,s.b.x]));
  const maxX=Math.max(...chain.flatMap(s=>[s.a.x,s.b.x]));
  const contact=(requestedX:number,side:-1|1):PlatformPoint=>{
    const x=Math.max(minX,Math.min(maxX,requestedX));
    let bestY=feet.y,bestScore=Infinity;
    for(const surface of chain) {
      const y=yAt(surface,x);if(y===null)continue;
      // At an exact stair corner, use the segment continuing outside the body.
      const continues=side===-1?Math.min(surface.a.x,surface.b.x)<x-epsilon:Math.max(surface.a.x,surface.b.x)>x+epsilon;
      const score=Math.abs(y-feet.y)+(continues?0:1000);
      if(score<bestScore){bestY=y;bestScore=score;}
    }
    return {x,y:bestY};
  };
  return {surfaces:connected,left:contact(span.left,-1),right:contact(span.right,1)};
}

function star(ctx:CanvasRenderingContext2D,x:number,y:number,r:number) {
  ctx.beginPath();
  for(let i=0;i<8;i++) {
    const angle=-Math.PI/2+i*Math.PI/4, radius=i%2?r*.27:r;
    if(i===0)ctx.moveTo(x+Math.cos(angle)*radius,y+Math.sin(angle)*radius);
    else ctx.lineTo(x+Math.cos(angle)*radius,y+Math.sin(angle)*radius);
  }
  ctx.closePath();
}

function gear(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,angle:number,ink:string,background:string) {
  ctx.save(); ctx.translate(x,y); ctx.rotate(angle);
  ctx.strokeStyle=ink; ctx.lineWidth=STROKE;
  ctx.fillStyle=background;
  ctx.beginPath();
  const teeth=12;
  for(let i=0;i<teeth*4;i++) {
    const a=i/(teeth*4)*TAU;
    const outer=(i%4===1 || i%4===2);
    const radius=r*(outer?1:.76);
    const x1=Math.cos(a)*radius,y1=Math.sin(a)*radius;
    if(i===0)ctx.moveTo(x1,y1);else ctx.lineTo(x1,y1);
  }
  ctx.closePath();ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.arc(0,0,r*.45,0,TAU);ctx.stroke();
  ctx.beginPath();ctx.arc(0,0,r*.12,0,TAU);ctx.stroke();
  for(let i=0;i<4;i++){
    const a=i*TAU/4;
    ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.15,Math.sin(a)*r*.15);
    ctx.lineTo(Math.cos(a)*r*.43,Math.sin(a)*r*.43);ctx.stroke();
  }
  ctx.restore();
}

export function drawPlatformScene(
  ctx: CanvasRenderingContext2D,
  level: PlatformLevel,
  world: GameWorld,
  options: {
    cameraX:number; viewWidth:number; pixelScale?:number; talkAmount:number; reducedMotion:boolean;
    companion?:CompanionActing; pointer?:PlatformPoint|null; blood?:boolean;
  },
) {
  const palette = PLATFORM_PALETTES[level.palette];
  const {player} = world;
  const availableDrawing=getAvailableDrawing(world,level);
  const moving=Math.abs(player.vx)>8;
  const motion = !player.grounded ? 'fall' : player.crouching ? (moving?'crouch-walk':'crouch')
    : world.phase==='won' ? 'happy' : world.phase==='drawing' ? (options.companion?'idle':'grumpy')
    : moving ? 'walk' : 'idle';
  const companion=options.companion;
  const canGesture=player.grounded&&!player.crouching&&!moving;
  const facing=canGesture&&companion?.facing ? companion.facing : player.facing;
  const headHeight=player.crouching?43:79;
  const pointerNear=options.pointer&&Math.hypot(options.pointer.x-player.x,options.pointer.y-(player.y-headHeight))<90;
  const target=companion?.target??(pointerNear?options.pointer:null);
  const look=target ? Math.max(-1,Math.min(1,(target.y-(player.y-headHeight))/65)) : 0;
  const actor = {
    x:player.x,y:player.y,scale:.60,facing: facing as -1|1,motion,
    travel:player.travel,time:world.time,talkAmount:options.talkAmount,
    ink:palette.ink,background:palette.background,stroke:STROKE,reducedMotion:options.reducedMotion,
    gesture:companion?.gesture,gestureAge:companion?.age,gestureDuration:companion?.duration,look,
  } as Parameters<typeof drawCartoonCharacter>[1];
  const span = player.grounded && world.phase!=='dead' ? getCharacterGroundSpan(actor) : null;
  const surfaces=getWorldSurfaces(world.activeDrawing
    ? {...world,drawn:world.drawn.filter(id=>id!==world.activeDrawing?.id)}
    : world,level);
  const join=span?groundJoin(surfaces,player,span):null;
  const mechanisms=getMechanismPositions(world,level);
  ctx.save(); ctx.translate(-options.cameraX,0);
  ctx.lineCap='round';ctx.lineJoin='round';

  // Rails use the same simulated positions and handle offsets as interaction.
  for(const view of mechanisms) {
    const {mechanism,position,handle,held}=view;
    if(Math.max(mechanism.from.x,mechanism.to.x)<options.cameraX-100||Math.min(mechanism.from.x,mechanism.to.x)>options.cameraX+options.viewWidth+100)continue;
    const offset={x:handle.x-position.x,y:handle.y-position.y};
    ctx.save();ctx.strokeStyle=palette.accent;ctx.lineWidth=1.6;ctx.globalAlpha=held?.65:.28;ctx.setLineDash([2,7]);
    ctx.beginPath();ctx.moveTo(mechanism.from.x+offset.x,mechanism.from.y+offset.y);
    ctx.lineTo(mechanism.to.x+offset.x,mechanism.to.y+offset.y);ctx.stroke();ctx.setLineDash([]);
    for(const end of [mechanism.from,mechanism.to]){ctx.beginPath();ctx.arc(end.x+offset.x,end.y+offset.y,3.5,0,TAU);ctx.stroke();}
    ctx.restore();
  }

  // The horizon is interrupted only at real gaps and at the figure's contour.
  ctx.strokeStyle=palette.ink;ctx.lineWidth=STROKE;
  ctx.beginPath();
  for(const surface of surfaces) {
    if(surface.b.x<options.cameraX-50 || surface.a.x>options.cameraX+options.viewWidth+50)continue;
    const gaps=span&&join?.surfaces.has(surface)?[span]:[];
    for(const {mechanism,position} of mechanisms)if(mechanism.type==='gate'&&Math.abs(surface.b.x-surface.a.x)>.01) {
      const x=position.x;
      if(x>=Math.min(surface.a.x,surface.b.x)&&x<=Math.max(surface.a.x,surface.b.x)) {
        const y=surface.a.y+(surface.b.y-surface.a.y)*(x-surface.a.x)/(surface.b.x-surface.a.x);
        if(Math.abs(position.y-y)<.2)gaps.push({left:x-mechanism.width/2,right:x+mechanism.width/2});
      }
    }
    line(ctx,surface,gaps);
  }
  ctx.stroke();

  // A lowered gate is a fold in the ground; a raised gate has a closed base.
  for(const {mechanism,position} of mechanisms)if(mechanism.type==='gate') {
    const half=mechanism.width/2,top=position.y-mechanism.height;
    const seated=surfaces.some(({a,b})=>Math.abs(b.x-a.x)>.01&&position.x>=Math.min(a.x,b.x)&&position.x<=Math.max(a.x,b.x)
      &&Math.abs(a.y+(b.y-a.y)*(position.x-a.x)/(b.x-a.x)-position.y)<.2);
    ctx.fillStyle=palette.background;ctx.strokeStyle=palette.ink;ctx.lineWidth=STROKE;
    ctx.beginPath();ctx.moveTo(position.x-half,position.y);ctx.lineTo(position.x-half,top);
    ctx.lineTo(position.x+half,top);ctx.lineTo(position.x+half,position.y);if(!seated)ctx.closePath();ctx.fill();ctx.stroke();
  }

  // Undrawn structures remain absent; a discreet pencil marker calls the hand.
  for(const drawing of level.drawings) {
    if(world.drawn.includes(drawing.id)||drawing.id===world.activeDrawing?.id||drawing.id===availableDrawing?.id)continue;
    if(drawing.triggerX<options.cameraX-100 || drawing.triggerX>options.cameraX+options.viewWidth+80)continue;
    const surface=surfaces.find(s=>s.a.x<=drawing.triggerX&&s.b.x>=drawing.triggerX);
    const ground=surface ? surface.a.y+(surface.b.y-surface.a.y)*(drawing.triggerX-surface.a.x)/(surface.b.x-surface.a.x) : 430;
    ctx.save();ctx.translate(drawing.triggerX,ground-35);
    ctx.strokeStyle=palette.accent;ctx.fillStyle=palette.accent;ctx.lineWidth=1.8;
    const near=Math.abs(player.x-drawing.triggerX)<150;
    ctx.globalAlpha=near?1:.55;
    ctx.beginPath();ctx.arc(0,0,16,0,TAU);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-6,5);ctx.lineTo(3,-7);ctx.lineTo(8,-3);ctx.lineTo(-1,8);ctx.closePath();ctx.stroke();
    ctx.beginPath();ctx.moveTo(-6,5);ctx.lineTo(-7,10);ctx.lineTo(-1,8);ctx.stroke();
    ctx.restore();
  }

  for(const checkpoint of level.checkpoints) {
    const active=level.checkpoints.indexOf(checkpoint)<=world.checkpointIndex;
    ctx.save();ctx.strokeStyle=active?palette.accent:palette.ink;ctx.globalAlpha=active?.85:.35;
    ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(checkpoint.x,checkpoint.y);ctx.lineTo(checkpoint.x,checkpoint.y-45);
    ctx.lineTo(checkpoint.x+18,checkpoint.y-39);ctx.lineTo(checkpoint.x,checkpoint.y-31);ctx.stroke();
    ctx.restore();
  }

  for(const hazard of level.hazards) {
    const p=getWorldHazardPosition(world,level,hazard);
    if(p.x<options.cameraX-180 || p.x>options.cameraX+options.viewWidth+180)continue;
    if(hazard.type==='gear') {
      if(hazard.axis && hazard.range && !mechanisms.some(view=>view.mechanism.type==='gear'&&view.mechanism.hazardId===hazard.id)) {
        ctx.save();ctx.globalAlpha=.2;ctx.strokeStyle=palette.ink;ctx.lineWidth=1.5;ctx.setLineDash([3,7]);
        ctx.beginPath();
        if(hazard.axis==='y'){ctx.moveTo(hazard.x,hazard.y-hazard.range);ctx.lineTo(hazard.x,hazard.y+hazard.range);}
        else{ctx.moveTo(hazard.x-hazard.range,hazard.y);ctx.lineTo(hazard.x+hazard.range,hazard.y);}
        ctx.stroke();ctx.restore();
      }
      gear(ctx,p.x,p.y,hazard.r,world.time*2.4+(hazard.phase??0),palette.ink,palette.background);
    } else {
      ctx.save();ctx.strokeStyle=palette.ink;ctx.lineWidth=STROKE;
      const count=Math.max(2,Math.round(hazard.w/20));
      ctx.beginPath();ctx.moveTo(hazard.x,hazard.y+hazard.h);
      for(let i=0;i<count;i++){
        ctx.lineTo(hazard.x+(i+.5)*hazard.w/count,hazard.y);
        ctx.lineTo(hazard.x+(i+1)*hazard.w/count,hazard.y+hazard.h);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  level.stars.forEach((p,index)=>{
    if(world.collected.includes(index))return;
    const float=options.reducedMotion?0:Math.sin(world.time*2.1+index)*3;
    ctx.save();ctx.strokeStyle=palette.accent;ctx.fillStyle=palette.accent;ctx.lineWidth=2.2;
    ctx.globalAlpha=.1;ctx.beginPath();ctx.arc(p.x,p.y+float,22,0,TAU);ctx.fill();
    ctx.globalAlpha=1;star(ctx,p.x,p.y+float,12);ctx.stroke();ctx.restore();
  });

  for(const {mechanism,position,handle,held} of mechanisms) {
    if(handle.x<options.cameraX-70||handle.x>options.cameraX+options.viewWidth+70)continue;
    const hovered=!!options.pointer&&Math.hypot(options.pointer.x-handle.x,options.pointer.y-handle.y)<25;
    ctx.save();ctx.strokeStyle=palette.accent;ctx.fillStyle=palette.background;ctx.lineWidth=2.7;
    if(mechanism.type==='platform') {
      ctx.beginPath();ctx.moveTo(handle.x,handle.y+10);ctx.lineTo(position.x,position.y);ctx.stroke();
    }
    ctx.beginPath();ctx.arc(handle.x,handle.y,held?13:11,0,TAU);ctx.fill();ctx.stroke();
    ctx.fillStyle=palette.accent;
    ctx.beginPath();ctx.arc(handle.x,handle.y,3,0,TAU);ctx.fill();
    if(held||hovered){ctx.globalAlpha=held?.7:.4;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(handle.x,handle.y,18,0,TAU);ctx.stroke();}
    ctx.restore();
  }

  const goal=level.goal;
  ctx.save();ctx.strokeStyle=palette.ink;ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(goal.x,goal.y);ctx.lineTo(goal.x,goal.y-114);ctx.stroke();
  ctx.strokeStyle=palette.accent;
  const flutter=options.reducedMotion?0:Math.sin(world.time*3)*3;
  ctx.beginPath();ctx.moveTo(goal.x,goal.y-110);
  ctx.bezierCurveTo(goal.x+20,goal.y-123+flutter,goal.x+36,goal.y-97-flutter,goal.x+55,goal.y-107);
  ctx.lineTo(goal.x+48,goal.y-69);
  ctx.bezierCurveTo(goal.x+29,goal.y-61,goal.x+15,goal.y-83,goal.x,goal.y-72);
  ctx.stroke();ctx.restore();

  if(world.phase!=='dead')drawCartoonCharacter(ctx,actor);
  if(join&&span) {
    // Keep the drawn body upright; short contour ends meet the actual slope or
    // adjacent stair tread instead of leaving a gap at the horizontal baseline.
    ctx.strokeStyle=palette.ink;ctx.lineWidth=STROKE;ctx.beginPath();
    if(Math.hypot(join.left.x-span.left,join.left.y-player.y)>.1){ctx.moveTo(join.left.x,join.left.y);ctx.lineTo(span.left,player.y);}
    if(Math.hypot(join.right.x-span.right,join.right.y-player.y)>.1){ctx.moveTo(span.right,player.y);ctx.lineTo(join.right.x,join.right.y);}
    ctx.stroke();
  }
  for(const p of world.particles) {
    ctx.save();ctx.globalAlpha=Math.min(1,p.life/Math.max(.001,p.maxLife)*1.8);
    if(options.blood===false) {
      ctx.strokeStyle=palette.ink;ctx.lineWidth=Math.min(STROKE,p.size);
      ctx.beginPath();ctx.moveTo(p.x-p.size*.6,p.y+p.size*.3);ctx.lineTo(p.x+p.size*.6,p.y-p.size*.3);ctx.stroke();ctx.restore();continue;
    }
    ctx.fillStyle=p.color;ctx.strokeStyle='#ff4654';ctx.lineWidth=.7;
    ctx.beginPath();ctx.ellipse(p.x,p.y,p.size,p.size*.7,Math.atan2(p.vy,p.vx),0,TAU);ctx.fill();
    if(p.size>3)ctx.stroke();ctx.restore();
  }

  const drawing=world.activeDrawing?level.drawings.find(d=>d.id===world.activeDrawing?.id):availableDrawing;
  if(drawing) {
    if(world.activeDrawing){
      ctx.strokeStyle=palette.ink;ctx.lineWidth=STROKE;ctx.beginPath();
      world.activeDrawing.path.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
    }
  }
  ctx.restore();
}

/** Interaction markers sit above the photographed hand, keeping the target visible. */
export function drawPassageAnchors(ctx:CanvasRenderingContext2D,level:PlatformLevel,world:GameWorld,options:{cameraX:number;pixelScale:number}) {
  const drawing=world.activeDrawing?level.drawings.find(d=>d.id===world.activeDrawing?.id):getAvailableDrawing(world,level);
  if(drawing){
    const palette=PLATFORM_PALETTES[level.palette];
    ctx.save();ctx.translate(-options.cameraX,0);
    const scale=Math.max(.25,options.pixelScale),radius=Math.max(11,Math.min(36,14/scale));
    [drawing.path[0],drawing.path[drawing.path.length-1]].forEach((point,index)=>{
      ctx.save();ctx.fillStyle=palette.background;ctx.strokeStyle=palette.accent;ctx.lineWidth=1.5/scale;
      ctx.beginPath();ctx.arc(point.x,point.y,radius,0,TAU);ctx.fill();ctx.stroke();
      ctx.fillStyle=palette.accent;ctx.beginPath();ctx.arc(point.x,point.y,Math.max(3,3/scale),0,TAU);ctx.fill();
      ctx.font=`600 ${Math.max(14,12/scale)}px Arial, sans-serif`;ctx.textAlign='center';
      ctx.fillText(index===0?'A':'B',point.x,point.y-radius-9/scale);
      ctx.restore();
    });
    ctx.restore();
  }
}
