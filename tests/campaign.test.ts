import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld, type PlatformLevel} from '../lib/trait/platformer';
import {
  chapterChallenge, createCampaignRun, emptyChapterScore, isChapterUnlocked,
  readChapterScores, readRunStats, recordChapterCompletion, summarizeCampaign,
} from '../lib/trait/campaign';
import {readAdventure, saveProgress} from '../lib/trait/progress';

function level(id = 1): PlatformLevel {
  return {
    id, title: `Chapitre ${id}`, subtitle: '', palette: 'blue', width: 1000,
    start: {x: 10, y: 430}, goal: {x: 990, y: 430}, hazards: [], checkpoints: [],
    surfaces: [{a: {x: 0, y: 430}, b: {x: 1000, y: 430}}],
    drawings: [{id: 'passage', title: 'Le passage', prompt: '', triggerX: 400, duration: 2,
      path: [{x: 400, y: 430}, {x: 600, y: 430}],
      choices: [
        {id: 'haut', label: 'Haut', hint: '', path: [{x: 400, y: 430}, {x: 600, y: 430}]},
        {id: 'bas', label: 'Bas', hint: '', path: [{x: 400, y: 430}, {x: 600, y: 430}]},
      ]}],
    stars: [{x: 300, y: 400}, {x: 500, y: 400}, {x: 700, y: 400}],
  };
}

test('legacy chapter scores keep their records without inventing same-run mastery', () => {
  const levels = Array.from({length: 12}, (_, i) => level(i + 1));
  const old = [{done: true, stars: 3, deaths: 0}, {done: true, stars: 1, deaths: 8}];
  const scores = readChapterScores(old, levels);
  assert.equal(scores.length, 12);
  assert.deepEqual(scores[0], {...emptyChapterScore(), done: true, stars: 3, deaths: 0});
  assert.equal(scores[1].deaths, 8);
  assert.deepEqual(scores[11], emptyChapterScore());
  assert.equal(chapterChallenge(scores[0], levels[0]), 'Toutes les étoiles, sans chute ni retour au drapeau');
  const broken = readChapterScores([{done: true, stars: Infinity, deaths: NaN, bestTime: -1,
    cleanStars: 3, independentStars: 3, mastered: true, routes: ['passage:haut', 'invalid', 'passage:haut']}], levels)[0];
  assert.equal(broken.stars, 0);
  assert.equal(broken.cleanStars, 0);
  assert.equal(broken.mastered, false);
  assert.equal(broken.bestTime, null);
  assert.deepEqual(broken.routes, ['passage:haut']);
});

test('a perfect traversal requires all conditions in one complete new run', () => {
  const l = level(), world = createWorld(l);
  world.phase = 'won'; world.collected = [0, 1, 2]; world.completedAt = 125;
  let score = recordChapterCompletion(emptyChapterScore(), world, l, {...createCampaignRun(), hintsUsed: 1});
  assert.equal(score.cleanStars, 3); assert.equal(score.independentStars, 0); assert.equal(score.mastered, false);
  world.deaths = 2; world.completedAt = 140;
  score = recordChapterCompletion(score, world, l, createCampaignRun());
  assert.equal(score.cleanStars, 3); assert.equal(score.independentStars, 3);
  assert.equal(score.mastered, false, 'two separate bests cannot be combined into a perfect traversal');
  assert.equal(score.deaths, 0); assert.equal(score.bestTime, 125);
  world.deaths = 0;
  score = recordChapterCompletion(score, world, l, createCampaignRun());
  assert.equal(score.mastered, true);
  assert.equal(chapterChallenge(score, l), 'Explorer les autres tracés');
});

