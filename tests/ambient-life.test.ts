import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAmbientState, updateAmbient, drawAmbient, type AmbientState } from '../lib/trait/ambient-life';
import { createWorld, getHazardPosition, type GameWorld, type PlatformLevel } from '../lib/trait/platformer';

const dt = 1 / 60;

function fixture(changes: Partial<PlatformLevel> = {}) {
  const level: PlatformLevel = {
    id: 7, title: 'Ambient test', subtitle: '', palette: 'blue', width: 2400,
    start: { x: 160, y: 430 }, goal: { x: 2310, y: 430 },
    surfaces: [{ a: { x: -100, y: 430 }, b: { x: 2400, y: 430 } }],
    hazards: [], drawings: [], stars: [], checkpoints: [], mechanisms: [], ...changes,
  };
  return { level, world: createWorld(level), state: createAmbientState(level) };
}

function advance(state: AmbientState, world: GameWorld, level: PlatformLevel, seconds: number,
  input: Parameters<typeof updateAmbient>[4] = {}) {
  for (let i = 0; i < Math.ceil(seconds / dt); i++) updateAmbient(state, world, level, dt, input);
}

test('approaching a resting bird triggers anticipation, a continuous flight and an exact landing', () => {
  const { level, world, state } = fixture();
  assert(state.birds.length >= 2);
  const bird = state.birds[0], start = { x: bird.x, y: bird.y };
  world.player.x = bird.x - 80;
  updateAmbient(state, world, level, dt);
  assert.equal(bird.phase, 'startled');
  assert.equal(bird.x, start.x);
  assert.equal(bird.y, start.y, 'anticipation keeps both feet on the line');
  advance(state, world, level, .16);
  assert.equal(bird.phase, 'flying');
  let sawAir = false, sawLanding = false, previous = { x: bird.x, y: bird.y };
  for (let i = 0; i < 600 && bird.phase !== 'perched'; i++) {
    updateAmbient(state, world, level, dt);
    assert(Math.hypot(bird.x - previous.x, bird.y - previous.y) < 20, 'no teleport during visible flight');
    sawAir ||= bird.y < start.y - 30;
    sawLanding ||= bird.phase === 'landing';
    previous = { x: bird.x, y: bird.y };
  }
  assert(sawAir && sawLanding);
  assert.equal(bird.phase, 'perched');
  assert.equal(bird.x, state.perches[bird.perch].x);
  assert.equal(bird.y, state.perches[bird.perch].y);
  assert.notEqual(bird.x, start.x, 'it chooses a different place instead of looping at one point');
  assert(Math.abs(bird.x - world.player.x) > 180);
});

test('a tap scares a bird while mere hovering does not, and a departed bird returns only after a pause', () => {
  const { level, world, state } = fixture({
    width: 380, start: { x: -200, y: 430 }, goal: { x: 1000, y: 430 },
    surfaces: [{ a: { x: 80, y: 430 }, b: { x: 340, y: 430 } }],
  });
  assert.equal(state.perches.length, 1);
  const bird = state.birds[0], pointer = { x: bird.x, y: bird.y - 15 };
  advance(state, world, level, .3, { pointer });
  assert.equal(bird.phase, 'perched');
  updateAmbient(state, world, level, dt, { pointer, touched: true });
  assert.equal(bird.phase, 'startled');
  for (let i = 0; i < 500 && bird.phase !== 'away'; i++) updateAmbient(state, world, level, dt);
  assert.equal(bird.phase, 'away');
  const awayAt = state.time;
  advance(state, world, level, 2);
  assert.equal(bird.phase, 'away', 'it does not instantly reappear under the pointer');
  let returnedThroughSky = false;
  for (let i = 0; i < 1100 && bird.phase !== 'perched'; i++) {
    updateAmbient(state, world, level, dt);
    returnedThroughSky ||= bird.phase === 'flying' && bird.y < 0;
  }
  assert(returnedThroughSky, 'return enters above the visible field rather than popping onto the floor');
  assert(state.time - awayAt >= 5);
  assert.equal(bird.phase, 'perched');
  assert.equal(bird.x, state.perches[0].x);
  assert.equal(bird.y, 430);
});

test('paused ambient time ignores new touch and preference events without mutating anything', () => {
  const { level, world, state } = fixture();
  const before = structuredClone(state), bird = state.birds[0];
  const result = updateAmbient(state, world, level, 0, {
    touched: true, pointer: { x: bird.x, y: bird.y - 15 }, reducedMotion: true,
  });
  assert.strictEqual(result, state);
  assert.deepEqual(state, before);
});

