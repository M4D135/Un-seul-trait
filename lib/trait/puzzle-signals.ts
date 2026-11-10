import {
  getGoalInterlock, getMechanismHandlePosition, getMechanismInterlock, getMechanismPosition,
  type GameWorld, type PlatformLevel, type PlatformMechanism, type PlatformPoint,
  type PuzzleRequirement, type PuzzleRequirementState,
} from './platformer';

export type PuzzleSignalGlyph = 'circle' | 'diamond' | 'triangle' | 'square' | 'stroke';
export type PuzzleSignalContact = {
  id: string; sourceId: string; targetId?: string; point: PlatformPoint;
  glyph: PuzzleSignalGlyph; satisfied: boolean; source: boolean;
  stem?: PlatformPoint;
};
export type PuzzleSignalConnection = {
  sourceId: string; targetId: string; points: PlatformPoint[]; satisfied: boolean;
};
export type PuzzleSignalDetent = {
  mechanismId: string; progress: number; point: PlatformPoint; normal: PlatformPoint;
};
export type PuzzleSignalSocket = {
  sourceId: string; targetId: string; progress: number; glyph: PuzzleSignalGlyph;
  point: PlatformPoint; railPoint: PlatformPoint; normal: PlatformPoint; satisfied: boolean;
};
export type PuzzleSignalLayout = {
  contacts: PuzzleSignalContact[];
  connections: PuzzleSignalConnection[];
  detents: PuzzleSignalDetent[];
  sockets: PuzzleSignalSocket[];
};
export type PuzzleSignalOptions = {
  cameraX: number; viewWidth: number; pixelScale?: number;
  ink: string; accent: string; background: string; pointer?: PlatformPoint | null;
};
type LayoutOptions = Pick<PuzzleSignalOptions, 'cameraX' | 'viewWidth' | 'pointer'>;
const p = (x: number, y: number): PlatformPoint => ({ x, y });
const distance = (a: PlatformPoint, b: PlatformPoint) => Math.hypot(a.x - b.x, a.y - b.y);

function glyph(level: PlatformLevel, id: string): PuzzleSignalGlyph {
  const authoredIndex = (level.mechanisms ?? []).findIndex(mechanism => mechanism.id === id);
  // A room's consecutive controls use different engravings, even when their
  // names happen to hash alike (left/right weights used to share a triangle).
  if (authoredIndex >= 0) return (['circle', 'diamond', 'triangle', 'square'] as const)[authoredIndex % 4];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (Math.imul(hash, 31) + id.charCodeAt(i)) >>> 0;
  return (['circle', 'diamond', 'triangle', 'square'] as const)[hash % 4];
}

function sourcePort(level: PlatformLevel, requirement: PuzzleRequirement): PuzzleSignalContact | null {
  if ('mechanismId' in requirement) {
    const mechanism = level.mechanisms?.find(m => m.id === requirement.mechanismId);
    if (!mechanism) return null;
    const y = Math.max(mechanism.from.y, mechanism.to.y);
    return {
      id: `source:${mechanism.id}`, sourceId: mechanism.id, source: true, satisfied: false,
      glyph: glyph(level, mechanism.id), point: p(mechanism.from.x - mechanism.width / 2 - 22, y + 46),
      stem: p(mechanism.from.x - mechanism.width / 2 - 9, y + 10),
    };
  }
  const drawing = level.drawings.find(d => d.id === requirement.drawingId);
  if (!drawing?.path.length) return null;
  const start = drawing.path[0];
  return {
    id: `source:draw:${drawing.id}`, sourceId: `draw:${drawing.id}`, source: true, satisfied: false,
    glyph: 'stroke', point: p(start.x + 16, start.y + 46), stem: p(start.x + 16, start.y + 12),
  };
}

/** The signal is a fixed engraving on the frame; it does not follow the slider. */
function targetPoint(mechanism: PlatformMechanism, index: number, count: number): PlatformPoint {
  return p(mechanism.from.x + (index - (count - 1) / 2) * 24, Math.max(mechanism.from.y, mechanism.to.y) + 46);
}

