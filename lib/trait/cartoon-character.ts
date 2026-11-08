/**
 * The walk is a sequence of drawings, not an articulated skeleton.
 *
 * Reference study: Quipos' official La Linea series 100 excerpt, 9.28–9.60 s,
 * BEFORE the character turns his head. Four drawings are each held for two
 * frames of 25 fps film (80 ms per drawing). This is a leftward forward walk;
 * its entire contour is reflected to make our canonical rightward walk.
 *
 * The later 10.56–10.88 s sequence keeps moving left with the head turned
 * right. Copying that silhouette as a rightward walk would make him walk
 * backwards. Keep the original pose order and reflect the whole drawing,
 * rather than reversing time or turning the head independently of the legs.
 * No video frames, original audio or raster character assets ship.
 */

export type CartoonMotion = 'idle' | 'walk' | 'jump' | 'fall' | 'grumpy' | 'happy';
export type CartoonGesture = 'none' | 'peek' | 'point' | 'call' | 'impatient' | 'delighted' | 'curious' | 'angry' | 'settle';

export type CartoonCharacterState = {
  /** World position at the middle of the character's ground baseline. */
  x: number;
  y: number;
  scale: number;
  facing: -1 | 1;
  motion: CartoonMotion;
  /** Absolute distance travelled; keep unchanged while stopped or paused. */
  travel: number;
  /** Active animation time in seconds, paused with the game. */
  time: number;
  talkAmount: number;
  ink: string;
  background: string;
  /** Stroke width in world coordinates, independent of character scale. */
  stroke: number;
  reducedMotion?: boolean;
  /** Short acting beats never replace a moving or airborne silhouette. */
  gesture?: CartoonGesture;
  gestureAge?: number;
  gestureDuration?: number;
  /** A small head inclination toward a nearby person or obstacle; -1 is up. */
  look?: number;
};

export const CARTOON_CHARACTER_HEIGHT = 155;
export const CARTOON_WALK_DRAWINGS = 4;
export const CARTOON_WALK_CYCLE_DISTANCE = 59.2;

// Rest/action poses use a 180-unit working height. The forward walk is first
// mapped from the original 166-unit height into that same coordinate system.
// x=234, y=260 is a shared origin for all four silhouettes.
const ORIGIN_X = 234;
const BASELINE = 260;
const DRAWING_SCALE = CARTOON_CHARACTER_HEIGHT / 180;
const FRAME_DISTANCE = CARTOON_WALK_CYCLE_DISTANCE / CARTOON_WALK_DRAWINGS;

type Point = readonly [x: number, y: number];
type WalkDrawing = {
  back: readonly Point[];
  headOffset: number;
  front: readonly Point[];
  ground: readonly [left: number, right: number];
};

/**
 * Four whole silhouettes in chronological order: compressed, tucked,
 * extended, passing. These source coordinates face and travel LEFT.
 * A foot is a small fold in the outside contour. It never becomes a boot,
 * a closed sole, or an independently swinging leg with a visible crotch.
 */
const FORWARD_WALK_SOURCE: readonly WalkDrawing[] = [
  {
    back: [[264, 260], [263, 249], [274, 252], [260, 234], [260, 219], [264, 195], [280, 167], [273, 139]],
    headOffset: 0,
    front: [[216, 148], [205, 188], [191, 217], [215, 246], [215, 260]],
    ground: [215, 264],
  },
  {
    back: [[270, 260], [263, 240], [259, 222], [260, 200], [278, 174], [272, 144]],
    headOffset: 5,
    front: [[215, 151], [205, 192], [187, 215], [194, 240], [171, 247], [215, 260]],
    ground: [215, 270],
  },
  {
    back: [[291, 260], [283, 241], [260, 239], [260, 205], [278, 182], [272, 153]],
    headOffset: 10,
    front: [[215, 158], [199, 204], [182, 218], [171, 245], [153, 240], [169, 260]],
    ground: [169, 291],
  },
  {
    back: [[272, 260], [272, 236], [257, 235], [263, 197], [277, 172], [272, 145]],
    headOffset: 4,
    front: [[213, 157], [201, 201], [194, 234], [186, 260]],
    ground: [186, 272],
  },
];

