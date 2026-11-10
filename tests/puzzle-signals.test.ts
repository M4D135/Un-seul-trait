import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorld, getMechanismHandlePosition, getMechanismPosition, type PlatformLevel } from '../lib/trait/platformer';
import { drawPuzzleSignals, getPuzzleSignalLayout } from '../lib/trait/puzzle-signals';
import { PLATFORM_LEVELS } from '../lib/trait/platform-levels';

function fixture(): PlatformLevel {
  return {
    id: 107, title: 'Signaux', subtitle: '', palette: 'blue', width: 1700,
    start: { x: 100, y: 430 }, goal: { x: 1500, y: 430 },
    surfaces: [{ a: { x: 0, y: 430 }, b: { x: 1700, y: 430 } }],
    hazards: [], stars: [], checkpoints: [], drawings: [],
    mechanisms: [
      { id: 'a', title: 'La lune', prompt: '', type: 'gate', width: 30, height: 60,
        from: { x: 260, y: 430 }, to: { x: 300, y: 230 }, detents: [0, .25, .5, .75, 1] },
      { id: 'b', title: 'Le soleil', prompt: '', type: 'platform', width: 60,
        from: { x: 410, y: 430 }, to: { x: 560, y: 430 }, detents: [0, .5, 1] },
      { id: 'c', title: 'La porte', prompt: '', type: 'gate', width: 30, height: 180,
        from: { x: 670, y: 430 }, to: { x: 670, y: 180 },
        interlock: { requirements: [{ mechanismId: 'a', min: .46, max: .54 }, { mechanismId: 'b', min: .96 }], message: 'Aligne.' } },
      { id: 'd', title: 'La suite', prompt: '', type: 'gate', width: 30, height: 180,
        from: { x: 900, y: 430 }, to: { x: 900, y: 180 },
        interlock: { requirements: [{ mechanismId: 'c', min: .96 }], message: 'Prépare.' } },
    ],
    goalRequirements: [{ mechanismId: 'd', min: .96 }],
  };
}
const options = { cameraX: 0, viewWidth: 1200 };

test('detent marks lie exactly on the visible handle rail and never advertise the right answer', () => {
  const level = fixture(), world = createWorld(level);
  const before = getPuzzleSignalLayout(level, world, options).detents;
  assert.equal(before.length, 8);
  for (const mark of before) {
    const mechanism = level.mechanisms!.find(m => m.id === mark.mechanismId)!;
    world.mechanisms[mechanism.id] = { progress: mark.progress, target: mark.progress };
    assert.deepEqual(mark.point, getMechanismHandlePosition(world, mechanism));
    assert(Math.abs(Math.hypot(mark.normal.x, mark.normal.y) - 1) < 1e-10);
    assert.deepEqual(Object.keys(mark).sort(), ['mechanismId', 'normal', 'point', 'progress']);
  }
  assert.deepEqual(getPuzzleSignalLayout(level, world, options).detents, before, 'all notches stay static through actual slider travel');
});

test('paired symbols match across a wire while only the receiving contact reflects a satisfied condition', () => {
  const level = fixture(), world = createWorld(level);
  const first = getPuzzleSignalLayout(level, world, options);
  assert.equal(first.connections.length, 2);
  for (const target of first.contacts.filter(c => c.targetId === 'c')) {
    const source = first.contacts.find(c => c.source && c.sourceId === target.sourceId)!;
    assert(source); assert.equal(target.glyph, source.glyph);
    assert.equal(target.satisfied, false); assert.equal(source.satisfied, false);
  }
  world.mechanisms.a = { progress: .5, target: .5 };
  const connected = getPuzzleSignalLayout(level, world, options);
  const target = connected.contacts.find(c => c.targetId === 'c' && c.sourceId === 'a')!;
  assert(target.satisfied);
  assert.equal(connected.contacts.find(c => c.source && c.sourceId === 'a')!.satisfied, false);
  assert.deepEqual(connected.connections.map(c => c.points), first.connections.map(c => c.points), 'the engraving cannot drift with the control');
});

