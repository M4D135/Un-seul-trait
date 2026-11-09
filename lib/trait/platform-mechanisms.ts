import type { GameWorld, PlatformHazard, PlatformLevel, PlatformPoint, PlatformSurface } from './platformer';
import { getPlayerHeight } from './platformer';

/** Rail endpoints are a platform's top centre, a gate's bottom centre, or a gear's centre. */
type MechanismBase = {
  id: string;
  title: string;
  prompt: string;
  from: PlatformPoint;
  to: PlatformPoint;
  width: number;
  speed?: number;
  initialProgress?: number;
};
export type PlatformMechanism =
  | (MechanismBase & { type: 'platform' })
  | (MechanismBase & { type: 'gate'; height: number })
  | (MechanismBase & { type: 'gear'; hazardId: string });
export type MechanismState = { progress: number; target: number };
export type HandInteraction = { id: string; source: 'pointer' | 'keyboard'; point: PlatformPoint };
export type MechanismResult = { ok: boolean; message: string; id?: string };
export type MechanismView = { mechanism: PlatformMechanism; position: PlatformPoint; handle: PlatformPoint; progress: number; held: boolean };

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const finitePoint = (p: PlatformPoint) => Number.isFinite(p.x) && Number.isFinite(p.y);
const lerpPoint = (m: PlatformMechanism, t: number): PlatformPoint => ({ x: m.from.x + (m.to.x - m.from.x) * t, y: m.from.y + (m.to.y - m.from.y) * t });

export function createMechanismStates(level: PlatformLevel): Record<string, MechanismState> {
  return Object.fromEntries((level.mechanisms ?? []).map(m => {
    const progress = clamp01(m.initialProgress ?? 0);
    return [m.id, { progress, target: progress }];
  }));
}

export function getMechanismPosition(world: GameWorld, mechanism: PlatformMechanism): PlatformPoint {
  return lerpPoint(mechanism, world.mechanisms[mechanism.id]?.progress ?? mechanism.initialProgress ?? 0);
}

export function getMechanismHandlePosition(world: GameWorld, mechanism: PlatformMechanism): PlatformPoint {
  const position = getMechanismPosition(world, mechanism);
  // A fixed lower-middle handle stays visible at both rail ends, including the tallest gate.
  const dy = mechanism.type === 'platform' ? -25 : mechanism.type === 'gate' ? -mechanism.height / 2 + 20 : -mechanism.width / 2 - 22;
  return { x: position.x, y: position.y + dy };
}

export function getMechanismPositions(world: GameWorld, level: PlatformLevel): MechanismView[] {
  return (level.mechanisms ?? []).map(mechanism => ({
    mechanism, position: getMechanismPosition(world, mechanism), handle: getMechanismHandlePosition(world, mechanism),
    progress: world.mechanisms[mechanism.id]?.progress ?? mechanism.initialProgress ?? 0,
    held: world.handInteraction?.id === mechanism.id,
  }));
}

/** The same returned position is used by the wheel renderer and the collision capsule. */
export function getWorldHazardPosition(world: GameWorld, level: PlatformLevel, hazard: PlatformHazard): PlatformPoint {
  const carrier = (level.mechanisms ?? []).find(m => m.type === 'gear' && m.hazardId === hazard.id);
  if (carrier) return getMechanismPosition(world, carrier);
  if (hazard.type !== 'gear' || !hazard.axis || !hazard.range) return { x: hazard.x, y: hazard.y };
  const offset = Math.sin(world.time * (hazard.speed ?? 1.3) + (hazard.phase ?? 0)) * hazard.range;
  return { x: hazard.x + (hazard.axis === 'x' ? offset : 0), y: hazard.y + (hazard.axis === 'y' ? offset : 0) };
}

export function getMechanismSurfaces(world: GameWorld, level: PlatformLevel): PlatformSurface[] {
  return (level.mechanisms ?? []).filter(m => m.type === 'platform').map(m => {
    const p = getMechanismPosition(world, m);
    return { a: { x: p.x - m.width / 2, y: p.y }, b: { x: p.x + m.width / 2, y: p.y } };
  });
}