/** Derive engraving and wiring from the same rails as manipulation. This helper
 * never changes simulation state. Only the nearest relevant circuit is expanded;
 * other visible frames keep their small local contacts, avoiding a web of wires.
 */
export function getPuzzleSignalLayout(level: PlatformLevel, world: GameWorld, options: LayoutOptions): PuzzleSignalLayout {
  const result: PuzzleSignalLayout = { contacts: [], connections: [], detents: [], sockets: [] };
  const left = options.cameraX - 35, right = options.cameraX + options.viewWidth + 35;
  const visible = (point: PlatformPoint) => point.x >= left && point.x <= right;
  const nearby = (point: PlatformPoint) => Math.abs(point.x - world.player.x) <= 760
    || !!options.pointer && distance(point, options.pointer) <= 90;
  const mechanisms = level.mechanisms ?? [];
  const sourceIds = new Set<string>();
  const circuits: { id: string; items: PuzzleRequirementState[]; points: PlatformPoint[]; focus: number }[] = [];
  const addSource = (contact: PuzzleSignalContact) => {
    if (!sourceIds.has(contact.id) && visible(contact.point) && nearby(contact.point)) {
      sourceIds.add(contact.id); result.contacts.push(contact);
    }
  };

  for (const mechanism of mechanisms) {
    const position = getMechanismPosition(world, mechanism), handle = getMechanismHandlePosition(world, mechanism);
    const offset = p(handle.x - position.x, handle.y - position.y);
    const dx = mechanism.to.x - mechanism.from.x, dy = mechanism.to.y - mechanism.from.y;
    const length = Math.hypot(dx, dy);
    if (length > .001) for (const detent of mechanism.detents ?? []) {
      if (!Number.isFinite(detent) || detent < 0 || detent > 1) continue;
      const point = p(mechanism.from.x + dx * detent + offset.x, mechanism.from.y + dy * detent + offset.y);
      if (visible(point) && nearby(point)) result.detents.push({
        mechanismId: mechanism.id, progress: detent, point, normal: p(-dy / length, dx / length),
      });
    }
    const interlock = getMechanismInterlock(world, level, mechanism);
    if (!interlock.items.length) continue;
    const points = interlock.items.map((_, index) => targetPoint(mechanism, index, interlock.items.length));
    for (let i = 0; i < interlock.items.length; i++) {
      const item = interlock.items[i], source = sourcePort(level, item.requirement);
      if (!source) continue;
      addSource(source);
      if (visible(points[i]) && nearby(points[i])) result.contacts.push({
        id: `contact:${mechanism.id}:${i}`, sourceId: source.sourceId, targetId: mechanism.id,
        point: points[i], glyph: source.glyph, satisfied: item.satisfied, source: false,
      });
    }
    if (!visible(handle) || !nearby(handle)) continue;
    const hovered = options.pointer && distance(options.pointer, handle) < 80;
    const heldDependency = interlock.items.some(item => 'mechanismId' in item.requirement
      && item.requirement.mechanismId === world.handInteraction?.id);
    const focus = hovered ? -3000 : world.handInteraction?.id === mechanism.id ? -2500
      : heldDependency ? -1800 : Math.abs(world.player.x - handle.x);
    circuits.push({ id: mechanism.id, items: interlock.items, points, focus });
  }

  const final = getGoalInterlock(world, level);
  if (final.items.length && visible(level.goal)) {
    const points = final.items.map((_, index) => p(level.goal.x + (index - (final.items.length - 1) / 2) * 24, level.goal.y + 46));
    for (let i = 0; i < final.items.length; i++) {
      const source = sourcePort(level, final.items[i].requirement);
      if (!source) continue;
      addSource(source);
      result.contacts.push({
        id: `contact:goal:${i}`, sourceId: source.sourceId, targetId: 'goal', point: points[i],
        glyph: source.glyph, satisfied: final.items[i].satisfied, source: false,
      });
    }
    if (nearby(level.goal)) circuits.push({ id: 'goal', items: final.items, points,
      focus: options.pointer && distance(options.pointer, level.goal) < 90 ? -3000 : Math.abs(world.player.x - level.goal.x) - 60 });
  }

  circuits.sort((a, b) => a.focus - b.focus);
  const focus = circuits[0];
  if (focus) for (let i = 0; i < focus.items.length; i++) {
    const item = focus.items[i], source = sourcePort(level, item.requirement), target = focus.points[i];
    if (!source || !visible(source.point) || !visible(target) || Math.abs(source.point.x - target.x) > 950) continue;
    // A paired socket is a clue engraved on this circuit's frame, not an
    // arbitrary hidden combination. Only the inspected circuit exposes it.
    // Regular ticks remain neutral and every action is still performed by hand.
    if ('mechanismId' in item.requirement) {
      const requirement = item.requirement;
      const mechanism = mechanisms.find(m => m.id === requirement.mechanismId)!;
      const min = requirement.min ?? 0, max = requirement.max ?? 1;
      const bounded = Number.isFinite(min) && Number.isFinite(max) && min >= 0 && max <= 1 && min <= max;
      const dx = mechanism.to.x - mechanism.from.x, dy = mechanism.to.y - mechanism.from.y;
      const length = Math.hypot(dx, dy);
      if (bounded && length > .001 && (min > 0 || max < 1)) {
        const progress = requirement.min === undefined ? 0 : requirement.max === undefined ? 1 : (min + max) / 2;
        const position = getMechanismPosition(world, mechanism), handle = getMechanismHandlePosition(world, mechanism);
        const offset = p(handle.x - position.x, handle.y - position.y);
        const railPoint = p(mechanism.from.x + dx * progress + offset.x,
          mechanism.from.y + dy * progress + offset.y);
        const normal = p(-dy / length, dx / length);
        // Gate panels are filled later. Put the engraved socket beside their
        // frame so the required contact remains readable before moving them.
        const spacing = mechanism.type === 'gate' ? mechanism.width / 2 + 18 : 18;
        const point = p(railPoint.x + normal.x * spacing, railPoint.y + normal.y * spacing);
        if (visible(point) && visible(railPoint)) result.sockets.push({
          sourceId: source.sourceId, targetId: focus.id, progress, glyph: source.glyph,
          point, railPoint, normal, satisfied: item.satisfied,
        });
      }
    }
    const laneY = Math.max(source.point.y, target.y) + 18 + i * 13;
    result.connections.push({
      sourceId: source.sourceId, targetId: focus.id, satisfied: item.satisfied,
      points: [source.point, p(source.point.x, laneY), p(target.x, laneY), target],
    });
  }
  return result;
}