/** Reflect the WHOLE source silhouette, including its head and leg folds. */
function forwardPoint([x, y]: Point): Point {
  const ratio = 180 / 166;
  return [ORIGIN_X - (x - ORIGIN_X) * ratio, BASELINE + (y - BASELINE) * ratio];
}

// Public facing=1 consistently means a right-facing, rightward forward walk.
const WALK: readonly WalkDrawing[] = FORWARD_WALK_SOURCE.map((drawing) => ({
  back: drawing.back.map(forwardPoint),
  headOffset: drawing.headOffset,
  front: drawing.front.map(forwardPoint),
  ground: [forwardPoint([drawing.ground[1], BASELINE])[0], forwardPoint([drawing.ground[0], BASELINE])[0]],
}));

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

export function getCartoonWalkFrame(travel: number): number {
  const safe = Number.isFinite(travel) ? Math.abs(travel) : 0;
  return Math.floor((safe + 1e-7) / FRAME_DISTANCE) % CARTOON_WALK_DRAWINGS;
}

function safeScale(state: CartoonCharacterState): number {
  return Math.max(.05, Number.isFinite(state.scale) ? state.scale : 1) * DRAWING_SCALE;
}

/** Exact WORLD x coordinates of the two ends of the grounded open contour. */
export function getCharacterGroundSpan(state: CartoonCharacterState): { left: number; right: number } {
  const endpoints = state.motion === 'walk'
    ? WALK[getCartoonWalkFrame(state.travel)].ground
    : [214, 264];
  const scale = safeScale(state) * (state.facing === -1 ? -1 : 1);
  const a = state.x + (endpoints[0] - ORIGIN_X) * scale;
  const b = state.x + (endpoints[1] - ORIGIN_X) * scale;
  return { left: Math.min(a, b), right: Math.max(a, b) };
}

function lineThrough(ctx: CanvasRenderingContext2D, points: readonly Point[]) {
  for (const [x, y] of points) ctx.lineTo(x, y);
}

/** The rounded cranium and long nose are one curve; no separate eye. */
function head(ctx: CanvasRenderingContext2D, offset: number, mouth: number) {
  ctx.bezierCurveTo(188, 123 + offset, 189, 108 + offset, 201, 96 + offset);
  ctx.bezierCurveTo(217, 80 + offset, 244, 75 + offset, 260, 86 + offset);
  ctx.bezierCurveTo(278, 99 + offset, 255, 109 + offset, 237, 104 + offset);
  ctx.lineTo(247, 112 + offset + mouth);
}

function mouthLine(ctx: CanvasRenderingContext2D, offset: number, mouth: number) {
  // This short lower-lip bend is visible in the reference. Its right end
  // rejoins the front contour, so it stays attached while the character talks.
  ctx.beginPath();
  ctx.moveTo(213, 110 + offset);
  ctx.quadraticCurveTo(229, 116 + offset + mouth * .6, 247, 112 + offset + mouth);
  ctx.stroke();
}

function traceWalk(ctx: CanvasRenderingContext2D, drawing: WalkDrawing, mouth: number, look = 0) {
  ctx.moveTo(...drawing.back[0]);
  lineThrough(ctx, drawing.back.slice(1));
  // This head belongs to the forward-walking drawings. The nose, lip and
  // torso remain in one continuous contour, and are mirrored together.
  const offset = drawing.headOffset;
  const neck=drawing.back[drawing.back.length-1],angle=look*.1;
  const observedHead=(point:Point):Point=>{
    const mapped=forwardPoint(point);
    if(!angle)return mapped;
    const x=mapped[0]-neck[0],y=mapped[1]-neck[1];
    return [neck[0]+x*Math.cos(angle)-y*Math.sin(angle),neck[1]+x*Math.sin(angle)+y*Math.cos(angle)];
  };
  ctx.bezierCurveTo(
    ...observedHead([289, 126 + offset]),
    ...observedHead([278, 108 + offset]),
    ...observedHead([258, 99 + offset]),
  );
  ctx.bezierCurveTo(
    ...observedHead([241, 89 + offset]),
    ...observedHead([220, 94 + offset]),
    ...observedHead([210, 102 + offset]),
  );
  ctx.bezierCurveTo(
    ...observedHead([194, 117 + offset]),
    ...observedHead([221, 121 + offset]),
    ...observedHead([243, 112 + offset]),
  );
  ctx.lineTo(...observedHead([224, 121 + offset]));
  ctx.quadraticCurveTo(
    ...observedHead([239, 126 + offset + mouth * .4]),
    ...observedHead([257, 123 + offset + mouth * .5]),
  );
  ctx.quadraticCurveTo(
    ...observedHead([240, 131 + offset + mouth]),
    ...observedHead([224, 128 + offset + mouth]),
  );
  lineThrough(ctx, drawing.front);
}

