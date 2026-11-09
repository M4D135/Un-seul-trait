import { preparePlayerStroke, strokeLength, STROKE_ANCHOR_RADIUS } from './platform-drawing';
import { advanceMechanisms, createMechanismStates, getMechanismPosition, getMechanismSurfaces, getWorldHazardPosition, releaseMechanisms, resolveGateCollision } from './platform-mechanisms';
import type { HandInteraction, MechanismState, PlatformMechanism } from './platform-mechanisms';
export { beginMechanismInteraction, endMechanismInteraction, getAvailableMechanism, getMechanismHandlePosition, getMechanismPosition, getMechanismPositions, getWorldHazardPosition, moveMechanismInteraction } from './platform-mechanisms';
export type { HandInteraction, MechanismResult, MechanismState, MechanismView, PlatformMechanism } from './platform-mechanisms';

/** Deterministic, DOM-free platform game simulation. Coordinates are in scene units. */
export type PlatformPoint = { x: number; y: number };
export type PlatformSurface = { a: PlatformPoint; b: PlatformPoint };
export type PlatformPalette = 'blue' | 'teal' | 'plum' | 'terracotta';

export type PlatformHazard =
  | {
    id: string; type: 'gear'; x: number; y: number; r: number;
    axis?: 'x' | 'y'; range?: number; speed?: number; phase?: number;
    appearance?: 'saw' | 'pendulum'; motion?: 'swing'; armLength?: number; swingAngle?: number;
  }
  | { id: string; type: 'spikes'; x: number; y: number; w: number; h: number };

export type DrawingChoice = {
  id: string;
  label: string;
  hint: string;
  path: PlatformPoint[];
  inkLimit?: number;
};

export type DrawingObstacle = {
  id: string;
  title: string;
  prompt: string;
  triggerX: number;
  /** Reference route: only its endpoints constrain the player's own construction. */
  path: PlatformPoint[];
  duration: number;
  /** Authored alternatives are planning guides, never automatically built geometry. */
  choices?: DrawingChoice[];
  inkLimit?: number;
};

export type PlatformLevel = {
  id: number;
  title: string;
  subtitle: string;
  palette: PlatformPalette;
  width: number;
  start: PlatformPoint;
  goal: PlatformPoint;
  surfaces: PlatformSurface[];
  hazards: PlatformHazard[];
  drawings: DrawingObstacle[];
  stars: PlatformPoint[];
  /** Safe respawn positions, in increasing x order; the initial start is separate. */
  checkpoints: PlatformPoint[];
  /** Objects manipulated by the human hand, with shared render/collision coordinates. */
  mechanisms?: PlatformMechanism[];
};

export type PlatformInput = {
  left: boolean;
  right: boolean;
  /** Held input: stay low, or walk slowly under an overhead obstacle. */
  crouch?: boolean;
  /** One-frame pulse, shared by E and the on-screen hand button. */
  draw: boolean;
};

export type GameEvent = 'land' | 'draw-start' | 'draw-complete' | 'star' | 'death' | 'respawn' | 'checkpoint' | 'win' | 'mechanism-start' | 'mechanism-settle';

export type BloodParticle = {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
};

export type PlatformPlayer = {
  /** x is the foot centre; y is the ground-contact height, not the head. */
  x: number; y: number; vx: number; vy: number;
  facing: -1 | 1;
  grounded: boolean;
  crouching: boolean;
  /** Actual accumulated horizontal distance, used to animate walking. */
  travel: number;
};

export type GameWorld = {
  levelId: number;
  player: PlatformPlayer;
  time: number;
  phase: 'playing' | 'drawing' | 'dead' | 'won';
  drawn: string[];
  /** Validated custom paths; these exact points are displayed and used for collisions. */
  constructions: Record<string, PlatformPoint[]>;
  /** Only committed choices are saved. Changing a plan never deletes an existing bridge. */
  drawingChoices: Record<string, string>;
  mechanisms: Record<string, MechanismState>;
  handInteraction: HandInteraction | null;
  activeDrawing: { id: string; progress: number; path: PlatformPoint[]; started: boolean; choiceId?: string; anchorRadius?: number } | null;
  collected: number[];
  /** -1 means the initial spawn; otherwise indexes level.checkpoints. */
  checkpointIndex: number;
  deaths: number;
  particles: BloodParticle[];
  deathTimer: number;
  invulnerable: number;
  completedAt: number | null;
  lastDeathCause: 'gear' | 'spikes' | 'fall' | null;
};

