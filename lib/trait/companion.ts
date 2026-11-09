import type { CartoonGesture } from './cartoon-character';
import {
  getMechanismPositions, getWorldHazardPosition, getWorldSurfaces,
  type GameEvent, type GameWorld, type PlatformLevel, type PlatformPoint,
} from './platformer';

export type CompanionActing = {
  gesture: CartoonGesture;
  age: number;
  duration: number;
  /** Changes at each acting beat. Only beats carrying speech start a reply. */
  sequence: number;
  target?: PlatformPoint;
  facing?: -1 | 1;
  speech?: 'waiting' | 'ready' | 'grumble' | 'call' | 'surprise' | 'thanks' | 'win';
};

type ActingBeat = {
  gesture: CartoonGesture;
  duration: number;
  focus?: 'obstacle' | 'artist';
  speech?: CompanionActing['speech'];
};

type ActingScene = {
  kind: 'protest' | 'danger' | 'touch' | 'thanks';
  beats: readonly ActingBeat[];
  index: number;
  obstacle?: PlatformPoint;
  artist: PlatformPoint;
  key?: string;
};

export type CompanionState = {
  time: number;
  acting: CompanionActing;
  blockedFor: number;
  blockedKey: string | null;
  /** Per obstacle cooldowns survive a small step away and back. */
  protestAfter: Record<string, number>;
  scene: ActingScene | null;
  takes: Record<ActingScene['kind'], number>;
  drawnCount: number;
  previousPhase: GameWorld['phase'];
  pointerNear: boolean;
  touchAfter: number;
  dangerKey: string | null;
  dangerAfter: number;
  heldId: string | null;
  heldFrom: number;
};

export function createCompanionState(world: GameWorld): CompanionState {
  return {
    time: 0, acting: { gesture: 'none', age: 0, duration: 0, sequence: 0 },
    blockedFor: 0, blockedKey: null, protestAfter: {}, scene: null,
    takes: { protest: 0, danger: 0, touch: 0, thanks: 0 }, drawnCount: world.drawn.length,
    previousPhase: world.phase, pointerNear: false, touchAfter: 0,
    dangerKey: null, dangerAfter: 0, heldId: null, heldFrom: 0,
  };
}

const DURATION: Record<CartoonGesture, number> = {
  none: 0, peek: .65, point: 1.1, call: 1.05, impatient: 1.15,
  delighted: 1.25, curious: .9, angry: .85, settle: .24,
  listen: .55, shrug: 1.25, explain: 1.2, recoil: .65, acknowledge: .65,
};

/**
 * The original exchanges are held drawings with changes of intention:
 * inspect the missing line, address the cartoonist, demonstrate, listen,
 * complain. Silent beats matter as much as the calls. These three takes
 * avoid performing the same pantomime at every new gap.
 */
const PROTEST_TAKES: readonly (readonly ActingBeat[])[] = [
  [
    { gesture: 'peek', duration: .65, focus: 'obstacle' },
    { gesture: 'listen', duration: .45, focus: 'artist' },
    { gesture: 'call', duration: 1.05, focus: 'artist', speech: 'call' },
    { gesture: 'point', duration: .75, focus: 'obstacle' },
    { gesture: 'shrug', duration: 1.25, focus: 'artist', speech: 'grumble' },
    { gesture: 'listen', duration: .65, focus: 'artist' },
    { gesture: 'angry', duration: 1.05, focus: 'artist', speech: 'waiting' },
    { gesture: 'impatient', duration: .7, focus: 'artist' },
  ],
  [
    { gesture: 'peek', duration: .5, focus: 'obstacle' },
    { gesture: 'point', duration: 1.05, focus: 'obstacle', speech: 'call' },
    { gesture: 'explain', duration: .7, focus: 'artist' },
    { gesture: 'listen', duration: .5, focus: 'artist' },
    { gesture: 'angry', duration: 1.2, focus: 'artist', speech: 'grumble' },
    { gesture: 'shrug', duration: .7, focus: 'artist' },
    { gesture: 'impatient', duration: 1.05, focus: 'artist', speech: 'waiting' },
    { gesture: 'listen', duration: .45, focus: 'artist' },
  ],
  [
    { gesture: 'peek', duration: .5, focus: 'obstacle' },
    { gesture: 'shrug', duration: 1.05, focus: 'artist', speech: 'call' },
    { gesture: 'point', duration: .7, focus: 'obstacle' },
    { gesture: 'listen', duration: .5, focus: 'artist' },
    { gesture: 'explain', duration: 1.3, focus: 'artist', speech: 'grumble' },
    { gesture: 'impatient', duration: .7, focus: 'artist' },
    { gesture: 'call', duration: 1.05, focus: 'artist', speech: 'waiting' },
    { gesture: 'listen', duration: .45, focus: 'artist' },
  ],
];