function backAtRest(ctx: CanvasRenderingContext2D) {
  ctx.moveTo(214, BASELINE);
  ctx.quadraticCurveTo(220, 236, 219, 217);
  // The resting hand is a few little notches in the silhouette, not a long
  // swinging arm attached to the torso by a separate stroke.
  lineThrough(ctx, [[215, 214], [219, 210], [214, 206], [218, 202], [211, 184]]);
  ctx.quadraticCurveTo(208, 161, 205, 130);
}

function traceIdle(ctx: CanvasRenderingContext2D, mouth: number) {
  backAtRest(ctx);
  head(ctx, 0, mouth);
  ctx.bezierCurveTo(260, 139, 270, 166, 267, 194);
  ctx.quadraticCurveTo(265, 228, 264, BASELINE);
}

function traceGrumpy(ctx: CanvasRenderingContext2D, mouth: number) {
  backAtRest(ctx);
  head(ctx, 0, mouth);
  lineThrough(ctx, [[261, 146], [288, 131], [294, 120]]);
  ctx.quadraticCurveTo(299, 117, 299, 123);
  lineThrough(ctx, [[296, 132], [308, 126]]);
  ctx.quadraticCurveTo(314, 126, 310, 132);
  lineThrough(ctx, [[301, 141], [314, 138]]);
  ctx.quadraticCurveTo(321, 140, 315, 145);
  lineThrough(ctx, [[300, 149], [279, 174], [268, 169]]);
  ctx.quadraticCurveTo(270, 215, 264, BASELINE);
}

function happyBack(ctx: CanvasRenderingContext2D, airborne: boolean) {
  if (airborne) {
    ctx.moveTo(213, 254);
    lineThrough(ctx, [[193, 246], [197, 239], [211, 240], [213, 220]]);
  } else {
    ctx.moveTo(214, BASELINE);
    ctx.quadraticCurveTo(219, 229, 213, 209);
  }
  lineThrough(ctx, [[205, 184], [184, 159], [175, 142], [164, 143], [155, 136]]);
  ctx.quadraticCurveTo(155, 130, 164, 134);
  lineThrough(ctx, [[169, 136], [155, 124]]);
  ctx.quadraticCurveTo(154, 118, 161, 123);
  lineThrough(ctx, [[174, 133], [172, 122]]);
  ctx.quadraticCurveTo(175, 116, 180, 125);
  lineThrough(ctx, [[182, 140], [200, 154], [205, 130]]);
}

function happyFront(ctx: CanvasRenderingContext2D) {
  lineThrough(ctx, [[262, 145], [282, 127], [286, 109]]);
  ctx.quadraticCurveTo(290, 103, 294, 111);
  lineThrough(ctx, [[291, 127], [300, 116]]);
  ctx.quadraticCurveTo(306, 112, 306, 120);
  lineThrough(ctx, [[298, 134], [309, 129]]);
  ctx.quadraticCurveTo(315, 130, 310, 137);
  lineThrough(ctx, [[302, 144], [291, 148], [274, 173]]);
}

