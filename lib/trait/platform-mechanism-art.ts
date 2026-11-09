import type { MechanismView } from './platform-mechanisms';
import type { PlatformPoint } from './platformer';

type Palette = { background: string; ink: string; accent: string };
const TAU = Math.PI * 2;
const STROKE = 3.8;
const point = (x: number, y: number): PlatformPoint => ({ x, y });

function segment(ctx: CanvasRenderingContext2D, a: PlatformPoint, b: PlatformPoint) {
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}

/** The round home stop and double arrival stop remain attached to the world. */
function rail(ctx: CanvasRenderingContext2D, a: PlatformPoint, b: PlatformPoint) {
  const length = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
  const ux = (b.x - a.x) / length, uy = (b.y - a.y) / length;
  segment(ctx, a, b);
  ctx.beginPath(); ctx.arc(a.x, a.y, 3, 0, TAU); ctx.stroke();
  for (const distance of [0, 4]) {
    const x = b.x + ux * distance, y = b.y + uy * distance;
    segment(ctx, point(x - uy * 7, y + ux * 7), point(x + uy * 7, y - ux * 7));
  }
}

function wheel(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, angle: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-radius * .62, 0); ctx.lineTo(radius * .62, 0);
  ctx.moveTo(0, -radius * .62); ctx.lineTo(0, radius * .62); ctx.stroke();
  ctx.restore();
}

function slidingBridge(view: MechanismView) {
  const m = view.mechanism;
  return m.type === 'platform' && Math.abs(m.to.y - m.from.y) < .5
    && m.width > Math.abs(m.to.x - m.from.x) * 1.8;
}

/** Fixed rigging is separate from the travelling object. Its geometry comes
 * from rail endpoints only; moving parts use the collision position, never
 * a second easing curve or an ornamental oscillation.
 */