const TOUCH_TAKES: readonly (readonly ActingBeat[])[] = [
  [{ gesture: 'curious', duration: .9, focus: 'artist', speech: 'surprise' },
    { gesture: 'listen', duration: .45, focus: 'artist' }],
  [{ gesture: 'recoil', duration: .75, focus: 'artist', speech: 'surprise' },
    { gesture: 'impatient', duration: .65, focus: 'artist' }],
  [{ gesture: 'shrug', duration: 1.05, focus: 'artist', speech: 'call' },
    { gesture: 'acknowledge', duration: .5, focus: 'artist' }],
];

const THANKS_TAKES: readonly (readonly ActingBeat[])[] = [
  [{ gesture: 'delighted', duration: 1.2, focus: 'artist', speech: 'thanks' },
    { gesture: 'acknowledge', duration: .55, focus: 'artist' }],
  [{ gesture: 'acknowledge', duration: 1.05, focus: 'artist', speech: 'thanks' },
    { gesture: 'delighted', duration: .65, focus: 'artist' }],
  [{ gesture: 'explain', duration: 1.05, focus: 'artist', speech: 'thanks' },
    { gesture: 'acknowledge', duration: .65, focus: 'artist' }],
];

const DANGER_TAKES: readonly (readonly ActingBeat[])[] = [
  [{ gesture: 'recoil', duration: 1.05, focus: 'obstacle', speech: 'surprise' },
    { gesture: 'point', duration: .65, focus: 'obstacle' },
    { gesture: 'angry', duration: 1.15, focus: 'artist', speech: 'grumble' },
    { gesture: 'impatient', duration: .55, focus: 'artist' }],
  [{ gesture: 'peek', duration: .55, focus: 'obstacle' },
    { gesture: 'angry', duration: 1.2, focus: 'artist', speech: 'grumble' },
    { gesture: 'listen', duration: .65, focus: 'artist' },
    { gesture: 'shrug', duration: 1.05, focus: 'artist', speech: 'waiting' }],
];

function start(
  state: CompanionState, world: GameWorld, gesture: CartoonGesture,
  target?: PlatformPoint, speech?: CompanionActing['speech'],
  duration = DURATION[gesture],
) {
  state.acting = {
    gesture, age: 0, duration, sequence: state.acting.sequence + 1,
    ...(target ? { target: { ...target }, facing: (target.x < world.player.x - 8 ? -1 : target.x > world.player.x + 8 ? 1 : world.player.facing) as -1 | 1 } : {}),
    ...(speech ? { speech } : {}),
  };
}

function rest(state: CompanionState) {
  state.scene = null;
  state.acting = { gesture: 'none', age: 0, duration: 0, sequence: state.acting.sequence };
}

function artistTarget(world: GameWorld, pointer?: PlatformPoint | null): PlatformPoint {
  const p = world.player;
  // A remote cursor on the map is not the cartoonist. With no nearby hand,
  // he addresses the space above his shoulder, as in the reference shots.
  return pointer && Math.hypot(pointer.x - p.x, pointer.y - (p.y - 79)) < 260 && pointer.y < p.y - 25
    ? { ...pointer } : { x: p.x + p.facing * 65, y: p.y - 205 };
}

function startBeat(state: CompanionState, world: GameWorld) {
  const scene = state.scene!;
  const beat = scene.beats[scene.index];
  const target = beat.focus === 'artist' ? scene.artist : beat.focus === 'obstacle' ? scene.obstacle : undefined;
  start(state, world, beat.gesture, target, beat.speech, beat.duration);
}

