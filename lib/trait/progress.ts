import {createWorld, type GameWorld, type PlatformLevel, type PlatformPoint} from './platformer';
import {preparePlayerStroke} from './platform-drawing';

export const ADVENTURE_SAVE_KEY = 'un-seul-trait-adventure-v2';
export type SavedProgress = {
  version: 2;
  levelId: number;
  checkpointIndex: number;
  constructions: Record<string, PlatformPoint[]>;
  collected: number[];
  deaths: number;
  time: number;
  mechanisms: Record<string, number>;
};

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const bounded = (v: unknown, min: number, max: number, fallback = min) => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;

/** Save only stable progress. A reload always starts safely at a reached flag. */
export function saveProgress(world: GameWorld, level: PlatformLevel): SavedProgress {
  return {
    version: 2, levelId: level.id, checkpointIndex: world.checkpointIndex,
    constructions: Object.fromEntries(level.drawings.filter(d => world.drawn.includes(d.id) && world.constructions[d.id]).map(d => [d.id, world.constructions[d.id].map(p => ({...p}))])),
    collected: [...world.collected], deaths: world.deaths, time: world.time,
    mechanisms: Object.fromEntries((level.mechanisms ?? []).map(m => [m.id, world.mechanisms[m.id]?.progress ?? m.initialProgress ?? 0])),
  };
}

/** Corrupt/older entries are ignored individually; no saved object becomes executable. */
export function restoreProgress(raw: unknown, level: PlatformLevel): GameWorld | null {
  if (!record(raw) || raw.version !== 2 || raw.levelId !== level.id) return null;
  const world = createWorld(level);
  world.checkpointIndex = Math.floor(bounded(raw.checkpointIndex, -1, level.checkpoints.length - 1));
  const spawn = world.checkpointIndex < 0 ? level.start : level.checkpoints[world.checkpointIndex];
  world.player.x = spawn.x; world.player.y = spawn.y;
  world.invulnerable = 1.2;
  world.deaths = Math.floor(bounded(raw.deaths, 0, 999999));
  world.time = bounded(raw.time, 0, 864000);
  world.collected = Array.isArray(raw.collected) ? [...new Set(raw.collected.filter((v): v is number => Number.isInteger(v) && v >= 0 && v < level.stars.length))] : [];
  if (record(raw.constructions)) for (const drawing of level.drawings) {
    const path = raw.constructions[drawing.id];
    if (!Array.isArray(path) || path.length < 2 || path.length > 4000 || path.some(p => !record(p) || typeof p.x !== 'number' || typeof p.y !== 'number')) continue;
    const prepared = preparePlayerStroke(path as PlatformPoint[], drawing.path[0], drawing.path[drawing.path.length - 1]);
    if (prepared.ok) { world.constructions[drawing.id] = prepared.points; world.drawn.push(drawing.id); }
  }
  if (record(raw.mechanisms)) for (const mechanism of level.mechanisms ?? []) {
    const progress = bounded(raw.mechanisms[mechanism.id], 0, 1, mechanism.initialProgress ?? 0);
    world.mechanisms[mechanism.id] = {progress, target: progress};
  }
  return world;
}

export function readAdventure(raw: unknown, levels: PlatformLevel[]): Record<string, SavedProgress> {
  if (!record(raw)) return {};
  const result: Record<string, SavedProgress> = {};
  for (const level of levels) {
    const world = restoreProgress(raw[String(level.id)], level);
    if (world) result[String(level.id)] = saveProgress(world, level);
  }
  return result;
}