export const PLATFORM_PHYSICS = {
  speed: 185,
  gravity: 820,
  crouchSpeed: 95,
  maxFallSpeed: 730,
  bodyHeight: 80,
  crouchHeight: 44,
  bodyRadius: 10,
  stepHeight: 34,
  respawnDelay: 0.9,
} as const;

export function getPlayerHeight(player: Pick<PlatformPlayer, 'crouching'>): number {
  return player.crouching ? PLATFORM_PHYSICS.crouchHeight : PLATFORM_PHYSICS.bodyHeight;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const approach = (n: number, target: number, amount: number) => n < target ? Math.min(target, n + amount) : Math.max(target, n - amount);

export function createWorld(level: PlatformLevel): GameWorld {
  return {
    levelId: level.id,
    player: { ...level.start, vx: 0, vy: 0, facing: 1, grounded: true, crouching: false, travel: 0 },
    time: 0, phase: 'playing', drawn: [], constructions: {}, drawingChoices: {}, activeDrawing: null, collected: [],
    mechanisms: createMechanismStates(level), handInteraction: null,
    checkpointIndex: -1, deaths: 0, particles: [], deathTimer: 0, invulnerable: 0,
    completedAt: null, lastDeathCause: null,
  };
}

export function getHazardPosition(hazard: PlatformHazard, time: number): PlatformPoint {
  if (hazard.type === 'gear' && hazard.motion === 'swing') {
    const length = hazard.armLength ?? 150;
    const angle = Math.sin(time * (hazard.speed ?? 1.3) + (hazard.phase ?? 0)) * (hazard.swingAngle ?? .32);
    // x/y is the lowest centre. The visible rope and collision centre share
    // this circular path; the ball rises toward either end of its swing.
    return { x: hazard.x + Math.sin(angle) * length, y: hazard.y + (Math.cos(angle) - 1) * length };
  }
  if (hazard.type !== 'gear' || !hazard.axis || !hazard.range) return { x: hazard.x, y: hazard.y };
  const displacement = Math.sin(time * (hazard.speed ?? 1.3) + (hazard.phase ?? 0)) * hazard.range;
  return {
    x: hazard.x + (hazard.axis === 'x' ? displacement : 0),
    y: hazard.y + (hazard.axis === 'y' ? displacement : 0),
  };
}

export function getWorldSurfaces(world: GameWorld, level: PlatformLevel): PlatformSurface[] {
  const surfaces = [...level.surfaces, ...getMechanismSurfaces(world, level)];
  for (const drawing of level.drawings) {
    if (!world.drawn.includes(drawing.id)) continue;
    const path = world.constructions[drawing.id];
    if (!path) continue;
    for (let i = 1; i < path.length; i++) {
      surfaces.push({ a: path[i - 1], b: path[i] });
    }
  }
  return surfaces;
}

export function getDrawingChoice(world: GameWorld, drawing: DrawingObstacle): DrawingChoice | null {
  const selected = world.activeDrawing?.id === drawing.id
    ? world.activeDrawing.choiceId ?? world.drawingChoices[drawing.id]
    : world.drawingChoices[drawing.id];
  return drawing.choices?.find(choice => choice.id === selected) ?? drawing.choices?.[0] ?? null;
}

export function getDrawingPlan(world: GameWorld, drawing: DrawingObstacle): DrawingObstacle {
  const choice = getDrawingChoice(world, drawing);
  return choice ? { ...drawing, path: choice.path, prompt: choice.hint, inkLimit: choice.inkLimit ?? drawing.inkLimit } : drawing;
}

export function getAvailableDrawing(world: GameWorld, level: PlatformLevel): DrawingObstacle | null {
  if (world.phase !== 'playing' || !world.player.grounded) return null;
  let nearest: DrawingObstacle | null = null;
  let nearestDistance = Infinity;
  for (const drawing of level.drawings) {
    if (drawing.path.length < 2) continue;
    const routes = drawing.choices?.length ? drawing.choices.map(choice => choice.path) : [drawing.path];
    const delta = Math.min(...routes.map(path => {
      const start = path[0], end = path[path.length - 1];
      const leftDistance = Math.abs(world.player.y - start.y) <= 90
        ? Math.min(Math.abs(world.player.x - drawing.triggerX), Math.abs(world.player.x - start.x)) : Infinity;
      const rightDistance = Math.abs(world.player.y - end.y) <= 90 ? Math.abs(world.player.x - end.x) : Infinity;
      return Math.min(leftDistance, rightDistance);
    }));
    if (delta <= 105 && delta < nearestDistance) {
      nearest = getDrawingPlan(world, drawing);
      nearestDistance = delta;
    }
  }
  return nearest;
}

export type PlayerStrokeResult = { ok: boolean; message: string; incomplete?: boolean };

function currentDrawing(world: GameWorld, level: PlatformLevel): DrawingObstacle | null {
  if (world.phase !== 'drawing' || !world.activeDrawing || world.levelId !== level.id) return null;
  const drawing = level.drawings.find(d => d.id === world.activeDrawing?.id);
  return drawing ? getDrawingPlan(world, drawing) : null;
}

/** Shared by the optional keyboard command and a direct press on a visible anchor. */
function enterDrawingMode(world: GameWorld, drawing: DrawingObstacle): NonNullable<GameWorld['activeDrawing']> {
  releaseMechanisms(world);
  world.phase = 'drawing';
  world.activeDrawing = { id: drawing.id, progress: 0, path: [], started: false, choiceId: getDrawingChoice(world, drawing)?.id };
  world.player.vx = 0;
  world.player.vy = 0;
  return world.activeDrawing;
}

/** Planning freezes the puzzle, but only the player's completed stroke creates a surface. */
export function selectDrawingChoice(world: GameWorld, level: PlatformLevel, drawingId: string, choiceId: string): PlayerStrokeResult {
  const drawing = level.drawings.find(item => item.id === drawingId);
  const choice = drawing?.choices?.find(item => item.id === choiceId);
  if (!drawing || !choice || world.levelId !== level.id || world.activeDrawing?.started)
    return { ok: false, message: 'Relâche le crayon avant de changer de chemin.' };
  if (world.phase === 'playing' && getAvailableDrawing(world, level)?.id === drawingId) enterDrawingMode(world, drawing);
  if (world.phase !== 'drawing' || world.activeDrawing?.id !== drawingId)
    return { ok: false, message: 'Approche-toi du passage pour choisir ton chemin.' };
  world.activeDrawing.choiceId = choiceId;
  resetPlayerStroke(world);
  return { ok: true, message: choice.hint };
}

/** Start one continuous gesture from either anchor, with no preliminary mode key required. */
export function beginPlayerStroke(world: GameWorld, level: PlatformLevel, point: PlatformPoint, anchorRadius = STROKE_ANCHOR_RADIUS): PlayerStrokeResult {
  if (world.levelId !== level.id) return { ok: false, message: 'Approche-toi du passage à dessiner.' };
  const drawing = world.phase === 'playing' ? getAvailableDrawing(world, level) : currentDrawing(world, level);
  if (!drawing || drawing.path.length < 2) return { ok: false, message: 'Approche-toi du passage à dessiner.' };
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return { ok: false, message: 'Commence sur l’un des deux repères.' };
  const start = drawing.path[0], end = drawing.path[drawing.path.length - 1];
  const ds = Math.hypot(point.x - start.x, point.y - start.y), de = Math.hypot(point.x - end.x, point.y - end.y);
  const radius = Number.isFinite(anchorRadius) ? clamp(anchorRadius, 12, 96) : STROKE_ANCHOR_RADIUS;
  const previous = world.activeDrawing;
  if (world.phase === 'drawing' && previous && !previous.started && previous.path.length > 1) {
    const tip = previous.path[previous.path.length - 1];
    if (Math.hypot(point.x - tip.x, point.y - tip.y) <= radius) {
      previous.started = true; previous.anchorRadius = radius;
      return { ok: true, message: 'Continue ton trait jusqu’au repère d’arrivée.' };
    }
  }
  // Validate before entering drawing mode: a missed press must not stop or alter the game.
  if (Math.min(ds, de) > radius) return { ok: false, message: 'Commence sur l’un des deux repères.' };
  const active = world.phase === 'playing' ? enterDrawingMode(world, drawing) : world.activeDrawing!;
  active.path = [{ ...(ds <= de ? start : end) }];
  active.progress = 0;
  active.started = true;
  active.anchorRadius = radius;
  return { ok: true, message: 'Trace vers l’autre rive. Tu peux lever le doigt et reprendre au bout du trait.' };
}

export function appendPlayerStroke(world: GameWorld, level: PlatformLevel, point: PlatformPoint): PlayerStrokeResult {
  const drawing = currentDrawing(world, level), active = world.activeDrawing;
  if (!drawing || !active?.started || !active.path.length) return { ok: false, message: 'Commence sur l’un des deux repères.' };
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return { ok: false, message: 'Le tracé a été interrompu. Recommence depuis un repère.' };
  if (active.path.length >= 4000) return { ok: false, message: 'Le trait est trop long. Recommence avec un geste plus simple.' };
  const last = active.path[active.path.length - 1];
  if (Math.hypot(point.x - last.x, point.y - last.y) >= 1.5) active.path.push({ ...point });
  const start = active.path[0];
  const left = drawing.path[0], right = drawing.path[drawing.path.length - 1];
  const target = Math.hypot(start.x - left.x, start.y - left.y) < 1 ? right : left;
  const span = target.x - start.x;
  active.progress = Math.abs(span) > 1 ? clamp((point.x - start.x) / span, 0, 1) : 0;
  return { ok: true, message: 'Continue jusqu’au repère d’arrivée.' };
}

/** Commit only on a valid, explicitly finished stroke. No timer can complete a construction. */
export function finishPlayerStroke(world: GameWorld, level: PlatformLevel): PlayerStrokeResult {
  const drawing = currentDrawing(world, level), active = world.activeDrawing;
  if (!drawing || !active || drawing.path.length < 2) return { ok: false, message: 'Appelle la main près du passage à dessiner.' };
  active.started = false;
  const a = drawing.path[0], b = drawing.path[drawing.path.length - 1];
  const first = active.path[0], last = active.path[active.path.length - 1];
  const end = first && Math.hypot(first.x - a.x, first.y - a.y) < Math.hypot(first.x - b.x, first.y - b.y) ? b : a;
  const radius = active.anchorRadius ?? STROKE_ANCHOR_RADIUS;
  if (last && active.path.length > 1 && Math.hypot(last.x - end.x, last.y - end.y) > radius)
    return { ok: false, incomplete: true, message: 'Trait conservé. Reprends sur son extrémité dorée pour continuer.' };
  const result = preparePlayerStroke(active.path, a, b, { assist: true, anchorRadius: radius, inkLimit: drawing.inkLimit });
  if (!result.ok) return { ok: false, message: result.message };
  world.constructions[drawing.id] = result.points;
  if (!world.drawn.includes(drawing.id)) world.drawn.push(drawing.id);
  if (active.choiceId) world.drawingChoices[drawing.id] = active.choiceId;
  world.phase = 'playing';
  world.activeDrawing = null;
  world.invulnerable = Math.max(world.invulnerable, 0.4);
  return { ok: true, message: result.message };
}

/** Peel back a short part of the draft, preserving the rest for a new finger stroke. */
export function undoPlayerStroke(world: GameWorld): void {
  const active = world.activeDrawing;
  if (world.phase !== 'drawing' || !active || active.started || active.path.length < 2) return;
  const target = Math.max(0, strokeLength(active.path) - Math.max(35, strokeLength(active.path) * .18));
  const result: PlatformPoint[] = [{ ...active.path[0] }];
  let travelled = 0;
  for (let i = 1; i < active.path.length; i++) {
    const a = active.path[i - 1], b = active.path[i], length = Math.hypot(b.x - a.x, b.y - a.y);
    if (travelled + length > target) {
      const t = length ? (target - travelled) / length : 0;
      if (t > .001) result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      break;
    }
    result.push({ ...b }); travelled += length;
  }
  active.path = result; active.progress = Math.max(0, active.progress * .82);
}

export function resetPlayerStroke(world: GameWorld): void {
  if (world.phase !== 'drawing' || !world.activeDrawing) return;
  world.activeDrawing.path = [];
  world.activeDrawing.progress = 0;
  world.activeDrawing.started = false;
}

export function cancelPlayerDrawing(world: GameWorld): void {
  if (world.phase !== 'drawing') return;
  world.activeDrawing = null;
  world.phase = 'playing';
}

/** Mutates the world, preserving collected stars, completed drawings and the death counter. */
export function restartAtCheckpoint(world: GameWorld, level: PlatformLevel): GameWorld {
  releaseMechanisms(world);
  const spawn = level.checkpoints[world.checkpointIndex] ?? level.start;
  world.player = { ...spawn, vx: 0, vy: 0, facing: 1, grounded: true, crouching: false, travel: 0 };
  world.phase = 'playing';
  world.activeDrawing = null;
  world.deathTimer = 0;
  world.invulnerable = 1.1;
  world.completedAt = null;
  return world;
}

/** A surface may be sampled beyond its endpoints for a swept landing test. */
function surfaceY(surface: PlatformSurface, x: number, extrapolate = false): number | null {
  const dx = surface.b.x - surface.a.x;
  if (Math.abs(dx) < 0.001) return null; // Stair risers are not horizontal platforms.
  if (!extrapolate && (x < Math.min(surface.a.x, surface.b.x) - 0.01 || x > Math.max(surface.a.x, surface.b.x) + 0.01)) return null;
  return surface.a.y + (surface.b.y - surface.a.y) * (x - surface.a.x) / dx;
}

function standingFloor(surfaces: PlatformSurface[], x: number, nearY: number): number | null {
  let closest: number | null = null;
  let difference = Infinity;
  for (const surface of surfaces) {
    const y = surfaceY(surface, x);
    if (y === null || y < nearY - PLATFORM_PHYSICS.stepHeight - 0.1 || y > nearY + PLATFORM_PHYSICS.stepHeight + 0.1) continue;
    const d = Math.abs(y - nearY);
    if (d < difference) { closest = y; difference = d; }
  }
  return closest;
}

function capsuleHitsCircle(player: PlatformPlayer, centre: PlatformPoint, radius: number): boolean {
  const bodyTop = player.y - getPlayerHeight(player) + PLATFORM_PHYSICS.bodyRadius;
  const bodyBottom = player.y - PLATFORM_PHYSICS.bodyRadius;
  const nearestY = clamp(centre.y, bodyTop, bodyBottom);
  return Math.hypot(centre.x - player.x, centre.y - nearestY) < radius + PLATFORM_PHYSICS.bodyRadius;
}

function capsuleHitsSpikes(player: PlatformPlayer, hazard: Extract<PlatformHazard, { type: 'spikes' }>): boolean {
  // Slightly inset from drawn tips, making near misses readable and forgiving.
  const left = hazard.x + 3, right = hazard.x + hazard.w - 3;
  const top = hazard.y + 5, bottom = hazard.y + hazard.h;
  const bodyTop = player.y - getPlayerHeight(player) + PLATFORM_PHYSICS.bodyRadius;
  const bodyBottom = player.y - PLATFORM_PHYSICS.bodyRadius;
  const px = clamp(player.x, left, right);
  const py = bodyBottom < top ? top : bodyTop > bottom ? bottom : clamp((bodyTop + bodyBottom) / 2, top, bottom);
  const nearestY = clamp(py, bodyTop, bodyBottom);
  return Math.hypot(px - player.x, py - nearestY) < PLATFORM_PHYSICS.bodyRadius;
}

/** Shared by walking collisions and each swept step of a hand-carried platform. */
export function playerTouchesHazard(world: GameWorld, level: PlatformLevel, player: PlatformPlayer, hazard: PlatformHazard): boolean {
  return hazard.type === 'gear'
    ? capsuleHitsCircle(player, getWorldHazardPosition(world, level, hazard), hazard.r * .84)
    : capsuleHitsSpikes(player, hazard);
}

/** Releasing Down under a beam or wheel keeps the crouch until the head has room. */
function canStandUpright(world: GameWorld, level: PlatformLevel): boolean {
  const standing: PlatformPlayer = { ...world.player, crouching: false };
  for (const hazard of level.hazards) {
    if (playerTouchesHazard(world, level, standing, hazard)) return false;
  }
  for (const mechanism of level.mechanisms ?? []) {
    if (mechanism.type !== 'gate') continue;
    const gate = getMechanismPosition(world, mechanism);
    if (Math.abs(standing.x - gate.x) < mechanism.width / 2 + PLATFORM_PHYSICS.bodyRadius
      && standing.y > gate.y - mechanism.height && standing.y - PLATFORM_PHYSICS.bodyHeight < gate.y) return false;
  }
  return true;
}

function splatter(world: GameWorld, cause: 'gear' | 'spikes' | 'fall') {
  let seed = (Math.floor(world.player.x * 29 + world.time * 1000) + world.deaths * 7919) >>> 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const x = world.player.x;
  const y = cause === 'fall' ? Math.min(525, world.player.y - 30) : world.player.y - 42;
  const colors = ['#ee243a', '#c40d24', '#920619', '#ff4450'];
  for (let i = 0; i < 48; i++) {
    const angle = random() * Math.PI * 2;
    const strength = 85 + random() * 280;
    const life = 0.6 + random() * 1.25;
    world.particles.push({
      x: x + (random() - 0.5) * 14, y: y + (random() - 0.5) * 22,
      vx: Math.cos(angle) * strength + world.player.vx * 0.3,
      vy: Math.sin(angle) * strength - 120,
      life, maxLife: life, size: 1.6 + random() * 4.1, color: colors[i % colors.length],
    });
  }
  if (world.particles.length > 144) world.particles.splice(0, world.particles.length - 144);
}

function kill(world: GameWorld, cause: 'gear' | 'spikes' | 'fall', events: GameEvent[]) {
  if (world.phase === 'dead' || world.phase === 'won') return;
  world.deaths += 1;
  world.lastDeathCause = cause;
  splatter(world, cause);
  world.phase = 'dead';
  releaseMechanisms(world);
  world.activeDrawing = null;
  world.deathTimer = PLATFORM_PHYSICS.respawnDelay;
  world.player.vx = 0;
  world.player.vy = 0;
  events.push('death');
}

function updateParticles(world: GameWorld, surfaces: PlatformSurface[], dt: number) {
  for (const p of world.particles) {
    p.life -= dt;
    const oldY = p.y;
    p.vy += 920 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-0.5 * dt);
    if (p.vy >= 0) {
      for (const surface of surfaces) {
        const y = surfaceY(surface, p.x);
        if (y !== null && oldY <= y && p.y >= y) {
          p.y = y - 0.5;
          p.vx *= 0.25;
          p.vy = 0;
          break;
        }
      }
    }
  }
  world.particles = world.particles.filter(p => p.life > 0 && p.y < 850);
}

