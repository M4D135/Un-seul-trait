import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAmbientState, updateAmbient, drawAmbient, type AmbientState } from '../lib/trait/ambient-life';
import { sampleBirdPose } from '../lib/trait/ambient-bird-renderer';
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

test('approaching a resting bird prepares its takeoff, follows an arc, brakes and settles on the line', () => {
  const { level, world, state } = fixture();
  assert(state.birds.length >= 2);
  const bird = state.birds[0], start = { x: bird.x, y: bird.y };
  world.player.x = bird.x - 80;
  updateAmbient(state, world, level, dt);
  assert.equal(bird.phase, 'startled');
  assert.equal(bird.x, start.x);
  assert.equal(bird.y, start.y, 'anticipation keeps both feet on the line');
  advance(state, world, level, .46);
  assert.equal(bird.phase, 'flying');
  let sawAir = false, sawLanding = false, sawSettling = false, previous = { x: bird.x, y: bird.y };
  for (let i = 0; i < 600 && bird.phase !== 'perched'; i++) {
    updateAmbient(state, world, level, dt);
    assert(Math.hypot(bird.x - previous.x, bird.y - previous.y) < 115 * dt, 'a local flight stays readable at every frame');
    sawAir ||= bird.y < start.y - 30;
    sawLanding ||= bird.phase === 'landing';
    sawSettling ||= bird.phase === 'settling';
    previous = { x: bird.x, y: bird.y };
  }
  assert(sawAir && sawLanding && sawSettling);
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
  for (let i = 0; i < 1000 && bird.phase !== 'away'; i++) updateAmbient(state, world, level, dt);
  assert.equal(bird.phase, 'away');
  const awayAt = state.time;
  advance(state, world, level, 2);
  assert.equal(bird.phase, 'away', 'it does not instantly reappear under the pointer');
  let returnedThroughSky = false;
  for (let i = 0; i < 2500 && bird.phase !== 'perched'; i++) {
    updateAmbient(state, world, level, dt);
    returnedThroughSky ||= bird.phase === 'flying' && bird.y < 0;
  }
  assert(returnedThroughSky, 'return enters above the visible field rather than popping onto the floor');
  assert(state.time - awayAt >= 10);
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

test('resting outlines keep both feet on the line and no more than three birds fill a shot', () => {
  const { state, world, level } = fixture();
  state.motes = [];
  const source = state.birds[0];
  state.birds = [0, 1, 2, 3, 4, 5].map(index => ({ ...source, id: index, x: 250 + index * 80, age: 0 }));
  const before = structuredClone(state), drawn = commands(state, world, level);
  const birdPlacements = drawn.filter(([method, x]) => method === 'translate' && x >= 250);
  assert.equal(birdPlacements.length, 3);
  const contours = drawn.filter(([method, , y]) => method === 'moveTo' && y === 0);
  assert.equal(contours.length, 3, 'each ground contour starts at one actual contact point');
  const feet = drawn.filter(([method, , , , y]) => method === 'quadraticCurveTo' && y === 0);
  assert.equal(feet.length, 3, 'each ground contour returns to the other contact point');
  assert(drawn.every(([, ...args]) => args.every(Number.isFinite)));
  assert.deepEqual(state, before, 'draw calls cannot restart life or move it');
});

test('voluntary animation leaves long calm beats and does not advance off-screen birds', () => {
  const { state, world, level } = fixture();
  world.player.x = -1000;
  advance(state, world, level, 12, { viewport: { cameraX: 0, viewWidth: level.width } });
  assert(state.birds.every(bird => bird.phase === 'perched'), 'ambient life does not immediately fill the screen with flights');
  const offscreen = state.birds[state.birds.length - 1], before = structuredClone(offscreen);
  advance(state, world, level, 7, { viewport: { cameraX: 0, viewWidth: 400 } });
  assert.deepEqual(offscreen, before, 'a future part of the stage keeps its quiet starting pose');
});

test('takeoff and landing speed ramps preserve a bounded cruise instead of a timed long-distance dash', () => {
  const { state, world, level } = fixture();
  const bird = state.birds[0];
  world.player.x = bird.x - 80;
  advance(state, world, level, .46);
  assert(bird.flight && bird.flight.destination !== null);
  const flight = bird.flight, speeds: number[] = [];
  let previous = { x: bird.x, y: bird.y }, settledAt = -1;
  for (let i = 0; i < 1000; i++) {
    updateAmbient(state, world, level, dt);
    const speed = distanceFrom(previous, bird) / dt;
    speeds.push(speed); previous = { x: bird.x, y: bird.y };
    if (bird.phase === 'settling') { settledAt = state.time; break; }
  }
  assert(settledAt > 0);
  assert(Math.max(...speeds) <= 115 && Math.max(...speeds) > 65);
  assert(speeds[0] < 12, 'the lift-off begins with a push rather than an instant translation');
  assert(Math.max(...speeds.slice(-6)) < 3, 'the feet arrive at rest instead of stopping at cruising speed');
  assert(Math.abs(flight.to.x - flight.from.x) <= 560, 'a local flight does not choose a perch several screens away');
  const contact = { x: bird.x, y: bird.y };
  advance(state, world, level, .4);
  assert.equal(bird.phase, 'settling');
  assert.deepEqual({ x: bird.x, y: bird.y }, contact, 'the body absorbs contact while the feet stay planted');
});

function distanceFrom(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

test('flight poses remain continuous through takeoff, brake and grounded recovery', () => {
  const { state, world, level } = fixture();
  const bird = state.birds[0];
  world.player.x = bird.x - 80;
  let previous = sampleBirdPose(bird, state.time), previousPhase = bird.phase;
  const transitions = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    const oldWingPhase = bird.wingPhase;
    updateAmbient(state, world, level, dt);
    const current = sampleBirdPose(bird, state.time);
    assert(bird.wingPhase >= oldWingPhase && bird.wingPhase - oldWingPhase < .5, 'the articulated wing cycle never resets or jumps to another frame');
    if (bird.phase !== previousPhase) {
      transitions.add(`${previousPhase}:${bird.phase}`);
      for (const key of ['airborne', 'opening', 'brake', 'bodyPitch', 'prone'] as const) {
        assert(Math.abs(current[key] - previous[key]) < .06, `${key} stays connected across ${previousPhase}/${bird.phase}`);
      }
    }
    previous = current; previousPhase = bird.phase;
    if (transitions.has('settling:perched')) break;
  }
  assert(transitions.has('startled:flying') && transitions.has('landing:settling') && transitions.has('settling:perched'));
});

test('a prepared turn interpolates orientation before lift-off', () => {
  const { state, world, level } = fixture();
  const bird = state.birds[0]; bird.facing = -1; bird.turn = -1;
  world.player.x = bird.x - 80;
  updateAmbient(state, world, level, dt);
  assert.equal(bird.turn, -1, 'a threat does not instantaneously mirror the bird');
  let previous = bird.turn, sawFront = false;
  for (let i = 0; i < 27; i++) {
    updateAmbient(state, world, level, dt);
    assert(Math.abs(bird.turn - previous) < .19);
    sawFront ||= Math.abs(bird.turn) < .2; previous = bird.turn;
  }
  assert(sawFront && Number(bird.turn) === 1 && bird.phase === 'flying');
});

test('an airborne route clears a moving saw throughout its full travel', () => {
  const { state, world, level } = fixture({ hazards: [
    { id: 'flight-saw', type: 'gear', x: 640, y: 350, r: 30, axis: 'x', range: 65 },
  ] });
  const bird = { ...state.birds[0], ...state.perches[1], perch: 1 }, hazard = level.hazards[0];
  state.birds = [bird];
  world.player.x = bird.x - 80;
  advance(state, world, level, .46);
  assert(bird.flight && bird.flight.destination !== null);
  let crossed = false;
  for (let i = 0; i < 1000 && bird.phase !== 'settling'; i++) {
    updateAmbient(state, world, level, dt);
    crossed ||= bird.x > hazard.x;
    for (let phase = 0; phase < 32; phase++) {
      const center = getHazardPosition(hazard, phase * .2);
      assert(distanceFrom({ x: bird.x, y: bird.y - 17 }, center) > 63, 'the wings clear every saw position, not only its initial position');
    }
  }
  assert(crossed && bird.phase === 'settling');
});

test('birds do not start underneath a low overhang that would block unfolding their wings', () => {
  const { state } = fixture({ surfaces: [
    { a: { x: -100, y: 430 }, b: { x: 2400, y: 430 } },
    { a: { x: 300, y: 350 }, b: { x: 750, y: 350 } },
  ] });
  assert(state.perches.length > 0);
  assert(!state.perches.some(perch => perch.y === 430 && perch.x > 282 && perch.x < 768));
});

test('a newly drawn obstruction cancels a takeoff calmly instead of clipping or repeating a false landing', () => {
  const { state, world, level } = fixture();
  const bird = state.birds[0], contact = { x: bird.x, y: bird.y };
  state.birds = [bird];
  world.player.x = bird.x - 80;
  world.constructions['temporary-overhang'] = [
    { x: bird.x - 45, y: bird.y }, { x: bird.x - 45, y: bird.y - 65 },
    { x: bird.x + 45, y: bird.y - 65 }, { x: bird.x + 45, y: bird.y },
  ];
  let previousPhase = bird.phase, starts = 0;
  for (let i = 0; i < 180; i++) {
    updateAmbient(state, world, level, dt);
    if (bird.phase === 'startled' && previousPhase !== bird.phase) starts++;
    assert.equal(sampleBirdPose(bird, state.time).airborne, 0, 'there is no airborne pose without an available flight');
    assert.deepEqual({ x: bird.x, y: bird.y }, contact);
    previousPhase = bird.phase;
  }
  assert.equal(starts, 1, 'a blocked route has a quiet recovery interval');
  assert.equal(bird.phase, 'perched');
  assert(bird.reaction < .001 && bird.wingPower < .001);
});
