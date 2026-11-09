import type { GameWorld, PlatformLevel, PlatformPoint, PlatformSurface } from './platformer';

export type AmbientPerch = PlatformPoint & { surface: number };
export type AmbientBird = {
  id: number;
  x: number;
  y: number;
  facing: -1 | 1;
  size: number;
  phase: 'perched' | 'startled' | 'flying' | 'landing' | 'away';
  age: number;
  wait: number;
  perch: number;
  wingOffset: number;
  pitch: number;
  escapeDirection: -1 | 1;
  flight: {
    from: PlatformPoint; controlA: PlatformPoint; controlB: PlatformPoint; to: PlatformPoint;
    elapsed: number; duration: number; destination: number | null;
  } | null;
};

type AmbientMote = {
  kind: 'butterfly' | 'leaf' | 'firefly';
  origin: PlatformPoint;
  x: number; y: number; phase: number; drift: number;
};

export type AmbientState = {
  levelId: number;
  time: number;
  seed: number;
  perches: AmbientPerch[];
  birds: AmbientBird[];
  motes: AmbientMote[];
  reducedMotion: boolean;
};

export type AmbientInput = {
  pointer?: PlatformPoint | null;
  /** A real press/tap, never continuous hover. Coordinates use the game world. */
  touched?: boolean;
  reducedMotion?: boolean;
};

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const distance = (a: PlatformPoint, b: PlatformPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const TAU = Math.PI * 2;

function random(state: Pick<AmbientState, 'seed'>): number {
  let value = state.seed | 0;
  value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
  state.seed = value >>> 0;
  return state.seed / 0x100000000;
}

function nearRectangle(point: PlatformPoint, left: number, top: number, right: number, bottom: number, margin: number) {
  return distance(point, { x: clamp(point.x, left, right), y: clamp(point.y, top, bottom) }) < margin;
}

/** Use the whole travel envelope, so a resting bird never waits on a saw rail. */
function safePerch(point: PlatformPoint, level: PlatformLevel): boolean {
  const body = { x: point.x, y: point.y - 14 };
  for (const hazard of level.hazards) {
    if (hazard.type === 'spikes') {
      if (nearRectangle(body, hazard.x, hazard.y, hazard.x + hazard.w, hazard.y + hazard.h, 55)) return false;
    } else {
      const swinging = hazard.motion === 'swing';
      const swing = Math.abs(hazard.swingAngle ?? .32), arm = Math.max(0, hazard.armLength ?? 150);
      const rangeX = swinging ? Math.abs(Math.sin(swing)) * arm : hazard.axis === 'x' ? Math.abs(hazard.range ?? 0) : 0;
      const rangeY = hazard.axis === 'y' ? Math.abs(hazard.range ?? 0) : 0;
      const top = swinging ? hazard.y - (1 - Math.cos(swing)) * arm : hazard.y - rangeY;
      const bottom = swinging ? hazard.y : hazard.y + rangeY;
      if (nearRectangle(body, hazard.x - rangeX, top, hazard.x + rangeX, bottom, hazard.r + 65)) return false;
    }
  }
  for (const mechanism of level.mechanisms ?? []) {
    const height = mechanism.type === 'gate' ? mechanism.height : 0;
    if (nearRectangle(body,
      Math.min(mechanism.from.x, mechanism.to.x) - mechanism.width * .5,
      Math.min(mechanism.from.y, mechanism.to.y) - height,
      Math.max(mechanism.from.x, mechanism.to.x) + mechanism.width * .5,
      Math.max(mechanism.from.y, mechanism.to.y), 55)) return false;
  }
  return !level.drawings.some(drawing => drawing.path.length &&
    [drawing.path[0], drawing.path[drawing.path.length - 1]].some(anchor => distance(body, anchor) < 68));
}

function perchCandidates(level: PlatformLevel, seed: Pick<AmbientState, 'seed'>): AmbientPerch[] {
  const perches: AmbientPerch[] = [];
  level.surfaces.forEach((surface: PlatformSurface, surfaceIndex: number) => {
    const left = Math.min(surface.a.x, surface.b.x), right = Math.max(surface.a.x, surface.b.x);
    const width = right - left;
    // The two feet meet the actual line. Do not invent a perch across a gap,
    // on a vertical riser, or on a movable platform that can depart beneath it.
    if (width < 155 || Math.abs(surface.a.y - surface.b.y) > 1) return;
    const begin = Math.max(45, left + 55), end = Math.min(level.width - 45, right - 55);
    const count = Math.max(1, Math.ceil((end - begin) / 165));
    for (let i = 0; i <= count; i++) {
      const x = clamp(begin + (end - begin) * (i + .22 + random(seed) * .35) / (count + .5), begin, end);
      const point = { x, y: surface.a.y, surface: surfaceIndex };
      if (distance(point, level.start) < 105 || distance(point, level.goal) < 70 || !safePerch(point, level)) continue;
      if (perches.some(other => distance(point, other) < 130)) continue;
      perches.push(point);
    }
  });
  return perches.sort((a, b) => a.x - b.x);
}

/** Persistent world-space life. Create once for a chapter/retry, never per render. */
export function createAmbientState(level: PlatformLevel): AmbientState {
  const state: AmbientState = {
    levelId: level.id, time: 0, seed: ((level.id * 2654435761) ^ Math.round(level.width * 97)) >>> 0 || 1,
    perches: [], birds: [], motes: [], reducedMotion: false,
  };
  state.perches = perchCandidates(level, state);
  const count = Math.min(12, Math.ceil(state.perches.length * .62));
  for (let i = 0; i < count; i++) {
    const perch = Math.min(state.perches.length - 1, Math.floor(i * state.perches.length / count));
    const point = state.perches[perch], facing = random(state) < .5 ? -1 : 1;
    state.birds.push({
      id: i, x: point.x, y: point.y, perch, facing, size: .68 + random(state) * .16,
      phase: 'perched', age: 0, wait: 5 + i * .7 + random(state) * 8,
      wingOffset: random(state) * TAU, pitch: 0, escapeDirection: facing, flight: null,
    });
  }
  const moteCount = Math.min(9, Math.max(2, Math.ceil(level.width / 690)));
  for (let i = 0; i < moteCount; i++) {
    const origin = { x: (i + .35 + random(state) * .3) * level.width / moteCount,
      y: level.start.y - 125 - random(state) * 145 };
    state.motes.push({
      kind: level.palette === 'plum' ? 'firefly' : level.palette === 'terracotta' ? 'leaf'
        : level.palette === 'teal' && i % 2 ? 'leaf' : 'butterfly',
      origin, ...origin, phase: random(state) * TAU, drift: 4 + random(state) * 5,
    });
  }
  return state;
}

function choosePerch(state: AmbientState, world: GameWorld, bird: AmbientBird, direction: -1 | 1): number | null {
  const possible = state.perches.map((point, index) => ({ point, index }))
    .filter(({ point, index }) => index !== bird.perch && distance(point, bird) > 150
      && distance(point, world.player) > 180
      && !state.birds.some(other => other.id !== bird.id && other.phase !== 'away' &&
        (other.perch === index || other.flight?.destination === index)));
  const preferred = possible.filter(({ point }) => (point.x - bird.x) * direction > 0 && Math.abs(point.x - bird.x) < 1300);
  const candidates = (preferred.length ? preferred : possible).sort((a, b) => distance(a.point, bird) - distance(b.point, bird)).slice(0, 5);
  return candidates.length ? candidates[Math.floor(random(state) * candidates.length)].index : null;
}

function depart(state: AmbientState, world: GameWorld, bird: AmbientBird, forceDirection?: -1 | 1) {
  const direction = forceDirection ?? bird.facing;
  const destination = choosePerch(state, world, bird, direction);
  const target = destination === null
    ? { x: bird.x + direction * (410 + random(state) * 220), y: Math.max(65, bird.y - 190 - random(state) * 60) }
    : state.perches[destination];
  const dx = target.x - bird.x;
  const arc = 90 + random(state) * 90;
  bird.flight = {
    from: { x: bird.x, y: bird.y }, controlA: { x: bird.x + dx * .23, y: Math.min(bird.y, target.y) - arc },
    controlB: { x: bird.x + dx * .78, y: Math.min(bird.y, target.y) - arc * .82 },
    to: { x: target.x, y: target.y }, elapsed: 0,
    duration: clamp(Math.abs(dx) / 185 + .55, 1.65, 5.5), destination,
  };
  bird.facing = dx < 0 ? -1 : 1;
  bird.phase = 'flying'; bird.age = 0;
}

function fly(bird: AmbientBird, state: AmbientState, step: number) {
  const flight = bird.flight!;
  flight.elapsed += step;
  const u = clamp(flight.elapsed / flight.duration, 0, 1), v = 1 - u;
  const previous = { x: bird.x, y: bird.y };
  bird.x = v * v * v * flight.from.x + 3 * v * v * u * flight.controlA.x + 3 * v * u * u * flight.controlB.x + u * u * u * flight.to.x;
  bird.y = v * v * v * flight.from.y + 3 * v * v * u * flight.controlA.y + 3 * v * u * u * flight.controlB.y + u * u * u * flight.to.y;
  bird.pitch = clamp(Math.atan2(bird.y - previous.y, Math.abs(bird.x - previous.x)), -.35, .35);
  if (flight.destination !== null && u > .8) bird.phase = 'landing';
  if (u < 1) return;
  bird.age = 0; bird.pitch = 0;
  if (flight.destination === null) {
    bird.phase = 'away'; bird.wait = 5 + random(state) * 6;
  } else {
    bird.phase = 'perched'; bird.perch = flight.destination;
    bird.wait = 7 + random(state) * 9;
  }
  bird.flight = null;
}

/** Presentation only: no write to the level, player, collisions or camera. */
export function updateAmbient(
  state: AmbientState, world: GameWorld, level: PlatformLevel, dt: number, input: AmbientInput = {},
): AmbientState {
  const step = Math.max(0, Math.min(.1, Number.isFinite(dt) ? dt : 0));
  if (!step || state.levelId !== level.id) return state;
  if (input.reducedMotion) {
    if (!state.reducedMotion) for (const bird of state.birds) {
      bird.x = state.perches[bird.perch].x; bird.y = state.perches[bird.perch].y;
      bird.phase = 'perched'; bird.flight = null; bird.age = 0; bird.pitch = 0;
    }
    state.reducedMotion = true;
    return state;
  }
  state.time += step;
  if (state.reducedMotion) {
    for (const bird of state.birds) bird.wait = 6 + random(state) * 8;
    state.reducedMotion = false;
  }
  for (const bird of state.birds) {
    bird.age += step;
    if (bird.phase === 'perched') {
      const body = { x: bird.x, y: bird.y - 14 };
      const hero = { x: world.player.x, y: world.player.y - (world.player.crouching ? 20 : 38) };
      const tapped = !!input.touched && !!input.pointer && distance(body, input.pointer) < 44;
      const approached = world.phase !== 'dead' && distance(body, hero) < 110;
      if (tapped || approached) {
        const threat = tapped ? input.pointer! : hero;
        bird.escapeDirection = threat.x < bird.x ? 1 : -1;
        bird.facing = bird.escapeDirection;
        bird.phase = 'startled'; bird.age = 0;
      } else if (bird.age >= bird.wait && state.birds.filter(other => other.flight).length < 3) depart(state, world, bird);
    } else if (bird.phase === 'startled') {
      if (bird.age >= .13) depart(state, world, bird, bird.escapeDirection);
    } else if (bird.phase === 'flying' || bird.phase === 'landing') fly(bird, state, step);
    else if (bird.age >= bird.wait) {
      // Return from the sky only once a real, unoccupied perch is safe again.
      const candidates = state.perches.map((point, index) => ({ point, index })).filter(({ point, index }) =>
        distance(point, world.player) > 180 && !state.birds.some(other => other.id !== bird.id && other.phase !== 'away' && other.perch === index));
      if (candidates.length) {
        const target = candidates[Math.floor(random(state) * candidates.length)];
        bird.x = target.point.x + (random(state) < .5 ? -1 : 1) * 330;
        bird.y = Math.min(-45, target.point.y - 510);
        const originalPerch = bird.perch;
        // Prefer this landing on the next selection, without assigning a new
        // ground location until the full approach flight has completed.
        bird.perch = -1;
        depart(state, world, bird, target.point.x < bird.x ? -1 : 1);
        bird.perch = originalPerch;
      } else { bird.age = 0; bird.wait = 1.5; }
    }
  }
  for (const mote of state.motes) {
    mote.x = ((mote.origin.x + 50 + state.time * mote.drift) % (level.width + 100)) - 50;
    mote.y = mote.origin.y + Math.sin(state.time * .55 + mote.phase) * 17;
  }
  return state;
}

function tracePerchedBird(ctx: CanvasRenderingContext2D, peck: boolean, alert: boolean) {
  ctx.moveTo(-5, 0); ctx.lineTo(-4, -6);
  ctx.quadraticCurveTo(-16, -10, -15, -17);
  ctx.lineTo(-25, -24); ctx.lineTo(-12, -22);
  if (peck) {
    ctx.quadraticCurveTo(1, -26, 12, -14);
    ctx.lineTo(21, -10); ctx.lineTo(12, -8);
    ctx.quadraticCurveTo(7, -3, 3, -6);
  } else {
    const head = alert ? -37 : -32;
    ctx.quadraticCurveTo(-10, head, 1, head);
    ctx.quadraticCurveTo(9, head, 11, head + 7);
    ctx.lineTo(20, head + 10); ctx.lineTo(10, head + 13);
    ctx.quadraticCurveTo(12, -10, 3, -6);
  }
  ctx.lineTo(5, 0);
}

function traceFlyingBird(ctx: CanvasRenderingContext2D, wing: number, landing: boolean) {
  const reach = -15 - wing * 16;
  ctx.moveTo(-24, 3); ctx.lineTo(-11, -4);
  ctx.quadraticCurveTo(-19, reach, -14, reach - 7);
  ctx.quadraticCurveTo(-6, reach + 3, -1, -10);
  ctx.quadraticCurveTo(7, -17, 12, -8);
  ctx.lineTo(21, -5); ctx.lineTo(12, -2);
  ctx.quadraticCurveTo(9, 7, 1, 7);
  if (landing) { ctx.lineTo(2, 14); ctx.lineTo(-2, 14); ctx.lineTo(-3, 7); }
  ctx.lineTo(-10, 7); ctx.lineTo(-24, 3);
  ctx.closePath();
}

/**
 * Call after drawPlatformScene and before the hand, on the same scaled canvas
 * context. This function owns its camera translation, matching that renderer.
 */
export function drawAmbient(
  ctx: CanvasRenderingContext2D, state: AmbientState, level: PlatformLevel, world: GameWorld,
  options: { cameraX: number; viewWidth: number; ink: string; background: string; pixelScale?: number; reducedMotion?: boolean },
) {
  if (state.levelId !== level.id) return;
  const pixelScale = Math.max(.15, options.pixelScale ?? 1);
  const readable = Math.min(1.55, Math.max(1, .72 / pixelScale));
  const reduced = !!options.reducedMotion || state.reducedMotion;
  const visible = (point: PlatformPoint, margin = 60) => point.x > options.cameraX - margin && point.x < options.cameraX + options.viewWidth + margin;
  ctx.save(); ctx.translate(-options.cameraX, 0);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = options.ink; ctx.fillStyle = options.background;
  for (const mote of state.motes.filter(point => visible(point) && distance(point, world.player) > 95).slice(0, 3)) {
    ctx.save(); ctx.translate(mote.x, mote.y); ctx.scale(readable, readable);
    ctx.globalAlpha = mote.kind === 'firefly' ? .65 : .43; ctx.lineWidth = 1.65;
    const flutter = reduced ? .6 : .4 + Math.abs(Math.sin(state.time * 7 + mote.phase)) * .6;
    ctx.beginPath();
    if (mote.kind === 'butterfly') {
      ctx.moveTo(0, 2); ctx.bezierCurveTo(-10 * flutter, -7, -9 * flutter, 7, 0, 0);
      ctx.bezierCurveTo(9 * flutter, -8, 10 * flutter, 6, 0, 2);
    } else if (mote.kind === 'leaf') {
      ctx.rotate(reduced ? mote.phase : Math.sin(state.time * .6 + mote.phase) * .8);
      ctx.moveTo(-7, 0); ctx.quadraticCurveTo(0, -8, 8, -1); ctx.quadraticCurveTo(1, 7, -7, 0);
    } else {
      ctx.arc(0, 0, 1.8 + flutter * .55, 0, TAU);
    }
    ctx.stroke(); ctx.restore();
  }
  // World-space occupancy can be larger, but the view never becomes a flock.
  for (const bird of state.birds.filter(point => point.phase !== 'away' && visible(point)).slice(0, 4)) {
    ctx.save(); ctx.translate(bird.x, bird.y);
    const scale = bird.size * readable;
    ctx.scale(scale * bird.facing, scale);
    ctx.lineWidth = Math.max(2.7, 1.2 / (pixelScale * scale));
    const perched = bird.phase === 'perched' || bird.phase === 'startled';
    if (perched) {
      // Remove just the tiny interval between the feet from the already drawn
      // floor. The outer contour rejoins it exactly at y=0 on both sides.
      ctx.fillRect(-5, -2.2 / scale, 10, 4.4 / scale);
      ctx.beginPath();
      const peck = !reduced && bird.phase === 'perched' && (bird.age + bird.wingOffset) % 5.6 > 4.9;
      tracePerchedBird(ctx, peck, bird.phase === 'startled');
    } else {
      ctx.rotate(bird.pitch);
      ctx.beginPath();
      const frame = Math.floor((state.time * 10 + bird.wingOffset) % 4);
      const wing = reduced ? .65 : [.2, .7, 1, .45][frame];
      traceFlyingBird(ctx, wing, bird.phase === 'landing');
    }
    ctx.fill(); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}
