// Blueprint drafting, shared by the skin (static board) and its effects.
// Stones are outlined and hatched: Player 1 in white with diagonal
// hatching, Player 2 in red-line pencil with cross-hatching, so the two
// differ by pattern as well as color. Empty tiles are thin construction
// lines, keeping the geometry crisp.
import type { Point, Player, Owner } from '../types';
import { tracePolygon, centroidOf } from '../canvas-utils';

export const INK = {
  1: 'rgba(255, 255, 255, 0.95)',
  2: 'rgba(252, 165, 165, 0.95)' // red-line pencil
};

const LINE = 'rgba(224, 242, 254, 0.55)';
const HATCH_INSET = 0.9;
export const HATCH_SPACING = 5;

// Blueprint paper: deep blue with a fine grid and heavier major lines
export const drawPaper = (ctx, w: number, h: number) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, Math.hypot(w, h) / 2);
  g.addColorStop(0, '#1d4ed8');
  g.addColorStop(1, '#1e3a8a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.beginPath();
  for (let x = 0; x <= w; x += 10) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
  for (let y = 0; y <= h; y += 10) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)';
  ctx.beginPath();
  for (let x = 0; x <= w; x += 50) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
  for (let y = 0; y <= h; y += 50) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
  ctx.stroke();
};

// An empty tile: a thin construction line; territory is stippled
export const drawEmptyTile = (ctx, verts: Point[], territory: Owner = 0) => {
  if (territory) {
    ctx.save();
    tracePolygon(ctx, verts);
    ctx.clip();
    const c = centroidOf(verts);
    ctx.fillStyle = INK[territory];
    for (let y = c.y - 40; y < c.y + 40; y += 6) {
      for (let x = c.x - 40 + ((y / 6) % 2) * 3; x < c.x + 40; x += 6) {
        ctx.fillRect(x, y, 1.2, 1.2);
      }
    }
    ctx.restore();
  }
  tracePolygon(ctx, verts);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 0.8;
  ctx.stroke();
};

// Hatch line offsets for a tile, in drawing order across the tile
const hatchLines = (verts: Point[], angle: number) => {
  const c = centroidOf(verts);
  const r = Math.max(...verts.map(p => Math.hypot(p.x - c.x, p.y - c.y)));
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  const nrm = { x: -dir.y, y: dir.x };
  const lines: [Point, Point][] = [];
  for (let d = -r; d <= r; d += HATCH_SPACING) {
    const o = { x: c.x + nrm.x * d, y: c.y + nrm.y * d };
    lines.push([{ x: o.x - dir.x * r, y: o.y - dir.y * r }, { x: o.x + dir.x * r, y: o.y + dir.y * r }]);
  }
  return lines;
};

const hatchAngles = (player: Player) => (player === 1 ? [Math.PI / 4] : [Math.PI / 4, -Math.PI / 4]);

// Hatching; `fraction` 0..1 of the lines are drawn (sweeping across the
// tile), or from the far side when `fromEnd` (for erasing)
export const drawHatch = (ctx, verts: Point[], player: Player, fraction = 1, fromEnd = false) => {
  if (fraction <= 0) return;
  const c = centroidOf(verts);
  const inset = verts.map(p => ({ x: c.x + (p.x - c.x) * HATCH_INSET, y: c.y + (p.y - c.y) * HATCH_INSET }));
  ctx.save();
  tracePolygon(ctx, inset);
  ctx.clip();
  ctx.strokeStyle = INK[player];
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (const angle of hatchAngles(player)) {
    const lines = hatchLines(verts, angle);
    const n = Math.round(lines.length * Math.min(1, fraction));
    const chosen = fromEnd ? lines.slice(lines.length - n) : lines.slice(0, n);
    for (const [p, q] of chosen) {
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
    }
  }
  ctx.stroke();
  ctx.restore();
};