test('returning to a checkpoint or resuming an unverified legacy run does not award a clean badge', () => {
  const l = level(), world = createWorld(l);
  world.phase = 'won'; world.collected = [0, 1, 2]; world.completedAt = 30;
  const retried = recordChapterCompletion(emptyChapterScore(), world, l, {...createCampaignRun(), checkpointReturns: 1});
  assert.equal(retried.cleanStars, 0); assert.equal(retried.independentStars, 3); assert.equal(retried.mastered, false);
  const legacy = recordChapterCompletion(emptyChapterScore(), world, l, readRunStats({version: 2}));
  assert.equal(legacy.done, true); assert.equal(legacy.stars, 3);
  assert.equal(legacy.cleanStars, 0); assert.equal(legacy.independentStars, 0); assert.equal(legacy.mastered, false);
});

test('run assistance counters survive the existing adventure migration and own their snapshot', () => {
  const l = level(), world = createWorld(l), run = createCampaignRun();
  run.hintsUsed = 2; run.checkpointReturns = 1;
  const saved = saveProgress(world, l, run);
  run.hintsUsed = 40;
  assert.equal(saved.run?.hintsUsed, 2);
  const restored = readAdventure(JSON.parse(JSON.stringify({[l.id]: saved})), [l]);
  assert.deepEqual(readRunStats(restored[l.id]), {hintsUsed: 2, checkpointReturns: 1, eligible: true});
  const old = readAdventure({[l.id]: saveProgress(world, l)}, [l]);
  assert.equal(readRunStats(old[l.id]).eligible, false);
  assert.deepEqual(readRunStats({run: {hintsUsed: NaN, checkpointReturns: -1, eligible: true}}),
    {hintsUsed: 0, checkpointReturns: 0, eligible: false});
});

test('the legacy act and new act entrance remain open; later chapters unlock progressively', () => {
  const levels = Array.from({length: 12}, (_, i) => level(i + 1));
  const scores = readChapterScores(null, levels);
  for (let i = 0; i < 7; i++) assert.equal(isChapterUnlocked(i, levels, scores), true);
  for (let i = 7; i < 12; i++) assert.equal(isChapterUnlocked(i, levels, scores), false);
  scores[6].done = true;
  assert.equal(isChapterUnlocked(7, levels, scores), true);
  assert.equal(isChapterUnlocked(8, levels, scores), false);
  const saved = {[levels[11].id]: saveProgress(createWorld(levels[11]), levels[11], createCampaignRun())};
  assert.equal(isChapterUnlocked(11, levels, scores, saved), true, 'existing started progress must never be locked');
  assert.equal(isChapterUnlocked(10, levels, scores, saved), false, 'unlocking one saved chapter does not unlock all later chapters');
  assert.equal(isChapterUnlocked(-1, levels, scores), false);
  assert.equal(isChapterUnlocked(12, levels, scores), false);
});

test('only committed alternatives in a completed chapter contribute to route exploration', () => {
  const l = level(), world = createWorld(l), initial = emptyChapterScore();
  world.drawn = ['passage']; world.constructions.passage = l.drawings[0].path;
  world.drawingChoices.passage = 'bas';
  assert.equal(recordChapterCompletion(initial, world, l, createCampaignRun()), initial);
  world.phase = 'won'; world.collected = [0, 0, 1, 2, 99];
  let score = recordChapterCompletion(initial, world, l, createCampaignRun());
  assert.equal(score.stars, 3); assert.deepEqual(score.routes, ['passage:bas']);
  score = recordChapterCompletion(score, world, l, createCampaignRun());
  assert.deepEqual(score.routes, ['passage:bas']);
  world.drawingChoices.passage = 'haut';
  score = recordChapterCompletion(score, world, l, createCampaignRun());
  assert.deepEqual(new Set(score.routes), new Set(['passage:haut', 'passage:bas']));
  assert.equal(chapterChallenge(score, l), 'Tous les défis accomplis');
  assert.deepEqual(summarizeCampaign([score], [l]), {
    completed: 1, stars: 3, totalStars: 3, mastered: 1, routes: 2, totalRoutes: 2,
  });
});