function railFraction(mechanism: PlatformMechanism, point: PlatformPoint): number {
  const dx = mechanism.to.x - mechanism.from.x, dy = mechanism.to.y - mechanism.from.y;
  const size = dx * dx + dy * dy;
  return size > 0 ? clamp01(((point.x - mechanism.from.x) * dx + (point.y - mechanism.from.y) * dy) / size) : 0;
}

/** A parked object remains callable from either end, so a lost ferry never strands a respawn. */
export function getAvailableMechanism(world: GameWorld, level: PlatformLevel): PlatformMechanism | null {
  if (world.phase !== 'playing') return null;
  const point = { x: world.player.x, y: world.player.y - 38 };
  let nearest: PlatformMechanism | null = null, best = 270;
  for (const mechanism of level.mechanisms ?? []) {
    const onRail = lerpPoint(mechanism, railFraction(mechanism, point));
    const distance = Math.hypot(point.x - onRail.x, point.y - onRail.y);
    if (distance < best) { nearest = mechanism; best = distance; }
  }
  return nearest;
}

export function beginMechanismInteraction(world: GameWorld, level: PlatformLevel, point: PlatformPoint): MechanismResult {
  if (world.phase !== 'playing' || !finitePoint(point)) return { ok: false, message: 'Reprends la traversée pour saisir une poignée.' };
  let nearest: PlatformMechanism | null = null, best = 34;
  for (const mechanism of level.mechanisms ?? []) {
    const handle = getMechanismHandlePosition(world, mechanism);
    const distance = Math.hypot(point.x - handle.x, point.y - handle.y);
    if (distance <= best) { nearest = mechanism; best = distance; }
  }
  if (!nearest) return { ok: false, message: 'Saisis une poignée dorée.' };
  const state = world.mechanisms[nearest.id];
  if (!state) return { ok: false, message: 'Cette poignée ne répond pas.' };
  state.target = state.progress;
  world.handInteraction = { id: nearest.id, source: 'pointer', point: { ...point } };
  return { ok: true, message: nearest.prompt, id: nearest.id };
}

export function moveMechanismInteraction(world: GameWorld, level: PlatformLevel, point: PlatformPoint): void {
  if (world.phase !== 'playing' || world.handInteraction?.source !== 'pointer' || !finitePoint(point)) return;
  const mechanism = (level.mechanisms ?? []).find(m => m.id === world.handInteraction?.id);
  if (!mechanism) return;
  const position = getMechanismPosition(world, mechanism), handle = getMechanismHandlePosition(world, mechanism);
  // Account for the visible handle's offset: grabbing it never shifts the object suddenly.
  const anchorPoint = { x: point.x - (handle.x - position.x), y: point.y - (handle.y - position.y) };
  world.mechanisms[mechanism.id].target = railFraction(mechanism, anchorPoint);
  world.handInteraction.point = { ...point };
}

export function endMechanismInteraction(world: GameWorld): void {
  world.handInteraction = null;
}

export function activateNearestMechanism(world: GameWorld, level: PlatformLevel): MechanismResult {
  const mechanism = getAvailableMechanism(world, level);
  if (!mechanism) return { ok: false, message: 'Approche-toi d’une poignée dorée.' };
  const state = world.mechanisms[mechanism.id];
  if (!state) return { ok: false, message: 'Cette poignée ne répond pas.' };
  state.target = state.target >= 0.5 ? 0 : 1;
  world.handInteraction = { id: mechanism.id, source: 'keyboard', point: getMechanismHandlePosition(world, mechanism) };
  return { ok: true, message: mechanism.prompt, id: mechanism.id };
}

/** Keep solved objects where they are, but release the hand and stop queued travel on death. */
export function releaseMechanisms(world: GameWorld): void {
  world.handInteraction = null;
  for (const state of Object.values(world.mechanisms)) state.target = state.progress;
}

function gateOverlapsPlayer(world: GameWorld, mechanism: Extract<PlatformMechanism, { type: 'gate' }>, p: PlatformPoint): boolean {
  const hero = world.player;
  return Math.abs(hero.x - p.x) < mechanism.width / 2 + 11 && hero.y > p.y - mechanism.height + 1 && hero.y - getPlayerHeight(hero) < p.y + 1;
}

function gearDistanceFromPlayer(world: GameWorld, p: PlatformPoint): number {
  const nearestY = Math.max(world.player.y - getPlayerHeight(world.player) + 10, Math.min(world.player.y - 10, p.y));
  return Math.hypot(world.player.x - p.x, nearestY - p.y);
}

