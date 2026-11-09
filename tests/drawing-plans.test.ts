import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appendPlayerStroke, beginPlayerStroke, cancelPlayerDrawing, createWorld,
  finishPlayerStroke, getDrawingChoice, getDrawingPlan, getWorldSurfaces,
  selectDrawingChoice, undoPlayerStroke, updateWorld, PLATFORM_PHYSICS,
  type GameWorld, type PlatformLevel, type PlatformPoint,
} from '../lib/trait/platformer';
import { preparePlayerStroke, strokeLength } from '../lib/trait/platform-drawing';
import { restoreProgress, saveProgress } from '../lib/trait/progress';

function fixture() {
  const lower = [{ x: 200, y: 430 }, { x: 600, y: 430 }];
  const upper = [{ x: 200, y: 310 }, { x: 400, y: 250 }, { x: 600, y: 310 }];
  const level: PlatformLevel = {
    id: 91, title: 'Two routes', subtitle: '', palette: 'blue', width: 920,
    start: { x: 150, y: 430 }, goal: { x: 870, y: 430 },
    surfaces: [
      { a: { x: 0, y: 430 }, b: { x: 200, y: 430 } },
      { a: { x: 600, y: 430 }, b: { x: 920, y: 430 } },
    ],
    hazards: [], stars: [], checkpoints: [], mechanisms: [],
    drawings: [{
      id: 'crossing', title: 'Crossing', prompt: 'Draw', triggerX: 160,
      path: lower, duration: 1, inkLimit: 480,
      choices: [
        { id: 'lower', label: 'Low route', hint: 'Stay low', path: lower, inkLimit: 480 },
        { id: 'upper', label: 'High route', hint: 'Use the upper ledge', path: upper, inkLimit: 520 },
      ],
    }],
  };
  return { level, world: createWorld(level), drawing: level.drawings[0], lower, upper };
}

function draw(world: GameWorld, level: PlatformLevel, points: PlatformPoint[]) {
  assert(beginPlayerStroke(world, level, points[0]).ok);
  for (const point of points.slice(1)) assert(appendPlayerStroke(world, level, point).ok);
  return finishPlayerStroke(world, level);
}

function distanceToPath(point: PlatformPoint, points: PlatformPoint[]) {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy));
  }
  return best;
}

test('choosing a route only plans it; cancelling preserves an existing bridge and its saved choice', () => {
  const { level, world, drawing, lower } = fixture();
  const originalSurfaces = getWorldSurfaces(world, level);
  assert(selectDrawingChoice(world, level, drawing.id, 'upper').ok);
  assert.equal(getDrawingChoice(world, drawing)?.id, 'upper');
  assert.deepEqual(getDrawingPlan(world, drawing).path, drawing.choices![1].path);
  assert.deepEqual(world.drawn, []);
  assert.deepEqual(world.constructions, {});
  assert.deepEqual(world.drawingChoices, {});
  assert.deepEqual(getWorldSurfaces(world, level), originalSurfaces, 'a preview is never a collidable bridge');
  cancelPlayerDrawing(world);

  assert(selectDrawingChoice(world, level, drawing.id, 'lower').ok);
  const own = [lower[0], { x: 395, y: 401 }, lower[1]];
  assert(draw(world, level, own).ok);
  const committed = structuredClone(world.constructions[drawing.id]);
  const stableSurfaces = getWorldSurfaces(world, level);
  assert(selectDrawingChoice(world, level, drawing.id, 'upper').ok);
  assert.equal(world.activeDrawing?.choiceId, 'upper');
  assert.equal(world.drawingChoices[drawing.id], 'lower', 'pending choice is not committed');
  assert.equal(saveProgress(world, level).drawingChoices?.[drawing.id], 'lower');
  assert.deepEqual(getWorldSurfaces(world, level), stableSurfaces);
  cancelPlayerDrawing(world);
  assert.equal(world.phase, 'playing');
  assert.equal(world.activeDrawing, null);
  assert.deepEqual(world.constructions[drawing.id], committed);
  assert.equal(getDrawingChoice(world, drawing)?.id, 'lower');
});

