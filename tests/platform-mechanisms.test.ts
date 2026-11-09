import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as E from '../lib/trait/platformer';
import type { DrawingObstacle, GameWorld, PlatformHazard, PlatformInput, PlatformLevel, PlatformMechanism, PlatformPoint, PlatformSurface } from '../lib/trait/platformer';
import { PLATFORM_LEVELS as levels } from '../lib/trait/platform-levels';
import { restoreProgress, saveProgress } from '../lib/trait/progress';

const idle: PlatformInput = { left: false, right: false, crouch: false, draw: false };
const dt = 1 / 120;
const tick = (w: GameWorld, l: PlatformLevel, input: PlatformInput = idle, seconds = dt) => E.updateWorld(w, l, input, seconds);
function run(w: GameWorld, l: PlatformLevel, seconds: number, input: PlatformInput = idle) { for (let t = 0; t < seconds; t += dt) tick(w, l, input); }
const floor = (x1: number, x2: number, y = 430): PlatformSurface => ({ a: { x: x1, y }, b: { x: x2, y } });
const platform: Extract<PlatformMechanism, { type: 'platform' }> = { id: 'ferry', type: 'platform', title: 'Ferry', prompt: 'Move', from: { x: 220, y: 430 }, to: { x: 540, y: 300 }, width: 132, speed: 150 };
const gate: Extract<PlatformMechanism, { type: 'gate' }> = { id: 'gate', type: 'gate', title: 'Gate', prompt: 'Lift', from: { x: 390, y: 430 }, to: { x: 390, y: 165 }, width: 32, height: 210 };
function fixture(changes: Partial<PlatformLevel> = {}): PlatformLevel {
  return { id: 101, title: 'Test', subtitle: '', palette: 'blue', width: 2000, start: { x: 160, y: 430 }, goal: { x: 1900, y: 430 }, surfaces: [floor(0, 2000)], hazards: [], drawings: [], stars: [], checkpoints: [{ x: 160, y: 430 }], mechanisms: [], ...changes };
}
function dragToEnd(w: GameWorld, l: PlatformLevel, mechanism: PlatformMechanism, fraction = 1, input: PlatformInput = idle) {
  const h = E.getMechanismHandlePosition(w, mechanism), p = E.getMechanismPosition(w, mechanism);
  assert(E.beginMechanismInteraction(w, l, h).ok);
  const destination = {
    x: h.x + mechanism.from.x + (mechanism.to.x - mechanism.from.x) * fraction - p.x,
    y: h.y + mechanism.from.y + (mechanism.to.y - mechanism.from.y) * fraction - p.y,
  };
  // A real press/drag/hold/release sequence: never assign simulation progress or target.
  for (let frame = 1; frame <= 180; frame++) {
    const t = Math.min(1, frame / 90);
    E.moveMechanismInteraction(w, l, { x: h.x + (destination.x - h.x) * t, y: h.y + (destination.y - h.y) * t });
    tick(w, l, input, 1 / 60);
  }
  E.endMechanismInteraction(w);
}
function draw(w: GameWorld, l: PlatformLevel, drawing: DrawingObstacle, points: PlatformPoint[] = drawing.path) {
  assert(E.beginPlayerStroke(w, l, points[0]).ok);
  assert.equal(w.phase, 'drawing');
  for (const point of points.slice(1)) assert(E.appendPlayerStroke(w, l, point).ok);
  const result = E.finishPlayerStroke(w, l);
  assert(result.ok, `${l.id}/${drawing.id}: ${result.message}`);
}

function boardNearbyPlatform(w: GameWorld, l: PlatformLevel): PlatformMechanism | null {
  const mechanism = (l.mechanisms ?? []).find(m => m.type === 'platform' && w.mechanisms[m.id].progress < 1
    && w.player.grounded && Math.abs(w.player.y - m.from.y) < 1
    && w.player.x >= m.from.x - 30 && w.player.x <= m.from.x + m.width / 2);
  if (mechanism) dragToEnd(w, l, mechanism, 1, { ...idle, crouch: true });
  return mechanism ?? null;
}

