import { getMechanismPosition, type GameWorld, type PlatformLevel, type PlatformPoint, type PlatformSurface } from './platformer';
import { drawAnimatedBird } from './ambient-bird-renderer';

export type AmbientPerch = PlatformPoint & { surface: number };
export type AmbientBird = {
  id: number;
  /** Foot datum, shared by the ground and airborne poses. */
  x: number;
  y: number;
  facing: -1 | 1;
  /** Continuous side projection during the preparatory turn, never a mirror cut. */
  turn: number;
  size: number;
  phase: 'perched' | 'startled' | 'flying' | 'landing' | 'settling' | 'away';
  age: number;
  wait: number;
  perch: number;
  wingOffset: number;
  wingPhase: number;
  wingPower: number;
  glide: number;
  pitch: number;
  bank: number;
  reaction: number;
  landing: number;
  idleAction: 'rest' | 'look' | 'peck' | 'preen';
  idleProgress: number;
  idleAge: number;
  idleDuration: number;
  nextIdle: number;
  reactAfter: number;
  escapeDirection: -1 | 1;
  turnFrom: number;
  flight: {
    from: PlatformPoint; controlA: PlatformPoint; controlB: PlatformPoint; to: PlatformPoint;
    elapsed: number; duration: number; destination: number | null;
    length: number; progress: number; returning: boolean;
    acceleration: number; deceleration: number; cruiseSpeed: number;
    arcLengths: number[];
  } | null;
};

type AmbientMote = {
  kind: 'firefly';
  origin: PlatformPoint;
  x: number; y: number; phase: number;
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
  /** Limits voluntary activity to the shot; an existing flight still finishes. */
  viewport?: { cameraX: number; viewWidth: number };
};