function startScene(
  state: CompanionState, world: GameWorld, kind: ActingScene['kind'],
  takes: readonly (readonly ActingBeat[])[],
  pointer?: PlatformPoint | null, obstacle?: PlatformPoint, key?: string,
) {
  const take = state.takes[kind]++;
  const beats = takes[take % takes.length];
  state.scene = { kind, beats, index: 0, artist: artistTarget(world, pointer),
    ...(obstacle ? { obstacle: { ...obstacle } } : {}), ...(key ? { key } : {}) };
  startBeat(state, world);
  return beats.reduce((duration, beat) => duration + beat.duration, 0);
}

function needHelp(world: GameWorld, level: PlatformLevel): { key: string; target: PlatformPoint; edge: boolean } | null {
  const p = world.player;
  if (!p.grounded) return null;
  const views = getMechanismPositions(world, level);
  const gate = views.find(v => v.mechanism.type === 'gate'
    && (v.position.x - p.x) * p.facing > -15 && (v.position.x - p.x) * p.facing < 115
    && v.position.y > p.y - (p.crouching ? 44 : 78) && v.position.y - v.mechanism.height < p.y + 4);
  if (gate) return { key: gate.mechanism.id, target: gate.handle, edge: false };
  if (world.phase === 'drawing') {
    const drawing = level.drawings.find(d => d.id === world.activeDrawing?.id);
    if (drawing) return { key: drawing.id, target: drawing.path[drawing.path.length - 1], edge: false };
  }
  const surfaces = getWorldSurfaces(world, level);
  const heightAt = (x: number) => surfaces.flatMap(({ a, b }) => {
    if (Math.abs(b.x - a.x) < .01 || x < Math.min(a.x, b.x) || x > Math.max(a.x, b.x)) return [];
    return [a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x)];
  });
  const ahead = p.x + p.facing * 68;
  if (heightAt(ahead).some(y => Math.abs(y - p.y) < 48)) return null;
  const support = surfaces.find(({ a, b }) => Math.abs(b.x - a.x) > .01
    && p.x >= Math.min(a.x, b.x) - 1 && p.x <= Math.max(a.x, b.x) + 1
    && Math.abs(a.y + (b.y - a.y) * (p.x - a.x) / (b.x - a.x) - p.y) < 3);
  if (!support) return null;
  const endpoint = p.facing === 1
    ? (support.a.x > support.b.x ? support.a : support.b)
    : (support.a.x < support.b.x ? support.a : support.b);
  return { key: `edge:${Math.round(endpoint.x)}`, target: { x: endpoint.x + p.facing * 30, y: endpoint.y + 12 }, edge: true };
}

/**
 * Presentation-only acting. This never writes player position, facing, input,
 * physics or collision state. Pass zero dt while paused, and normal dt while
 * drawing so that a held pencil does not freeze the character's reaction.
 */
