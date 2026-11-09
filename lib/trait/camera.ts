import { getAvailableMechanism, type DrawingObstacle, type GameWorld, type PlatformLevel } from './platformer';

export type CameraFrame = { cameraX: number; scale: number; offsetY: number };
export type CameraState = CameraFrame & { levelId: number | null; width: number; height: number; playerX: number };
type CameraOptions = {
  width: number; height: number; dt: number;
  locked?: boolean; frozen?: boolean; reducedMotion?: boolean;
};

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
export const createCamera = (): CameraState => ({ cameraX: 0, scale: 1, offsetY: 0, levelId: null, width: 0, height: 0, playerX: 0 });

function nearbyDrawing(world: GameWorld, level: PlatformLevel): DrawingObstacle | null {
  if (world.activeDrawing) return level.drawings.find(d => d.id === world.activeDrawing?.id) ?? null;
  let nearest: DrawingObstacle | null = null, distance = Infinity;
  for (const drawing of level.drawings) {
    const first = drawing.path[0], last = drawing.path.at(-1);
    if (!first || !last) continue;
    const left = Math.min(first.x, last.x), right = Math.max(first.x, last.x);
    const dx = Math.max(left - world.player.x, world.player.x - right, 0);
    // Prepare the view before A becomes interactive. Keep its zoom across the
    // whole bridge, including after construction and while returning over it.
    if (dx > 260 || Math.abs(world.player.y - Math.min(first.y, last.y)) > 210) continue;
    if (dx < distance) { nearest = drawing; distance = dx; }
  }
  return nearest;
}

function sceneBand(level: PlatformLevel, short: boolean): { top: number; bottom: number } {
  if (!short) return { top: 0, bottom: 560 };
  // A constant band per chapter prevents vertical zoom jumps whenever a handle,
  // slope or bridge enters the interaction radius on a landscape phone.
  let top = Math.min(160, level.start.y - 150);
  for (const surface of level.surfaces) top = Math.min(top, surface.a.y - 145, surface.b.y - 145);
  for (const drawing of level.drawings) for (const point of drawing.path) top = Math.min(top, point.y - 135);
  for (const mechanism of level.mechanisms ?? []) {
    const handleOffset = mechanism.type === 'platform' ? -25 : mechanism.type === 'gate'
      ? -mechanism.height / 2 + 20 : -mechanism.width / 2 - 22;
    top = Math.min(top, mechanism.from.y + handleOffset - 45, mechanism.to.y + handleOffset - 45);
  }
  return { top, bottom: 490 };
}

/** Presentation only: never changes player position, progress or constructions. */
export function updateCamera(state: CameraState, world: GameWorld, level: PlatformLevel, options: CameraOptions): CameraFrame {
  const width = Math.max(1, options.width), height = Math.max(1, options.height);
  const resized = Math.abs(width - state.width) > .5 || Math.abs(height - state.height) > .5;
  const initial = state.levelId !== level.id;
  const previousPlayerFraction = state.width > 0 ? (world.player.x - state.cameraX) * state.scale / state.width : .36;
  // Even easing must stop under a pointer: otherwise a straight screen stroke
  // becomes a bent world stroke. Pause/settings preserve the exact same view.
  if (!initial && !resized && (options.locked || options.frozen)) return state;

  const short = height <= 460;
  const band = sceneBand(level, short), sceneHeight = band.bottom - band.top;
  // Controls float over the artwork, so reserve room in the camera rather than
  // adding a web-page dock. The line and both anchors stay above the thumbs.
  const topInset = short ? 54 : 68, bottomInset = short ? 84 : 108;
  const playHeight = Math.max(100, height - topInset - bottomInset);
  const baseScale = Math.min(width / (width < 600 ? 660 : 1250), playHeight / sceneHeight);
  const drawing = nearbyDrawing(world, level);
  const mechanism = world.handInteraction
    ? level.mechanisms?.find(m => m.id === world.handInteraction?.id) ?? null
    : !drawing ? getAvailableMechanism(world, level) : null;
  let left = 0, right = 0, needsFraming = false, targetScale = baseScale;
  if (drawing) {
    const xs = drawing.path.map(p => p.x);
    left = Math.min(...xs, world.player.x - 45) - 75;
    right = Math.max(...xs, world.player.x + 45) + 75;
    targetScale = Math.min(baseScale, width / (right - left));
    needsFraming = !!world.activeDrawing || !world.drawn.includes(drawing.id);
  } else if (mechanism) {
    left = Math.min(mechanism.from.x, mechanism.to.x, world.player.x - 45) - 90;
    right = Math.max(mechanism.from.x, mechanism.to.x, world.player.x + 45) + 90;
    targetScale = Math.min(baseScale, width / (right - left));
    needsFraming = true;
  }

  const dt = clamp(options.dt, 0, .2);
  const ease = 1 - Math.exp(-dt * (options.reducedMotion ? 12 : 8));
  if (initial || resized) state.scale = targetScale;
  else state.scale += (targetScale - state.scale) * ease;
  const viewWidth = width / state.scale;
  const offset = topInset + (playHeight - sceneHeight * state.scale) / 2 - band.top * state.scale;
  state.offsetY = initial || resized ? offset : state.offsetY + (offset - state.offsetY) * ease;

  if (initial || resized) state.cameraX = clamp(world.player.x - viewWidth * (initial ? .36 : clamp(previousPlayerFraction, .28, .46)), 0, Math.max(0, level.width - viewWidth));
  // The camera rests inside a tracking window. Completing a bridge, turning the
  // head, changing direction or opening a menu never recentres the player.
  const travelled = world.player.x - state.playerX;
  let target = state.cameraX;
  if (travelled > .001) target = Math.max(target, world.player.x - viewWidth * .46);
  else if (travelled < -.001) target = Math.min(target, world.player.x - viewWidth * .28);
  if (needsFraming) {
    const span = right - left;
    target = span > viewWidth ? (left + right - viewWidth) / 2 : clamp(target, right - viewWidth, left);
  }
  target = clamp(target, 0, Math.max(0, level.width - viewWidth));
  if (initial || resized) state.cameraX = target;
  else {
    // Bound the speed as well as smoothing, including an irregular RAF frame.
    const maxStep = Math.max(450, viewWidth) * dt;
    state.cameraX += clamp((target - state.cameraX) * ease, -maxStep, maxStep);
  }
  state.cameraX = clamp(state.cameraX, 0, Math.max(0, level.width - viewWidth));
  state.levelId = level.id; state.width = width; state.height = height; state.playerX = world.player.x;
  return state;
}
