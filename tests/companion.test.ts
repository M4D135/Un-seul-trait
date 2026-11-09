import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCompanionState, updateCompanion, type CompanionState } from '../lib/trait/companion';
import { drawCartoonCharacter, getCharacterGroundSpan, type CartoonCharacterState } from '../lib/trait/cartoon-character';
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
  assert.equal(state.takes.touch, 1, 'hover must not act as repeated clicks');
  assert.equal(advance(state, world, level, 3, { pointer }).sequence, parked.sequence, 'a completed exchange stays quiet');
  const touchedAgain = updateCompanion(state, world, level, dt, { pointer, touched: true });
  assert.notEqual(touchedAgain.gesture, first.gesture, 'a new touch gets a different response');
  assert.equal(touchedAgain.sequence, parked.sequence + 1);
  assert.equal(state.takes.touch, 2);
});

test('a blocked character inspects the gap then exchanges separated replies with the cartoonist', () => {
  const { level, world, state } = fixture();
  world.player.x = 460;
  const reactions: string[] = [], speech: string[] = [], spokenAt: number[] = [];
  const focuses: { gesture: string; y: number }[] = [];
  let sequence = 0;
  for (let i = 0; i < 660; i++) {
    const acting = updateCompanion(state, world, level, dt);
    if (acting.sequence !== sequence) {
      sequence = acting.sequence;
      reactions.push(acting.gesture);
      if (acting.speech) { speech.push(acting.speech); spokenAt.push(state.time); }
      if (acting.target) focuses.push({ gesture: acting.gesture, y: acting.target.y });
    }
    if (acting.gesture !== 'none') assert(acting.age < acting.duration, 'every reaction has an end');
  }
  assert.equal(reactions[0], 'peek', 'look before asking for help');
  for (const gesture of ['point', 'listen', 'shrug', 'angry', 'impatient']) assert(reactions.includes(gesture));
  assert.deepEqual(speech, ['call', 'grumble', 'waiting']);
  for (let i = 1; i < spokenAt.length; i++) assert(spokenAt[i] - spokenAt[i - 1] >= 1.4, 'a pause separates original voice takes');
  assert(focuses.some(f => f.gesture === 'peek' && f.y > world.player.y), 'inspect the actual missing floor');
  assert(focuses.some(f => f.gesture === 'listen' && f.y < world.player.y - 120), 'then address the offscreen cartoonist');
  assert.equal(state.acting.gesture, 'none', 'impatience must not become a permanent pose');
  assert.equal(state.scene, null);
  assert.equal(state.takes.protest, 1, 'one scene is followed by calm, not constant shouting');
});

test('completed help receives one thank-you and landing compression expires', () => {
  const { level, world, state } = fixture();
  // A finished stroke is recorded by the drawing API outside updateWorld.
  world.drawn.push('finished-bridge');
  const thanks = updateCompanion(state, world, level, dt);
  assert.equal(thanks.gesture, 'delighted');
  assert.equal(thanks.speech, 'thanks');
  const utterances: string[] = [thanks.speech];
  let sequence = thanks.sequence;
  for (let i = 0; i < 120; i++) {
    const acting = updateCompanion(state, world, level, dt);
    if (acting.sequence !== sequence) {
      sequence = acting.sequence;
      if (acting.speech) utterances.push(acting.speech);
    }
  }
  const rested = advance(state, world, level, 2);
  assert.equal(rested.gesture, 'none');
  assert.deepEqual(utterances, ['thanks'], 'the acknowledgement after the spoken thank-you is silent');
  assert.equal(rested.sequence, sequence, 'a saved bridge must not restart the exchange');
  assert.equal(state.takes.thanks, 1);
  const landing = updateCompanion(state, world, level, dt, { events: ['land'] });
  assert.equal(landing.gesture, 'settle');
  assert.equal(advance(state, world, level, .5).gesture, 'none');
});