test('the focused circuit engraves readable target sockets at the exact physical rail positions', () => {
  const level = fixture(), world = createWorld(level);
  const untouched = JSON.stringify(world);
  const layout = getPuzzleSignalLayout(level, world, options);
  assert.equal(JSON.stringify(world), untouched);
  assert.deepEqual(layout.sockets.map(s => [s.sourceId, s.progress, s.satisfied]), [['a', .5, false], ['b', 1, false]]);
  for (const socket of layout.sockets) {
    const mechanism = level.mechanisms!.find(m => m.id === socket.sourceId)!;
    const aligned = createWorld(level);
    aligned.mechanisms[mechanism.id] = { progress: socket.progress, target: socket.progress };
    assert.deepEqual(socket.railPoint, getMechanismHandlePosition(aligned, mechanism), 'the contact is at the actual, usable handle position');
    assert.equal(socket.glyph, layout.contacts.find(c => c.targetId === socket.targetId && c.sourceId === socket.sourceId)!.glyph);
    assert(Math.hypot(socket.point.x - socket.railPoint.x, socket.point.y - socket.railPoint.y) >= 18);
    if (mechanism.type === 'gate') assert(Math.hypot(socket.point.x - socket.railPoint.x, socket.point.y - socket.railPoint.y) > mechanism.width / 2,
      'a filled gate panel cannot cover its own engraved target');
    assert(getPuzzleSignalLayout(level, aligned, options).sockets.find(s => s.sourceId === socket.sourceId)!.satisfied);
  }
  world.mechanisms.a = { progress: .87, target: .87 };
  const wrong = getPuzzleSignalLayout(level, world, options).sockets.find(s => s.sourceId === 'a')!;
  assert.deepEqual(wrong.railPoint, layout.sockets[0].railPoint);
  assert.equal(wrong.satisfied, false, 'the clue stays still; only actual alignment fills it');
});

test('a closing requirement uses the home socket and only the currently inspected circuit exposes its targets', () => {
  const level = fixture(), world = createWorld(level), target = level.mechanisms![3];
  target.interlock = { requirements: [{ mechanismId: 'c', max: .12 }], message: 'Referme.' };
  const focused = getPuzzleSignalLayout(level, world, { ...options, pointer: getMechanismHandlePosition(world, target) });
  assert.deepEqual(focused.sockets.map(s => [s.sourceId, s.targetId, s.progress]), [['c', 'd', 0]]);
  assert.equal(focused.sockets[0].satisfied, true);
  const cropped = getPuzzleSignalLayout(level, world, { cameraX: 580, viewWidth: 180 });
  assert.deepEqual(cropped.sockets, [], 'unseen earlier controls are not shown as distant solution markers');
});

test('simultaneous counterweights and their arrival ferry have distinct paired engravings in every authored room', () => {
  let circuits = 0;
  for (const level of PLATFORM_LEVELS) {
    const ferries = level.mechanisms?.filter(mechanism => mechanism.title === 'Le plateau équilibré') ?? [];
    for (const ferry of ferries) {
      const exit = level.mechanisms!.find(mechanism => mechanism.interlock?.requirements.some(requirement =>
        'mechanismId' in requirement && requirement.mechanismId === ferry.id))!;
      assert(exit);
      for (const target of [ferry, exit]) {
        const world = createWorld(level);
        const sourceIds = target.interlock!.requirements.map(requirement => {
          assert('mechanismId' in requirement); return requirement.mechanismId;
        });
        const sources = sourceIds.map(id => level.mechanisms!.find(mechanism => mechanism.id === id)!);
        const left = Math.min(...sources.map(m => m.from.x), target.from.x) - 100;
        const right = Math.max(...sources.map(m => m.from.x), target.from.x) + 100;
        world.player.x = (left + right) / 2;
        const layout = getPuzzleSignalLayout(level, world, {
          cameraX: left, viewWidth: right - left, pointer: getMechanismHandlePosition(world, target),
        });
        const contacts = layout.contacts.filter(contact => contact.targetId === target.id);
        assert.equal(contacts.length, sourceIds.length);
        assert.equal(new Set(contacts.map(contact => contact.glyph)).size, sourceIds.length,
          `${level.id}/${target.id}: each simultaneously required control needs its own readable symbol`);
        for (const contact of contacts) {
          const source = layout.contacts.find(mark => mark.source && mark.sourceId === contact.sourceId)!;
          const socket = layout.sockets.find(mark => mark.sourceId === contact.sourceId && mark.targetId === target.id)!;
          assert(source); assert(socket);
          assert.equal(source.glyph, contact.glyph); assert.equal(socket.glyph, contact.glyph);
        }
        circuits++;
      }
    }
  }
  assert.equal(circuits, 6, 'two related circuits in each of the three counterweight rooms');
});