test('a dragged rail stays bounded and carries a standing hero without faking walking', () => {
  const l = fixture({ mechanisms: [platform] });
  const w = E.createWorld(l); w.player.x = platform.from.x;
  const h = E.getMechanismHandlePosition(w, platform);
  assert(E.beginMechanismInteraction(w, l, h).ok);
  E.moveMechanismInteraction(w, l, h);
  assert.equal(w.mechanisms.ferry.target, 0, 'grabbing a handle must not move the object');
  E.moveMechanismInteraction(w, l, { x: h.x + 3200, y: h.y - 1300 });
  assert.equal(w.mechanisms.ferry.target, 1);
  run(w, l, 3);
  assert.deepEqual(E.getMechanismPosition(w, platform), platform.to);
  assert(Math.abs(w.player.x - platform.to.x) < 0.001);
  assert(Math.abs(w.player.y - platform.to.y) < 0.001);
  assert(w.player.grounded);
  assert.equal(w.player.travel, 0);
  assert.equal(w.phase, 'playing');
  E.endMechanismInteraction(w); assert.equal(w.handInteraction, null);
});

test('a ferry responds only to a held handle, can be recalled, and stops at the exact release position', () => {
  const l = fixture({ mechanisms: [platform, { ...gate, from: { x: 900, y: 430 }, to: { x: 900, y: 165 } }] });
  const w = E.createWorld(l); w.player.x = 220;
  assert.equal(E.getAvailableMechanism(w, l)?.id, 'ferry');
  const legacyInput = { ...idle, interact: true };
  assert(!tick(w, l, legacyInput).includes('mechanism-start'));
  run(w, l, 1); assert.equal(w.mechanisms.ferry.progress, 0, 'a former F command has no effect');
  const handle = E.getMechanismHandlePosition(w, platform);
  assert(E.beginMechanismInteraction(w, l, handle).ok);
  E.moveMechanismInteraction(w, l, { x: handle.x + 80, y: handle.y - 32.5 });
  assert.equal(w.mechanisms.ferry.progress, .25, 'the handle follows the current finger position without a lagging trip');
  assert(w.mechanisms.ferry.progress > 0 && w.mechanisms.ferry.progress < 1);
  E.endMechanismInteraction(w);
  const stopped = E.getMechanismPosition(w, platform);
  run(w, l, 2);
  assert.deepEqual(E.getMechanismPosition(w, platform), stopped, 'no queued travel after releasing');
  assert.equal(w.mechanisms.ferry.target, w.mechanisms.ferry.progress);
  dragToEnd(w, l, platform); run(w, l, 1); assert.equal(w.mechanisms.ferry.progress, 1);
  E.restartAtCheckpoint(w, l);
  dragToEnd(w, l, platform, 0); run(w, l, 1); assert.equal(w.mechanisms.ferry.progress, 0);
});

test('finger-sized handle tolerance is bounded and an off-centre grab does not shift the object', () => {
  const l = fixture({ mechanisms: [platform] }), w = E.createWorld(l);
  const handle = E.getMechanismHandlePosition(w, platform), point = { x: handle.x + 46, y: handle.y - 15 };
  assert.equal(E.beginMechanismInteraction(w, l, point).ok, false);
  assert(E.beginMechanismInteraction(w, l, point, 54).ok);
  E.moveMechanismInteraction(w, l, point);
  run(w, l, .2);
  assert.equal(w.mechanisms.ferry.progress, 0);
  E.endMechanismInteraction(w);
  assert.equal(E.beginMechanismInteraction(w, l, { x: handle.x + 90, y: handle.y }, 1e6).ok, false);
  assert.equal(E.beginMechanismInteraction(w, l, point, Number.NaN).ok, false);
});

test('closed gates block upright and crouched walking; lifting unlocks them', () => {
  const l = fixture({ mechanisms: [gate] }), w = E.createWorld(l);
  run(w, l, 2, { ...idle, right: true });
  assert.equal(w.player.x, gate.from.x - gate.width / 2 - E.PLATFORM_PHYSICS.bodyRadius);
  tick(w, l, { ...idle, right: true, crouch: true });
  run(w, l, 1.4, { ...idle, right: true });
  assert(w.player.x < gate.from.x);
  dragToEnd(w, l, gate);
  assert.equal(w.mechanisms.gate.progress, 1, 'opening must work even while leaning against the door');
  assert(E.getMechanismHandlePosition(w, gate).y >= 65, 'the raised handle must remain reachable on-screen');
  run(w, l, 0.8, { ...idle, right: true });
  assert(w.player.x > gate.from.x + 50);
  w.player.x = gate.from.x; w.player.vx = 0;
  dragToEnd(w, l, gate, 0);
  assert.equal(w.phase, 'playing');
  assert(E.getMechanismPosition(w, gate).y <= w.player.y - 80, 'a lowering gate stops above the head');
});