test('movement immediately cancels remaining replies without resetting travelled walk distance', () => {
  for (const interruption of ['walk', 'duck', 'fall'] as const) {
    const { level, world, state } = fixture();
    world.player.x = 460;
    advance(state, world, level, 2);
    assert(state.scene, 'the protest has started');
    world.player.travel = 37.4;
    if (interruption === 'walk') world.player.vx = 185;
    if (interruption === 'duck') world.player.crouching = true;
    if (interruption === 'fall') world.player.grounded = false;
    const controlledPlayer = structuredClone(world.player);
    const stopped = updateCompanion(state, world, level, dt);
    assert.equal(stopped.gesture, 'none', interruption);
    assert.equal(stopped.speech, undefined, interruption);
    assert.equal(state.scene, null, 'unfinished lines are discarded');
    assert.deepEqual(world.player, controlledPlayer, 'acting does not touch walk phase or physics');
    world.player.vx = 0; world.player.crouching = false; world.player.grounded = true;
    const sequence = stopped.sequence;
    advance(state, world, level, 3);
    assert.equal(state.acting.sequence, sequence, 'stopping does not resume an interrupted gesture or repeat the greeting');
  }
});

test('success interrupts a complaint and different help events use different thank-you gestures', () => {
  const { level, world, state } = fixture();
  world.player.x = 460;
  advance(state, world, level, 2);
  assert.equal(state.scene?.kind, 'protest');
  world.drawn.push('bridge-one');
  const first = updateCompanion(state, world, level, dt, { events: ['draw-complete'] });
  assert.equal(first.speech, 'thanks');
  assert.equal(state.scene?.kind, 'thanks');
  advance(state, world, level, 2);
  const second = updateCompanion(state, world, level, dt, { events: ['mechanism-settle'] });
  assert.equal(second.speech, 'thanks');
  assert.notEqual(second.gesture, first.gesture);
  advance(state, world, level, 2);
  world.phase = 'won';
  assert.equal(updateCompanion(state, world, level, dt).speech, 'win', 'the victory owns one voice cue');
  advance(state, world, level, 2);
  assert.equal(state.takes.thanks, 3, 'won does not re-trigger on subsequent frames');
});

test('repeat requests rotate three held-drawing scenes with long quiet intervals', () => {
  const { level, world, state } = fixture();
  world.player.x = 460;
  const scenes: string[][] = [];
  const starts: number[] = [], endings: number[] = [];
  let sequence = 0, wasActive = false;
  for (let i = 0; i < 60 * 48; i++) {
    const acting = updateCompanion(state, world, level, dt);
    const active = state.scene?.kind === 'protest';
    if (active && !wasActive) { scenes.push([]); starts.push(state.time); }
    if (!active && wasActive) endings.push(state.time);
    if (active && acting.sequence !== sequence) scenes.at(-1)!.push(acting.gesture);
    sequence = acting.sequence; wasActive = active;
  }
  assert(scenes.length >= 3 && scenes.length <= 4);
  assert.equal(new Set(scenes.slice(0, 3).map(scene => scene.join(','))).size, 3, 'new requests have different staging');
  for (let i = 1; i < starts.length; i++) assert(starts[i] - endings[i - 1] >= 7.5, 'calm separates complete exchanges');
});

function drawingCommands(state: CartoonCharacterState) {
  const commands: [string, ...number[]][] = [];
  const methods = ['save', 'restore', 'translate', 'scale', 'beginPath', 'moveTo', 'lineTo',
    'bezierCurveTo', 'quadraticCurveTo', 'closePath', 'fill', 'stroke'];
  const context = Object.fromEntries(methods.map(name => [name, (...args: number[]) => commands.push([name, ...args])])) as unknown as CanvasRenderingContext2D;
  drawCartoonCharacter(context, state);
  return commands;
}

test('walking, crouching and falling take visual priority over an unfinished gesture', () => {
  const state: CartoonCharacterState = {
    x: 200, y: 430, scale: .6, facing: -1, motion: 'idle', travel: 22.2, time: 1,
    talkAmount: 0, ink: '#fffdf6', background: '#064b8e', stroke: 3.8,
  };
  for (const name of ['point', 'shrug', 'listen', 'explain', 'recoil', 'acknowledge'] as const) {
    const gesture = { gesture: name, gestureAge: .4, gestureDuration: 1.1 };
    assert.notDeepEqual(drawingCommands(state), drawingCommands({ ...state, ...gesture }), `${name} is visible at rest`);
    for (const motion of ['walk', 'crouch', 'crouch-walk', 'fall'] as const) {
      assert.deepEqual(drawingCommands({ ...state, motion, ...gesture }), drawingCommands({ ...state, motion }), `${name}/${motion}`);
    }
  }
});

