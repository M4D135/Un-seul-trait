import test from 'node:test';
import assert from 'node:assert/strict';
import {appendPlayerStroke,beginPlayerStroke,createWorld,finishPlayerStroke,updateWorld} from '../lib/trait/platformer';
import {PLATFORM_LEVELS} from '../lib/trait/platform-levels';
import {readAdventure,restoreProgress,saveProgress} from '../lib/trait/progress';

test('reload resumes at a safe flag with the exact authored passage and solved mechanisms',()=>{
  const level=PLATFORM_LEVELS[0],world=createWorld(level),drawing=level.drawings[0];
  const a=drawing.path[0],b=drawing.path.at(-1)!;
  const ownPath=[{...a},{x:(a.x+b.x)/2,y:a.y-35},{...b}];
  world.drawn=[drawing.id];world.constructions[drawing.id]=ownPath;
  world.checkpointIndex=0;world.player.x=999;world.player.y=600;world.player.vy=300;
  world.collected=[0,2];world.deaths=4;world.time=86;
  const mechanism=level.mechanisms![0];world.mechanisms[mechanism.id]={progress:.8,target:1};
  const encoded=saveProgress(world,level);
  const restored=restoreProgress(JSON.parse(JSON.stringify(encoded)),level)!;
  assert.equal(restored.player.x,level.checkpoints[0].x);
  assert.equal(restored.player.y,level.checkpoints[0].y);
  assert.equal(restored.phase,'playing');assert.equal(restored.player.vy,0);
  assert.deepEqual(restored.constructions[drawing.id],ownPath);
  assert.deepEqual(restored.collected,[0,2]);assert.equal(restored.deaths,4);
  assert.deepEqual(restored.mechanisms[mechanism.id],{progress:.8,target:.8});
  assert.equal(restored.handInteraction,null);
  ownPath[1].y=200;assert.notEqual(encoded.constructions[drawing.id][1].y,200,'snapshot owns its points');
});

test('corrupt progress cannot restore invalid coordinates, impossible stars or malformed strokes',()=>{
  const level=PLATFORM_LEVELS[0];
  const base=saveProgress(createWorld(level),level);
  const restored=restoreProgress({...base,checkpointIndex:1e9,deaths:NaN,time:Infinity,
    collected:[0,0,-1,3,'1',1.5],
    constructions:{[level.drawings[0].id]:[{x:0,y:NaN},{x:1,y:3}]},
    mechanisms:{[level.mechanisms![0].id]:Infinity}},level)!;
  assert.equal(restored.checkpointIndex,level.checkpoints.length-1);
  assert.equal(restored.deaths,0);assert.equal(restored.time,0);
  assert.deepEqual(restored.collected,[0]);assert.deepEqual(restored.drawn,[]);
  assert.ok(Number.isFinite(restored.player.x)&&Number.isFinite(restored.player.y));
  assert.equal(restoreProgress({...base,levelId:999},level),null);
  assert.equal(restoreProgress({version:1},level),null);
});

test('adventure migration keeps each level isolated and ignores unrelated keys',()=>{
  const [a,b]=PLATFORM_LEVELS;
  const wa=createWorld(a),wb=createWorld(b);wa.deaths=2;wb.deaths=7;
  const all=readAdventure({[a.id]:saveProgress(wa,a),[b.id]:saveProgress(wb,b),other:'bad'},PLATFORM_LEVELS);
  assert.equal(all[a.id].deaths,2);assert.equal(all[b.id].deaths,7);
  assert.equal(Object.keys(all).length,2);assert.deepEqual(readAdventure(null,PLATFORM_LEVELS),{});
});

test('dense freehand input is stabilised once and every committed point survives save and reload',()=>{
  const level=PLATFORM_LEVELS[0],world=createWorld(level),drawing=level.drawings[0];
  const a=drawing.path[0],b=drawing.path.at(-1)!;
  world.player.x=drawing.triggerX;
  assert(updateWorld(world,level,{left:false,right:false,crouch:false,draw:true},1/60).includes('draw-start'));
  assert(beginPlayerStroke(world,level,a).ok);
  // Preserve an intentional arch while removing a small, dense finger tremor.
  for(let i=1;i<2200;i++){
    const t=i/2200;
    appendPlayerStroke(world,level,{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t-35*Math.sin(Math.PI*t)+(i%2?2:-2)});
  }
  appendPlayerStroke(world,level,b);
  assert(finishPlayerStroke(world,level).ok);
  const committed=world.constructions[drawing.id];
  assert(committed.length>2&&committed.length<100,'the finger tremor is not saved as thousands of tiny zigzags');
  assert.deepEqual(committed[0],a);assert.deepEqual(committed.at(-1),b);
  assert(committed.some(point=>{
    const t=(point.x-a.x)/(b.x-a.x),baseline=a.y+(b.y-a.y)*t;
    return baseline-point.y>30;
  }),'the deliberate arch survives stabilisation');
  const saved=saveProgress(world,level),restored=restoreProgress(JSON.parse(JSON.stringify(saved)),level)!;
  assert.deepEqual(restored.drawn,[drawing.id]);
  assert.deepEqual(restored.constructions[drawing.id],world.constructions[drawing.id]);
});