test('crouching fits under a low gate and cannot stand up until the head is clear', () => {
  const lowGate = { ...gate, width: 120, from: { x: 390, y: 376 } };
  const l = fixture({ mechanisms: [lowGate] }), w = E.createWorld(l);
  run(w, l, 1.5, { ...idle, right: true });
  assert.equal(w.player.x, 320, 'the upright body is stopped by the low gate');
  run(w, l, 1, { ...idle, right: true, crouch: true });
  assert(w.player.x > 390 && w.player.crouching);
  run(w, l, 0.1);
  assert(w.player.crouching, 'releasing Down under the gate must not unfold the body');
  run(w, l, 1, { ...idle, right: true });
  assert(w.player.x > 480); assert.equal(w.player.crouching, false); assert.equal(w.deaths, 0);

  const closing = fixture({ mechanisms: [gate] }), cw = E.createWorld(closing);
  cw.player.x = gate.from.x; cw.player.crouching = true;
  cw.mechanisms.gate = { progress: 1, target: 1 };
  dragToEnd(cw, closing, gate, 0, { ...idle, crouch: true });
  const bottom = E.getMechanismPosition(cw, gate).y;
  assert(bottom > 350 && bottom <= 386, 'closing clearance uses the 44-unit crouched body');
  run(cw, closing, 0.1);
  assert(cw.player.crouching); assert.equal(cw.deaths, 0);
});

test('an overhead wheel is dangerous upright and safe during a held or obstructed crouch', () => {
  const l = fixture({ hazards: [{ id: 'low-wheel', type: 'gear', x: 390, y: 342, r: 28 }] });
  const standing = E.createWorld(l);
  run(standing, l, 1.5, { ...idle, right: true });
  assert.equal(standing.deaths, 1);
  const crouched = E.createWorld(l);
  run(crouched, l, 2.4, { ...idle, right: true, crouch: true });
  assert(Math.abs(crouched.player.x - 390) < 25); assert.equal(crouched.deaths, 0);
  run(crouched, l, 0.1);
  assert(crouched.player.crouching);
  run(crouched, l, 1.2, { ...idle, right: true });
  assert(crouched.player.x > 460); assert.equal(crouched.player.crouching, false); assert.equal(crouched.deaths, 0);
});

test('walking toward an unfinished gap stops at the edge without a launch or a forced fall', () => {
  const l = fixture({ surfaces: [floor(0, 300), floor(600, 2000)] }), w = E.createWorld(l);
  run(w, l, 3, { ...idle, right: true });
  assert(w.player.x > 298 && w.player.x <= 300);
  assert.equal(w.player.y, 430); assert.equal(w.player.vy, 0); assert.equal(w.player.vx, 0);
  assert(w.player.grounded); assert.equal(w.deaths, 0);
  run(w, l, 0.3, { ...idle, left: true });
  assert(w.player.x < 270, 'the player can turn back from the edge');
});

test('movable and free gear collisions use exactly their rendered positions', () => {
  const wheel: Extract<PlatformHazard, { type: 'gear' }> = { id: 'wheel', type: 'gear', x: 340, y: 405, r: 28, axis: 'x', range: 50, speed: 2 };
  const handle: Extract<PlatformMechanism, { type: 'gear' }> = { id: 'wheel-handle', type: 'gear', hazardId: 'wheel', title: 'Wheel', prompt: 'Lift', from: { x: 340, y: 405 }, to: { x: 340, y: 175 }, width: 56 };
  const l = fixture({ hazards: [wheel], mechanisms: [handle] }), w = E.createWorld(l);
  assert.deepEqual(E.getWorldHazardPosition(w, l, wheel), E.getMechanismPosition(w, handle));
  dragToEnd(w, l, handle); run(w, l, 2);
  assert.deepEqual(E.getWorldHazardPosition(w, l, wheel), handle.to);
  w.player.x = wheel.x; run(w, l, 0.3); assert.equal(w.phase, 'playing', 'old wheel coordinates must no longer be lethal');
  w.player.y = 205; w.player.grounded = false;
  assert(tick(w, l).includes('death'), 'the parked wheel itself is still a real hazard');
  const free = fixture({ hazards: [wheel] }), fw = E.createWorld(free); fw.time = 1.25;
  assert.deepEqual(E.getWorldHazardPosition(fw, free, wheel), E.getHazardPosition(wheel, fw.time));
});

