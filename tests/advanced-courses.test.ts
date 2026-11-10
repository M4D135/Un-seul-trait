import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ADVANCED_LEVELS } from '../lib/trait/platform-advanced-levels';
import * as E from '../lib/trait/platformer';
import { restoreProgress, saveProgress } from '../lib/trait/progress';
import { solveAdvancedLevel } from './advanced-walkthrough';

for (const level of ADVANCED_LEVELS) {
  test(`chapter ${level.id}: a complete sequence finishes without jumping, with all three optional stars`, () => {
    const world = solveAdvancedLevel(level);
    assert.equal(world.phase, 'won', `${level.id}: stopped at ${world.player.x},${world.player.y}`);
    assert.equal(world.deaths, 0);
    assert.equal(world.drawn.length, level.drawings.length);
    assert.equal(world.collected.length, 3, `chapter ${level.id}: collected ${world.collected}`);
    assert.equal(E.getGoalInterlock(world, level).locked, false);
  });
  test(`chapter ${level.id}: alternate low landings are playable but leave high-route stars`, () => {
    const world = solveAdvancedLevel(level, { choice: 'rive' });
    assert.equal(world.phase, 'won', `${level.id}: stopped at ${world.player.x},${world.player.y}`);
    assert.equal(world.deaths, 0);
    assert(world.collected.length < 3, 'a real optional high reward remains');
    assert.equal(Object.values(world.drawingChoices).filter(id => id === 'rive').length, level.drawings.length);
  });
}

test('the second act adds nineteen authored scenes and forks; the final assembly has four rooms', () => {
  assert.equal(ADVANCED_LEVELS.length, 6);
  assert.equal(ADVANCED_LEVELS.reduce((n, l) => n + l.puzzles!.length, 0), 19);
  assert.equal(ADVANCED_LEVELS.reduce((n, l) => n + l.drawings.length, 0), 19);
  for (const level of ADVANCED_LEVELS) {
    assert.equal(level.stars.length, 3);
    assert(level.mechanisms!.length >= 6);
    assert(level.goalRequirements!.some(r => 'mechanismId' in r && (r.max ?? 1) < 1));
    for (const d of level.drawings) {
      assert.equal(d.choices!.length, 2);
      assert.notDeepEqual(d.choices![0].path.at(-1), d.choices![1].path.at(-1), 'both routes have physically distinct landings');
    }
    for (const puzzle of level.puzzles!) {
      assert(puzzle.fromX < puzzle.toX);
      assert(puzzle.hints.every(hint => hint.length > 40));
      assert.equal(new Set(puzzle.hints).size, 3);
    }
  }
});

test('setting every handle to its upper endpoint cannot satisfy any final assembly', () => {
  for (const level of ADVANCED_LEVELS) {
    const world = E.createWorld(level);
    // An adversarial state stronger than a player can actually reach: even
    // granting every raised latch does not complete the required assembly.
    for (const state of Object.values(world.mechanisms)) state.progress = state.target = 1;
    assert(E.getGoalInterlock(world, level).locked, `chapter ${level.id} accepts the all-open shortcut`);
  }
});

test('every checkpoint reached in a solved run restores onto real ground with its physical settings', () => {
  for (const level of ADVANCED_LEVELS) {
    let previous = -1, restoredCount = 0;
    solveAdvancedLevel(level, { onFrame(world) {
      if (world.checkpointIndex === previous) return;
      previous = world.checkpointIndex;
      if (previous < 0) return;
      const saved = saveProgress(world, level), restored = restoreProgress(JSON.parse(JSON.stringify(saved)), level)!;
      assert(restored);
      for (let frame = 0; frame < 600; frame++) E.updateWorld(restored, level, { left: false, right: false, draw: false, crouch: false }, 1 / 60);
      assert.equal(restored.deaths, 0, `${level.id}/${previous}: unsafe restored flag`);
      assert(restored.player.grounded, `${level.id}/${previous}: no ground under restored flag`);
      assert.equal(restored.player.y, level.checkpoints[previous].y, `${level.id}/${previous}: restore dropped onto another floor`);
      restoredCount++;
    } });
    assert(restoredCount >= 7, `chapter ${level.id}: insufficient checked flags ${restoredCount}`);
  }
});
