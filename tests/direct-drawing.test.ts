import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appendPlayerStroke, beginMechanismInteraction, beginPlayerStroke, cancelPlayerDrawing,
  createWorld, finishPlayerStroke, getMechanismHandlePosition, getWorldSurfaces, moveMechanismInteraction, resetPlayerStroke, updateWorld,
  type GameWorld, type PlatformPoint,
} from '../lib/trait/platformer';
import { PLATFORM_LEVELS } from '../lib/trait/platform-levels';

const level = PLATFORM_LEVELS[0], drawing = level.drawings[0];
const a = drawing.path[0], b = drawing.path[drawing.path.length - 1];
const idle = { left: false, right: false, draw: false };
const custom = [a, { x: a.x + 105, y: 352 }, { x: b.x - 100, y: 360 }, b];

function nearBank(side: 'left' | 'right' = 'left'): GameWorld {
  const world = createWorld(level);
  world.player.x = side === 'left' ? drawing.triggerX : b.x + 20;
  world.player.y = side === 'left' ? a.y : b.y;
  return world;
}
function completeGesture(world: GameWorld, path: PlatformPoint[]) {
  assert(beginPlayerStroke(world, level, path[0]).ok);
  for (const point of path.slice(1)) assert(appendPlayerStroke(world, level, point).ok);
  const result = finishPlayerStroke(world, level);
  assert(result.ok, result.message);
}
function assertUntouched(world: GameWorld, point: PlatformPoint, radius?: number) {
  const before = structuredClone(world);
  assert.equal(beginPlayerStroke(world, level, point, radius).ok, false);
  assert.deepEqual(world, before);
}
function holdHandle(world: GameWorld) {
  const mechanism = level.mechanisms![0], handle = getMechanismHandlePosition(world, mechanism);
  assert(beginMechanismInteraction(world, level, handle).ok);
  moveMechanismInteraction(world, level, { x: handle.x + mechanism.to.x - mechanism.from.x, y: handle.y + mechanism.to.y - mechanism.from.y });
}

test('pressing either anchor starts and completes a freehand passage in one gesture without E', () => {
  for (const reversed of [false, true]) {
    const world = nearBank(reversed ? 'right' : 'left');
    const path = reversed ? [...custom].reverse() : custom;
    const first = path[0];
    assert(beginPlayerStroke(world, level, { x: first.x + 6, y: first.y - 5 }).ok);
    assert.equal(world.phase, 'drawing');
    assert.equal(world.activeDrawing?.started, true);
    assert.deepEqual(world.activeDrawing?.path, [first], 'the initial press snaps to the exact anchor');
    const frozen = structuredClone(world);
    for (let i = 0; i < 30; i++) updateWorld(world, level, { ...idle, right: true }, 0.05);
    assert.deepEqual(world, frozen, 'a direct gesture pauses the same simulation as keyboard drawing');
    for (const point of path.slice(1)) assert(appendPlayerStroke(world, level, point).ok);
    assert(finishPlayerStroke(world, level).ok);
    assert.equal(world.phase, 'playing');
    assert.deepEqual(world.drawn, [drawing.id]);
    assert.deepEqual(world.constructions[drawing.id], custom);
    assert(getWorldSurfaces(world, level).some(s => s.a.x === custom[1].x && s.a.y === custom[1].y && s.b.x === custom[2].x));
  }
});

test('missed anchors leave the entire world unchanged and touch tolerance stays bounded', () => {
  const world = nearBank();
  world.player.vx = 120;
  holdHandle(world);
  assertUntouched(world, { x: (a.x + b.x) / 2, y: a.y });
  assertUntouched(world, { x: Number.NaN, y: a.y });
  assertUntouched(world, level.drawings[1].path[0]);
  assertUntouched(world, { x: a.x + 40, y: a.y });
  assertUntouched(world, { x: a.x + 40, y: a.y }, Number.NaN);
  assertUntouched(world, { x: a.x + 100, y: a.y }, 1e9);
  assert(beginPlayerStroke(world, level, { x: a.x + 40, y: a.y }, 48).ok);
  assert.deepEqual(world.activeDrawing?.path, [a]);
  assert.equal(world.player.vx, 0);
  assert.equal(world.handInteraction, null);
  for (const state of Object.values(world.mechanisms)) assert.equal(state.target, state.progress);
});

test('direct drawing is refused at a distance, in the air, after death or after winning', () => {
  assertUntouched(createWorld(level), a);
  for (const phase of ['dead', 'won'] as const) {
    const world = nearBank(); world.phase = phase;
    assertUntouched(world, a, 72);
  }
  const airborne = nearBank(); airborne.player.grounded = false;
  assertUntouched(airborne, a, 72);
  const wrongLevel = nearBank(), before = structuredClone(wrongLevel);
  assert.equal(beginPlayerStroke(wrongLevel, PLATFORM_LEVELS[1], a).ok, false);
  assert.deepEqual(wrongLevel, before);
});

test('direct redrawing retains the old passage until a replacement is valid', () => {
  const world = nearBank(); completeGesture(world, custom);
  const original = world.constructions[drawing.id];
  assert(beginPlayerStroke(world, level, a).ok);
  assert(appendPlayerStroke(world, level, { x: a.x + 80, y: 360 }).ok);
  const beforeMiss = structuredClone(world);
  assert.equal(beginPlayerStroke(world, level, { x: a.x + 180, y: 220 }).ok, false);
  assert.deepEqual(world, beforeMiss, 'a miss also preserves a draft already in progress');
  assert.equal(finishPlayerStroke(world, level).ok, false);
  assert.strictEqual(world.constructions[drawing.id], original);
  resetPlayerStroke(world); assert.strictEqual(world.constructions[drawing.id], original);
  cancelPlayerDrawing(world); assert.strictEqual(world.constructions[drawing.id], original);
  assert.equal(world.phase, 'playing');
  const replacement = [a, { x: a.x + 90, y: 342 }, { x: b.x - 100, y: 342 }, b];
  completeGesture(world, [...replacement].reverse());
  assert.deepEqual(world.constructions[drawing.id], replacement);
  assert.deepEqual(world.drawn, [drawing.id]);
});

test('the optional keyboard entry still opens an empty draft and supports the same gesture', () => {
  const world = nearBank(); world.player.vx = 100;
  holdHandle(world);
  const time = world.time;
  assert(updateWorld(world, level, { ...idle, draw: true }, 1 / 60).includes('draw-start'));
  assert.equal(world.phase, 'drawing');
  assert.deepEqual(world.activeDrawing?.path, []);
  assert.equal(world.activeDrawing?.started, false);
  assert.equal(world.player.vx, 0); assert.equal(world.time, time); assert.equal(world.handInteraction, null);
  completeGesture(world, custom);
  assert.deepEqual(world.constructions[drawing.id], custom);
});