function symbol(ctx: CanvasRenderingContext2D, point: PlatformPoint, shape: PuzzleSignalGlyph, size: number) {
  const { x, y } = point;
  ctx.beginPath();
  if (shape === 'circle') ctx.arc(x, y, size, 0, Math.PI * 2);
  else if (shape === 'diamond') {
    ctx.moveTo(x, y - size); ctx.lineTo(x + size, y); ctx.lineTo(x, y + size); ctx.lineTo(x - size, y); ctx.closePath();
  } else if (shape === 'triangle') {
    ctx.moveTo(x, y - size); ctx.lineTo(x + size * .92, y + size * .72); ctx.lineTo(x - size * .92, y + size * .72); ctx.closePath();
  } else if (shape === 'square') ctx.rect(x - size * .72, y - size * .72, size * 1.44, size * 1.44);
  else {
    ctx.moveTo(x - size * .8, y + size * .55);
    ctx.quadraticCurveTo(x - size * .3, y - size * 1.15, x + size * .8, y - size * .55);
    ctx.quadraticCurveTo(x + size * .3, y + size * 1.15, x - size * .8, y + size * .55);
    ctx.closePath();
  }
}

function roundedWire(ctx: CanvasRenderingContext2D, points: PlatformPoint[]) {
  ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1], corner = points[index], next = points[index + 1];
    const before = distance(previous, corner), after = distance(corner, next), radius = Math.min(8, before / 2, after / 2);
    const a = p(corner.x + (previous.x - corner.x) * radius / Math.max(.001, before), corner.y + (previous.y - corner.y) * radius / Math.max(.001, before));
    const b = p(corner.x + (next.x - corner.x) * radius / Math.max(.001, after), corner.y + (next.y - corner.y) * radius / Math.max(.001, after));
    ctx.lineTo(a.x, a.y); ctx.quadraticCurveTo(corner.x, corner.y, b.x, b.y);
  }
  const last = points[points.length - 1]; ctx.lineTo(last.x, last.y); ctx.stroke();
}