export function updateCompanion(
  state: CompanionState, world: GameWorld, level: PlatformLevel, dt: number,
  options: { pointer?: PlatformPoint | null; events?: GameEvent[]; touched?: boolean } = {},
): CompanionActing {
  const step = Math.max(0, Math.min(.1, Number.isFinite(dt) ? dt : 0));
  if (!step) return state.acting;
  state.time += step;
  state.acting.age += step;
  if (state.acting.age >= state.acting.duration) {
    if (state.scene && state.scene.index + 1 < state.scene.beats.length) {
      state.scene.index++;
      startBeat(state, world);
    } else rest(state);
  }
  const p = world.player, events = options.events ?? [];
  const held = world.handInteraction?.id ?? null;
  const beganHolding = !!held && held !== state.heldId;
  let assisted = world.drawn.length > state.drawnCount || events.includes('draw-complete');
  if (state.heldId && state.heldId !== held) {
    assisted ||= Math.abs((world.mechanisms[state.heldId]?.progress ?? 0) - state.heldFrom) > .08;
  }
  if (held !== state.heldId) {
    state.heldFrom = held ? world.mechanisms[held]?.progress ?? 0 : 0;
    state.heldId = held;
  }
  assisted ||= events.includes('mechanism-settle');
  state.drawnCount = world.drawn.length;

  if (world.phase === 'dead') {
    rest(state);
    state.blockedKey = null; state.blockedFor = 0; state.previousPhase = world.phase;
    return state.acting;
  }
  const won = world.phase === 'won' && state.previousPhase !== 'won';
  const celebrating = assisted || won;
  state.previousPhase = world.phase;

  const locomotion = !p.grounded || p.crouching || Math.abs(p.vx) >= 8;
  // A player action cancels the remaining conversation. It must never start
  // again halfway through after walking or ducking out of the pose.
  if (locomotion || ((held || world.phase === 'drawing') && state.scene?.kind !== 'thanks' && state.scene)) rest(state);

  const headHeight = p.crouching ? 43 : 79;
  const nearHead = !!options.pointer && Math.hypot(options.pointer.x - p.x, options.pointer.y - (p.y - headHeight)) < 48;
  const touched = options.touched && nearHead && state.time >= state.touchAfter && world.phase !== 'won';
  const noticedPointer = nearHead && !state.pointerNear;
  state.pointerNear = nearHead;

  const danger = world.phase === 'playing' && p.grounded ? level.hazards.find(hazard => {
    const position = getWorldHazardPosition(world, level, hazard);
    const radius = hazard.type === 'gear' ? hazard.r : hazard.w * .5;
    const x = hazard.type === 'gear' ? position.x : position.x + hazard.w * .5;
    return (x - p.x) * p.facing > -15 && (x - p.x) * p.facing < radius + 98
      && Math.abs(position.y - (p.y - (p.crouching ? 22 : 34))) < (hazard.type === 'gear' ? radius + 56 : hazard.h + 55);
  }) : undefined;
  const noticedDanger = danger && state.dangerKey !== danger.id && state.time >= state.dangerAfter;
  // Keep the approach eligible until he actually has a chance to react at rest.
  if (!locomotion) state.dangerKey = danger?.id ?? null;

  const need = world.phase === 'won' ? null : needHelp(world, level);
  const waiting = !!need && !locomotion && !held && world.phase === 'playing';
  if (need?.key !== state.blockedKey || !waiting) {
    state.blockedKey = need?.key ?? null; state.blockedFor = 0;
  } else state.blockedFor += step;

  if (state.scene?.kind === 'protest' && (!waiting || need?.key !== state.scene.key)) rest(state);

  if (celebrating) {
    startScene(state, world, 'thanks', THANKS_TAKES, options.pointer);
    if (won) state.acting.speech = 'win';
    state.blockedFor = 0;
  } else if (touched) {
    startScene(state, world, 'touch', TOUCH_TAKES, options.pointer);
    state.touchAfter = state.time + 2.4;
  } else if (noticedDanger && !locomotion && !held && world.phase === 'playing' && !state.scene) {
    startScene(state, world, 'danger', DANGER_TAKES, options.pointer, getWorldHazardPosition(world, level, danger));
    state.dangerAfter = state.time + 7;
  } else if (beganHolding) {
    const handle = getMechanismPositions(world, level).find(view => view.mechanism.id === held)?.handle;
    start(state, world, 'peek', handle);
  } else if (events.includes('land') && !locomotion && !state.scene && state.acting.gesture === 'none') {
    start(state, world, 'settle');
  } else if (noticedPointer && !locomotion && !state.scene && state.acting.gesture === 'none') {
    start(state, world, 'listen', options.pointer ?? undefined);
  }

  if (need && waiting && !state.scene && state.acting.gesture === 'none'
    && state.blockedFor >= .45 && state.time >= (state.protestAfter[need.key] ?? 0)) {
    const duration = startScene(state, world, 'protest', PROTEST_TAKES, options.pointer, need.target, need.key);
    // One exchange, then several seconds of calm. Neither a still cursor nor
    // tapping movement at the same edge restarts the introductory line.
    state.protestAfter[need.key] = state.time + duration + 8 + state.takes.protest % 3;
  }
  return state.acting;
}
