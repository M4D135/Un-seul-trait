import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appendPlayerStroke, beginMechanismInteraction, beginPlayerStroke, createWorld,
  endMechanismInteraction, evaluatePuzzleRequirements, finishPlayerStroke,
  getGoalInterlock, getMechanismHandlePosition, getMechanismInterlock,
  getMechanismPosition, getMechanismPositions, moveMechanismInteraction,
  restartAtCheckpoint, selectDrawingChoice, updateWorld,
  type GameWorld, type PlatformLevel, type PlatformMechanism, type PuzzleRequirement,
} from '../lib/trait/platformer';
import { restoreProgress, saveProgress } from '../lib/trait/progress';

const idle = { left: false, right: false, draw: false };
const regulator = (id: string, x: number): PlatformMechanism => ({
  id, type: 'gate', title: `Régulateur ${id}`, prompt: 'Aligne le repère.',
  from: { x, y: 250 }, to: { x, y: 70 }, width: 26, height: 40,
  detents: [0, .25, .5, .75, 1],
});
const required: PuzzleRequirement[] = [
  { mechanismId: 'a', min: .46, max: .54, label: 'La lune au milieu' },
  { mechanismId: 'b', min: .96, label: 'Le soleil en haut' },
];
function fixture(changes: Partial<PlatformLevel> = {}): PlatformLevel {
  return {
    id: 107, title: 'Contacts', subtitle: '', palette: 'blue', width: 1600,
    start: { x: 100, y: 430 }, goal: { x: 1450, y: 430 },
    surfaces: [{ a: { x: 0, y: 430 }, b: { x: 1600, y: 430 } }],
    drawings: [], hazards: [], stars: [], checkpoints: [{ x: 100, y: 430 }],
    mechanisms: [regulator('a', 240), regulator('b', 370), {
      id: 'lock', type: 'gate', title: 'La porte des deux repères', prompt: 'Soulève la porte.',
      from: { x: 550, y: 430 }, to: { x: 550, y: 180 }, width: 30, height: 175,
      interlock: { requirements: required, message: 'Les deux repères doivent correspondre.' },
    }], ...changes,
  };
}
function drag(world: GameWorld, level: PlatformLevel, id: string, fraction: number) {
  const mechanism = level.mechanisms!.find(item => item.id === id)!;
  const handle = getMechanismHandlePosition(world, mechanism), position = getMechanismPosition(world, mechanism);
  const grabbed = beginMechanismInteraction(world, level, handle);
  if (!grabbed.ok) return grabbed;
  moveMechanismInteraction(world, level, {
    x: handle.x + mechanism.from.x + (mechanism.to.x - mechanism.from.x) * fraction - position.x,
    y: handle.y + mechanism.from.y + (mechanism.to.y - mechanism.from.y) * fraction - position.y,
  });
  endMechanismInteraction(world);
  return grabbed;
}
function run(world: GameWorld, level: PlatformLevel, seconds: number, right = false) {
  for (let frame = 0; frame < seconds * 120; frame++) updateWorld(world, level, { ...idle, right }, 1 / 120);
}

test('two simultaneous contacts are physical prerequisites and opening everything is not a solution', () => {
  const level = fixture(), world = createWorld(level), door = level.mechanisms![2];
  const blocked = drag(world, level, 'lock', 1);
  assert.equal(blocked.ok, false); assert.equal(blocked.message, 'Les deux repères doivent correspondre.');
  assert.equal(world.handInteraction, null); assert.equal(world.mechanisms.lock.progress, 0);
  assert(drag(world, level, 'a', 1).ok); assert(drag(world, level, 'b', 1).ok);
  const wrong = getMechanismInterlock(world, level, door);
  assert(wrong.locked); assert.deepEqual(wrong.items.map(item => item.satisfied), [false, true]);
  assert.equal(drag(world, level, 'lock', 1).ok, false, 'all endpoints raised must still fail');
  assert(drag(world, level, 'a', .5).ok);
  assert.equal(getMechanismInterlock(world, level, door).locked, false);
  assert(drag(world, level, 'lock', 1).ok); assert.equal(world.mechanisms.lock.progress, 1);
  run(world, level, 3, true);
  assert(world.player.x > 600, 'the unlocked opening really admits the player');
  assert.equal(world.deaths, 0); assert.equal(world.player.vy, 0);
});