test('new discussion drawings remain one grounded open contour in either direction', () => {
  for (const gesture of ['listen', 'shrug', 'explain', 'recoil', 'acknowledge'] as const) {
    for (const facing of [-1, 1] as const) {
      const state: CartoonCharacterState = {
        x: 230, y: 430, scale: .6, facing, motion: 'idle', travel: 0, time: 1,
        talkAmount: .75, ink: '#fffdf6', background: '#064b8e', stroke: 3.8,
        gesture, gestureAge: .45, gestureDuration: 1.2,
      };
      const commands = drawingCommands(state);
      assert.equal(commands.filter(([method]) => method === 'moveTo').length, 1, 'no detached arms, eyes or feet');
      assert(!commands.some(([method]) => method === 'closePath'), 'ground must join both ends of the silhouette');
      const first = commands.find(([method]) => method === 'moveTo')!;
      const last = commands.filter(([method]) => ['lineTo', 'quadraticCurveTo', 'bezierCurveTo'].includes(method)).at(-1)!;
      assert.equal(first.at(-1), 260);
      assert.equal(last.at(-1), 260);
      assert(commands.every(([, ...values]) => values.every(Number.isFinite)), 'all deformed points stay finite');
    }
  }
});

test('silent poses do not generate syllables and reduced motion holds the central drawing', () => {
  const state: CartoonCharacterState = {
    x: 230, y: 430, scale: .6, facing: 1, motion: 'idle', travel: 0, time: 1,
    talkAmount: 0, ink: '#fffdf6', background: '#064b8e', stroke: 3.8,
    gestureAge: .45, gestureDuration: 1.2,
  };
  for (const gesture of ['call', 'angry', 'shrug', 'explain', 'impatient', 'listen'] as const) {
    const silent = drawingCommands({ ...state, gesture });
    assert.deepEqual(silent, drawingCommands({ ...state, gesture, time: 50 }), 'an idle audio clock does not wag the jaw');
    assert.notDeepEqual(silent, drawingCommands({ ...state, gesture, talkAmount: .9 }), 'the real sample amplitude articulates the mouth');
    assert.deepEqual(
      drawingCommands({ ...state, gesture, reducedMotion: true, gestureAge: .04 }),
      drawingCommands({ ...state, gesture, reducedMotion: true, gestureAge: 1.05 }),
      'reduced motion removes repeated anticipations and releases',
    );
  }
});

test('touch detection follows the lowered head while crouching', () => {
  const { level, world, state } = fixture();
  world.player.crouching = true;
  const acting = updateCompanion(state, world, level, dt, {
    pointer: { x: world.player.x + 30, y: world.player.y - 24 }, touched: true,
  });
  assert.equal(acting.gesture, 'curious');
  assert.equal(acting.speech, 'surprise');
  assert.equal(world.player.crouching, true);
});

test('low silhouettes remain grounded in both directions and fit a lower visual envelope', () => {
  for (const motion of ['crouch', 'crouch-walk'] as const) for (const facing of [-1, 1] as const) {
    const state: CartoonCharacterState = {
      x: 230, y: 430, scale: .6, facing, motion, travel: 29.6, time: 1,
      talkAmount: 0, ink: '#fffdf6', background: '#064b8e', stroke: 3.8,
    };
    const commands = drawingCommands(state), points: [number, number][] = [];
    let sx = 1, sy = 1, tx = 0, ty = 0;
    for (const [method, ...args] of commands) {
      if (method === 'translate') { tx += sx * args[0]; ty += sy * args[1]; }
      else if (method === 'scale') { sx *= args[0]; sy *= args[1]; }
      else if (['moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo'].includes(method)) {
        for (let i = 0; i < args.length; i += 2) points.push([tx + sx * args[i], ty + sy * args[i + 1]]);
      }
    }
    const first = points[0], last = points.at(-1)!, span = getCharacterGroundSpan(state);
    assert(Math.abs(first[1] - state.y) < .001 && Math.abs(last[1] - state.y) < .001);
    assert(Math.abs(Math.min(first[0], last[0]) - span.left) < .001);
    assert(Math.abs(Math.max(first[0], last[0]) - span.right) < .001);
    assert(Math.min(...points.map(p => p[1])) >= state.y - 55, 'the head stays low instead of redrawing an upright body');
    assert(!commands.some(([method]) => method === 'closePath'), 'the two feet must remain open to the floor');
  }
});