export function drawMechanismTrack(ctx: CanvasRenderingContext2D, view: MechanismView, palette: Palette) {
  const { mechanism: m, handle, position, held } = view;
  const dx = m.to.x - m.from.x, dy = m.to.y - m.from.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / length, uy = dy / length, half = m.width / 2;
  ctx.save(); ctx.strokeStyle = palette.ink; ctx.fillStyle = palette.background;
  ctx.lineWidth = 1.6; ctx.globalAlpha = held ? .58 : .34;
  if (m.type === 'platform') {
    if (slidingBridge(view)) {
      // A receiving socket on each real bank, rather than another false floor
      // drawn across the empty gap. The long deck slides through these rollers.
      const home = m.from.x - 12, dock = m.to.x + half - 10;
      for (const x of [home, dock]) {
        ctx.beginPath(); ctx.moveTo(x - 12, m.from.y + 12);
        ctx.lineTo(x - 12, m.from.y + 29); ctx.lineTo(x + 12, m.from.y + 29);
        ctx.lineTo(x + 12, m.from.y + 12); ctx.stroke();
      }
      rail(ctx, point(m.from.x - half, m.from.y + 23), point(m.from.x - 24, m.from.y + 23));
      segment(ctx, point(dock + 13, m.to.y + 6), point(dock + 13, m.to.y + 30));
    } else if (Math.abs(dx) < .5) {
      const high = Math.min(m.from.y, m.to.y), low = Math.max(m.from.y, m.to.y);
      for (const side of [-1, 1]) rail(ctx,
        point(m.from.x + side * (half + 10), low + 12),
        point(m.from.x + side * (half + 10), high - 13));
      const pulleyX = m.from.x + half + 18;
      segment(ctx, point(pulleyX - 15, high - 33), point(pulleyX + 16, high - 33));
      segment(ctx, point(pulleyX, high - 33), point(pulleyX, high - 21));
    } else {
      // A horizontal trolley or an inclined bogie rides a fixed track below
      // the walkable top. Its thin track cannot be mistaken for the white deck.
      const reach = Math.abs(dy) < .5 ? half * .58 + 11 : 32;
      const a = point(m.from.x - ux * reach, m.from.y + 26 - uy * reach);
      const b = point(m.to.x + ux * reach, m.to.y + 26 + uy * reach);
      rail(ctx, a, b);
      if (Math.abs(dy) >= .5) segment(ctx,
        point(a.x - uy * 6, a.y + ux * 6), point(b.x - uy * 6, b.y + ux * 6));
    }
  } else if (m.type === 'gate') {
    for (const side of [-1, 1]) rail(ctx,
      point(m.from.x + side * (half + 9), m.from.y - m.height / 2),
      point(m.to.x + side * (half + 9), m.to.y - m.height / 2));
    if (m.appearance === 'press') {
      const support = Math.min(m.from.y, m.to.y) - m.height - 22;
      segment(ctx, point(m.from.x - half - 10, support), point(m.from.x + half + 10, support));
      for (const x of [m.from.x - half + 2, m.from.x + half - 2]) {
        segment(ctx, point(x - 3, support - 5), point(x + 3, support + 1));
      }
    }
  } else {
    rail(ctx, m.from, m.to);
    segment(ctx, point(m.to.x - 16, m.to.y - 7), point(m.to.x + 16, m.to.y - 7));
  }
  if (held) {
    const offset = point(handle.x - position.x, handle.y - position.y);
    ctx.strokeStyle = palette.accent; ctx.globalAlpha = .55; ctx.setLineDash([2, 7]);
    segment(ctx, point(m.from.x + offset.x, m.from.y + offset.y), point(m.to.x + offset.x, m.to.y + offset.y));
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/** All wheel angles, counterweights and piston lengths are derived from actual
 * hand travel. Letting go freezes the entire assembly immediately.
 */
export function drawMechanismBody(ctx: CanvasRenderingContext2D, view: MechanismView, palette: Palette, seated = false) {
  const { mechanism: m, position: p } = view;
  const half = m.width / 2, dx = m.to.x - m.from.x, dy = m.to.y - m.from.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const travel = Math.hypot(p.x - m.from.x, p.y - m.from.y);
  ctx.save(); ctx.strokeStyle = palette.ink; ctx.fillStyle = palette.background; ctx.lineWidth = 1.8;
  if (m.type === 'platform') {
    ctx.globalAlpha = .78;
    // The real top is drawn with world surfaces, preserving the figure's
    // uninterrupted contour. Only the undercarriage belongs in this pass.
    ctx.beginPath(); ctx.moveTo(p.x - half, p.y + 3); ctx.lineTo(p.x - half + 9, p.y + 10);
    ctx.lineTo(p.x + half - 9, p.y + 10); ctx.lineTo(p.x + half, p.y + 3); ctx.stroke();
    if (slidingBridge(view)) {
      const home = m.from.x - 12, dock = m.to.x + half - 10;
      wheel(ctx, home, p.y + 17, 6, travel / 6);
      wheel(ctx, dock, p.y + 17, 6, Math.max(0, p.x + half - dock) / 6);
      ctx.globalAlpha = .42; ctx.beginPath();
      for (let x = p.x - half + 22; x < p.x + half - 14; x += 28) {
        ctx.moveTo(x, p.y + 10); ctx.lineTo(x, p.y + 13);
      }
      ctx.stroke();
    } else if (Math.abs(dx) < .5) {
      const high = Math.min(m.from.y, m.to.y), low = Math.max(m.from.y, m.to.y);
      for (const side of [-1, 1]) {
        segment(ctx, point(p.x + side * (half - 3), p.y + 6), point(p.x + side * (half + 10), p.y + 6));
        wheel(ctx, p.x + side * (half + 10), p.y + 6, 5, side * (p.y - m.from.y) / 5);
      }
      const pulleyX = m.from.x + half + 18, pulleyY = high - 21;
      const weightY = high + low - p.y - 16;
      ctx.globalAlpha = .5; ctx.lineWidth = 1.5;
      segment(ctx, point(pulleyX - 9, pulleyY), point(pulleyX - 9, p.y + 6));
      segment(ctx, point(pulleyX + 9, pulleyY), point(pulleyX + 9, weightY));
      wheel(ctx, pulleyX, pulleyY, 9, (p.y - m.from.y) / 9);
      ctx.beginPath(); ctx.rect(pulleyX + 3, weightY, 12, 22); ctx.fill(); ctx.stroke();
      segment(ctx, point(pulleyX + 5, weightY + 7), point(pulleyX + 13, weightY + 7));
    } else {
      const horizontal = Math.abs(dy) < .5, ux = dx / length, uy = dy / length;
      const spacing = horizontal ? half * .58 : 22;
      for (const side of [-1, 1]) {
        const wx = p.x + side * ux * spacing + uy * 8, wy = p.y + 26 + side * uy * spacing - ux * 8;
        segment(ctx, point(p.x + side * Math.min(35, half * .55), p.y + 10), point(wx, wy));
        wheel(ctx, wx, wy, 8, travel / 8);
      }
    }
  } else if (m.type === 'gate') {
    const top = p.y - m.height;
    if (m.appearance === 'press') {
      const support = Math.min(m.from.y, m.to.y) - m.height - 22;
      ctx.globalAlpha = .55;
      for (const offset of [-5, 5]) segment(ctx, point(m.from.x + offset, support), point(p.x + offset, top));
      segment(ctx, point(p.x - 10, top - 8), point(p.x + 10, top - 8));
    } else {
      ctx.globalAlpha = .65;
      for (const side of [-1, 1]) {
        segment(ctx, point(p.x + side * half, p.y - m.height / 2), point(p.x + side * (half + 9), p.y - m.height / 2));
        wheel(ctx, p.x + side * (half + 9), p.y - m.height / 2, 5, travel / 5);
      }
    }
    ctx.globalAlpha = 1; ctx.lineWidth = STROKE;
    ctx.beginPath(); ctx.moveTo(p.x - half, p.y); ctx.lineTo(p.x - half, top);
    ctx.lineTo(p.x + half, top); ctx.lineTo(p.x + half, p.y);
    if (!seated) ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = .5; ctx.lineWidth = 1.6;
    if (m.appearance === 'press') {
      ctx.beginPath();
      for (let x = p.x - half + 7; x < p.x + half - 3; x += 13) {
        ctx.moveTo(x, top + 5); ctx.lineTo(x + 6, top + 12);
      }
      ctx.stroke();
      segment(ctx, point(p.x - half + 5, p.y - 9), point(p.x + half - 5, p.y - 9));
    } else if (Math.abs(dx) > .5) {
      // The oblique shutter reads as one sliding panel, not another press.
      for (let y = top + 26; y < p.y - 15; y += 28) {
        segment(ctx, point(p.x - half + 9, y), point(p.x + half - 9, y));
      }
    }
  } else {
    ctx.globalAlpha = .6;
    segment(ctx, point(view.handle.x, view.handle.y + 10), point(p.x, p.y - half + 3));
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}