test('detents catch nearby touch aims but never queue a motion or change an untouched legacy rail', () => {
  const level = fixture(), world = createWorld(level);
  assert(drag(world, level, 'a', .535).ok);
  assert.equal(world.mechanisms.a.progress, .5, 'a six-unit finger error snaps to the drawn centre notch');
  const stopped = getMechanismPosition(world, level.mechanisms![0]);
  run(world, level, 4);
  assert.deepEqual(getMechanismPosition(world, level.mechanisms![0]), stopped);
  assert.equal(world.mechanisms.a.target, .5);
  assert(drag(world, level, 'a', .63).ok);
  assert(Math.abs(world.mechanisms.a.progress - .63) < 1e-10, 'points between notches remain freely adjustable');
  const legacy = fixture({ mechanisms: [{ ...regulator('plain', 240), detents: undefined }] }), old = createWorld(legacy);
  assert(drag(old, legacy, 'plain', .535).ok);
  assert(Math.abs(old.mechanisms.plain.progress - .535) < 1e-10);
});

test('changing an upstream setting holds an already opened latch instead of springing closed', () => {
  const level = fixture(), world = createWorld(level), door = level.mechanisms![2];
  assert(drag(world, level, 'a', .5).ok); assert(drag(world, level, 'b', 1).ok);
  assert(drag(world, level, 'lock', .6).ok);
  const actual = world.mechanisms.lock.progress;
  assert(drag(world, level, 'a', 0).ok); assert(getMechanismInterlock(world, level, door).locked);
  run(world, level, 4);
  assert.equal(world.mechanisms.lock.progress, actual); assert.equal(world.mechanisms.lock.target, actual);
  assert.equal(drag(world, level, 'lock', 0).ok, false);
  assert(drag(world, level, 'a', .5).ok); assert(drag(world, level, 'lock', 0).ok);
  assert.equal(world.mechanisms.lock.progress, 0, 'the wrong configuration can be corrected and reversed');
});

test('goal completion requires actual final contact positions even after physically reaching the exit', () => {
  const level = fixture({ goal: { x: 420, y: 430 }, goalRequirements: required, goalMessage: 'Raccorde les deux contacts.' });
  const world = createWorld(level);
  run(world, level, 2, true);
  assert(world.player.x >= level.goal.x); assert.equal(world.phase, 'playing');
  assert.equal(getGoalInterlock(world, level).message, 'Raccorde les deux contacts.');
  assert(drag(world, level, 'a', 1).ok); assert(drag(world, level, 'b', 1).ok);
  run(world, level, .2); assert.equal(world.phase, 'playing');
  assert(drag(world, level, 'a', .5).ok);
  assert(updateWorld(world, level, idle, 1 / 60).includes('win'));
  assert.equal(world.phase, 'won');
});