test('manual free drawing, crouch walking and actual-velocity facing remain independent', () => {
  const l = { ...levels[0], mechanisms: [], hazards: [], stars: [], surfaces: [floor(-100, 5000)] };
  const w = E.createWorld(l), d = l.drawings[0], a = d.path[0], b = d.path.at(-1)!;
  w.player.x = d.triggerX;
  const path = [a, { x: a.x + 90, y: 375 }, { x: b.x - 90, y: 375 }, b];
  draw(w, l, d, path);
  assert.deepEqual(w.constructions[d.id], path);
  run(w, l, 0.3, { ...idle, right: true });
  tick(w, l, { ...idle, left: true });
  assert(w.player.vx > 0); assert.equal(w.player.facing, 1);
  run(w, l, 0.3, { ...idle, left: true });
  assert(w.player.vx < 0); assert.equal(w.player.facing, -1);
  run(w, l, 0.5, { ...idle, right: true, crouch: true });
  assert(w.player.crouching); assert.equal(w.player.vx, E.PLATFORM_PHYSICS.crouchSpeed);
  assert.equal(w.player.y,430); assert.equal(w.player.vy,0); assert(w.player.grounded);
  run(w,l,.2); assert.equal(w.player.crouching,false); assert.equal(E.getPlayerHeight(w.player),80);
});

test('drawing pauses mechanisms and death releases the hand while retaining progress, stars and constructions', () => {
  const l = levels[0], w = E.createWorld(l), d = l.drawings[0], m = l.mechanisms![0];
  assert(m.type === 'gate');
  w.player.x = d.path[0].x - 1;
  const handle = E.getMechanismHandlePosition(w, m);
  assert(E.beginMechanismInteraction(w, l, handle).ok);
  E.moveMechanismInteraction(w, l, { x: handle.x, y: handle.y + (m.to.y - m.from.y) * .3 });
  tick(w, l, idle, .08);
  assert(w.mechanisms[m.id].progress > 0 && w.mechanisms[m.id].progress < 1);
  assert(tick(w, l, { ...idle, draw: true }).includes('draw-start'));
  assert.equal(w.handInteraction, null, 'drawing releases the held mechanism');
  const frozen = JSON.stringify(w);
  run(w, l, 2); assert.equal(JSON.stringify(w), frozen);
  assert(E.beginPlayerStroke(w, l, d.path[0]).ok);
  for (const point of d.path.slice(1)) E.appendPlayerStroke(w, l, point);
  assert(E.finishPlayerStroke(w, l).ok);
  const savedPath = w.constructions[d.id]; w.collected = [0]; w.checkpointIndex = 0;
  assert(E.beginMechanismInteraction(w, l, E.getMechanismHandlePosition(w, m)).ok);
  E.moveMechanismInteraction(w, l, { x: m.to.x, y: m.to.y - m.height / 2 + 20 });
  w.player.y = 700; w.player.grounded = false;
  assert(tick(w, l).includes('death'));
  assert.equal(w.handInteraction, null);
  for (const s of Object.values(w.mechanisms)) assert.equal(s.target, s.progress);
  run(w, l, 1.1);
  assert.equal(w.phase, 'playing'); assert.strictEqual(w.constructions[d.id], savedPath);
  assert.deepEqual(w.collected, [0]); assert.equal(w.deaths, 1);
});

