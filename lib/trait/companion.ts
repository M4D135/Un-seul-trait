import type { CartoonGesture } from './cartoon-character';
import {
  getMechanismPositions, getWorldHazardPosition, getWorldSurfaces,
  type GameEvent, type GameWorld, type PlatformLevel, type PlatformPoint,
} from './platformer';

export type CompanionActing = {
  gesture: CartoonGesture;
  age: number;
  duration: number;
  /** Changes only when a new reaction starts, useful for a single audio cue. */
  sequence: number;
  target?: PlatformPoint;
  facing?: -1 | 1;
  speech?: 'waiting' | 'ready' | 'grumble' | 'call' | 'surprise' | 'thanks';
};

export type CompanionState = {
  time: number;
  acting: CompanionActing;
  blockedFor: number;
  blockedKey: string | null;
  cue: number;
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
    blockedFor: 0, blockedKey: null, cue: 0, drawnCount: world.drawn.length,
    previousPhase: world.phase, pointerNear: false, touchAfter: 0,
    dangerKey: null, dangerAfter: 0, heldId: null, heldFrom: 0,
  };
}

const DURATION: Record<CartoonGesture, number> = {
  none: 0, peek: .65, point: 1.1, call: 1.05, impatient: 1.15,
  delighted: 1.25, curious: .9, angry: .85, settle: .24,
};

function start(
  state: CompanionState, world: GameWorld, gesture: CartoonGesture,
  target?: PlatformPoint, speech?: CompanionActing['speech'],
) {
  state.acting = {
    gesture, age: 0, duration: DURATION[gesture], sequence: state.acting.sequence + 1,
    ...(target ? { target: { ...target }, facing: (target.x < world.player.x - 8 ? -1 : target.x > world.player.x + 8 ? 1 : world.player.facing) as -1 | 1 } : {}),
    ...(speech ? { speech } : {}),
  };
}

function needHelp(world: GameWorld, level: PlatformLevel): { key: string; target: PlatformPoint; edge: boolean } | null {
  const p = world.player;
  if (!p.grounded) return null;
  const views = getMechanismPositions(world, level);
  const gate = views.find(v => v.mechanism.type === 'gate'
    && (v.position.x - p.x) * p.facing > -15 && (v.position.x - p.x) * p.facing < 115
    && v.position.y > p.y - 78 && v.position.y - v.mechanism.height < p.y + 4);
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
    state.acting = { gesture: 'none', age: 0, duration: 0, sequence: state.acting.sequence };
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
    state.acting = { gesture: 'none', age: 0, duration: 0, sequence: state.acting.sequence };
    state.blockedKey = null; state.blockedFor = 0; state.previousPhase = world.phase;
    return state.acting;
  }
  if (assisted || (world.phase === 'won' && state.previousPhase !== 'won')) {
    start(state, world, 'delighted', options.pointer ?? undefined, 'thanks');
    state.blockedFor = 0; state.cue = 0;
  } else if (events.includes('land') && state.acting.gesture === 'none') {
    start(state, world, 'settle');
  } else if (beganHolding && state.acting.gesture === 'none') {
    const handle=getMechanismPositions(world,level).find(view=>view.mechanism.id===held)?.handle;
    start(state, world, 'peek', handle);
  }
  state.previousPhase = world.phase;

  const nearHead = !!options.pointer && Math.hypot(options.pointer.x - p.x, options.pointer.y - (p.y - 79)) < 48;
  if (options.touched && nearHead && state.time >= state.touchAfter && world.phase !== 'won') {
    start(state, world, 'curious', options.pointer ?? undefined, 'surprise');
    state.touchAfter = state.time + 1.8;
  } else if (nearHead && !state.pointerNear && Math.abs(p.vx) < 8 && state.acting.gesture === 'none') {
    start(state, world, 'peek', options.pointer ?? undefined);
  }
  state.pointerNear = nearHead;

  const danger = world.phase === 'playing' && p.grounded ? level.hazards.find(hazard => {
    const position = getWorldHazardPosition(world, level, hazard);
    const radius = hazard.type === 'gear' ? hazard.r : hazard.w * .5;
    const x = hazard.type === 'gear' ? position.x : position.x + hazard.w * .5;
    return (x - p.x) * p.facing > -15 && (x - p.x) * p.facing < radius + 98
      && Math.abs(position.y - (p.y - 34)) < (hazard.type === 'gear' ? radius + 56 : hazard.h + 55);
  }) : undefined;
  if (danger && state.dangerKey !== danger.id && state.time >= state.dangerAfter
    && state.acting.gesture !== 'delighted' && state.acting.gesture !== 'curious') {
    start(state, world, 'angry', getWorldHazardPosition(world, level, danger), 'grumble');
    state.dangerAfter = state.time + 4;
  }
  state.dangerKey = danger?.id ?? null;

  const need = world.phase === 'won' ? null : needHelp(world, level);
  const waiting = !!need && Math.abs(p.vx) < 8 && !held;
  if (need?.key !== state.blockedKey || !waiting) {
    state.blockedKey = need?.key ?? null; state.blockedFor = 0; state.cue = 0;
  } else state.blockedFor += step;

  if (need && state.acting.gesture === 'none') {
    // A short glance can anticipate an edge while the player keeps moving.
    // Large gestures are only selected after stopping; the renderer also
    // makes locomotion take precedence over every reaction.
    if (!waiting && need.edge && state.cue === 0) {
      start(state, world, 'peek', need.target); state.cue = 1;
    } else if (waiting) {
      const thresholds = [.35, 1.7, 4.2, 8, 17];
      const threshold = thresholds[Math.min(state.cue, thresholds.length - 1)] + Math.max(0, state.cue - 4) * 12;
      if (state.blockedFor >= threshold) {
        const gesture: CartoonGesture = state.cue === 0 ? (need.edge ? 'peek' : 'point')
          : state.cue === 1 ? 'point' : state.cue === 2 ? 'call' : 'impatient';
        start(state, world, gesture, need.target, gesture === 'call' ? 'call' : gesture === 'impatient' ? 'grumble' : undefined);
        state.cue++;
      }
    }
  }
  return state.acting;
}