test('low and high plans use the actual player geometry and retain their different anchors after reload', () => {
  const low = fixture(), high = fixture();
  const ownLow = [low.lower[0], { x: 390, y: 404 }, low.lower[1]];
  const ownHigh = [high.upper[0], { x: 365, y: 278 }, { x: 455, y: 238 }, high.upper[2]];
  for (const [run, choice, authored] of [[low, 'lower', ownLow], [high, 'upper', ownHigh]] as const) {
    assert(selectDrawingChoice(run.world, run.level, run.drawing.id, choice).ok);
    assert(draw(run.world, run.level, authored).ok);
    assert.deepEqual(run.world.constructions.crossing, authored, 'the guide is not substituted for the drawn path');
    assert.equal(run.world.drawingChoices.crossing, choice);
    assert.deepEqual(getWorldSurfaces(run.world, run.level).slice(run.level.surfaces.length),
      authored.slice(1).map((b, i) => ({ a: authored[i], b })));
    const restored = restoreProgress(JSON.parse(JSON.stringify(saveProgress(run.world, run.level))), run.level)!;
    assert(restored);
    assert.deepEqual(restored.constructions.crossing, authored);
    assert.equal(restored.drawingChoices.crossing, choice);
    assert.deepEqual(getDrawingPlan(restored, run.drawing).path, run.drawing.choices!.find(p => p.id === choice)!.path);
  }
  assert.notDeepEqual(low.world.constructions.crossing, high.world.constructions.crossing);
});

test('lifting the finger keeps an unfinished line which resumes from its tip in either direction', () => {
  for (const reversed of [false, true]) {
    const { level, world, drawing, lower } = fixture();
    const points = [lower[0], { x: 275, y: 420 }, { x: 355, y: 398 }, { x: 455, y: 402 }, { x: 530, y: 408 }, lower[1]];
    const ordered = reversed ? [...points].reverse() : points;
    assert(selectDrawingChoice(world, level, drawing.id, 'lower').ok);
    assert(beginPlayerStroke(world, level, ordered[0]).ok);
    for (const point of ordered.slice(1, 3)) assert(appendPlayerStroke(world, level, point).ok);
    const draft = structuredClone(world.activeDrawing!.path);
    const release = finishPlayerStroke(world, level);
    assert.equal(release.ok, false);
    assert.equal(release.incomplete, true);
    assert.equal(world.phase, 'drawing');
    assert.equal(world.activeDrawing?.started, false);
    assert.deepEqual(world.activeDrawing!.path, draft);
    assert.deepEqual(world.constructions, {});
    assert.deepEqual(world.drawn, []);
    const beforeMiss = structuredClone(world.activeDrawing);
    assert.equal(beginPlayerStroke(world, level, { x: 400, y: 170 }).ok, false);
    assert.deepEqual(world.activeDrawing, beforeMiss, 'a missed resumption cannot discard the draft');
    const tip = draft.at(-1)!;
    assert(beginPlayerStroke(world, level, { x: tip.x + 3, y: tip.y - 2 }).ok);
    assert.deepEqual(world.activeDrawing!.path, draft, 'near-tip resumption does not insert a discontinuity');
    for (const point of ordered.slice(3)) assert(appendPlayerStroke(world, level, point).ok);
    assert(finishPlayerStroke(world, level).ok);
    assert.deepEqual(world.constructions.crossing, points, 'both drawing directions commit the same left-to-right surface');
  }
});