// The stone's outline; `fraction` 0..1 of the perimeter is traced
export const drawOutline = (ctx, verts: Point[], player: Player, fraction = 1) => {
  if (fraction <= 0) return;
  const n = verts.length;
  const lens = verts.map((p, i) => Math.hypot(verts[(i + 1) % n].x - p.x, verts[(i + 1) % n].y - p.y));
  let left = lens.reduce((a, b) => a + b, 0) * Math.min(1, fraction);
  ctx.save();
  ctx.strokeStyle = INK[player];
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(verts[0].x, verts[0].y);
  for (let i = 0; i < n && left > 0; i++) {
    const a = verts[i], b = verts[(i + 1) % n];
    const t = Math.min(1, left / lens[i]);
    ctx.lineTo(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
    left -= lens[i];
  }
  if (fraction >= 1) ctx.closePath();
  ctx.stroke();
  ctx.restore();
};

export const drawStone = (ctx, verts: Point[], player: Player) => {
  drawHatch(ctx, verts, player);
  drawOutline(ctx, verts, player);
};

// Draws the empty look over a tile (paper clipped to it plus its
// construction line), so effects can make a drawn stone appear unfinished
export const coverWithEmpty = (ctx, verts: Point[], w: number, h: number) => {
  ctx.save();
  tracePolygon(ctx, verts);
  ctx.clip();
  drawPaper(ctx, w, h);
  ctx.restore();
  drawEmptyTile(ctx, verts);
};

// Dimension markings for the last move: a measured line along its first
// long edge, and the 72° angle at its tip (vertex 0 of kite and dart)
export const drawDimensions = (ctx, verts: Point[]) => {
  const c = centroidOf(verts);
  const a = verts[0], b = verts[1]; // a long edge for both kite and dart
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  let n = { x: -u.y, y: u.x };
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (n.x * (mid.x - c.x) + n.y * (mid.y - c.y) < 0) n = { x: -n.x, y: -n.y };
  const off = 11;
  const a2 = { x: a.x + n.x * off, y: a.y + n.y * off };
  const b2 = { x: b.x + n.x * off, y: b.y + n.y * off };

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  // Extension lines
  ctx.moveTo(a.x + n.x * 2, a.y + n.y * 2); ctx.lineTo(a.x + n.x * (off + 3), a.y + n.y * (off + 3));
  ctx.moveTo(b.x + n.x * 2, b.y + n.y * 2); ctx.lineTo(b.x + n.x * (off + 3), b.y + n.y * (off + 3));
  // Dimension line
  ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y);
  ctx.stroke();
  // Arrowheads
  for (const [p, s] of [[a2, 1], [b2, -1]] as [Point, number][]) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + u.x * 5 * s + n.x * 2, p.y + u.y * 5 * s + n.y * 2);
    ctx.lineTo(p.x + u.x * 5 * s - n.x * 2, p.y + u.y * 5 * s - n.y * 2);
    ctx.closePath();
    ctx.fill();
  }
  // Length label, reading along the edge (kept upright)
  let ang = Math.atan2(u.y, u.x);
  if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
  const lp = { x: (a2.x + b2.x) / 2 + n.x * 6, y: (a2.y + b2.y) / 2 + n.y * 6 };
  ctx.translate(lp.x, lp.y);
  ctx.rotate(ang);
  ctx.font = 'bold 9px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(len.toFixed(1), 0, 0);
  ctx.restore();

  // Angle arc and label at the tip
  const d = verts[verts.length - 1];
  const a1 = Math.atan2(b.y - a.y, b.x - a.x);
  const a0 = Math.atan2(d.y - a.y, d.x - a.x);
  let start = a0, sweep = a1 - a0;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;
  if (sweep < 0) { start = a1; sweep = -sweep; }
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(a.x, a.y, 12, start, start + sweep);
  ctx.stroke();
  const mida = start + sweep / 2;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.font = 'bold 8px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('72°', a.x + Math.cos(mida) * 21, a.y + Math.sin(mida) * 21);
  ctx.restore();
};