function updatePlayer(world: GameWorld, level: PlatformLevel, surfaces: PlatformSurface[], input: PlatformInput, dt: number, events: GameEvent[]) {
  const p = world.player;
  const direction = Number(input.right) - Number(input.left);
  const acceleration = p.grounded ? (direction ? 1450 : 1900) : (direction ? 1100 : 450);
  const speed = p.crouching ? PLATFORM_PHYSICS.crouchSpeed : PLATFORM_PHYSICS.speed;
  p.vx = approach(p.vx, direction * speed, acceleration * dt);
  // Keep looking in the actual travel direction during braking, then turn.
  if (Math.abs(p.vx) > 2) p.facing = p.vx > 0 ? 1 : -1;
  else if (direction) p.facing = direction > 0 ? 1 : -1;
  const oldX = p.x, oldY = p.y;
  const wasGrounded = p.grounded;
  p.x = clamp(p.x + p.vx * dt, 28, level.width - 28);
  if (p.x === 28 || p.x === level.width - 28) p.vx = 0;
  if (wasGrounded) {
    const floor = standingFloor(surfaces, p.x, oldY);
    if (floor !== null) { p.y = floor; p.vy = 0; }
    else if (standingFloor(surfaces, oldX, oldY) !== null) {
      // He waits at an unfinished edge for the human hand; there is no auto-hop.
      p.x = oldX; p.y = oldY; p.vx = 0; p.vy = 0;
    } else p.grounded = false;
  }

  if (!p.grounded) {
    p.vy = Math.min(PLATFORM_PHYSICS.maxFallSpeed, p.vy + PLATFORM_PHYSICS.gravity * dt);
    p.y += p.vy * dt;
    if (p.vy >= 0) {
      let landing: number | null = null;
      for (const surface of surfaces) {
        const y = surfaceY(surface, p.x);
        const previousFloor = surfaceY(surface, oldX, true);
        if (y !== null && previousFloor !== null && oldY <= previousFloor + 0.6 && p.y >= y - 0.1) {
          if (landing === null || y < landing) landing = y;
        }
      }
      if (landing !== null) {
        p.y = landing;
        p.vy = 0;
        p.grounded = true;
        if (!wasGrounded) events.push('land');
      }
    }
  }
  resolveGateCollision(world, level, { x: oldX, y: oldY });
  // The walk cycle follows ground travel, and holds its last pose while airborne.
  if (p.grounded) p.travel += Math.abs(p.x - oldX);

  if (p.y > 675 || !Number.isFinite(p.x) || !Number.isFinite(p.y)) { kill(world, 'fall', events); return; }
  if (world.invulnerable <= 0) {
    for (const hazard of level.hazards) {
      const hit = playerTouchesHazard(world, level, p, hazard);
      if (hit) { kill(world, hazard.type, events); return; }
    }
  }

  level.stars.forEach((star, index) => {
    if (world.collected.includes(index)) return;
    const closestY = clamp(star.y, p.y - getPlayerHeight(p) + 12, p.y - 12);
    if (Math.hypot(star.x - p.x, star.y - closestY) < 27) {
      world.collected.push(index);
      events.push('star');
    }
  });

  if (p.grounded) {
    for (let index = world.checkpointIndex + 1; index < level.checkpoints.length; index++) {
      if (p.x >= level.checkpoints[index].x) {
        world.checkpointIndex = index;
        events.push('checkpoint');
      }
    }
    if (p.x >= level.goal.x - 10 && p.y <= level.goal.y + 28) {
      p.vx = 0;
      world.phase = 'won';
      world.completedAt = world.time;
      events.push('win');
    }
  }
}