test('undo removes only the end of a released draft and the retained section can be continued', () => {
  const { level, world, drawing, lower } = fixture();
  assert(selectDrawingChoice(world, level, drawing.id, 'lower').ok);
  assert(beginPlayerStroke(world, level, lower[0]).ok);
  const points = [{ x: 240, y: 400 }, { x: 280, y: 375 }, { x: 320, y: 355 }, { x: 360, y: 345 }, { x: 400, y: 340 }];
  for (const point of points) assert(appendPlayerStroke(world, level, point).ok);
  const held = structuredClone(world.activeDrawing!.path);
  undoPlayerStroke(world);
  assert.deepEqual(world.activeDrawing!.path, held, 'undo does not fight an active pointer gesture');
  assert(finishPlayerStroke(world, level).incomplete);
  const before = structuredClone(world.activeDrawing!.path), beforeLength = strokeLength(before);
  undoPlayerStroke(world);
  const remaining = structuredClone(world.activeDrawing!.path);
  assert(remaining.length >= 2);
  assert(strokeLength(remaining) < beforeLength - 30);
  assert(strokeLength(remaining) > beforeLength * .65, 'the entire sketch is not reset');
  assert.deepEqual(remaining[0], lower[0]);
  assert.deepEqual(remaining.slice(0, -1), before.slice(0, remaining.length - 1));
  assert(beginPlayerStroke(world, level, remaining.at(-1)!).ok);
  for (const point of [{ x: 450, y: 350 }, { x: 520, y: 390 }, lower[1]]) assert(appendPlayerStroke(world, level, point).ok);
  assert(finishPlayerStroke(world, level).ok);
  assert.equal(world.drawn.length, 1);
  assert(world.constructions.crossing.some(point => point.y < 365), 'the retained raised section remains in the result');
});

test('stabilisation damps finger jitter while preserving the authored arc rather than following a guide', () => {
  const { lower } = fixture();
  const [a, b] = lower;
  const raw = Array.from({ length: 201 }, (_, i) => {
    const t = i / 200;
    return { x: a.x + (b.x - a.x) * t, y: a.y - 78 * Math.sin(Math.PI * t) + (i === 0 || i === 200 ? 0 : i % 2 ? 2.4 : -2.4) };
  });
  const copy = structuredClone(raw);
  const ordinary = preparePlayerStroke(raw, a, b);
  const assisted = preparePlayerStroke(raw, a, b, { assist: true });
  assert(ordinary.ok && assisted.ok);
  assert.deepEqual(raw, copy, 'assistance leaves the input samples untouched');
  assert(strokeLength(assisted.points) < strokeLength(ordinary.points) * .7, 'the alternating tremor is removed');
  assert(Math.min(...assisted.points.map(p => p.y)) < 357, 'the intentional 78-unit arch is retained');
  assert.deepEqual(assisted.points[0], a);
  assert.deepEqual(assisted.points.at(-1), b);
  assert(raw.every(point => distanceToPath(point, assisted.points) < 5.5), 'assistance stays close to the gesture');
  assert.notDeepEqual(assisted.points, lower, 'the low straight reference never replaces the player’s arch');
});

test('an over-budget replacement is rejected without erasing the previous bridge or committing the pending choice', () => {
  const { level, world, drawing, lower, upper } = fixture();
  assert(selectDrawingChoice(world, level, drawing.id, 'lower').ok);
  assert(draw(world, level, [lower[0], { x: 400, y: 400 }, lower[1]]).ok);
  const oldBridge = structuredClone(world.constructions.crossing);
  assert(selectDrawingChoice(world, level, drawing.id, 'upper').ok);
  const long = [upper[0], { x: 300, y: 150 }, { x: 400, y: 350 }, { x: 500, y: 150 }, upper[2]];
  assert(preparePlayerStroke(long, upper[0], upper[2]).ok, 'the gesture is geometrically valid without the ink budget');
  const result = draw(world, level, long);
  assert.equal(result.ok, false);
  assert.match(result.message, /trop long/);
  assert.equal(finishPlayerStroke(world, level).ok, false, 'releasing again cannot bypass validation');
  assert.deepEqual(world.constructions.crossing, oldBridge);
  assert.equal(world.drawingChoices.crossing, 'lower');
  assert.deepEqual(saveProgress(world, level).constructions.crossing, oldBridge);
  cancelPlayerDrawing(world);
  assert.deepEqual(world.constructions.crossing, oldBridge);
});