function traceHappy(ctx: CanvasRenderingContext2D, mouth: number) {
  happyBack(ctx, false);
  head(ctx, 0, mouth);
  happyFront(ctx);
  ctx.quadraticCurveTo(273, 214, 264, BASELINE);
}

function traceAir(ctx: CanvasRenderingContext2D, mouth: number, falling: boolean) {
  happyBack(ctx, true);
  head(ctx, 0, mouth);
  if (falling) {
    // A wider reaching gesture on descent; still the same single silhouette.
    lineThrough(ctx, [[265, 151], [287, 155], [302, 144]]);
    ctx.quadraticCurveTo(310, 141, 307, 148);
    lineThrough(ctx, [[301, 155], [314, 153]]);
    ctx.quadraticCurveTo(321, 156, 313, 160);
    lineThrough(ctx, [[300, 162], [307, 170]]);
    ctx.quadraticCurveTo(307, 176, 300, 172);
    lineThrough(ctx, [[289, 165], [270, 173]]);
  } else {
    happyFront(ctx);
  }
  ctx.quadraticCurveTo(265, 201, 253, 216);
  lineThrough(ctx, [[271, 234], [291, 232], [297, 240], [274, 247], [250, 236], [237, 238], [224, 255]]);
  ctx.closePath();
}

type ActingHead = { dx: number; dy: number; tilt: number; mouth: number };

function headPoint([x, y]: Point, pose: ActingHead): Point {
  const cosine = Math.cos(pose.tilt), sine = Math.sin(pose.tilt);
  return [205 + pose.dx + (x - 205) * cosine - (y - 130) * sine,
    130 + pose.dy + (x - 205) * sine + (y - 130) * cosine];
}

function actingHead(ctx: CanvasRenderingContext2D, pose: ActingHead) {
  ctx.bezierCurveTo(...headPoint([188, 123], pose), ...headPoint([189, 108], pose), ...headPoint([201, 96], pose));
  ctx.bezierCurveTo(...headPoint([217, 80], pose), ...headPoint([244, 75], pose), ...headPoint([260, 86], pose));
  ctx.bezierCurveTo(...headPoint([278, 99], pose), ...headPoint([255, 109], pose), ...headPoint([237, 104], pose));
  ctx.lineTo(...headPoint([247, 112 + pose.mouth], pose));
}

function actingLip(ctx: CanvasRenderingContext2D, pose: ActingHead) {
  ctx.beginPath();
  ctx.moveTo(...headPoint([213, 110], pose));
  ctx.quadraticCurveTo(...headPoint([229, 116 + pose.mouth * .6], pose), ...headPoint([247, 112 + pose.mouth], pose));
  ctx.stroke();
}

function finishTorso(ctx: CanvasRenderingContext2D) {
  ctx.quadraticCurveTo(271, 213, 264, BASELINE);
}

/**
 * Acting study: series 200 at ~3 s (angular crouch), ~7 s (hands by face),
 * ~37–41 s (small fist, raised palm and appeal toward the artist), and series
 * 100 at ~5 s (open, raised arms). These game reactions adapt those contour
 * gestures; their timings and input triggers are gameplay decisions.
 * All grounded poses retain exactly the same two floor contacts.
 */
