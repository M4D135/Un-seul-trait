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
 * These silhouettes remain vector paths, with no raster character frames.
 */

export type CartoonMotion = 'idle' | 'walk' | 'crouch' | 'crouch-walk' | 'fall' | 'grumpy' | 'happy';
export type CartoonGesture = 'none' | 'peek' | 'point' | 'call' | 'impatient' | 'delighted' | 'curious' | 'angry' | 'settle'
  | 'listen' | 'shrug' | 'explain' | 'recoil' | 'acknowledge';

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
  const endpoints = state.motion === 'walk' || state.motion === 'crouch-walk'
    ? WALK[getCartoonWalkFrame(state.travel)].ground
    : state.motion === 'crouch' ? [194, 278] : [214, 264];
  const scale = safeScale(state) * (state.facing === -1 ? -1 : 1);
  const a = state.x + (endpoints[0] - ORIGIN_X) * scale;
  const b = state.x + (endpoints[1] - ORIGIN_X) * scale;
  return { left: Math.min(a, b), right: Math.max(a, b) };
}

function lineThrough(ctx: CanvasRenderingContext2D, points: readonly Point[]) {
  for (const [x, y] of points) ctx.lineTo(x, y);
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

type ActingHead = { dx: number; dy: number; tilt: number; mouth: number };

function headPoint([x, y]: Point, pose: ActingHead): Point {
  const cosine = Math.cos(pose.tilt), sine = Math.sin(pose.tilt);
  return [205 + pose.dx + (x - 205) * cosine - (y - 130) * sine,
    130 + pose.dy + (x - 205) * sine + (y - 130) * cosine];
}

/** One oblong cranium/nose loop and its mouth notch, all in the outer contour. */
function actingHead(ctx: CanvasRenderingContext2D, pose: ActingHead) {
  const p = (point: Point) => headPoint(point, pose);
  ctx.bezierCurveTo(...p([185, 126]), ...p([182, 111]), ...p([194, 95]));
  ctx.bezierCurveTo(...p([208, 76]), ...p([238, 67]), ...p([259, 78]));
  ctx.bezierCurveTo(...p([280, 86]), ...p([280, 98]), ...p([259, 104]));
  ctx.quadraticCurveTo(...p([246, 109]), ...p([231, 105]));
  ctx.lineTo(...p([254, 115]));
  if (pose.mouth < 3) ctx.lineTo(...p([242, 123]));
  else {
    ctx.quadraticCurveTo(...p([233, 130 + pose.mouth * .6]), ...p([241, 135 + pose.mouth * .6]));
    ctx.lineTo(...p([257, 119 + pose.mouth * .2]));
  }
}

function backAtRest(ctx: CanvasRenderingContext2D, dx = 0, dy = 0) {
  ctx.moveTo(214, BASELINE);
  ctx.quadraticCurveTo(222, 230, 218, 208);
  // The hand at the hip is an interruption in the outline, as in the profiles.
  lineThrough(ctx, [[213, 203], [219, 198], [214, 193], [219, 188], [214, 178]]);
  ctx.quadraticCurveTo(210 + dx, 153 + dy, 205 + dx, 130 + dy);
}

function finishTorso(ctx: CanvasRenderingContext2D) {
  ctx.quadraticCurveTo(278, 214, 264, BASELINE);
}

function palmUp(ctx: CanvasRenderingContext2D) {
  lineThrough(ctx, [[266, 149], [290, 170], [312, 151], [317, 137]]);
  ctx.quadraticCurveTo(319, 130, 324, 135);
  lineThrough(ctx, [[325, 145], [337, 136]]);
  ctx.quadraticCurveTo(343, 135, 342, 141);
  lineThrough(ctx, [[332, 152], [343, 147]]);
  ctx.quadraticCurveTo(350, 148, 345, 155);
  lineThrough(ctx, [[335, 161], [345, 159]]);
  ctx.quadraticCurveTo(350, 163, 343, 168);
  lineThrough(ctx, [[329, 175], [319, 173], [293, 194], [270, 176]]);
}

/** Open palms and long arms are silhouette folds, never attached stick limbs. */
function openBack(ctx: CanvasRenderingContext2D) {
  ctx.moveTo(214, BASELINE);
  ctx.quadraticCurveTo(217, 218, 212, 188);
  lineThrough(ctx, [[225, 156], [170, 179], [158, 194], [150, 202]]);
  ctx.quadraticCurveTo(144, 203, 146, 196);
  lineThrough(ctx, [[155, 184], [143, 195]]);
  ctx.quadraticCurveTo(136, 198, 139, 190);
  lineThrough(ctx, [[150, 176], [138, 185]]);
  ctx.quadraticCurveTo(132, 185, 137, 178);
  lineThrough(ctx, [[149, 166], [140, 164]]);
  ctx.quadraticCurveTo(132, 160, 139, 156);
  lineThrough(ctx, [[154, 160], [164, 156], [205, 130]]);
}

function openFront(ctx: CanvasRenderingContext2D) {
  lineThrough(ctx, [[265, 150], [301, 179], [313, 179], [324, 171]]);
  ctx.quadraticCurveTo(331, 171, 327, 179);
  lineThrough(ctx, [[319, 185], [332, 201]]);
  ctx.quadraticCurveTo(334, 209, 327, 207);
  lineThrough(ctx, [[315, 193], [322, 212]]);
  ctx.quadraticCurveTo(320, 220, 315, 213);
  lineThrough(ctx, [[307, 194], [308, 211]]);
  ctx.quadraticCurveTo(304, 218, 300, 210);
  lineThrough(ctx, [[299, 191], [278, 173], [269, 164]]);
  finishTorso(ctx);
}

function raisedBack(ctx: CanvasRenderingContext2D, fists: boolean) {
  ctx.moveTo(214, BASELINE);
  ctx.quadraticCurveTo(224, 215, 211, 171);
  lineThrough(ctx, [[174, 184], [173, 145]]);
  if (fists) {
    lineThrough(ctx, [[164, 140], [159, 132]]);
    ctx.quadraticCurveTo(157, 124, 165, 124);
    lineThrough(ctx, [[171, 127], [175, 118]]);
    ctx.quadraticCurveTo(181, 115, 184, 123);
    lineThrough(ctx, [[193, 121], [198, 128], [190, 141]]);
  } else {
    lineThrough(ctx, [[160, 140], [154, 134]]);
    ctx.quadraticCurveTo(152, 127, 160, 130);
    lineThrough(ctx, [[173, 135], [169, 119]]);
    ctx.quadraticCurveTo(170, 111, 176, 116);
    lineThrough(ctx, [[181, 130], [187, 117]]);
    ctx.quadraticCurveTo(194, 112, 194, 121);
    lineThrough(ctx, [[189, 137], [198, 131], [202, 137], [193, 146]]);
  }
  lineThrough(ctx, [[199, 145], [205, 130]]);
}

function raisedFront(ctx: CanvasRenderingContext2D, fists: boolean) {
  lineThrough(ctx, [[267, 146], [283, 155], [294, 137]]);
  if (fists) {
    lineThrough(ctx, [[288, 129], [291, 120], [298, 118], [302, 124], [309, 120]]);
    ctx.quadraticCurveTo(317, 120, 315, 130);
    lineThrough(ctx, [[322, 135], [319, 145], [307, 151]]);
  } else {
    lineThrough(ctx, [[284, 123]]);
    ctx.quadraticCurveTo(282, 116, 289, 117);
    lineThrough(ctx, [[300, 131], [305, 114]]);
    ctx.quadraticCurveTo(312, 108, 313, 118);
    lineThrough(ctx, [[310, 134], [322, 124]]);
    ctx.quadraticCurveTo(331, 123, 326, 132);
    lineThrough(ctx, [[316, 143], [325, 141], [329, 147], [314, 154], [307, 152]]);
  }
  lineThrough(ctx, [[289, 184], [271, 171]]);
  finishTorso(ctx);
}

function joyBack(ctx: CanvasRenderingContext2D) {
  ctx.moveTo(214, BASELINE);
  ctx.quadraticCurveTo(230, 213, 213, 177);
  lineThrough(ctx, [[153, 130], [138, 126], [121, 130], [106, 124]]);
  ctx.quadraticCurveTo(101, 118, 110, 116);
  lineThrough(ctx, [[123, 119], [110, 111]]);
  ctx.quadraticCurveTo(107, 105, 114, 103);
  lineThrough(ctx, [[127, 114], [120, 100]]);
  ctx.quadraticCurveTo(120, 92, 127, 97);
  lineThrough(ctx, [[138, 112], [143, 107], [150, 113], [151, 122], [198, 147], [205, 130]]);
}

function joyFront(ctx: CanvasRenderingContext2D) {
  lineThrough(ctx, [[258, 150], [308, 106], [314, 96], [310, 86]]);
  ctx.quadraticCurveTo(306, 78, 313, 76);
  lineThrough(ctx, [[321, 86], [332, 71]]);
  ctx.quadraticCurveTo(340, 67, 338, 75);
  lineThrough(ctx, [[328, 92], [344, 82]]);
  ctx.quadraticCurveTo(353, 82, 347, 90);
  lineThrough(ctx, [[334, 101], [349, 96]]);
  ctx.quadraticCurveTo(357, 100, 349, 107);
  lineThrough(ctx, [[331, 113], [322, 120], [278, 183]]);
  finishTorso(ctx);
}

/**
 * The supplied pose sheet and the observed Quipos excerpts guide these held
 * drawings: palms at 18.4–19.2 s (series 100), angular flexion at 20–21.2 s,
 * open arms at 3.6–4.8 s (series 200), fists/hands near the head at 5.2–7.2 s.
 * The game chooses when to hold them. They are adaptations, not footage from
 * the separately linked YouTube video, whose images were unavailable.
 */
function traceActing(
  ctx: CanvasRenderingContext2D, gesture: CartoonGesture, age: number,
  mouth: number, look: number, reducedMotion: boolean, duration = 1.1,
) {
  // Anticipation, a held drawing, then release. A long complaint should not
  // cycle its arms at speech-syllable speed. Only the recorded voice opens
  // the jaw; quiet listening remains visibly quiet.
  const length = Math.max(.24, duration);
  const beat = reducedMotion ? 1 : age < Math.min(.2, length * .24) ? 0 : age >= length - Math.min(.22, length * .25) ? 2 : 1;
  const emphasis = reducedMotion ? 0 : Math.round(mouth / 4) * .018;
  const pose: ActingHead = { dx: 0, dy: 0, tilt: look * .18, mouth };
  if (gesture === 'peek') {
    pose.dx = 27; pose.dy = 28; pose.tilt = look < -.3 ? -.1 : .25;
    ctx.moveTo(214, BASELINE);
    lineThrough(ctx, [[221, 234], [206, 218]]);
    ctx.quadraticCurveTo(197, 199, 216, 180);
    ctx.lineTo(232, 158); actingHead(ctx, pose);
    lineThrough(ctx, [[290, 180], [304, 196], [298, 211], [291, 207], [292, 218], [285, 219], [279, 202], [268, 194]]);
    ctx.quadraticCurveTo(281, 220, 264, BASELINE);
  } else if (gesture === 'settle') {
    const deep = reducedMotion || age < .11;
    pose.dy = deep ? 30 : 12; pose.tilt = .1;
    ctx.moveTo(214, BASELINE);
    lineThrough(ctx, [[deep ? 193 : 205, 233], [215, 212], [215, 181], [205, 130 + pose.dy]]);
    actingHead(ctx, pose);
    lineThrough(ctx, [[270, 181], [269, 209], [deep ? 292 : 279, 232], [264, BASELINE]]);
  } else if (gesture === 'call' && beat === 0) {
    pose.tilt = -.25 - emphasis; pose.mouth = mouth * 1.25;
    openBack(ctx); actingHead(ctx, pose); openFront(ctx);
  } else if (gesture === 'call' || gesture === 'angry') {
    const fists = gesture === 'angry' && beat !== 2;
    pose.tilt = fists ? -.12 - emphasis : -.38 - emphasis;
    pose.dx = beat === 1 ? -3 : 0; pose.dy = beat === 1 ? -2 : 0;
    pose.mouth = mouth * 1.45;
    raisedBack(ctx, fists); actingHead(ctx, pose); raisedFront(ctx, fists);
  } else if (gesture === 'shrug') {
    // Series 200, 3.6–4.8 s: both palms out, elbows below the head,
    // profile drawn up toward the unseen cartoonist, feet still the floor.
    pose.tilt = (beat === 1 ? -.2 : -.08) - emphasis;
    pose.dx = beat === 1 ? 5 : 0;
    pose.mouth = mouth * 1.2;
    openBack(ctx); actingHead(ctx, pose); openFront(ctx);
  } else if (gesture === 'listen') {
    pose.tilt = look < -.25 ? -.3 : -.07;
    pose.dy = -2;
    backAtRest(ctx); actingHead(ctx, pose);
    // A low, relaxed hand on the belly distinguishes this pause from a
    // clenched hands-on-hips rebuke. There is no independent interior arm.
    lineThrough(ctx, [[269, 154], [277, 177], [275, 192], [282, 196],
      [281, 201], [274, 202], [279, 207], [274, 212], [269, 209]]);
    finishTorso(ctx);
  } else if (gesture === 'explain') {
    pose.tilt = -.16 - emphasis;
    pose.mouth = mouth * 1.25;
    if (beat === 1) openBack(ctx); else backAtRest(ctx);
    actingHead(ctx, pose);
    if (beat === 2) {
      lineThrough(ctx, [[267, 149], [299, 167], [326, 157], [337, 159], [349, 170]]);
      ctx.quadraticCurveTo(351, 177, 344, 175);
      lineThrough(ctx, [[334, 167], [341, 180]]);
      ctx.quadraticCurveTo(340, 187, 334, 182);
      lineThrough(ctx, [[326, 170], [330, 184]]);
      ctx.quadraticCurveTo(326, 190, 322, 183);
      lineThrough(ctx, [[317, 174], [296, 190], [270, 177]]);
    } else palmUp(ctx);
    finishTorso(ctx);
  } else if (gesture === 'recoil') {
    pose.dx = -10; pose.dy = beat === 0 ? 7 : 3;
    pose.tilt = -.42 - emphasis; pose.mouth = mouth * 1.4;
    raisedBack(ctx, beat === 2); actingHead(ctx, pose); raisedFront(ctx, false);
  } else if (gesture === 'acknowledge') {
    pose.dx = beat === 1 ? 7 : 0;
    pose.dy = beat === 1 ? 8 : 0;
    pose.tilt = beat === 1 ? .16 : -.08;
    backAtRest(ctx, pose.dx, pose.dy); actingHead(ctx, pose);
    palmUp(ctx); finishTorso(ctx);
  } else if (gesture === 'point') {
    pose.tilt = look < -.25 ? -.27 : -.08;
    backAtRest(ctx); actingHead(ctx, pose);
    if (beat === 0) palmUp(ctx);
    else if (look < -.25) {
      lineThrough(ctx, [[266, 150], [287, 147], [312, 121], [313, 108], [322, 101], [326, 84]]);
      ctx.quadraticCurveTo(330, 77, 335, 85);
      lineThrough(ctx, [[332, 106], [341, 100], [347, 104], [342, 114], [349, 117], [345, 125], [332, 133], [323, 132], [295, 169], [270, 177]]);
    } else {
      lineThrough(ctx, [[267, 152], [293, 164], [328, 158], [355, 151]]);
      ctx.quadraticCurveTo(364, 150, 364, 157);
      lineThrough(ctx, [[342, 166], [354, 170]]);
      ctx.quadraticCurveTo(358, 177, 350, 178);
      lineThrough(ctx, [[339, 175], [347, 183], [343, 189], [331, 182], [328, 176], [292, 189], [270, 177]]);
    }
    finishTorso(ctx);
  } else if (gesture === 'impatient') {
    pose.tilt = (beat === 1 ? -.15 : .04) - emphasis;
    pose.mouth = mouth * 1.2;
    ctx.moveTo(214, BASELINE);
    ctx.quadraticCurveTo(223, 235, 220, 211);
    lineThrough(ctx, [[211, 204], [199, 214], [190, 213], [193, 202], [187, 199], [192, 192], [181, 175], [205, 140], [205, 130]]);
    actingHead(ctx, pose);
    lineThrough(ctx, [[273, 150], [298, 175], [289, 201], [277, 207], [271, 201], [281, 194], [270, 195], [268, 213]]);
    finishTorso(ctx);
  } else if (gesture === 'curious') {
    pose.tilt = -.17; pose.mouth = mouth;
    ctx.moveTo(214, BASELINE);
    ctx.quadraticCurveTo(223, 217, 212, 166);
    lineThrough(ctx, [[176, 180], [180, 146], [168, 143], [163, 136], [170, 130], [179, 131], [181, 120]]);
    ctx.quadraticCurveTo(186, 113, 192, 120);
    lineThrough(ctx, [[198, 119], [205, 126], [196, 139], [205, 130]]);
    actingHead(ctx, pose);
    lineThrough(ctx, [[273, 155], [283, 174], [277, 197], [285, 200], [284, 206], [277, 208], [280, 214], [273, 216]]);
    finishTorso(ctx);
  } else if (gesture === 'delighted') {
    pose.tilt = beat === 0 ? -.18 : -.46;
    pose.mouth = mouth * 1.2;
    if (beat === 0) { backAtRest(ctx); actingHead(ctx, pose); palmUp(ctx); finishTorso(ctx); }
    else { joyBack(ctx); actingHead(ctx, pose); joyFront(ctx); }
  } else {
    backAtRest(ctx); actingHead(ctx, pose);
    ctx.bezierCurveTo(265, 147, 281, 183, 270, 212);
    ctx.quadraticCurveTo(265, 238, 264, BASELINE);
  }
}

/**
 * Low movement adapts the angular knee/hip flexion of series 100 at 20–21.2 s.
 * Four drawn edge folds retain the confirmed forward order. Bending the torso
 * does not invent a joint rig, separate shoes or a second line between legs.
 * The head stays full size while the body folds beneath it.
 */
function crouchPoint([x, y]: Point): Point {
  const bend = clamp((BASELINE - y) / 110, 0, 1);
  return [x + bend * 45, BASELINE - (BASELINE - y) * .36];
}

function lowHand(ctx: CanvasRenderingContext2D, shoulder: Point) {
  const [x, y] = shoulder;
  lineThrough(ctx, [[x + 20, y + 10], [x + 31, y + 8], [x + 38, y + 15],
    [x + 29, y + 14], [x + 32, y + 21], [x + 25, y + 21],
    [x + 17, y + 15], [x + 2, y + 10]]);
}

function traceCrouch(ctx: CanvasRenderingContext2D, drawing: WalkDrawing | null, mouth: number) {
  if (!drawing) {
    ctx.moveTo(194, BASELINE);
    lineThrough(ctx, [[204, 248], [181, 236], [213, 221], [237, 210]]);
    actingHead(ctx, { dx: 32, dy: 80, tilt: .25, mouth: mouth * .4 });
    ctx.lineTo(298, 223); lowHand(ctx, [298, 223]);
    lineThrough(ctx, [[269, 238], [286, 251], [278, BASELINE]]);
    return;
  }
  const back = drawing.back.map(crouchPoint), front = drawing.front.map(crouchPoint);
  const neck = back[back.length - 1];
  ctx.moveTo(...back[0]); lineThrough(ctx, back.slice(1));
  actingHead(ctx, { dx: neck[0] - 205, dy: neck[1] - 130, tilt: .25, mouth: mouth * .4 });
  ctx.lineTo(...front[0]); lowHand(ctx, front[0]);
  lineThrough(ctx, front.slice(1));
}

/** Falling reaches for the edge; there is no ascending/jump performance. */
function traceFall(ctx: CanvasRenderingContext2D, mouth: number) {
  ctx.moveTo(215, 251);
  lineThrough(ctx, [[206, 226], [199, 185], [165, 181], [147, 192], [141, 188], [149, 179], [138, 182], [136, 176], [149, 167], [158, 170], [205, 130]]);
  actingHead(ctx, { dx: 0, dy: 0, tilt: -.15, mouth: Math.max(9, mouth) });
  lineThrough(ctx, [[271, 152], [289, 121], [292, 79], [283, 72], [281, 65], [290, 64], [297, 71], [299, 54]]);
  ctx.quadraticCurveTo(304, 48, 308, 55);
  lineThrough(ctx, [[307, 73], [319, 60], [325, 64], [313, 81], [327, 76], [332, 83], [310, 94], [307, 139], [277, 180], [259, 215], [287, 244], [268, 237], [246, 229], [226, 251]]);
  ctx.closePath();
}

function reactionTicks(ctx: CanvasRenderingContext2D, gesture: CartoonGesture, age: number) {
  if ((gesture !== 'curious' && gesture !== 'angry') || age > .22) return;
  ctx.beginPath();
  ctx.moveTo(185, 66); ctx.quadraticCurveTo(190, 55, 200, 52);
  ctx.moveTo(175, 61); ctx.quadraticCurveTo(179, 50, 188, 45);
  ctx.stroke();
}

/** Draw one entire silhouette in world coordinates. The caller owns the floor. */
export function drawCartoonCharacter(ctx: CanvasRenderingContext2D, state: CartoonCharacterState): void {
  const scale = safeScale(state);
  const facing = state.facing === -1 ? -1 : 1;
  const walking = state.motion === 'walk' || state.motion === 'crouch-walk';
  const frame = walking ? getCartoonWalkFrame(state.travel) : 0;
  const talk = clamp(Number.isFinite(state.talkAmount) ? state.talkAmount : 0, 0, 1);
  const mouth = talk * 12;
  const protectedPose = walking || state.motion === 'crouch' || state.motion === 'fall';
  const gesture = protectedPose ? 'none' : state.gesture ?? 'none';
  const age = Math.max(0, state.gestureAge ?? 0);
  const look = clamp(Number.isFinite(state.look) ? state.look! : 0, -1, 1);
  ctx.save();
  ctx.translate(state.x, state.y);
  ctx.scale(scale * facing, scale);
  ctx.translate(-ORIGIN_X, -BASELINE);
  ctx.lineWidth = Math.max(.3, state.stroke) / scale;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = state.ink; ctx.fillStyle = state.background;
  ctx.beginPath();
  switch (state.motion) {
    case 'walk': traceWalk(ctx, WALK[frame], talk * 8, look); break;
    case 'crouch': traceCrouch(ctx, null, mouth); break;
    case 'crouch-walk': traceCrouch(ctx, WALK[frame], mouth); break;
    case 'fall': traceFall(ctx, mouth); break;
    default: {
      const acting = gesture !== 'none' ? gesture : state.motion === 'grumpy' ? 'impatient' : state.motion === 'happy' ? 'delighted' : 'none';
      traceActing(ctx, acting, state.motion === 'happy' && gesture === 'none' ? .5 : age, mouth, look,
        !!state.reducedMotion, state.gestureDuration || 1.1);
    }
  }
  // Filling closes the mask; the stroked ground contour remains open.
  ctx.fill(); ctx.stroke();
  if (!state.reducedMotion) reactionTicks(ctx, gesture, age);
  ctx.restore();
}
