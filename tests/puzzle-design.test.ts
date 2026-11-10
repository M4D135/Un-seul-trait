import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLATFORM_LEVELS } from '../lib/trait/platform-levels';
import * as E from '../lib/trait/platformer';
import type { DrawingChoice, DrawingObstacle, GameWorld, PlatformHazard, PlatformLevel, PlatformPoint } from '../lib/trait/platformer';

const idle = { left: false, right: false, crouch: false, draw: false };
// These are the v1.4/1.5 route contracts; authored act II has separate solution tests.
const levels = PLATFORM_LEVELS.filter(level => level.id <= 6);
const routeLength = (path: PlatformPoint[]) => path.slice(1).reduce((length, point, i) =>
  length + Math.hypot(point.x - path[i].x, point.y - path[i].y), 0);

function openByHand(world: GameWorld, level: PlatformLevel, id: string) {
  const mechanism = level.mechanisms!.find(item => item.id === id)!;
  assert(mechanism, `${level.id}: missing mechanism ${id}`);
  const handle = E.getMechanismHandlePosition(world, mechanism);
  assert(E.beginMechanismInteraction(world, level, handle).ok);
  E.moveMechanismInteraction(world, level, {
    x: handle.x + mechanism.to.x - mechanism.from.x,
    y: handle.y + mechanism.to.y - mechanism.from.y,
  });
  E.endMechanismInteraction(world);
  assert.equal(world.mechanisms[id].progress, 1);
}

function requiredHandle(level: PlatformLevel, drawing: DrawingObstacle, choice: DrawingChoice): string | null {
  if (choice.id === 'presse') return level.id === 4 ? 'presse-des-deux-chemins' : 'presse-du-choix-final';
  if (choice.id !== 'roue') return null;
  if (level.id === 2) return 'poignee-roue-sous-pont';
  return drawing.id === 'pont-haut' ? 'poignee-roue-du-bas' : 'poignee-roue-du-vide';
}

function crossChoice(level: PlatformLevel, drawing: DrawingObstacle, choice: DrawingChoice,
  options: { solve?: boolean; crouch?: boolean; time?: number } = {}) {
  const world = E.createWorld(level), start = choice.path[0], end = choice.path.at(-1)!;
  world.player.x = start.x; world.player.y = start.y; world.time = options.time ?? 0;
  const handle = requiredHandle(level, drawing, choice);
  if (options.solve !== false && handle) openByHand(world, level, handle);
  assert(E.selectDrawingChoice(world, level, drawing.id, choice.id).ok);
  assert(E.beginPlayerStroke(world, level, start).ok);
  for (const point of choice.path.slice(1)) assert(E.appendPlayerStroke(world, level, point).ok);
  const finished = E.finishPlayerStroke(world, level);
  assert(finished.ok, `${level.id}/${drawing.id}/${choice.id}: ${finished.message}`);
  const crouch = options.crouch ?? choice.id === 'bas';
  for (let step = 0; step < 1800 && world.phase === 'playing' && world.player.x < end.x + 16; step++) {
    E.updateWorld(world, level, { ...idle, right: true, crouch }, 1 / 60);
  }
  return world;
}

test('all nine decisions are actual manually drawn routes with generous finger tolerance', () => {
  let passages = 0, choices = 0;
  for (const level of levels) for (const drawing of level.drawings) {
    if (!drawing.choices) continue;
    passages++;
    assert.equal(drawing.choices.length, 2);
    assert.deepEqual(drawing.path, drawing.choices[0].path, 'the full-course reference is an advertised solution');
    assert.notDeepEqual(drawing.choices[0].path, drawing.choices[1].path);
    for (const choice of drawing.choices) {
      choices++;
      assert(choice.inkLimit! > routeLength(choice.path) * 1.2, 'the line allowance does not demand a perfect copy');
      assert.deepEqual(choice.path[0], drawing.path[0]);
      assert.deepEqual(choice.path.at(-1), drawing.path.at(-1));
      for (const time of [0, 1.8, 4.1]) {
        const world = crossChoice(level, drawing, choice, { time });
        assert.equal(world.phase, 'playing', `${level.id}/${drawing.id}/${choice.id} dies at ${world.player.x},${world.player.y}`);
        assert.equal(world.deaths, 0);
        assert(world.player.grounded && world.player.x >= choice.path.at(-1)!.x + 16,
          `${level.id}/${drawing.id}/${choice.id} cannot reach its bank at ${world.player.x},${world.player.y}`);
        assert.equal(world.drawingChoices[drawing.id], choice.id);
      }
    }
  }
  assert.equal(passages, 9); assert.equal(choices, 18);
});