function traceActing(
  ctx: CanvasRenderingContext2D, gesture: CartoonGesture, age: number,
  mouth: number, look: number, reducedMotion: boolean,
): ActingHead {
  // Deliberate held drawings, not a continuously bobbing idle skeleton.
  const beat = reducedMotion ? 0 : age < .24 ? 0 : age < .56 ? 1 : 2;
  const pose: ActingHead = { dx: 0, dy: 0, tilt: look * .15, mouth };
  if (gesture === 'peek') {
    pose.dx = 13; pose.dy = 10; pose.tilt = look < -.2 ? -.18 : .2;
    ctx.moveTo(214, BASELINE);
    ctx.quadraticCurveTo(219, 232, 216, 211);
    lineThrough(ctx, [[211, 205], [216, 201], [212, 196], [216, 190], [218, 140]]);
    actingHead(ctx, pose);
    ctx.quadraticCurveTo(284, 162, 279, 196);
    finishTorso(ctx);
  } else if (gesture === 'settle') {
    // Two brief compression drawings keep the base on the landing surface.
    const deep = reducedMotion || age < .11;
    pose.dy = deep ? 25 : 10;
    ctx.moveTo(214, BASELINE);
    lineThrough(ctx, [[deep ? 195 : 207, deep ? 229 : 231], [216, 211], [213, 181], [205, 130 + pose.dy]]);
    actingHead(ctx, pose);
    lineThrough(ctx, [[269, 177], [269, 208], [deep ? 291 : 278, 229], [264, BASELINE]]);
  } else if (gesture === 'call' || gesture === 'angry') {
    pose.tilt = gesture === 'angry' ? .08 : -.17;
    pose.mouth = Math.max(mouth, beat === 1 ? 13 : 6);
    ctx.moveTo(214, BASELINE);
    ctx.quadraticCurveTo(220, 213, 210, 169);
    lineThrough(ctx, [[181, 180], [184, 153], [174, 150], [169, 145], [172, 141], [184, 146], [185, 136]]);
    ctx.quadraticCurveTo(189, 131, 192, 137);
    lineThrough(ctx, [[191, 148], [199, 143], [205, 130]]);
    actingHead(ctx, pose);
    lineThrough(ctx, [[264, 145], [279, 151], [286, 130], [280, 122], [282, 115], [289, 121], [293, 130], [298, 121]]);
    ctx.quadraticCurveTo(304, 119, 303, 126);
    lineThrough(ctx, [[299, 137], [301, 144], [289, 153], [285, 177], [270, 168]]);
    finishTorso(ctx);
  } else if (gesture === 'point') {
    pose.tilt = look < -.25 ? -.15 : .08;
    backAtRest(ctx); actingHead(ctx, pose);
    // The pointing hand and both sides of its forearm belong to the outline.
    if(look < -.25) {
      lineThrough(ctx, [[263, 149], [282, 145], [300, 126], [302, 113], [308, 108], [311, 98]]);
      ctx.quadraticCurveTo(315, 93, 317, 99);
      lineThrough(ctx, [[314, 114], [321, 112], [325, 117], [319, 122], [320, 130], [310, 134], [291, 164], [268, 174]]);
    } else {
      lineThrough(ctx, [[263, 149], [285, 163], [315, 161], [333, 158]]);
      ctx.quadraticCurveTo(340, 158, 337, 163);
      lineThrough(ctx, [[324, 167], [332, 170], [329, 176], [322, 174], [325, 180], [320, 183], [313, 174], [281, 186], [268, 174]]);
    }
    finishTorso(ctx);
  } else if (gesture === 'impatient') {
    pose.tilt = beat === 1 ? .13 : .04;
    pose.mouth = Math.max(mouth, beat === 1 ? 7 : 2);
    backAtRest(ctx); actingHead(ctx, pose);
    // A small fist at the waist, as in the film, instead of a detached arm.
    lineThrough(ctx, [[266, 149], [287, 172], [282, 189], [275, 192], [271, 188], [276, 183], [269, 185], [266, 201]]);
    finishTorso(ctx);
  } else if (gesture === 'curious') {
    pose.tilt = -.1; pose.mouth = Math.max(mouth, 2);
    backAtRest(ctx); actingHead(ctx, pose);
    lineThrough(ctx, [[265, 145], [290, 134], [283, 106], [275, 105], [269, 100], [270, 94], [278, 99], [281, 93]]);
    ctx.quadraticCurveTo(286, 91, 287, 98);
    lineThrough(ctx, [[287, 105], [302, 133], [289, 158], [268, 170]]);
    finishTorso(ctx);
  } else if (gesture === 'delighted') {
    pose.tilt = beat === 0 ? .08 : -.2;
    pose.mouth = Math.max(mouth, beat === 1 ? 10 : 4);
    backAtRest(ctx); actingHead(ctx, pose);
    if (beat === 0) {
      // A small open-palm acknowledgement before the raised-hand drawing.
      lineThrough(ctx, [[264, 148], [281, 166], [302, 154], [307, 143], [313, 141], [313, 150], [323, 147]]);
      ctx.quadraticCurveTo(330, 148, 325, 154);
      lineThrough(ctx, [[315, 159], [304, 170], [280, 185], [268, 174]]);
    } else {
      lineThrough(ctx, [[262, 145], [283, 126], [294, 103], [290, 94], [293, 88], [298, 99], [305, 89]]);
      ctx.quadraticCurveTo(311, 86, 310, 93);
      lineThrough(ctx, [[303, 108], [312, 101], [317, 104], [305, 118], [299, 135], [278, 162], [268, 173]]);
    }
    finishTorso(ctx);
  } else {
    backAtRest(ctx); actingHead(ctx, pose);
    ctx.bezierCurveTo(260, 139, 270, 166, 267, 194);
    ctx.quadraticCurveTo(265, 228, 264, BASELINE);
  }
  return pose;
}