test('a drawing contact activates only on a committed stroke and the chosen route stays meaningful', () => {
  const path = [{ x: 120, y: 430 }, { x: 180, y: 390 }, { x: 240, y: 430 }];
  const level = fixture({ drawings: [{
    id: 'bridge', title: 'Le raccord', prompt: '', triggerX: 110, path, duration: 1,
    choices: [{ id: 'high', label: 'En haut', hint: 'Passe au-dessus.', path },
      { id: 'flat', label: 'En bas', hint: 'Passe tout droit.', path: [path[0], path[2]] }],
  }] });
  const world = createWorld(level);
  const condition: PuzzleRequirement[] = [{ drawingId: 'bridge', choiceId: 'high' }];
  assert(evaluatePuzzleRequirements(world, level, condition).locked);
  assert(selectDrawingChoice(world, level, 'bridge', 'high').ok);
  assert(evaluatePuzzleRequirements(world, level, condition).locked, 'selecting the preview does not close the circuit');
  assert(beginPlayerStroke(world, level, path[0]).ok);
  appendPlayerStroke(world, level, path[1]);
  assert(evaluatePuzzleRequirements(world, level, condition).locked, 'a half stroke is not a construction');
  appendPlayerStroke(world, level, path[2]); assert(finishPlayerStroke(world, level).ok);
  assert.equal(evaluatePuzzleRequirements(world, level, condition).locked, false);
  assert(selectDrawingChoice(world, level, 'bridge', 'flat').ok);
  assert.equal(evaluatePuzzleRequirements(world, level, condition).locked, false, 'changing a preview preserves the existing committed circuit');
  assert(beginPlayerStroke(world, level, path[0]).ok); appendPlayerStroke(world, level, path[2]);
  assert(finishPlayerStroke(world, level).ok);
  assert(evaluatePuzzleRequirements(world, level, condition).locked, 'committing the alternate route updates the contact');
});

test('save and checkpoint restoration preserve intermediate solutions and re-evaluate every lock', () => {
  const level = fixture(), world = createWorld(level);
  assert(drag(world, level, 'a', .5).ok); assert(drag(world, level, 'b', 1).ok);
  assert(drag(world, level, 'lock', .6).ok);
  const snapshot = saveProgress(world, level);
  const restored = restoreProgress(JSON.parse(JSON.stringify(snapshot)), level)!;
  assert(restored); assert.deepEqual(restored.mechanisms, {
    a: { progress: .5, target: .5 }, b: { progress: 1, target: 1 }, lock: { progress: .6, target: .6 },
  });
  assert.equal(getMechanismPositions(restored, level)[2].interlock.locked, false);
  restartAtCheckpoint(restored, level); run(restored, level, 2);
  assert.equal(restored.mechanisms.lock.progress, .6); assert.equal(restored.deaths, 0);
  assert(drag(restored, level, 'lock', 1).ok);
  assert.equal(restored.mechanisms.lock.progress, 1);
});

test('missing contacts and malformed windows fail closed while original mechanisms stay unlocked', () => {
  const level = fixture(), world = createWorld(level);
  for (const requirement of [
    { mechanismId: 'missing', min: 0 }, { mechanismId: 'a', min: .8, max: .2 },
    { mechanismId: 'a', min: Number.NaN }, { mechanismId: 'a', max: Infinity },
    { drawingId: 'missing' },
  ]) assert(evaluatePuzzleRequirements(world, level, [requirement]).locked);
  assert.equal(getMechanismInterlock(world, level, level.mechanisms![0]).locked, false);
  assert.equal(getGoalInterlock(world, level).locked, false);
});

test('a checkpoint or exit on an upper landing cannot be claimed from the floor beneath it', () => {
  const level = fixture({ mechanisms: [], goal: { x: 450, y: 260 },
    checkpoints: [{ x: 240, y: 260 }, { x: 650, y: 430 }],
    surfaces: [
      { a: { x: 0, y: 430 }, b: { x: 1600, y: 430 } },
      { a: { x: 200, y: 260 }, b: { x: 550, y: 260 } },
    ],
  });
  const world = createWorld(level);
  run(world, level, 2.1, true);
  assert(world.player.x > 450 && world.player.x < 550);
  assert.equal(world.checkpointIndex, -1, 'the high flag remains unreached');
  assert.equal(world.phase, 'playing', 'the character has not physically reached the upper exit');
  restartAtCheckpoint(world, level);
  assert.deepEqual({ x: world.player.x, y: world.player.y }, level.start, 'retry cannot teleport upstairs');
  run(world, level, 3.1, true);
  assert.equal(world.checkpointIndex, 1, 'the flag actually walked through on this floor activates');
  restartAtCheckpoint(world, level);
  assert.deepEqual({ x: world.player.x, y: world.player.y }, level.checkpoints[1]);
});
