import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLATFORM_LEVELS } from '../lib/trait/platform-levels';
import { createWorld, getMechanismPositions } from '../lib/trait/platformer';
import { drawMechanismBody, drawMechanismTrack } from '../lib/trait/platform-mechanism-art';

const palette = { ink: '#fff', background: '#064b8e', accent: '#f6d89a' };
type Command = [string, ...number[]];
function recording() {
  const commands: Command[] = [];
  const methods = ['save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'rect', 'translate', 'rotate', 'fill', 'stroke', 'setLineDash'];
  const ctx = Object.fromEntries(methods.map(method => [method, (...args: number[]) => commands.push([method, ...args])])) as unknown as CanvasRenderingContext2D;
  return { ctx, commands };
}

test('mechanical stops and supporting rails stay fixed through every hand-driven journey', () => {
  for (const level of PLATFORM_LEVELS) for (const mechanism of level.mechanisms ?? []) {
    const world = createWorld(level);
    let anchored: Command[] | null = null;
    for (const progress of [0, .18, .55, 1]) {
      world.mechanisms[mechanism.id] = { progress, target: progress };
      const view = getMechanismPositions(world, level).find(v => v.mechanism.id === mechanism.id)!;
      const track = recording(); drawMechanismTrack(track.ctx, view, palette);
      assert(track.commands.length > 10, `${mechanism.id}: the machine has a visible fixed support`);
      if (anchored) assert.deepEqual(track.commands, anchored, `${mechanism.id}: rail or stop moves with its passenger`);
      anchored = track.commands;
    }
  }
});

test('moving machinery has progressive articulation that freezes when its real position is unchanged', () => {
  const mechanisms = [
    [1, 'passeur-des-dents'], [2, 'ascenseur-oblique'], [0, 'ascenseur-du-debut'],
    [1, 'presse-des-dents'], [4, 'porte-du-balcon'],
  ] as const;
  for (const [index, id] of mechanisms) {
    const level = PLATFORM_LEVELS[index], world = createWorld(level);
    let last: Command[] | null = null;
    for (const progress of [0, .25, .5, .75, 1]) {
      world.mechanisms[id] = { progress, target: progress };
      const view = getMechanismPositions(world, level).find(v => v.mechanism.id === id)!;
      const first = recording(); drawMechanismBody(first.ctx, view, palette);
      if (last) assert.notDeepEqual(first.commands, last, `${id}: the parts must move continuously with the hand`);
      last = first.commands;
      world.time += 11.7;
      const stopped = recording(); drawMechanismBody(stopped.ctx, getMechanismPositions(world, level).find(v => v.mechanism.id === id)!, palette);
      assert.deepEqual(stopped.commands, first.commands, `${id}: an idle machine must not drift or spin on its own`);
    }
  }
});