test('only one nearby circuit expands and hovering a different lock changes the selected connections', () => {
  const level = fixture(), world = createWorld(level);
  world.player.x = 350;
  const first = getPuzzleSignalLayout(level, world, options);
  assert.deepEqual([...new Set(first.connections.map(c => c.targetId))], ['c']);
  const secondHandle = getMechanismHandlePosition(world, level.mechanisms![3]);
  const hovered = getPuzzleSignalLayout(level, world, { ...options, pointer: secondHandle });
  assert.deepEqual([...new Set(hovered.connections.map(c => c.targetId))], ['d']);
  const cropped = getPuzzleSignalLayout(level, world, { cameraX: 580, viewWidth: 450 });
  for (const wire of cropped.connections) for (const point of wire.points) {
    assert(point.x >= 545 && point.x <= 1065, 'links cannot reach unseen controls through the frame edge');
  }
});

test('goal contacts show the same current assembly state and layout reads never mutate the game', () => {
  const level = fixture(), world = createWorld(level); world.player.x = 1430;
  const snapshot = JSON.stringify(world);
  const local = { cameraX: 840, viewWidth: 800 };
  const unfinished = getPuzzleSignalLayout(level, world, local);
  assert.equal(unfinished.contacts.find(c => c.targetId === 'goal')!.satisfied, false);
  assert.equal(unfinished.connections.length, 1);
  assert.equal(JSON.stringify(world), snapshot);
  world.mechanisms.d = { progress: 1, target: 1 };
  const finished = getPuzzleSignalLayout(level, world, local);
  assert.equal(finished.contacts.find(c => c.targetId === 'goal')!.satisfied, true);
  assert.deepEqual(finished.connections.map(c => c.points), unfinished.connections.map(c => c.points));
});

test('signal drawing uses only fixed line art with no labels, percentages, time animation or hidden legacy decorations', () => {
  const level = fixture(), world = createWorld(level);
  const record = () => {
    const commands: unknown[][] = [];
    const methods = ['save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'arc', 'rect', 'fill', 'stroke', 'setLineDash'];
    const ctx = Object.fromEntries(methods.map(name => [name, (...args: number[]) => commands.push([name, ...args])])) as unknown as CanvasRenderingContext2D;
    ctx.fillText = () => { throw new Error('No text belongs in these circuit engravings.'); };
    return { commands, ctx };
  };
  const palette = { ...options, pixelScale: .58, ink: '#fffdf6', accent: '#f6d89a', background: '#064b8e' };
  const a = record(); drawPuzzleSignals(a.ctx, level, world, palette);
  assert(a.commands.length > 80);
  world.time = 700;
  const b = record(); drawPuzzleSignals(b.ctx, level, world, palette);
  assert.deepEqual(a.commands, b.commands, 'wiring is a still engraving, not another animated obstacle');
  const legacy = { ...level, mechanisms: level.mechanisms!.map(m => ({ ...m, interlock: undefined, detents: undefined })), goalRequirements: undefined };
  const old = record(); drawPuzzleSignals(old.ctx, legacy, world, palette);
  assert.deepEqual(old.commands, []);
  assert.deepEqual(getMechanismPosition(world, level.mechanisms![0]), level.mechanisms![0].from);
});