test('one fast pointer move reaches a clear rail endpoint, but swept riders cannot pass through a hazard', () => {
  const l = fixture({ mechanisms: [gate] }), w = E.createWorld(l);
  const h = E.getMechanismHandlePosition(w, gate);
  assert(E.beginMechanismInteraction(w, l, h).ok);
  E.moveMechanismInteraction(w, l, { x: h.x, y: h.y + gate.to.y - gate.from.y });
  assert.equal(w.mechanisms.gate.progress, 1, 'even a coalesced 0.2-second drag reaches the pointer before release');
  assert(!tick(w, l).includes('mechanism-settle'), 'holding does not play an arrival after every pointer sample');
  E.endMechanismInteraction(w);
  assert(tick(w, l).includes('mechanism-settle'));
  assert(!tick(w, l).includes('mechanism-settle'), 'one arrival per completed gesture');

  const ferry = { ...platform, from: { x: 220, y: 430 }, to: { x: 540, y: 430 } };
  const blocked = fixture({ mechanisms: [ferry], hazards: [{ id: 'crossing-wheel', type: 'gear', x: 390, y: 380, r: 28 }] });
  const rider = E.createWorld(blocked); rider.player.x = 220;
  const start = E.getMechanismHandlePosition(rider, ferry);
  assert(E.beginMechanismInteraction(rider, blocked, start).ok);
  E.moveMechanismInteraction(rider, blocked, { x: start.x + 320, y: start.y });
  assert(rider.player.x > 300 && rider.player.x < 360, 'the carried body is stopped before the wheel even in one mousemove');
  assert(rider.mechanisms.ferry.progress < 1);
  const stopped = rider.player.x;
  E.endMechanismInteraction(rider); run(rider, blocked, 1);
  assert.equal(rider.player.x, stopped);
  assert.equal(rider.deaths, 0);
});

test('pendulum collisions follow a circular swing with the same fixed pivot used for drawing', () => {
  const pendulum: Extract<PlatformHazard, { type: 'gear' }> = {
    id: 'pendulum', type: 'gear', appearance: 'pendulum', motion: 'swing',
    x: 390, y: 340, r: 28, armLength: 150, swingAngle: .36, speed: 1.2,
  };
  const l = fixture({ hazards: [pendulum] }), w = E.createWorld(l);
  const pivot = { x: pendulum.x, y: pendulum.y - pendulum.armLength! };
  const centres: PlatformPoint[] = [];
  for (let i = 0; i < 80; i++) {
    w.time = i / 10;
    const centre = E.getWorldHazardPosition(w, l, pendulum);
    assert(Math.abs(Math.hypot(centre.x - pivot.x, centre.y - pivot.y) - 150) < 1e-9);
    assert(centre.y <= pendulum.y + 1e-9, 'the ball rises at the ends of its arc');
    centres.push(centre);
  }
  assert(Math.max(...centres.map(p => p.x)) - Math.min(...centres.map(p => p.x)) > 100);
  const standing = E.createWorld(l); standing.player.x = 390;
  assert(tick(standing, l).includes('death'), 'the low centre is dangerous upright');
  const low = E.createWorld(l); low.player.x = 390;
  run(low, l, 8, { ...idle, crouch: true });
  assert.equal(low.deaths, 0, 'the whole arc leaves the authored crouch clearance');
});

test('all eighteen bridges still validate through the public stroke API and support walking', () => {
  let count = 0;
  for (const source of levels) {
    const l = { ...source, hazards: [], stars: [], mechanisms: [], checkpoints: [], goal: { x: source.width + 100, y: 430 } };
    for (const d of l.drawings) {
      const w = E.createWorld(l); w.player.x = d.path[0].x - 1; w.player.y = d.path[0].y;
      draw(w, l, d);
      for (let i = 0; i < 1200 && w.player.x < d.path.at(-1)!.x + 20; i++) tick(w, l, { ...idle, right: true });
      assert.equal(w.phase, 'playing', `${l.id}/${d.id} fall`);
      assert(w.player.grounded && w.player.x >= d.path.at(-1)!.x + 20, `${l.id}/${d.id} endpoint`);
      count++;
    }
  }
  assert.equal(count, 18);
});