test('ambient life is deterministic for a chapter and never writes gameplay or level data', () => {
  const one = fixture(), two = fixture();
  const beforeWorld = structuredClone(one.world), beforeLevel = structuredClone(one.level);
  assert.deepEqual(one.state, two.state);
  advance(one.state, one.world, one.level, 24);
  advance(two.state, two.world, two.level, 24);
  assert.deepEqual(one.state, two.state, 'seeded flights and destinations reproduce exactly');
  assert.deepEqual(one.world, beforeWorld);
  assert.deepEqual(one.level, beforeLevel);
  const other = createAmbientState({ ...one.level, id: 8 });
  assert.notDeepEqual(other.birds.map(b => [b.x, b.wait]), one.state.birds.map(b => [b.x, b.wait]));
});

test('perches exclude complete moving danger envelopes, gaps and manipulation rails', () => {
  const { state, level } = fixture({
    surfaces: [
      { a: { x: 0, y: 430 }, b: { x: 1100, y: 430 } },
      { a: { x: 1370, y: 350 }, b: { x: 2400, y: 350 } },
    ],
    hazards: [
      { id: 'saw', type: 'gear', x: 530, y: 410, r: 30, axis: 'x', range: 95 },
      { id: 'spikes', type: 'spikes', x: 820, y: 405, w: 100, h: 25 },
      { id: 'swing', type: 'gear', x: 2150, y: 315, r: 28, motion: 'swing', armLength: 150, swingAngle: .45 },
    ],
    mechanisms: [{ id: 'lift', type: 'platform', title: 'Lift', prompt: '',
      from: { x: 1800, y: 350 }, to: { x: 1800, y: 160 }, width: 120, speed: 100 }],
  });
  assert(state.perches.length > 0);
  for (const perch of state.perches) {
    const floor = level.surfaces[perch.surface];
    assert(perch.x >= floor.a.x + 45 && perch.x <= floor.b.x - 45);
    assert.equal(perch.y, floor.a.y);
    if (perch.y === 430) {
      assert(Math.abs(perch.x - 530) > 95 + 30 + 60);
      assert(perch.x < 765 || perch.x > 975);
    }
    if (perch.y === 350) assert(Math.abs(perch.x - 1800) > 110);
    for (const hazard of level.hazards) if (hazard.type === 'gear') for (let sample = 0; sample < 60; sample++) {
      const position = getHazardPosition(hazard, sample * .1);
      assert(Math.hypot(perch.x - position.x, perch.y - 14 - position.y) > hazard.r + 60, 'the whole oscillation remains clear');
    }
  }
});

function commands(state: AmbientState, world: GameWorld, level: PlatformLevel, reducedMotion = false) {
  const result: [string, ...number[]][] = [];
  const names = ['save', 'restore', 'translate', 'scale', 'rotate', 'beginPath', 'moveTo', 'lineTo',
    'quadraticCurveTo', 'bezierCurveTo', 'closePath', 'fill', 'fillRect', 'stroke', 'arc'];
  const ctx = Object.fromEntries(names.map(name => [name, (...args: number[]) => result.push([name, ...args])])) as unknown as CanvasRenderingContext2D;
  drawAmbient(ctx, state, level, world, { cameraX: 0, viewWidth: 1000, ink: '#fff', background: '#064b8e', pixelScale: .5, reducedMotion });
  return result;
}

test('reduced motion keeps resting silhouettes and does not accumulate a resume jump', () => {
  const { state, world, level } = fixture();
  const bird = state.birds[0];
  updateAmbient(state, world, level, dt, { pointer: { x: bird.x, y: bird.y - 15 }, touched: true });
  advance(state, world, level, .5);
  updateAmbient(state, world, level, dt, { reducedMotion: true });
  const before = structuredClone(state), drawing = commands(state, world, level, true);
  advance(state, world, level, 20, { reducedMotion: true, touched: true, pointer: { x: bird.x, y: bird.y - 15 } });
  assert.deepEqual(state, before);
  assert.deepEqual(commands(state, world, level, true), drawing);
  assert(state.birds.every(item => item.phase === 'perched' && !item.flight));
});

test('resting outlines meet the line at both feet and rendering caps visible birds at four', () => {
  const { state, world, level } = fixture();
  state.motes = [];
  const source = state.birds[0];
  state.birds = [0, 1, 2, 3, 4, 5].map(index => ({ ...source, id: index, x: 250 + index * 80, age: 0 }));
  const before = structuredClone(state), drawn = commands(state, world, level);
  assert.equal(drawn.filter(([method]) => method === 'stroke').length, 4);
  assert.equal(drawn.filter(([method]) => method === 'moveTo').length, 4);
  assert(drawn.filter(([method]) => method === 'moveTo').every(([, x, y]) => x === -5 && y === 0));
  assert(!drawn.some(([method]) => method === 'closePath'), 'the grounded silhouette stays open into its floor');
  assert(drawn.every(([, ...args]) => args.every(Number.isFinite)));
  assert.deepEqual(state, before, 'draw calls cannot restart life or move it');
});
