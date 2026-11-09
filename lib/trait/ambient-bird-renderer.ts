import type { AmbientBird } from './ambient-life';

type Point = { x: number; y: number };
export type BirdPose = {
  airborne: number;
  opening: number;
  brake: number;
  crouch: number;
  bodyPitch: number;
  bodyBob: number;
  prone: number;
  wingLift: number;
  wristLift: number;
  farLift: number;
  wingFold: number;
  farFold: number;
  bank: number;
  glide: number;
  tail: number;
  peck: number;
  preen: number;
  look: number;
  blink: number;
  turn: number;
};

const TAU = Math.PI * 2;
const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => { const u = clamp(t); return u * u * (3 - 2 * u); };

/** The power stroke is shorter than the folded recovery; both meet with zero velocity. */
function strokeLift(phase: number): number {
  const cycle = ((phase / TAU) % 1 + 1) % 1;
  return cycle < .4 ? Math.cos(Math.PI * cycle / .4) : -Math.cos(Math.PI * (cycle - .4) / .6);
}

/** Primaries tuck on the recovery stroke and extend before pushing down. */
function recoveryFold(phase: number): number {
  const cycle = ((phase / TAU) % 1 + 1) % 1;
  if (cycle <= .4) return 0;
  return Math.sin(Math.PI * (cycle - .4) / .6) ** 2;
}

/** One anatomical rig throughout the shot, including both contact transitions. */
export function sampleBirdPose(bird: AmbientBird, time: number, _reducedMotion = false): BirdPose {
  const settling = bird.phase === 'settling';
  const flying = bird.phase === 'flying' || bird.phase === 'landing' || bird.phase === 'away';
  const settle = settling ? smooth(bird.age / .52) : 0;
  // Ambient time and the rig are frozen together by updateAmbient when motion
  // is reduced. Changing the preference must never snap an airborne bird into
  // its standing silhouette, nor fold its wings when a flight is extended.
  const takeoff = flying ? smooth(bird.age / .42) : 0;
  const airborne = flying ? takeoff : settling ? 1 - settle : 0;
  const reaction = clamp(bird.reaction);
  const brake = clamp(bird.landing);
  const glide = clamp(bird.glide);
  const power = clamp(bird.wingPower);
  const phase = bird.wingPhase;
  const pulse = Math.sin(Math.PI * clamp(bird.idleProgress));
  const peck = bird.idleAction === 'peck' ? pulse * pulse : 0;
  const preen = bird.idleAction === 'preen' ? pulse * pulse : 0;
  const look = bird.idleAction === 'look'
    ? Math.sin(TAU * bird.idleProgress) * Math.sin(Math.PI * bird.idleProgress) : 0;
  const preparation = smooth((reaction - .48) / .52);
  const opening = clamp(airborne + (1 - airborne) * preparation * .58);
  // At the end of the approach the wings stay above the line, while the feet
  // reach it. The same open wings fold after contact instead of changing sprite.
  const flap = (offset: number) => mix(strokeLift(phase + offset) * (1 - glide * .82),
    .57 + strokeLift(phase + offset) * .3, brake);
  const breath = Math.sin(time * 1.55 + bird.wingOffset) * .17;
  const blinkCycle = (time + bird.wingOffset * 1.8) % 6.8;
  const blink = blinkCycle < 6.55 ? 0 : Math.sin((blinkCycle - 6.55) / .25 * Math.PI);
  const fold = (offset: number) => recoveryFold(phase + offset) * (1 - glide) * (1 - brake * .85) * opening;
  return {
    airborne, opening, brake, glide,
    crouch: (preparation * 2.8 - Math.sin(reaction * Math.PI) * .8) * (1 - airborne)
      + (settling ? Math.sin(Math.PI * settle) * 2.3 : 0) + peck * 1.8,
    bodyPitch: mix(-.035 + look * .025, clamp(bird.pitch, -.42, .3) - brake * .34, airborne)
      + (bird.bank ?? 0) * .14 * airborne,
    bodyBob: breath * (1 - airborne) + Math.sin(phase - .4) * .55 * power * airborne * (1 - brake),
    prone: airborne * (1 - brake * .65),
    wingLift: flap(0), wristLift: flap(-.36), farLift: flap(.22),
    wingFold: fold(0), farFold: fold(.22), bank: clamp(bird.bank ?? 0, -1, 1) * airborne,
    tail: Math.sin(phase - .9) * .045 * airborne * power + breath * .08,
    peck, preen, look, blink,
    turn: clamp(Number.isFinite(bird.turn) ? bird.turn : bird.facing, -1, 1),
  };
}

function point(x: number, y: number): Point { return { x, y }; }

