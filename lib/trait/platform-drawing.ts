import { PLATFORM_PHYSICS, type PlatformPoint } from './platformer';

export const STROKE_ANCHOR_RADIUS = 34;
const MIN_Y = 150;
const MAX_Y = 500;
const SIMPLIFY_ERROR = 1.25;

export type PreparedPlayerStroke = {
  ok: boolean;
  message: string;
  points: PlatformPoint[];
};

const distance = (a: PlatformPoint, b: PlatformPoint) => Math.hypot(b.x - a.x, b.y - a.y);

export function strokeLength(points: readonly PlatformPoint[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += distance(points[i - 1], points[i]);
  return length;
}

/** Remove small finger tremors only. Corners, intentional slopes and the endpoints survive. */
export function stabilizePlayerStroke(raw: readonly PlatformPoint[]): PlatformPoint[] {
  let points = raw.map(point => ({ ...point }));
  if (points.length <= 8) return points;
  for (let pass = 0; pass < 2; pass++) points = points.map((point, i) => {
    if (i === 0 || i === points.length - 1) return point;
    const previous = points[i - 1], next = points[i + 1];
    if (distance(previous, point) > 16 || distance(point, next) > 16) return point;
    const x = (previous.x + point.x * 2 + next.x) / 4;
    const y = (previous.y + point.y * 2 + next.y) / 4;
    const delta = Math.hypot(x - point.x, y - point.y), amount = delta > 1.75 ? 1.75 / delta : 1;
    return { x: point.x + (x - point.x) * amount, y: point.y + (y - point.y) * amount };
  });
  const direction = raw[raw.length - 1].x >= raw[0].x ? 1 : -1;
  for (let i = 1; i < points.length - 1; i++) {
    const backward = (points[i - 1].x - points[i].x) * direction;
    if (backward > 0 && backward < 7) points[i].x = points[i - 1].x;
  }
  return points;
}

function pointToSegmentSquared(p: PlatformPoint, a: PlatformPoint, b: PlatformPoint): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const denominator = dx * dx + dy * dy;
  const t = denominator > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / denominator)) : 0;
  return (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2;
}

/** Keep corners and endpoints; the displayed/collidable line deviates by at most 1.25 units. */
function simplify(points: PlatformPoint[]): PlatformPoint[] {
  if (points.length <= 2) return points;
  const retained = new Uint8Array(points.length);
  retained[0] = retained[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let farthest = -1, farthestDistance = SIMPLIFY_ERROR * SIMPLIFY_ERROR;
    for (let i = start + 1; i < end; i++) {
      const d = pointToSegmentSquared(points[i], points[start], points[end]);
      if (d > farthestDistance) { farthestDistance = d; farthest = i; }
    }
    if (farthest >= 0) {
      retained[farthest] = 1;
      stack.push([start, farthest], [farthest, end]);
    }
  }
  return points.filter((_, i) => retained[i]);
}

/** Validate the player's own geometry. This function never substitutes the guide route. */
export function preparePlayerStroke(raw: readonly PlatformPoint[], start: PlatformPoint, end: PlatformPoint,
  options: { assist?: boolean; anchorRadius?: number; inkLimit?: number } = {}): PreparedPlayerStroke {
  const fail = (message: string): PreparedPlayerStroke => ({ ok: false, message, points: [] });
  if (raw.length < 2) return fail('Garde le crayon appuyé et relie les deux repères.');
  if (raw.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return fail('Le tracé a été interrompu. Recommence depuis un repère.');

  let points = options.assist ? stabilizePlayerStroke(raw) : raw.map(p => ({ ...p }));
  const radius = Number.isFinite(options.anchorRadius) ? Math.max(12, Math.min(96, options.anchorRadius!)) : STROKE_ANCHOR_RADIUS;
  // A player returning from the far bank can draw right-to-left as well.
  const reversed = distance(points[0], end) < distance(points[0], start);
  if (reversed) points.reverse();
  if (distance(points[0], start) > radius) return fail('Commence sur l’un des deux repères.');
  if (distance(points[points.length - 1], end) > radius) return fail('Il manque le raccord : termine sur l’autre repère.');
  points[0] = { ...start };
  points[points.length - 1] = { ...end };

  if (points.some(p => p.y < MIN_Y || p.y > MAX_Y)) return fail('Garde le passage dans la zone de dessin.');
  const minX = Math.min(start.x, end.x), maxX = Math.max(start.x, end.x);
  if (points.some(p => p.x < minX - STROKE_ANCHOR_RADIUS || p.x > maxX + STROKE_ANCHOR_RADIUS)) {
    return fail('Reste entre les deux repères pour dessiner le passage.');
  }

  const distinct = points.filter((p, i) => i === 0 || distance(p, points[i - 1]) > 0.05);
  points = simplify(distinct);
  if (points.length < 2 || distance(points[0], points[points.length - 1]) < 2) return fail('Relie les deux repères d’un seul trait.');
  const direction = end.x >= start.x ? 1 : -1;
  // A near-vertical riser is skipped by even one crouched movement substep.
  // Match the real step allowance, while retaining the separate tolerance for
  // continuous slopes: a steep but continuous ramp is not a vertical stair.
  const impossibleStep = (dx: number, dy: number) => Math.abs(dx) <= .5 && dy > PLATFORM_PHYSICS.stepHeight + .1;
  const stepMessage = 'Cette marche est trop haute. Dessine des marches plus petites ou une pente douce.';
  let backwards = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = (points[i].x - points[i - 1].x) * direction;
    const dy = Math.abs(points[i].y - points[i - 1].y);
    if (dx < 0) backwards -= dx;
    if (dx < -22 || backwards > Math.max(38, Math.abs(end.x - start.x) * 0.16)) {
      return fail('Avance vers l’autre repère : évite les grandes boucles en arrière.');
    }
    if (impossibleStep(dx, dy)) return fail(stepMessage);
    if (dy > 52 + Math.max(0, dx) * 1.6) return fail('Cette paroi est trop haute. Dessine une pente ou de petites marches.');
  }
  // Catch a large vertical wall even when the pointer supplied many tiny segments.
  for (let i = 0; i < points.length - 1; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = (points[j].x - points[i].x) * direction;
      if (dx > 48) break;
      const dy = Math.abs(points[j].y - points[i].y);
      if (impossibleStep(dx, dy)) return fail(stepMessage);
      if (dy > 52 + Math.max(0, dx) * 1.6) {
        return fail('Cette paroi est trop haute. Dessine une pente ou de petites marches.');
      }
    }
  }
  if (options.inkLimit && Number.isFinite(options.inkLimit) && strokeLength(points) > options.inkLimit * 1.04)
    return fail('Le détour est trop long pour ce crayon. Raccourcis une portion ou choisis un autre chemin.');
  return { ok: true, message: 'Ton passage est prêt. À toi de le traverser !', points };
}