/** Call after translating into world coordinates, before machine frames. Thin
 * engraved circuits sit below the walkable contour; contacts, not motion or
 * percentages, reveal whether the player's current arrangement is connected.
 */
export function drawPuzzleSignals(ctx: CanvasRenderingContext2D, level: PlatformLevel, world: GameWorld, options: PuzzleSignalOptions): void {
  const layout = getPuzzleSignalLayout(level, world, options);
  if (!layout.contacts.length && !layout.detents.length && !layout.sockets.length) return;
  const scale = Math.max(.15, options.pixelScale ?? 1);
  const size = Math.max(5, Math.min(8, 4.5 / scale));
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
  for (const connection of layout.connections) {
    ctx.strokeStyle = connection.satisfied ? options.accent : options.ink;
    ctx.globalAlpha = connection.satisfied ? .43 : .21;
    ctx.lineWidth = Math.max(1.15, 1 / scale);
    roundedWire(ctx, connection.points);
  }
  for (const detent of layout.detents) {
    ctx.strokeStyle = options.ink; ctx.globalAlpha = .46; ctx.lineWidth = Math.max(1.2, .9 / scale);
    const { point, normal } = detent;
    // Every notch has the same visual weight: no built-in answer is highlighted.
    ctx.beginPath(); ctx.moveTo(point.x - normal.x * size, point.y - normal.y * size);
    ctx.lineTo(point.x + normal.x * size, point.y + normal.y * size); ctx.stroke();
  }
  for (const socket of layout.sockets) {
    ctx.strokeStyle = socket.satisfied ? options.accent : options.ink;
    ctx.globalAlpha = socket.satisfied ? .65 : .42;
    ctx.lineWidth = Math.max(1.25, .9 / scale);
    ctx.beginPath(); ctx.moveTo(socket.railPoint.x, socket.railPoint.y);
    ctx.lineTo(socket.point.x - socket.normal.x * size, socket.point.y - socket.normal.y * size); ctx.stroke();
    ctx.beginPath(); ctx.arc(socket.railPoint.x, socket.railPoint.y, 2.1, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = socket.satisfied ? .95 : .78;
    ctx.fillStyle = socket.satisfied ? options.accent : options.background;
    ctx.lineWidth = Math.max(1.5, 1.05 / scale);
    symbol(ctx, socket.point, socket.glyph, size); ctx.fill(); ctx.stroke();
  }
  for (const contact of layout.contacts) {
    if (contact.stem) {
      ctx.strokeStyle = options.ink; ctx.globalAlpha = .2; ctx.lineWidth = Math.max(1.1, .8 / scale);
      ctx.beginPath(); ctx.moveTo(contact.stem.x, contact.stem.y);
      ctx.quadraticCurveTo(contact.point.x, contact.stem.y + 15, contact.point.x, contact.point.y - size); ctx.stroke();
    }
    ctx.globalAlpha = contact.source ? .65 : contact.satisfied ? .95 : .6;
    ctx.lineWidth = Math.max(1.5, 1.05 / scale);
    ctx.strokeStyle = contact.satisfied ? options.accent : options.ink;
    ctx.fillStyle = contact.satisfied ? options.accent : options.background;
    symbol(ctx, contact.point, contact.glyph, size); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