/** Advance bounded rails at simulation rate; riding platforms carry feet before the next player step. */
export function advanceMechanisms(world: GameWorld, level: PlatformLevel, dt: number): boolean {
  let settled = false;
  for (const mechanism of level.mechanisms ?? []) {
    const state = world.mechanisms[mechanism.id];
    if (!state || Math.abs(state.target - state.progress) < 0.000001) continue;
    const old = getMechanismPosition(world, mechanism);
    const length = Math.hypot(mechanism.to.x - mechanism.from.x, mechanism.to.y - mechanism.from.y);
    const step = (mechanism.speed ?? 170) * dt / Math.max(1, length);
    let progress = state.progress < state.target ? Math.min(state.target, state.progress + step) : Math.max(state.target, state.progress - step);
    if (Math.abs(progress - state.target) < 0.000001) progress = state.target;
    const next = lerpPoint(mechanism, progress);
    // Hand-driven gates and gears stop at the body, instead of crushing or teleporting it.
    const blocked = mechanism.type === 'gate'
      ? gateOverlapsPlayer(world, mechanism, next) && (next.y > old.y || !gateOverlapsPlayer(world, mechanism, old))
      : mechanism.type === 'gear'
        ? gearDistanceFromPlayer(world, next) < mechanism.width / 2 * 0.84 + 14
          && gearDistanceFromPlayer(world, next) < gearDistanceFromPlayer(world, old)
        : false;
    if (blocked) {
      state.target = state.progress;
      if (world.handInteraction?.id === mechanism.id && world.handInteraction.source === 'keyboard') world.handInteraction = null;
      continue;
    }
    const riding = mechanism.type === 'platform' && world.player.grounded
      && Math.abs(world.player.y - old.y) < 2.5 && Math.abs(world.player.x - old.x) <= mechanism.width / 2 + 0.1;
    if (riding) {
      const shift = { x: next.x - old.x, y: next.y - old.y };
      const shiftedPlayer = { ...world.player, x: world.player.x + shift.x, y: world.player.y + shift.y };
      const collisionWorld = { ...world, player: shiftedPlayer };
      const obstructed = (level.mechanisms ?? []).some(m => m.type === 'gate' && gateOverlapsPlayer(collisionWorld, m, getMechanismPosition(world, m)));
      if (obstructed) {
        state.target = state.progress;
        if (world.handInteraction?.id === mechanism.id && world.handInteraction.source === 'keyboard') world.handInteraction = null;
        continue;
      }
      world.player.x = shiftedPlayer.x;
      world.player.y = shiftedPlayer.y;
    }
    state.progress = progress;
    if (world.handInteraction?.id === mechanism.id && world.handInteraction.source === 'keyboard') {
      world.handInteraction.point = getMechanismHandlePosition(world, mechanism);
    }
    if (Math.abs(state.progress - state.target) < 0.000001) {
      settled = true;
      if (world.handInteraction?.id === mechanism.id && world.handInteraction.source === 'keyboard') world.handInteraction = null;
    }
  }
  return settled;
}

/** Solid gates prevent lateral passage while their lower edge is still in the hero's way. */
export function resolveGateCollision(world: GameWorld, level: PlatformLevel, previous: PlatformPoint): void {
  const p = world.player;
  for (const mechanism of level.mechanisms ?? []) {
    if (mechanism.type !== 'gate') continue;
    const gate = getMechanismPosition(world, mechanism);
    const left = gate.x - mechanism.width / 2 - 10, right = gate.x + mechanism.width / 2 + 10;
    const top = gate.y - mechanism.height;
    if (p.x <= left || p.x >= right || p.y <= top || p.y - getPlayerHeight(p) >= gate.y) continue;
    if (previous.x <= left || (previous.x < gate.x && previous.y > top)) { p.x = left; p.vx = 0; }
    else if (previous.x >= right || previous.y > top) { p.x = right; p.vx = 0; }
    else if (p.vy >= 0 && previous.y <= top) { p.y = top; p.vy = 0; p.grounded = true; }
    else { p.y = gate.y + getPlayerHeight(p); p.vy = Math.max(0, p.vy); }
  }
}
