import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ADVANCED_LEVELS } from '../lib/trait/platform-advanced-levels';
import * as E from '../lib/trait/platformer';
import { restoreProgress, saveProgress } from '../lib/trait/progress';
import { ADVANCED_WALKTHROUGHS, runAdvancedAction, solveAdvancedLevel } from './advanced-walkthrough';

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
    assert(level.mechanisms!.some(m => m.interlock?.requirements.some(r => 'mechanismId' in r && (r.max ?? 1) < 1)),
      'intermediate and lowered positions are still required by the physical room locks');
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

test('trying to raise every handle through the real pointer API cannot bypass the first puzzle', () => {
  for (const level of ADVANCED_LEVELS) {
    const world = E.createWorld(level);
    let refused = 0;
    for (const mechanism of level.mechanisms!) {
      const handle = E.getMechanismHandlePosition(world, mechanism);
      const position = E.getMechanismPosition(world, mechanism);
      if (!E.beginMechanismInteraction(world, level, handle).ok) { refused++; continue; }
      E.moveMechanismInteraction(world, level, {
        x: handle.x + mechanism.to.x - position.x,
        y: handle.y + mechanism.to.y - position.y,
      });
      E.endMechanismInteraction(world);
    }
    for (let frame = 0; frame < 1200; frame++) E.updateWorld(world, level,
      { left: false, right: true, draw: false, crouch: true }, 1 / 60);
    assert(refused > 0, `chapter ${level.id}: no local lock rejected an incorrect setting`);
    assert(world.player.x < level.drawings[0].triggerX,
      `chapter ${level.id}: opening everything bypassed the physical first room`);
    assert.equal(world.phase, 'playing');
    assert.equal(world.deaths, 0, 'the character waits at a real door or unfinished edge');
  }
});

test('the bridge and returning ferry reject wrong settings locally, before their exit doors open', () => {
  const level = ADVANCED_LEVELS.find(l => l.id === 7)!;
  const world = E.createWorld(level);
  const tryDoor = (id: string) => E.beginMechanismInteraction(world, level,
    E.getMechanismHandlePosition(world, level.mechanisms!.find(m => m.id === id)!));

  runAdvancedAction(world, level, { kind: 'drag', id: 'appuis-pont', at: 1 });
  assert.equal(tryDoor('appuis-porte').ok, false, 'the bridge endpoint does not align both banks');
  assert.equal(world.mechanisms['appuis-porte'].progress, 0);
  runAdvancedAction(world, level, { kind: 'drag', id: 'appuis-pont', at: .5 });
  runAdvancedAction(world, level, { kind: 'drag', id: 'appuis-porte', at: 1 });

  runAdvancedAction(world, level, { kind: 'drag', id: 'rappel-plateau', at: 1 });
  runAdvancedAction(world, level, { kind: 'drag', id: 'rappel-cliquet', at: 1 });
  assert.equal(tryDoor('rappel-porte').ok, false, 'docking alone does not release the return door');
  assert.equal(world.mechanisms['rappel-porte'].progress, 0);
  runAdvancedAction(world, level, { kind: 'drag', id: 'rappel-plateau', at: 0 });
  runAdvancedAction(world, level, { kind: 'drag', id: 'rappel-porte', at: 1 });
});

test('chapter 7 can finish after its solved bridge and ferry have been moved again', () => {
  const level = ADVANCED_LEVELS.find(l => l.id === 7)!;
  const world = E.createWorld(level);
  for (const action of ADVANCED_WALKTHROUGHS[7]) {
    runAdvancedAction(world, level, action);
    if (action.kind === 'drag' && action.id === 'appuis-porte') {
      runAdvancedAction(world, level, { kind: 'drag', id: 'appuis-pont', at: 1 });
    }
    if (action.kind === 'drag' && action.id === 'rappel-porte') {
      runAdvancedAction(world, level, { kind: 'drag', id: 'rappel-plateau', at: 1 });
    }
  }
  assert.equal(world.collected.length, 3);
  assert.equal(world.deaths, 0);
  assert.equal(world.mechanisms['appuis-pont'].progress, 1);
  assert.equal(world.mechanisms['rappel-plateau'].progress, 1);
  assert.equal(world.mechanisms['appuis-porte'].progress, 1);
  assert.equal(world.mechanisms['rappel-porte'].progress, 1);

  // This is also a version-2 save from the previously blocked configuration:
  // no new field, automatic reset or replay of the old rooms is necessary.
  const saved = JSON.parse(JSON.stringify(saveProgress(world, level)));
  const restored = restoreProgress(saved, level)!;
  assert(restored);
  assert(restored.player.x > 5500, 'the final reached checkpoint is retained');
  assert.deepEqual(restored.mechanisms['appuis-pont'], { progress: 1, target: 1 });
  assert.deepEqual(restored.mechanisms['rappel-plateau'], { progress: 1, target: 1 });
  for (const candidate of [world, restored]) {
    for (let frame = 0; frame < 240 && candidate.phase !== 'won'; frame++) {
      E.updateWorld(candidate, level, { left: false, right: true, draw: false, crouch: true }, 1 / 60);
    }
    assert.equal(candidate.phase, 'won', 'reaching the flag completes the physical course');
    assert.equal(candidate.collected.length, 3);
    assert.equal(candidate.deaths, 0);
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
