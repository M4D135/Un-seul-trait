import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as E from '../lib/trait/platformer';
import type { DrawingObstacle, GameWorld, PlatformHazard, PlatformInput, PlatformLevel, PlatformMechanism, PlatformPoint, PlatformSurface } from '../lib/trait/platformer';
import { PLATFORM_LEVELS as levels } from '../lib/trait/platform-levels';

const idle: PlatformInput = { left: false, right: false, jump: false, draw: false };
const dt = 1 / 120;
const tick = (w: GameWorld, l: PlatformLevel, input: PlatformInput = idle, seconds = dt) => E.updateWorld(w, l, input, seconds);
function run(w: GameWorld, l: PlatformLevel, seconds: number, input: PlatformInput = idle) { for (let t = 0; t < seconds; t += dt) tick(w, l, input); }
const floor = (x1: number, x2: number, y = 430): PlatformSurface => ({ a: { x: x1, y }, b: { x: x2, y } });
const platform: Extract<PlatformMechanism, { type: 'platform' }> = { id: 'ferry', type: 'platform', title: 'Ferry', prompt: 'Move', from: { x: 220, y: 430 }, to: { x: 540, y: 300 }, width: 132, speed: 150 };
const gate: Extract<PlatformMechanism, { type: 'gate' }> = { id: 'gate', type: 'gate', title: 'Gate', prompt: 'Lift', from: { x: 390, y: 430 }, to: { x: 390, y: 165 }, width: 32, height: 210 };
function fixture(changes: Partial<PlatformLevel> = {}): PlatformLevel {
  return { id: 101, title: 'Test', subtitle: '', palette: 'blue', width: 2000, start: { x: 160, y: 430 }, goal: { x: 1900, y: 430 }, surfaces: [floor(0, 2000)], hazards: [], drawings: [], stars: [], checkpoints: [{ x: 160, y: 430 }], mechanisms: [], ...changes };
}
function dragToEnd(w: GameWorld, l: PlatformLevel, mechanism: PlatformMechanism) {
  const h = E.getMechanismHandlePosition(w, mechanism), p = E.getMechanismPosition(w, mechanism);
  assert(E.beginMechanismInteraction(w, l, h).ok);
  E.moveMechanismInteraction(w, l, { x: h.x + mechanism.to.x - p.x, y: h.y + mechanism.to.y - p.y });
  E.endMechanismInteraction(w);
}
function draw(w: GameWorld, l: PlatformLevel, drawing: DrawingObstacle, points: PlatformPoint[] = drawing.path) {
  assert(tick(w, l, { ...idle, draw: true }).includes('draw-start'));
  assert.deepEqual(w.activeDrawing?.path, []);
  assert(E.beginPlayerStroke(w, l, points[0]).ok);
  for (const point of points.slice(1)) assert(E.appendPlayerStroke(w, l, point).ok);
  const result = E.finishPlayerStroke(w, l);
  assert(result.ok, `${l.id}/${drawing.id}: ${result.message}`);
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

test('F selects the nearest mechanism, toggles its endpoint, and recalls a parked ferry', () => {
  const l = fixture({ mechanisms: [platform, { ...gate, from: { x: 900, y: 430 }, to: { x: 900, y: 165 } }] });
  const w = E.createWorld(l); w.player.x = 220;
  assert.equal(E.getAvailableMechanism(w, l)?.id, 'ferry');
  assert(tick(w, l, { ...idle, interact: true }).includes('mechanism-start'));
  run(w, l, 3); assert.equal(w.mechanisms.ferry.progress, 1);
  E.restartAtCheckpoint(w, l);
  assert.equal(E.activateNearestMechanism(w, l).id, 'ferry');
  run(w, l, 3); assert.equal(w.mechanisms.ferry.progress, 0);
});

test('closed gates block walking and jumping; lifting at the stop unlocks them', () => {
  const l = fixture({ mechanisms: [gate] }), w = E.createWorld(l);
  run(w, l, 2, { ...idle, right: true });
  assert.equal(w.player.x, gate.from.x - gate.width / 2 - E.PLATFORM_PHYSICS.bodyRadius);
  tick(w, l, { ...idle, right: true, jump: true });
  run(w, l, 1.4, { ...idle, right: true });
  assert(w.player.x < gate.from.x);
  assert(E.activateNearestMechanism(w, l).ok);
  run(w, l, 2);
  assert.equal(w.mechanisms.gate.progress, 1, 'opening must work even while leaning against the door');
  assert(E.getMechanismHandlePosition(w, gate).y >= 65, 'the raised handle must remain reachable on-screen');
  run(w, l, 0.8, { ...idle, right: true });
  assert(w.player.x > gate.from.x + 50);
  w.player.x = gate.from.x; w.player.vx = 0;
  assert(E.activateNearestMechanism(w, l).ok);
  run(w, l, 2);
  assert.equal(w.phase, 'playing');
  assert(E.getMechanismPosition(w, gate).y <= w.player.y - 80, 'a lowering gate stops above the head');
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

test('manual free drawing, jumps and actual-velocity facing survive mechanism integration', () => {
  const l = { ...levels[0], mechanisms: [], hazards: [], stars: [], surfaces: [floor(-100, 5000)] };
  const w = E.createWorld(l), d = l.drawings[0], a = d.path[0], b = d.path.at(-1)!;
  w.player.x = d.triggerX;
  const path = [a, { x: a.x + 90, y: 375 }, { x: b.x - 90, y: 375 }, b];
  draw(w, l, d, path);
  assert.deepEqual(w.constructions[d.id], path);
  for (const prepare of [() => {}, () => run(w, l, 0.3, { ...idle, right: true }), () => tick(w, l, { ...idle, left: true })]) {
    prepare(); const y = w.player.y;
    assert(tick(w, l, { ...idle, jump: true }).includes('jump'));
    assert.equal(w.player.grounded, false);
    let top = w.player.y;
    for (let i = 0; i < 150; i++) { tick(w, l); top = Math.min(top, w.player.y); }
    assert(y - top > 100); assert(w.player.grounded);
  }
  run(w, l, 0.3, { ...idle, right: true });
  tick(w, l, { ...idle, left: true });
  assert(w.player.vx > 0); assert.equal(w.player.facing, 1);
  run(w, l, 0.3, { ...idle, left: true });
  assert(w.player.vx < 0); assert.equal(w.player.facing, -1);
});

test('drawing pauses mechanisms and death releases the hand while retaining progress, stars and constructions', () => {
  const l = levels[0], w = E.createWorld(l), d = l.drawings[0], m = l.mechanisms![0];
  assert(m.type === 'gate');
  w.player.x = d.triggerX;
  dragToEnd(w, l, m);
  tick(w, l, { ...idle, draw: true });
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

test('all eighteen bridges still validate through the public stroke API and support walking', () => {
  let count = 0;
  for (const source of levels) {
    const l = { ...source, hazards: [], stars: [], mechanisms: [], checkpoints: [], goal: { x: source.width + 100, y: 430 } };
    for (const d of l.drawings) {
      const w = E.createWorld(l); w.player.x = d.triggerX; w.player.y = d.path[0].y;
      draw(w, l, d);
      for (let i = 0; i < 1200 && w.player.x < d.path.at(-1)!.x + 20; i++) tick(w, l, { ...idle, right: true });
      assert.equal(w.phase, 'playing', `${l.id}/${d.id} fall`);
      assert(w.player.grounded && w.player.x >= d.path.at(-1)!.x + 20, `${l.id}/${d.id} endpoint`);
      count++;
    }
  }
  assert.equal(count, 18);
});

test('all six complete geometries remain traversable using drawing, ferries, gates and jumps', () => {
  for (const source of levels) {
    // Separate route/carry geometry from hazard timing, which is checked above.
    const l = { ...source, hazards: [], stars: [] }, w = E.createWorld(l);
    let waiting: string | null = null;
    for (let i = 0; i < 7200 && w.phase !== 'won'; i++) {
      assert.equal(w.phase, 'playing', `level ${l.id}, x=${w.player.x}, y=${w.player.y}`);
      const drawing = E.getAvailableDrawing(w, l);
      if (drawing && !w.drawn.includes(drawing.id)) draw(w, l, drawing);
      for (const m of l.mechanisms ?? []) {
        if (m.type !== 'platform' && w.mechanisms[m.id].target !== 1 && Math.abs(w.player.x - m.from.x) < 230) dragToEnd(w, l, m);
      }
      if (waiting && w.mechanisms[waiting].progress === 1) waiting = null;
      if (!waiting) {
        const m = (l.mechanisms ?? []).find(m => m.type === 'platform' && w.mechanisms[m.id].progress < 1 && w.player.grounded && Math.abs(w.player.y - m.from.y) < 1 && w.player.x >= m.from.x - 30 && w.player.x <= m.from.x + m.width / 2);
        if (m) {
          assert.equal(E.activateNearestMechanism(w, l).id, m.id, `level ${l.id} keyboard boarding`);
          waiting = m.id;
        }
      }
      const ahead = w.player.x + 28;
      const hasFloor = E.getWorldSurfaces(w, l).some(s => Math.abs(s.a.x - s.b.x) > 0.01 && ahead >= Math.min(s.a.x, s.b.x) && ahead <= Math.max(s.a.x, s.b.x));
      tick(w, l, { ...idle, right: !waiting, jump: !waiting && w.player.grounded && !hasFloor }, 1 / 60);
    }
    assert.equal(w.phase, 'won', `level ${l.id} stopped at ${w.player.x},${w.player.y}`);
    assert.equal(w.drawn.length, 3); assert.equal(w.deaths, 0);
    for (const m of (l.mechanisms ?? []).filter(m => m.type === 'platform')) assert.equal(w.mechanisms[m.id].progress, 1);
  }
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
