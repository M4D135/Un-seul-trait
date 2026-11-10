import type {GameWorld, PlatformLevel} from './platformer';

/** A deliberate restart is different from resuming a saved adventure. */
export type CampaignRun = {
  hintsUsed: number;
  checkpointReturns: number;
  /** Legacy saves have no evidence of a complete, unassisted run. */
  eligible: boolean;
};

/** Existing score fields retain their names so v1 saves remain readable. */
export type ChapterScore = {
  done: boolean;
  stars: number;
  deaths: number;
  /** Active simulation time, not time spent thinking or drawing. No deadline. */
  bestTime: number | null;
  cleanStars: number;
  independentStars: number;
  /** All stars, no death, no manual return and no hint in the same full run. */
  mastered: boolean;
  /** Distinct committed alternatives used on completed traversals. */
  routes: string[];
};

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown, maximum: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(maximum, Math.floor(value))) : 0;
const time = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0
  ? Math.min(864000, value) : null;

export const createCampaignRun = (): CampaignRun => ({hintsUsed: 0, checkpointReturns: 0, eligible: true});

/** Takes the saved chapter entry, not an unchecked world or preferences object. */
export function readRunStats(savedChapter: unknown): CampaignRun {
  const saved = record(savedChapter) && record(savedChapter.run) ? savedChapter.run : null;
  return {
    hintsUsed: count(saved?.hintsUsed, 999999),
    checkpointReturns: count(saved?.checkpointReturns, 999999),
    eligible: saved?.eligible === true && Number.isInteger(saved.hintsUsed)
      && Number.isInteger(saved.checkpointReturns)
      && typeof saved.hintsUsed === 'number' && saved.hintsUsed >= 0
      && typeof saved.checkpointReturns === 'number' && saved.checkpointReturns >= 0,
  };
}

export const emptyChapterScore = (): ChapterScore => ({
  done: false, stars: 0, deaths: 0, bestTime: null,
  cleanStars: 0, independentStars: 0, mastered: false, routes: [],
});

function routeKeys(level: PlatformLevel): Set<string> {
  return new Set(level.drawings.flatMap(drawing => (drawing.choices ?? [])
    .map(choice => `${drawing.id}:${choice.id}`)));
}

/** Migration never combines old best stars/deaths into an unproved perfect run. */
export function readChapterScores(raw: unknown, levels: readonly PlatformLevel[]): ChapterScore[] {
  return levels.map((level, index) => {
    const saved = Array.isArray(raw) && record(raw[index]) ? raw[index] : null;
    if (!saved) return emptyChapterScore();
    const done = saved.done === true;
    const stars = count(saved.stars, level.stars.length);
    const validRoutes = routeKeys(level);
    return {
      done, stars, deaths: count(saved.deaths, 999999),
      bestTime: done ? time(saved.bestTime) : null,
      cleanStars: done ? Math.min(stars, count(saved.cleanStars, level.stars.length)) : 0,
      independentStars: done ? Math.min(stars, count(saved.independentStars, level.stars.length)) : 0,
      mastered: done && stars === level.stars.length && saved.mastered === true
        && count(saved.cleanStars, level.stars.length) === level.stars.length
        && count(saved.independentStars, level.stars.length) === level.stars.length,
      routes: done && Array.isArray(saved.routes)
        ? [...new Set(saved.routes.filter((key): key is string => typeof key === 'string' && validRoutes.has(key)))] : [],
    };
  });
}

/** Called once on the simulation's win event. Failed/unfinished runs award nothing. */
export function recordChapterCompletion(
  previous: ChapterScore,
  world: GameWorld,
  level: PlatformLevel,
  run: CampaignRun,
): ChapterScore {
  if (world.levelId !== level.id || world.phase !== 'won') return previous;
  const stars = new Set(world.collected.filter(index => Number.isInteger(index) && index >= 0 && index < level.stars.length)).size;
  const deaths = count(world.deaths, 999999);
  const elapsed = time(world.completedAt ?? world.time);
  const clean = run.eligible && deaths === 0 && run.checkpointReturns === 0;
  const independent = run.eligible && run.hintsUsed === 0;
  const routes = new Set(previous.routes);
  for (const drawing of level.drawings) {
    if (!world.drawn.includes(drawing.id) || !world.constructions[drawing.id]?.length) continue;
    const choice = drawing.choices?.find(item => item.id === world.drawingChoices[drawing.id])
      ?? drawing.choices?.[0];
    if (choice) routes.add(`${drawing.id}:${choice.id}`);
  }
  return {
    done: true,
    stars: Math.max(previous.stars, stars),
    deaths: previous.done ? Math.min(previous.deaths, deaths) : deaths,
    bestTime: elapsed === null ? previous.bestTime
      : previous.bestTime === null ? elapsed : Math.min(previous.bestTime, elapsed),
    cleanStars: Math.max(previous.cleanStars, clean ? stars : 0),
    independentStars: Math.max(previous.independentStars, independent ? stars : 0),
    mastered: previous.mastered || (clean && independent && stars === level.stars.length),
    routes: [...routes],
  };
}

/** The old six chapters stay open; chapter seven is the new act's entrance. */
export function isChapterUnlocked(
  index: number,
  levels: readonly PlatformLevel[],
  scores: readonly ChapterScore[],
  adventure: Readonly<Record<string, unknown>> = {},
): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= levels.length) return false;
  if (index <= 6 || scores[index]?.done || scores[index - 1]?.done) return true;
  const saved = adventure[String(levels[index].id)];
  // Never lock a legitimate chapter already started in this browser.
  return record(saved) && saved.version === 2 && saved.levelId === levels[index].id;
}

export function chapterChallenge(score: ChapterScore, level: PlatformLevel): string {
  if (!score.done) return 'Trouver la sortie';
  if (score.stars < level.stars.length) return 'Réunir toutes les étoiles';
  if (score.cleanStars < level.stars.length) return 'Toutes les étoiles, sans chute ni retour au drapeau';
  if (score.independentStars < level.stars.length) return 'Toutes les étoiles, sans indice';
  if (!score.mastered) return 'Un parcours parfait, du premier au dernier trait';
  if (score.routes.length < routeKeys(level).size) return 'Explorer les autres tracés';
  return 'Tous les défis accomplis';
}

export function summarizeCampaign(scores: readonly ChapterScore[], levels: readonly PlatformLevel[]) {
  return levels.reduce((summary, level, index) => {
    const score = scores[index] ?? emptyChapterScore();
    summary.completed += Number(score.done);
    summary.stars += Math.min(level.stars.length, score.stars);
    summary.totalStars += level.stars.length;
    summary.mastered += Number(score.mastered);
    summary.routes += score.routes.length;
    summary.totalRoutes += routeKeys(level).size;
    return summary;
  }, {completed: 0, stars: 0, totalStars: 0, mastered: 0, routes: 0, totalRoutes: 0});
}