/**
 * Advances one frame, mutating world and returning discrete events for UI/audio.
 * The caller owns pause: do not call while paused. draw is an input pulse;
 * mechanisms only respond to a currently held pointer handle.
 * Internally split at 120Hz so thin spikes and moving gears cannot be skipped.
 */
export function updateWorld(world: GameWorld, level: PlatformLevel, input: PlatformInput, elapsed: number): GameEvent[] {
  const events: GameEvent[] = [];
  const dt = clamp(Number.isFinite(elapsed) ? elapsed : 0, 0, 0.08);
  if (dt <= 0 || world.levelId !== level.id) return events;
  // Drawing is a deliberate planning pause: hazards, particles and time freeze.
  if (world.phase === 'drawing') return events;
  if (input.draw && world.phase === 'playing') {
    const drawing = getAvailableDrawing(world, level);
    if (drawing) {
      enterDrawingMode(world, drawing);
      events.push('draw-start');
      return events;
    }
  }
  world.time += dt;
  world.invulnerable = Math.max(0, world.invulnerable - dt);
  updateParticles(world, getWorldSurfaces(world, level), dt);
  if (world.phase === 'won') return events;
  if (world.phase === 'dead') {
    world.deathTimer -= dt;
    if (world.deathTimer <= 0) { restartAtCheckpoint(world, level); events.push('respawn'); }
    return events;
  }
  const count = Math.ceil(dt / (1 / 120));
  const step = dt / count;
  for (let i = 0; i < count; i++) {
    world.player.crouching = !!input.crouch || (world.player.crouching && !canStandUpright(world, level));
    if (advanceMechanisms(world, level, step)) events.push('mechanism-settle');
    updatePlayer(world, level, getWorldSurfaces(world, level), input, step, events);
    if (world.phase !== 'playing') break;
  }
  return [...new Set(events)];
}