export const AMBIENT_MOTION = {
  anticipation: .42,
  settling: .52,
  maxSpeed: 112,
  minRest: 18,
  maxRest: 34,
} as const;

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const distance = (a: PlatformPoint, b: PlatformPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const mix = (a: number, b: number, u: number) => a + (b - a) * u;
const smooth = (u: number) => { const t = clamp(u, 0, 1); return t * t * (3 - 2 * t); };
const smoother = (u: number) => { const t = clamp(u, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
const TAU = Math.PI * 2;
const ARC_STEPS = 128;

function random(state: Pick<AmbientState, 'seed'>): number {
  let value = state.seed | 0;
  value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
  state.seed = value >>> 0;
  return state.seed / 0x100000000;
}

function nearRectangle(point: PlatformPoint, left: number, top: number, right: number, bottom: number, margin: number) {
  return distance(point, { x: clamp(point.x, left, right), y: clamp(point.y, top, bottom) }) < margin;
}

function pointSegmentDistance(p: PlatformPoint, a: PlatformPoint, b: PlatformPoint) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const u = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return distance(p, { x: a.x + dx * u, y: a.y + dy * u });
}

/** Use the whole travel envelope, so a resting bird never waits on a saw rail. */
function safePerch(point: PlatformPoint, level: PlatformLevel): boolean {
  const body = { x: point.x, y: point.y - 14 };
  // A calm perch also needs room to unfold its wings. A second floor directly
  // above the feet would otherwise trap the very first escape animation.
  for (const surface of level.surfaces) {
    const dx = surface.b.x - surface.a.x;
    if (Math.abs(dx) < .01 || point.x < Math.min(surface.a.x, surface.b.x) - 18 || point.x > Math.max(surface.a.x, surface.b.x) + 18) continue;
    const y = surface.a.y + (surface.b.y - surface.a.y) * clamp((point.x - surface.a.x) / dx, 0, 1);
    if (y < point.y - 2 && y > point.y - 115) return false;
  }
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
    // Feet meet a real horizontal line, never a gap or a movable platform.
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

function restDuration(state: AmbientState) {
  return AMBIENT_MOTION.minRest + random(state) * (AMBIENT_MOTION.maxRest - AMBIENT_MOTION.minRest);
}

/** Persistent world-space life. Create once for a chapter/retry, never per render. */
export function createAmbientState(level: PlatformLevel): AmbientState {
  const state: AmbientState = {
    levelId: level.id, time: 0, seed: ((level.id * 2654435761) ^ Math.round(level.width * 97)) >>> 0 || 1,
    perches: [], birds: [], motes: [], reducedMotion: false,
  };
  state.perches = perchCandidates(level, state);
  const count = Math.min(8, Math.ceil(state.perches.length * .28));
  for (let i = 0; i < count; i++) {
    const perch = Math.min(state.perches.length - 1, Math.floor(i * state.perches.length / count));
    const point = state.perches[perch], facing = random(state) < .5 ? -1 : 1;
    const wingOffset = random(state) * TAU;
    state.birds.push({
      id: i, x: point.x, y: point.y, perch, facing, turn: facing, turnFrom: facing,
      size: .72 + random(state) * .12, phase: 'perched', age: 0, wait: restDuration(state),
      wingOffset, wingPhase: wingOffset, wingPower: 0, glide: 0, pitch: 0, bank: 0,
      reaction: 0, landing: 0, idleAction: 'rest', idleProgress: 0, idleAge: 0, idleDuration: 1,
      nextIdle: 2 + random(state) * 4, reactAfter: 0, escapeDirection: facing, flight: null,
    });
  }
  // Sparse fireflies remain local to a twilight scene. No decorative silhouettes
  // continuously slide across the whole stage or wrap back into view.
  if (level.palette === 'plum') for (let i = 0; i < Math.min(4, Math.ceil(level.width / 1600)); i++) {
    const origin = { x: (i + .45 + random(state) * .2) * level.width / Math.ceil(level.width / 1600),
      y: level.start.y - 150 - random(state) * 60 };
    state.motes.push({ kind: 'firefly', origin, ...origin, phase: random(state) * TAU });
  }
  return state;
}

type BirdFlight = NonNullable<AmbientBird['flight']>;

function curve(flight: Pick<BirdFlight, 'from' | 'controlA' | 'controlB' | 'to'>, u: number): PlatformPoint {
  const v = 1 - u;
  return {
    x: v * v * v * flight.from.x + 3 * v * v * u * flight.controlA.x + 3 * v * u * u * flight.controlB.x + u * u * u * flight.to.x,
    y: v * v * v * flight.from.y + 3 * v * v * u * flight.controlA.y + 3 * v * u * u * flight.controlB.y + u * u * u * flight.to.y,
  };
}

function tangent(flight: BirdFlight, u: number): PlatformPoint {
  const v = 1 - u;
  return {
    x: 3 * v * v * (flight.controlA.x - flight.from.x) + 6 * v * u * (flight.controlB.x - flight.controlA.x) + 3 * u * u * (flight.to.x - flight.controlB.x),
    y: 3 * v * v * (flight.controlA.y - flight.from.y) + 6 * v * u * (flight.controlB.y - flight.controlA.y) + 3 * u * u * (flight.to.y - flight.controlB.y),
  };
}

function prepareFlight(from: PlatformPoint, to: PlatformPoint, destination: number | null, arc: number, returning = false): BirdFlight {
  const dx = to.x - from.x, high = Math.min(from.y, to.y);
  const flight: BirdFlight = {
    from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y },
    controlA: returning ? { x: from.x + dx * .38, y: from.y + 25 }
      : { x: from.x + dx * .14, y: high - arc },
    controlB: returning ? { x: to.x - dx * .17, y: to.y - Math.max(95, arc * .6) }
      : { x: from.x + dx * .79, y: high - arc * .68 },
    elapsed: 0, duration: 0, destination, length: 0, progress: 0, returning,
    acceleration: returning ? .9 : .55, deceleration: destination === null ? .8 : 1.2,
    cruiseSpeed: AMBIENT_MOTION.maxSpeed, arcLengths: [0],
  };
  let previous = from;
  for (let i = 1; i <= ARC_STEPS; i++) {
    const point = curve(flight, i / ARC_STEPS);
    flight.length += distance(previous, point); flight.arcLengths.push(flight.length); previous = point;
  }
  // Distance controls the duration, never the reverse. Half-cosine speed ramps
  // give a prompt push-off, a calm cruise and a longer braking approach. A long
  // flight must not spend its first seconds floating beside the approaching hero.
  const ramps = (flight.acceleration + flight.deceleration) / 2;
  flight.cruiseSpeed = Math.min(AMBIENT_MOTION.maxSpeed, flight.length / Math.max(.5, 3.6 - ramps));
  flight.duration = flight.length / flight.cruiseSpeed + ramps;
  return flight;
}

function travelledDistance(flight: BirdFlight) {
  const t = flight.elapsed, speed = flight.cruiseSpeed, a = flight.acceleration, d = flight.deceleration;
  const rampDistance = (seconds: number, ramp: number) => speed * .5 * (seconds - ramp / Math.PI * Math.sin(Math.PI * seconds / ramp));
  if (t < a) return rampDistance(t, a);
  if (t <= flight.duration - d) return speed * (t - a / 2);
  const remaining = Math.max(0, flight.duration - t);
  return flight.length - rampDistance(remaining, d);
}

function curveParameter(flight: BirdFlight, progress: number) {
  const length = progress * flight.length;
  let low = 0, high = ARC_STEPS;
  while (low + 1 < high) { const middle = (low + high) >> 1; if (flight.arcLengths[middle] < length) low = middle; else high = middle; }
  const start = flight.arcLengths[low], end = flight.arcLengths[high];
  return (low + clamp((length - start) / (end - start || 1), 0, 1)) / ARC_STEPS;
}

/** Plan against all positions of a moving saw and against the current drawn world. */
function clearFlight(flight: BirdFlight, world: GameWorld, level: PlatformLevel): boolean {
  for (let i = 0; i <= 64; i++) {
    const foot = curve(flight, i / 64), body = { x: foot.x, y: foot.y - 17 };
    for (const surface of level.surfaces) if (pointSegmentDistance(body, surface.a, surface.b) < 15) return false;
    for (const path of Object.values(world.constructions)) for (let p = 1; p < path.length; p++) {
      if (pointSegmentDistance(body, path[p - 1], path[p]) < 18) return false;
    }
    for (const hazard of level.hazards) {
      if (hazard.type === 'spikes') {
        if (nearRectangle(body, hazard.x, hazard.y, hazard.x + hazard.w, hazard.y + hazard.h, 34)) return false;
      } else {
        const carrier = (level.mechanisms ?? []).find(mechanism => mechanism.type === 'gear' && mechanism.hazardId === hazard.id);
        const position = carrier ? getMechanismPosition(world, carrier) : hazard;
        const arm = hazard.armLength ?? 150, swing = Math.abs(hazard.swingAngle ?? .32);
        const rx = carrier ? 0 : hazard.motion === 'swing' ? Math.abs(Math.sin(swing)) * arm : hazard.axis === 'x' ? Math.abs(hazard.range ?? 0) : 0;
        const ry = carrier ? 0 : hazard.axis === 'y' ? Math.abs(hazard.range ?? 0) : 0;
        const top = !carrier && hazard.motion === 'swing' ? position.y - (1 - Math.cos(swing)) * arm : position.y - ry;
        if (nearRectangle(body, position.x - rx, top, position.x + rx, position.y + ry, hazard.r + 34)) return false;
      }
    }
    for (const mechanism of level.mechanisms ?? []) {
      if (mechanism.type === 'gear') continue;
      const position = getMechanismPosition(world, mechanism);
      if (nearRectangle(body, position.x - mechanism.width / 2, position.y - (mechanism.type === 'gate' ? mechanism.height : 3),
        position.x + mechanism.width / 2, position.y + 3, 26)) return false;
    }
  }
  return true;
}

function freePerch(state: AmbientState, world: GameWorld, bird: AmbientBird, index: number) {
  const point = state.perches[index];
  return distance(point, world.player) > 205 && !state.birds.some(other => other.id !== bird.id && other.phase !== 'away'
    && (other.perch === index || other.flight?.destination === index));
}

function planDeparture(state: AmbientState, world: GameWorld, level: PlatformLevel, bird: AmbientBird): BirdFlight | null {
  const direction = bird.escapeDirection;
  const candidates = state.perches.map((point, index) => ({ point, index }))
    .filter(({ point, index }) => index !== bird.perch && (point.x - bird.x) * direction > 165
      && Math.abs(point.x - bird.x) <= 560 && Math.abs(point.y - bird.y) < 170 && freePerch(state, world, bird, index))
    .sort((a, b) => distance(a.point, bird) - distance(b.point, bird));
  // The nearest clear perch is a deliberate destination, rather than a random
  // journey across several screens. Slight arc variation avoids identical takes.
  const baseArc = 86 + ((bird.id + state.levelId * 2) % 5) * 11;
  for (const { point, index } of candidates) for (const addedHeight of [0, 95, 210, 330]) {
    const flight = prepareFlight(bird, point, index, baseArc + addedHeight);
    if (clearFlight(flight, world, level)) return flight;
  }
  // When the local area is blocked, leave upward through a clear corridor.
  // The endpoint is above the playable shot; it never vanishes halfway across it.
  const reach = 230 + random(state) * 95, sky = -140 - random(state) * 50;
  for (const dx of [reach, 180, 80, 20]) {
    const target = { x: bird.x + direction * dx, y: sky };
    const flight = prepareFlight(bird, target, null, 28);
    if (clearFlight(flight, world, level)) return flight;
  }
  return null;
}

function startAnticipation(bird: AmbientBird, direction: -1 | 1) {
  bird.escapeDirection = direction; bird.turnFrom = bird.turn;
  bird.phase = 'startled'; bird.age = 0; bird.reaction = 0; bird.idleAction = 'rest'; bird.idleProgress = 0;
}

function beginFlight(bird: AmbientBird, flight: BirdFlight) {
  bird.flight = flight; bird.facing = flight.to.x < flight.from.x ? -1 : 1;
  bird.turn = bird.facing; bird.phase = 'flying'; bird.age = 0;
  bird.glide = 0; bird.landing = 0; bird.idleAction = 'rest'; bird.idleProgress = 0;
}

function fly(bird: AmbientBird, state: AmbientState, step: number) {
  const flight = bird.flight!;
  flight.elapsed = Math.min(flight.duration, flight.elapsed + step);
  const timeProgress = flight.elapsed / flight.duration;
  const progress = clamp(travelledDistance(flight) / flight.length, 0, 1);
  flight.progress = progress;
  const u = curveParameter(flight, progress), position = curve(flight, u), heading = tangent(flight, u);
  bird.x = position.x; bird.y = position.y;
  bird.landing = flight.destination === null ? 0 : smoother((progress - .72) / .28);
  const launching = 1 - smooth(flight.elapsed / .8);
  const glideWindow = smooth((progress - .22) / .12) * (1 - smooth((progress - .53) / .12));
  bird.glide = glideWindow * .8 * (flight.length > 300 ? 1 : .35);
  bird.wingPower = mix(.76, .3, bird.glide) + launching * .14 + bird.landing * .15;
  bird.wingPhase += step * TAU * (3.15 + launching * .55 + bird.landing * .45 - bird.glide * 1.35);
  bird.reaction = 1 - smooth(flight.elapsed / .42);
  const pitchTarget = clamp(Math.atan2(heading.y, Math.abs(heading.x) || .01) * .28, -.35, .25) * (1 - bird.landing) - bird.landing * .2;
  bird.pitch += (pitchTarget - bird.pitch) * (1 - Math.exp(-step * 9));
  bird.bank = Math.sin(progress * Math.PI * 2) * .055 * (1 - bird.landing);
  if (flight.destination !== null && progress > .72) bird.phase = 'landing';
  if (timeProgress < 1) return;
  bird.x = flight.to.x; bird.y = flight.to.y; bird.age = 0;
  if (flight.destination === null) {
    bird.phase = 'away'; bird.wait = 10 + random(state) * 9;
    bird.wingPower = 0; bird.glide = 0; bird.reaction = 0; bird.landing = 0;
  } else {
    bird.phase = 'settling'; bird.perch = flight.destination; bird.landing = 1;
    bird.wait = restDuration(state); bird.idleAge = 0; bird.nextIdle = 3 + random(state) * 4;
  }
  bird.flight = null;
}

function updateIdle(bird: AmbientBird, state: AmbientState, step: number) {
  bird.idleAge += step;
  if (bird.idleAction === 'rest') {
    if (bird.idleAge < bird.nextIdle) return;
    const pick = random(state);
    bird.idleAction = pick < .5 ? 'look' : pick < .78 ? 'peck' : 'preen';
    bird.idleDuration = bird.idleAction === 'look' ? 1.45 : bird.idleAction === 'peck' ? 1.2 : 1.8;
    bird.idleAge = 0; bird.idleProgress = 0;
  } else {
    bird.idleProgress = clamp(bird.idleAge / bird.idleDuration, 0, 1);
    if (bird.idleProgress >= 1) {
      bird.idleAction = 'rest'; bird.idleAge = 0; bird.idleProgress = 0; bird.nextIdle = 3.5 + random(state) * 6;
    }
  }
}

function returnFromSky(state: AmbientState, world: GameWorld, level: PlatformLevel, bird: AmbientBird) {
  const original = state.perches[bird.perch];
  const candidates = state.perches.map((point, index) => ({ point, index }))
    .filter(({ point, index }) => distance(point, original) < 650 && freePerch(state, world, bird, index))
    .sort((a, b) => distance(a.point, original) - distance(b.point, original));
  for (const { point, index } of candidates) for (const side of [-1, 1]) {
    const from = { x: point.x + side * 260, y: -150 };
    const flight = prepareFlight(from, point, index, 120, true);
    if (!clearFlight(flight, world, level)) continue;
    bird.x = from.x; bird.y = from.y; bird.reaction = 0;
    beginFlight(bird, flight);
    return;
  }
  bird.age = 0; bird.wait = 4;
}

/** Presentation only: no write to the level, player, collisions or camera. */
export function updateAmbient(
  state: AmbientState, world: GameWorld, level: PlatformLevel, dt: number, input: AmbientInput = {},
): AmbientState {
  const step = Math.max(0, Math.min(.1, Number.isFinite(dt) ? dt : 0));
  if (!step || state.levelId !== level.id) return state;
  if (input.reducedMotion) {
    if (!state.reducedMotion) for (const bird of state.birds) {
      const perch = state.perches[bird.perch];
      if (!perch) continue;
      bird.x = perch.x; bird.y = perch.y; bird.phase = 'perched'; bird.flight = null;
      bird.age = 0; bird.pitch = 0; bird.bank = 0; bird.wingPower = 0; bird.glide = 0;
      bird.reaction = 0; bird.landing = 0; bird.idleAction = 'rest'; bird.idleProgress = 0; bird.turn = bird.facing;
    }
    state.reducedMotion = true;
    return state;
  }
  state.time += step;
  if (state.reducedMotion) {
    for (const bird of state.birds) bird.wait = restDuration(state);
    state.reducedMotion = false;
  }
  const inShot = (bird: AmbientBird) => input.viewport
    ? bird.x > input.viewport.cameraX - 100 && bird.x < input.viewport.cameraX + input.viewport.viewWidth + 100
    : Math.abs(bird.x - world.player.x) < 650;
  for (const bird of state.birds) {
    if (bird.phase === 'perched' && !inShot(bird)) continue;
    bird.age += step;
    if (bird.phase === 'perched') {
      // A cancelled takeoff relaxes the prepared pose without pretending that
      // an airborne body has just landed. Normal resting birds are already zero.
      bird.reaction *= Math.exp(-step * 8);
      bird.wingPower *= Math.exp(-step * 8);
      const body = { x: bird.x, y: bird.y - 17 };
      const hero = { x: world.player.x, y: world.player.y - (world.player.crouching ? 20 : 38) };
      const tapped = !!input.touched && !!input.pointer && distance(body, input.pointer) < 44;
      const approaching = (bird.x - world.player.x) * world.player.vx > 0 && Math.abs(world.player.vx) > 75;
      const approached = world.phase !== 'dead' && distance(body, hero) < (approaching ? 178 : 142);
      updateIdle(bird, state, step);
      if (tapped || (approached && state.time >= bird.reactAfter)) {
        const threat = tapped ? input.pointer! : hero;
        startAnticipation(bird, threat.x < bird.x ? 1 : -1);
      } else if (bird.age >= bird.wait && !state.birds.some(other => other.id !== bird.id &&
        (other.flight || other.phase === 'startled' || other.phase === 'settling') && Math.abs(other.x - bird.x) < 800)) {
        startAnticipation(bird, bird.facing);
      }
    } else if (bird.phase === 'startled') {
      bird.reaction = smooth(bird.age / AMBIENT_MOTION.anticipation);
      bird.turn = mix(bird.turnFrom, bird.escapeDirection, smooth(bird.age / .28));
      bird.facing = bird.turn < 0 ? -1 : 1;
      bird.wingPower = smooth((bird.age - .22) / .2) * .7;
      bird.wingPhase += step * TAU * 2.3 * smooth((bird.age - .2) / .22);
      if (bird.age >= AMBIENT_MOTION.anticipation) {
        const flight = planDeparture(state, world, level, bird);
        if (flight) beginFlight(bird, flight);
        else {
          // A boxed-in bird stays on its actual line; do not clip through a
          // ceiling or teleport it out of a puzzle to fulfil a decorative cue.
          bird.phase = 'perched'; bird.age = 0; bird.landing = 0; bird.wait = 5; bird.reactAfter = state.time + 5;
        }
      }
    } else if (bird.phase === 'flying' || bird.phase === 'landing') fly(bird, state, step);
    else if (bird.phase === 'settling') {
      const settle = smoother(bird.age / AMBIENT_MOTION.settling);
      bird.landing = 1 - settle; bird.wingPower = .76 * (1 - settle); bird.reaction = 0;
      bird.wingPhase += step * TAU * 2.4 * (1 - settle); bird.glide = 0;
      bird.pitch *= Math.exp(-step * 10); bird.bank *= Math.exp(-step * 10);
      if (bird.age >= AMBIENT_MOTION.settling) {
        bird.phase = 'perched'; bird.age = 0; bird.landing = 0; bird.wingPower = 0; bird.pitch = 0; bird.bank = 0;
      }
    } else if (bird.age >= bird.wait && !state.birds.some(other => other.id !== bird.id && other.flight && Math.abs(other.x - bird.x) < 800)) {
      returnFromSky(state, world, level, bird);
    }
  }
  for (const mote of state.motes) {
    mote.x = mote.origin.x + Math.sin(state.time * .32 + mote.phase) * 22 + Math.sin(state.time * .71 + mote.phase) * 4;
    mote.y = mote.origin.y + Math.cos(state.time * .4 + mote.phase) * 11;
  }
  return state;
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
  const visible = (point: PlatformPoint, margin = 65) => point.x > options.cameraX - margin && point.x < options.cameraX + options.viewWidth + margin;
  ctx.save(); ctx.translate(-options.cameraX, 0);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = options.ink;
  for (const mote of state.motes.filter(point => visible(point) && distance(point, world.player) > 120).slice(0, 1)) {
    ctx.save(); ctx.translate(mote.x, mote.y); ctx.scale(readable, readable);
    const breathe = reduced ? .7 : .45 + smooth((Math.sin(state.time * .7 + mote.phase) + 1) * .5) * .45;
    ctx.globalAlpha = breathe * .42; ctx.fillStyle = options.ink;
    ctx.beginPath(); ctx.arc(0, 0, 1.4, 0, TAU); ctx.fill(); ctx.restore();
  }
  // Restraint keeps the action readable: several perches may exist in world
  // space, but the camera never frames a crowd of competing gestures.
  for (const bird of state.birds.filter(point => point.phase !== 'away' && visible(point)).slice(0, 3)) {
    drawAnimatedBird(ctx, bird, state.time, {
      ink: options.ink, background: options.background, pixelScale, sizeScale: readable, reducedMotion: reduced,
    });
  }
  ctx.restore();
}
