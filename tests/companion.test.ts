import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCompanionState, updateCompanion, type CompanionState } from '../lib/trait/companion';
import { drawCartoonCharacter, type CartoonCharacterState } from '../lib/trait/cartoon-character';
import { createWorld, type GameWorld, type PlatformLevel } from '../lib/trait/platformer';

const dt = 1 / 60;

function fixture(changes: Partial<PlatformLevel> = {}) {
  const level: PlatformLevel = {
    id: 101, title: 'Companion test', subtitle: '', palette: 'blue', width: 1500,
    start: { x: 160, y: 430 }, goal: { x: 1400, y: 430 },
    surfaces: [{ a: { x: -100, y: 430 }, b: { x: 500, y: 430 } }],
    hazards: [], drawings: [], stars: [], checkpoints: [], mechanisms: [], ...changes,
  };
  const world = createWorld(level);
  return { level, world, state: createCompanionState(world) };
}

function advance(
  state: CompanionState, world: GameWorld, level: PlatformLevel, seconds: number,
  options: Parameters<typeof updateCompanion>[4] = {},
) {
  for (let i = 0; i < Math.ceil(seconds / dt); i++) updateCompanion(state, world, level, dt, options);
  return state.acting;
}

test('companion reactions leave player control and the simulation world untouched', () => {
  const { level, world, state } = fixture({ mechanisms: [{
    id: 'gate', type: 'gate', title: 'Gate', prompt: 'Lift',
    from: { x: 420, y: 430 }, to: { x: 420, y: 165 }, width: 32, height: 210,
  }] });
  world.player.x = 340;
  const beforeWorld = structuredClone(world), beforeLevel = structuredClone(level);
  const acting = updateCompanion(state, world, level, dt, {
    pointer: { x: 320, y: 351 }, touched: true,
  });
  assert.equal(acting.facing, -1, 'the presentation can look toward the person');
  assert.equal(world.player.facing, 1, 'looking must not turn the controlled body');
  advance(state, world, level, 10);
  assert.deepEqual(world, beforeWorld);
  assert.deepEqual(level, beforeLevel);
});

test('zero presentation time freezes an active reaction and ignores new triggers', () => {
  const { level, world, state } = fixture();
  updateCompanion(state, world, level, dt, { pointer: { x: 160, y: 351 }, touched: true });
  const before = structuredClone(state), active = state.acting;
  const paused = updateCompanion(state, world, level, 0, {
    pointer: { x: 175, y: 351 }, touched: true, events: ['land', 'mechanism-settle'],
  });
  assert.strictEqual(paused, active);
  assert.deepEqual(state, before);
});

test('touching the head has a cooldown and a parked pointer never repeats the reaction', () => {
  const { level, world, state } = fixture();
  const pointer = { x: 165, y: 350 };
  const first = updateCompanion(state, world, level, dt, { pointer, touched: true });
  assert.equal(first.gesture, 'curious');
  assert.equal(first.speech, 'surprise');
  const sequence = first.sequence;
  advance(state, world, level, .4, { pointer });
  assert.equal(updateCompanion(state, world, level, dt, { pointer, touched: true }).sequence, sequence);
  const parked = advance(state, world, level, 2.5, { pointer });
  assert.equal(parked.gesture, 'none');
  assert.equal(parked.sequence, sequence, 'hover must not act as repeated clicks');
  const touchedAgain = updateCompanion(state, world, level, dt, { pointer, touched: true });
  assert.equal(touchedAgain.gesture, 'curious');
  assert.equal(touchedAgain.sequence, sequence + 1);
});

test('waiting at an edge progresses from looking to calling and then releases each pose', () => {
  const { level, world, state } = fixture();
  world.player.x = 460;
  const reactions: string[] = [], speech: string[] = [];
  let sequence = 0;
  for (let i = 0; i < 660; i++) {
    const acting = updateCompanion(state, world, level, dt);
    if (acting.sequence !== sequence) {
      sequence = acting.sequence;
      reactions.push(acting.gesture);
      if (acting.speech) speech.push(acting.speech);
    }
    if (acting.gesture !== 'none') assert(acting.age < acting.duration, 'every reaction has an end');
  }
  assert.deepEqual(reactions, ['peek', 'point', 'call', 'impatient']);
  assert.deepEqual(speech, ['call', 'grumble']);
  assert.equal(state.acting.gesture, 'none', 'impatience must not become a permanent pose');
});

test('completed help receives one thank-you and landing compression expires', () => {
  const { level, world, state } = fixture();
  // A finished stroke is recorded by the drawing API outside updateWorld.
  world.drawn.push('finished-bridge');
  const thanks = updateCompanion(state, world, level, dt);
  assert.equal(thanks.gesture, 'delighted');
  assert.equal(thanks.speech, 'thanks');
  const sequence = thanks.sequence;
  const rested = advance(state, world, level, 2);
  assert.equal(rested.gesture, 'none');
  assert.equal(rested.sequence, sequence, 'a saved bridge must not trigger a thank-you every frame');
  const landing = updateCompanion(state, world, level, dt, { events: ['land'] });
  assert.equal(landing.gesture, 'settle');
  assert.equal(advance(state, world, level, .5).gesture, 'none');
});

function drawingCommands(state: CartoonCharacterState) {
  const commands: [string, ...number[]][] = [];
  const methods = ['save', 'restore', 'translate', 'scale', 'beginPath', 'moveTo', 'lineTo',
    'bezierCurveTo', 'quadraticCurveTo', 'closePath', 'fill', 'stroke'];
  const context = Object.fromEntries(methods.map(name => [name, (...args: number[]) => commands.push([name, ...args])])) as unknown as CanvasRenderingContext2D;
  drawCartoonCharacter(context, state);
  return commands;
}

test('walking, jumping and falling take visual priority over an unfinished gesture', () => {
  const state: CartoonCharacterState = {
    x: 200, y: 430, scale: .6, facing: -1, motion: 'idle', travel: 22.2, time: 1,
    talkAmount: 0, ink: '#fffdf6', background: '#064b8e', stroke: 3.8,
  };
  const gesture = { gesture: 'point' as const, gestureAge: .4, gestureDuration: 1.1 };
  assert.notDeepEqual(drawingCommands(state), drawingCommands({ ...state, ...gesture }), 'the test gesture is visible at rest');
  for (const motion of ['walk', 'jump', 'fall'] as const) {
    assert.deepEqual(drawingCommands({ ...state, motion, ...gesture }), drawingCommands({ ...state, motion }), motion);
  }
});