test('saved explicit choices enforce their own ink budget and cannot fall back to another plan', () => {
  const { level, world, upper } = fixture();
  const long = [upper[0], { x: 300, y: 150 }, { x: 400, y: 350 }, { x: 500, y: 150 }, upper[2]];
  const saved = { ...saveProgress(world, level), constructions: { crossing: long }, drawingChoices: { crossing: 'upper' } };
  const restored = restoreProgress(saved, level)!;
  assert.deepEqual(restored.drawn, []);
  assert.deepEqual(restored.constructions, {});
  assert.deepEqual(restored.drawingChoices, {});
  const unknown = restoreProgress({ ...saved, constructions: { crossing: upper }, drawingChoices: { crossing: 'missing-plan' } }, level)!;
  assert.deepEqual(unknown.drawn, [], 'an explicit but missing choice cannot silently select a different puzzle route');
});

test('legacy saved passages without a choice keep their long authored geometry during migration', () => {
  const { level, world, lower } = fixture();
  const raw = [lower[0]];
  for (let i = 1; i < 2200; i++) raw.push({ x: 200 + 400 * i / 2200, y: 430 + (i % 2 ? 2 : -2) });
  raw.push(lower[1]);
  const prepared = preparePlayerStroke(raw, lower[0], lower[1]);
  assert(prepared.ok && prepared.points.length > 2048);
  const saved = { ...saveProgress(world, level), constructions: { crossing: prepared.points }, drawingChoices: undefined };
  const restored = restoreProgress(JSON.parse(JSON.stringify(saved)), level)!;
  assert.deepEqual(restored.drawn, ['crossing']);
  assert.deepEqual(restored.constructions.crossing, prepared.points);
});

test('a validated staircase is actually walkable; an excessive riser cannot replace the previous bridge', () => {
  const { level, world, lower } = fixture(), [a, b] = lower;
  const steps = (height: number) => [a, { x: 300, y: 430 }, { x: 300, y: 430 - height },
    { x: 500, y: 430 - height }, { x: 500, y: 430 }, b];
  const walkable = steps(PLATFORM_PHYSICS.stepHeight);
  assert(draw(world, level, walkable).ok, 'small intentional stair risers remain accepted');
  const committed = structuredClone(world.constructions.crossing);
  const rejected = draw(world, level, steps(40));
  assert.equal(rejected.ok, false, 'a 40-unit wall cannot be reported as ready');
  assert.match(rejected.message, /marche est trop haute/);
  assert.deepEqual(world.constructions.crossing, committed, 'a bad replacement retains the previous valid staircase');
  assert.equal(world.phase, 'drawing');
  assert.equal(world.activeDrawing!.path.length, 6, 'the draft remains available to undo or redraw');
  cancelPlayerDrawing(world);
  for (let frame = 0; frame < 900 && world.player.x < 620; frame++)
    updateWorld(world, level, { left: false, right: true, draw: false }, 1 / 60);
  assert.equal(world.deaths, 0);
  assert(world.player.x >= 620, 'the maximum allowed small steps can be walked in the game');

  const legacy = { ...saveProgress(world, level), drawingChoices: undefined };
  const restored = restoreProgress(legacy, level)!;
  assert.deepEqual(restored.constructions.crossing, committed, 'an older valid staircase keeps its geometry on reload');
  for (let frame = 0; frame < 900 && restored.player.x < 620; frame++)
    updateWorld(restored, level, { left: false, right: true, draw: false }, 1 / 60);
  assert.equal(restored.deaths, 0);
  assert(restored.player.x >= 620);
});

test('splitting a near-vertical wall into tiny pointer samples cannot bypass the real step limit', () => {
  for (const reversed of [false, true]) {
    const { level, world, lower } = fixture(), [a, b] = lower;
    const wall = [a, { x: 300, y: 430 },
      { x: 300.2, y: 420 }, { x: 300, y: 410 }, { x: 300.2, y: 400 }, { x: 300, y: 390 },
      { x: 500, y: 390 }, { x: 500, y: 430 }, b];
    const result = draw(world, level, reversed ? [...wall].reverse() : wall);
    assert.equal(result.ok, false);
    assert.match(result.message, /marche est trop haute/);
    assert.deepEqual(world.constructions, {});
    assert.deepEqual(world.drawn, []);
  }
});