test('short wheel corridors require moving their actual handle; upper routes avoid that dependency', () => {
  for (const level of levels) for (const drawing of level.drawings) {
    const low = drawing.choices?.find(choice => choice.id === 'roue');
    if (!low) continue;
    const blocked = crossChoice(level, drawing, low, { solve: false });
    assert.equal(blocked.phase, 'dead', `${level.id}/${drawing.id}: low choice must meet its undisturbed wheel`);
    assert.equal(blocked.lastDeathCause, 'gear');
    const high = drawing.choices!.find(choice => choice.id === 'haut')!;
    const upper = crossChoice(level, drawing, high, { solve: false });
    assert.equal(upper.deaths, 0);
    assert.equal(upper.mechanisms[requiredHandle(level, drawing, low)!].progress, 0,
      'a high route does not silently move the wheel for the player');
  }
});

test('press puzzles offer a real bypass, whereas the short route requires lifting the press', () => {
  for (const id of [4, 6]) {
    const level = levels.find(item => item.id === id)!, drawing = level.drawings[1];
    const low = drawing.choices!.find(choice => choice.id === 'presse')!;
    const high = drawing.choices!.find(choice => choice.id === 'dessus')!;
    const blocked = crossChoice(level, drawing, low, { solve: false });
    const mechanism = level.mechanisms!.find(item => item.id === requiredHandle(level, drawing, low))!;
    assert.equal(blocked.phase, 'playing', 'the press blocks instead of killing');
    assert(blocked.player.x < mechanism.from.x, 'the closed press physically blocks the short route');
    assert.equal(blocked.mechanisms[mechanism.id].progress, 0);
    const bypass = crossChoice(level, drawing, high, { solve: false });
    assert(bypass.player.x >= high.path.at(-1)!.x + 16);
    assert.equal(bypass.mechanisms[mechanism.id].progress, 0);
  }
});

test('the low suspended-wheel path requires a crouch while the high arc allows upright walking', () => {
  const level = levels[2], drawing = level.drawings[0];
  const low = drawing.choices!.find(choice => choice.id === 'bas')!;
  assert.equal(crossChoice(level, drawing, low, { crouch: false }).phase, 'dead');
  assert.equal(crossChoice(level, drawing, low, { crouch: true }).deaths, 0);
  assert.equal(crossChoice(level, drawing, drawing.choices![0], { crouch: false }).deaths, 0);
});

test('three upper detours collect their star while the lower shortcuts deliberately leave it', () => {
  const decisions = [[1, 0, 0], [2, 2, 1], [6, 0, 0]] as const;
  for (const [id, drawingIndex, star] of decisions) {
    const level = levels.find(item => item.id === id)!, drawing = level.drawings[drawingIndex];
    const high = crossChoice(level, drawing, drawing.choices![0]);
    const low = crossChoice(level, drawing, drawing.choices![1]);
    assert(high.collected.includes(star), `level ${id} upper path misses the promised star`);
    assert(!low.collected.includes(star), `level ${id} short path must leave a real optional reward`);
  }
});

function wheelEnvelope(level: PlatformLevel, hazard: Extract<PlatformHazard, { type: 'gear' }>) {
  const carrier = level.mechanisms?.find(item => item.type === 'gear' && item.hazardId === hazard.id);
  if (carrier) return {
    left: Math.min(carrier.from.x, carrier.to.x), right: Math.max(carrier.from.x, carrier.to.x),
    top: Math.min(carrier.from.y, carrier.to.y), bottom: Math.max(carrier.from.y, carrier.to.y),
  };
  const swing = hazard.motion === 'swing', arm = hazard.armLength ?? 150, angle = hazard.swingAngle ?? .32;
  const dx = swing ? Math.abs(Math.sin(angle) * arm) : hazard.axis === 'x' ? Math.abs(hazard.range ?? 0) : 0;
  const dy = !swing && hazard.axis === 'y' ? Math.abs(hazard.range ?? 0) : 0;
  return { left: hazard.x - dx, right: hazard.x + dx,
    top: hazard.y - (swing ? (1 - Math.cos(angle)) * arm : dy), bottom: hazard.y + dy };
}

test('every wheel travel envelope stays visibly clear of every spike bed', () => {
  for (const level of levels) {
    const beds = level.hazards.filter((item): item is Extract<PlatformHazard, { type: 'spikes' }> => item.type === 'spikes');
    for (const wheel of level.hazards) {
      if (wheel.type !== 'gear') continue;
      const envelope = wheelEnvelope(level, wheel);
      for (const bed of beds) {
        const dx = Math.max(bed.x - envelope.right, envelope.left - bed.x - bed.w, 0);
        const dy = Math.max(bed.y - envelope.bottom, envelope.top - bed.y - bed.h, 0);
        assert(Math.hypot(dx, dy) > wheel.r + 24,
          `level ${level.id}: ${wheel.id} visibly overlaps ${bed.id} during its travel`);
      }
    }
  }
  const finalPit = levels[4];
  assert(!finalPit.hazards.some(item => item.id === 'piques-2'), 'the pictured stacked trap is removed');
});