test('an old saved flat bridge can be redrawn from either bank after the new spike layout', () => {
  const l = levels[0], d = l.drawings[0], saved = saveProgress(E.createWorld(l), l);
  saved.constructions[d.id] = [{ ...d.path[0] }, { ...d.path[d.path.length - 1] }];
  saved.mechanisms['premiere-porte'] = 1;
  const w = restoreProgress(JSON.parse(JSON.stringify(saved)), l)!;
  assert.deepEqual(w.drawn, [d.id]);
  for (let i = 0; i < 1600 && w.phase !== 'dead'; i++) { boardNearbyPlatform(w, l); tick(w, l, { ...idle, right: true }); }
  assert.equal(w.phase, 'dead', 'the old flat line reaches the new spikes');
  assert.equal(w.deaths, 1); run(w, l, 1.1);
  for (let i = 0; i < 1400 && E.getAvailableDrawing(w, l)?.id !== d.id; i++) {
    const lift = (l.mechanisms ?? []).find(m => m.id === 'ascenseur-du-debut');
    if (lift && w.player.x < lift.from.x && w.mechanisms[lift.id].progress === 1) dragToEnd(w, l, lift, 0);
    boardNearbyPlatform(w, l); tick(w, l, { ...idle, right: true });
  }
  assert.equal(E.getAvailableDrawing(w, l)?.id, d.id, 'the existing passage remains editable before crossing');
  draw(w, l, d);
  for (let i = 0; i < 1400 && w.player.x < l.checkpoints[0].x + 5; i++) tick(w, l, { ...idle, right: true });
  assert(w.player.x >= l.checkpoints[0].x + 5); assert.equal(w.deaths, 1);
  const fromRight = restoreProgress({ ...saved, checkpointIndex: 0 }, l)!;
  assert.equal(E.getAvailableDrawing(fromRight, l)?.id, d.id, 'the far-bank checkpoint also offers redrawing');
  draw(fromRight, l, d, [...d.path].reverse());
  assert.deepEqual(fromRight.constructions[d.id], d.path);
});

test('all six routes finish without a jump using only drawn passages and pointer-held mechanisms', () => {
  let verticalLifts = 0;
  for (const source of levels) {
    const l = source, w = E.createWorld(l);
    let crouchFrames = 0;
    for (let i = 0; i < 7200 && w.phase !== 'won'; i++) {
      assert.equal(w.phase, 'playing', `level ${l.id}, x=${w.player.x}, y=${w.player.y}`);
      const drawing = E.getAvailableDrawing(w, l);
      if (drawing && !w.drawn.includes(drawing.id)) draw(w, l, drawing);
      for (const m of l.mechanisms ?? []) {
        if (m.type !== 'platform' && w.mechanisms[m.id].progress !== 1 && Math.abs(w.player.x - m.from.x) < 230) dragToEnd(w, l, m, 1, { ...idle, crouch: true });
      }
      const boarded = boardNearbyPlatform(w, l);
      if (boarded && boarded.from.x === boarded.to.x && boarded.from.y !== boarded.to.y) verticalLifts++;
      const crouch = l.hazards.some(h => {
        if(h.type!=='gear')return false;
        const position=E.getWorldHazardPosition(w,l,h);
        return Math.abs(position.x-w.player.x)<h.r+80 && position.y<w.player.y-12 && position.y>w.player.y-130;
      });
      if(crouch)crouchFrames++;
      tick(w, l, { ...idle, right: true, crouch }, 1 / 60);
      assert(w.player.vy>=0,`level ${l.id} acquired an upward velocity`);
    }
    assert.equal(w.phase, 'won', `level ${l.id} stopped at ${w.player.x},${w.player.y}`);
    assert.equal(w.drawn.length, 3); assert.equal(w.deaths, 0);
    assert.equal(w.collected.length,3,`level ${l.id} missing a walking star`);
    assert(crouchFrames>0,`level ${l.id} never exercised crouching`);
    for (const m of (l.mechanisms ?? []).filter(m => m.type === 'platform')) assert.equal(w.mechanisms[m.id].progress, 1);
  }
  assert.equal(verticalLifts, 4, 'all four true vertical lifts were boarded and hand-driven');
});

test('all twenty-four checkpoint spawns stay safe through a full moving-hazard cycle', () => {
  let count = 0;
  for (const l of levels) for (let index = 0; index < l.checkpoints.length; index++) {
    const w = E.createWorld(l); w.checkpointIndex = index; E.restartAtCheckpoint(w, l); w.invulnerable = 0;
    run(w, l, 20);
    assert.equal(w.deaths, 0, `unsafe checkpoint ${l.id}/${index}`); count++;
  }
  assert.equal(count, 24);
});