/** Canvas uses curves rather than a frame-indexed silhouette or repeated V glyph. */
export function drawAnimatedBird(
  ctx: CanvasRenderingContext2D,
  bird: AmbientBird,
  time: number,
  options: { ink: string; background: string; pixelScale: number; sizeScale: number; reducedMotion?: boolean },
) {
  const pose = sampleBirdPose(bird, time, !!options.reducedMotion);
  const scale = bird.size * options.sizeScale;
  // A turn passes through a round frontal pose: the torso keeps its volume,
  // while the beak, tail and near wing move towards its centre before changing
  // sides. Mirroring a still-wide profile would produce a visible little cut.
  const side = smooth(Math.abs(pose.turn) / .65);
  const turnWidth = .76 + side * .24;
  const face = pose.turn < 0 ? -1 : pose.turn > 0 ? 1 : bird.facing;
  const grounded = bird.phase === 'perched' || bird.phase === 'startled' || bird.phase === 'settling';
  const line = Math.max(2.1, 1.05 / (options.pixelScale * scale));
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.scale(scale * face, scale);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = line; ctx.fillStyle = options.background; ctx.strokeStyle = options.ink;

  const cosine = Math.cos(pose.bodyPitch), sine = Math.sin(pose.bodyPitch);
  // The feet are fixed in ground space. Every other joint rotates about the
  // pelvis, so crouching and landing bend the legs without sliding either foot.
  const body = (p: Point): Point => ({
    x: (p.x * cosine - (p.y + 16) * sine) * turnWidth,
    y: -16 + p.x * sine + (p.y + 16) * cosine + pose.crouch + pose.bodyBob,
  });
  const move = (p: Point) => ctx.moveTo(p.x, p.y);
  const lineTo = (p: Point) => ctx.lineTo(p.x, p.y);
  const cubic = (a: Point, b: Point, c: Point) => ctx.bezierCurveTo(a.x, a.y, b.x, b.y, c.x, c.y);
  const quadratic = (a: Point, b: Point) => ctx.quadraticCurveTo(a.x, a.y, b.x, b.y);
  const b = (x: number, y: number) => body(point(x, y));

  const drawWing = (far: boolean) => {
    const open = pose.opening;
    const lift = far ? pose.farLift : pose.wingLift;
    const wristLift = far ? mix(pose.wristLift, pose.farLift, .5) : pose.wristLift;
    const fold = far ? pose.farFold : pose.wingFold;
    const bank = pose.bank * (far ? -1 : 1);
    const small = (far ? .84 : 1) * (1 + bank * .1);
    const root = point(far ? .3 : -3.5, far ? -20.5 : -19);
    const brakeLift = pose.brake * 12;
    const elbow = point(mix(-4, -7 - pose.glide * 3 + fold * 2.2, open), mix(3.8, -lift * 13 - brakeLift * .45 + bank * 3, open));
    const wrist = point(mix(-8, (-13 - pose.glide * 8) * (1 - fold * .44), open), mix(5.7, -wristLift * (22 - fold * 5) - brakeLift + bank * 5, open));
    const tip = point(mix(-10, (-21 - pose.glide * 11) * (1 - fold * .38), open), mix(5.9, -wristLift * (27 - fold * 6) - brakeLift + bank * 7, open));
    const feather = 1.2 + open * 2.7 * (1 - fold * .45) + pose.brake * 1.3;
    const w = (x: number, y: number) => body(point(root.x + x * small, root.y + y * small));
    ctx.save();
    ctx.globalAlpha = far ? .64 * open * side : side;
    ctx.lineWidth = line * (far ? .84 : .86);
    ctx.beginPath(); move(w(1, -1));
    cubic(w(-2, -2), w(elbow.x + 3, elbow.y - 2), w(elbow.x, elbow.y));
    quadratic(w(wrist.x + 3, wrist.y - 2), w(wrist.x, wrist.y));
    quadratic(w(tip.x + 2, tip.y - 1), w(tip.x, tip.y));
    // Three rounded primary groups, small enough to remain one readable wing.
    quadratic(w(tip.x - .5, tip.y + feather), w(tip.x + 2.1, tip.y + feather * 1.15));
    quadratic(w(tip.x + 3.1, tip.y + feather * .9), w(tip.x + 3.8, tip.y + feather * 1.4));
    quadratic(w(tip.x + 5.5, tip.y + feather * 1.55), w(tip.x + 6.8, tip.y + feather * 1.1));
    cubic(w(wrist.x + 5, wrist.y + feather * 1.7), w(elbow.x + 5, elbow.y + feather * 1.4), w(3, 3.2));
    quadratic(w(4, .5), w(1, -1));
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  };

  if (grounded) {
    // Keep the original continuous-line convention at the two contact points.
    ctx.fillRect(-5 * turnWidth, -2.2 / scale, 11 * turnWidth, 4.4 / scale);
  }
  if (pose.opening > .025) drawWing(true);

  const prone = pose.prone;
  const headCenter = point((5.8 + prone * 5.7 + pose.peck * 3.2 - pose.preen * 2.2 + pose.look) * side,
    -28.3 + prone * 6.9 + pose.peck * 13.2 + pose.preen * 2.4 - pose.look * .6);
  const headAngle = pose.peck * .56 + pose.preen * 1.72 + pose.look * .12
    + pose.bodyPitch * (1 - pose.airborne * .78);
  const hc = Math.cos(headAngle), hs = Math.sin(headAngle);
  const headOrigin = body(headCenter);
  const h = (x: number, y: number) => {
    const projection = x > 6.7 ? mix(6.7, x, side) : x;
    // The neck absorbs most of the torso's pitch and wing recoil. The gaze
    // stays level through a climb instead of the entire bird rotating rigidly.
    return point(headOrigin.x + (projection * hc - y * hs) * turnWidth,
      headOrigin.y + projection * hs + y * hc - pose.bodyBob * .6 * pose.airborne);
  };
  const tailAngle = pose.tail - pose.brake * .14;
  const tailFan = pose.brake * 3.8;
  const tc = Math.cos(tailAngle), ts = Math.sin(tailAngle);
  const t = (x: number, y: number) => body(point(mix(-10.5, -13 + x * tc - y * ts, side), mix(-19.5, -18 + x * ts + y * tc, side)));
  const tucked = pose.airborne * (1 - smooth((pose.brake - .05) / .7));
  const leftFoot = point(mix(-4.5 * turnWidth, b(-2, -7).x, tucked), mix(0, b(-2, -7).y, tucked));
  const rightFoot = point(mix(5.5 * turnWidth, b(3, -6.5).x, tucked), mix(0, b(3, -6.5).y, tucked));
  const leftAnkle = point(mix(-3.2 * turnWidth, b(-1, -8).x, tucked), mix(-4.6, b(-1, -8).y, tucked));
  const rightAnkle = point(mix(4.2 * turnWidth, b(2, -8).x, tucked), mix(-4.6, b(2, -8).y, tucked));

  ctx.beginPath(); move(leftFoot); quadratic(leftAnkle, b(-4, -7.3));
  cubic(b(-9, -8.1), b(-13, -11.8), b(-13.3, -16.3));
  lineTo(t(-14.5, -5.8 + prone * 5 + tailFan));
  quadratic(t(-16.2, -6.1 + prone * 5 + tailFan), t(-14.6, -7.2 + prone * 5 + tailFan));
  lineTo(t(-8, -6.6 + prone * 4));
  lineTo(t(-14.6, -11.2 + prone * 5 - tailFan));
  quadratic(t(-15.6, -12.4 + prone * 5 - tailFan), t(-13.4, -11.6 + prone * 5 - tailFan));
  quadratic(b(-15.4, -23.7), b(-10.5, -22.3));
  cubic(b(-5.9, -24.7), h(-7.2, -.8), h(-6.3, -3.1));
  cubic(h(-5, -8.1), h(3.8, -8.3), h(6.7, -2.2));
  quadratic(h(7.3, -.6), h(7.1, .4));
  lineTo(h(13.6, 2.1));
  quadratic(h(14.6, 2.5), h(13.5, 3));
  lineTo(h(6.8, 4));
  cubic(h(5.9, 7), b(11.7, -13.4), b(5.1, -8.1));
  quadratic(rightAnkle, rightFoot);
  if (!grounded) ctx.closePath();
  ctx.fill(); ctx.stroke();

  drawWing(false);

  if (side < .99) {
    ctx.save(); ctx.globalAlpha = 1 - side; ctx.lineWidth = line * .8;
    ctx.beginPath(); move(b(-8.4, -20)); quadratic(b(-7.8, -14.8), b(-5.4, -12));
    move(b(8.4, -20)); quadratic(b(7.8, -14.8), b(5.4, -12)); ctx.stroke();
    // Front-facing bill, seen end-on during the turn.
    ctx.beginPath(); move(h(-1.4, 2)); lineTo(h(0, 4)); lineTo(h(1.4, 2)); ctx.stroke(); ctx.restore();
  }

  // A small eye and a head tilt carry attention without a cartoon face pasted on.
  const eye = h(3.6, -.9);
  ctx.save(); ctx.strokeStyle = options.ink; ctx.fillStyle = options.ink;
  ctx.lineWidth = line * .7; ctx.beginPath();
  if (pose.blink > .65) {
    move(point(eye.x - 1.15, eye.y)); lineTo(point(eye.x + 1.15, eye.y)); ctx.stroke();
  } else {
    ctx.arc(eye.x, eye.y, .85, 0, TAU); ctx.fill();
  }
  if (side < .99) {
    const farEye = h(-3.6, -.9);
    ctx.globalAlpha = 1 - side; ctx.beginPath(); ctx.arc(farEye.x, farEye.y, .85, 0, TAU); ctx.fill();
  }
  ctx.restore(); ctx.restore();
}