function reactionTicks(ctx: CanvasRenderingContext2D, gesture: CartoonGesture, age: number) {
  // The source uses a few short arcs at a sudden surprise (series 100 ~13 s).
  // Keep them brief and close to the head, with the same white stroke.
  if ((gesture !== 'curious' && gesture !== 'angry') || age > .22) return;
  ctx.beginPath();
  ctx.moveTo(197, 67); ctx.quadraticCurveTo(203, 58, 212, 57);
  ctx.moveTo(188, 61); ctx.quadraticCurveTo(192, 52, 201, 49);
  ctx.stroke();
}

/** Draw one entire silhouette in world coordinates. The caller owns the floor. */
export function drawCartoonCharacter(ctx: CanvasRenderingContext2D, state: CartoonCharacterState): void {
  const scale = safeScale(state);
  const facing = state.facing === -1 ? -1 : 1;
  const frame = state.motion === 'walk' ? getCartoonWalkFrame(state.travel) : 0;
  const headOffset = state.motion === 'walk' ? WALK[frame].headOffset : 0;
  const talk = clamp(Number.isFinite(state.talkAmount) ? state.talkAmount : 0, 0, 1);
  const mouth = talk * 8 + (state.motion === 'grumpy' ? 3 : state.motion === 'happy' ? 2 : 0);
  const locomotion = state.motion === 'walk' || state.motion === 'jump' || state.motion === 'fall';
  const gesture = !locomotion ? state.gesture ?? 'none' : 'none';
  const age = Math.max(0, state.gestureAge ?? 0);
  const look = clamp(Number.isFinite(state.look) ? state.look! : 0, -1, 1);
  let expressiveHead: ActingHead | null = null;

  ctx.save();
  ctx.translate(state.x, state.y);
  ctx.scale(scale * facing, scale);
  ctx.translate(-ORIGIN_X, -BASELINE);
  ctx.lineWidth = Math.max(.3, state.stroke) / scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = state.ink;
  ctx.fillStyle = state.background;
  ctx.beginPath();
  if (gesture !== 'none' || (state.motion === 'idle' && Math.abs(look) > .05)) {
    expressiveHead = traceActing(ctx, gesture, age, mouth, look, !!state.reducedMotion);
  } else switch (state.motion) {
    case 'walk': traceWalk(ctx, WALK[frame], mouth, look); break;
    case 'jump': traceAir(ctx, mouth, false); break;
    case 'fall': traceAir(ctx, mouth, true); break;
    case 'grumpy': traceGrumpy(ctx, mouth); break;
    case 'happy': traceHappy(ctx, mouth); break;
    default: traceIdle(ctx, mouth); break;
  }
  // fill() closes an open grounded path only for the background mask. stroke()
  // keeps its two ends open, joining the ground without a horizontal baseline.
  ctx.fill();
  ctx.stroke();
  if (expressiveHead) actingLip(ctx, expressiveHead);
  else if (state.motion !== 'walk') mouthLine(ctx, headOffset, mouth);
  if (!state.reducedMotion) reactionTicks(ctx, gesture, age);
  ctx.restore();
}
