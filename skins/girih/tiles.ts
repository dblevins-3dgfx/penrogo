// Girih tile drawing, shared by the skin (static board) and its effects.
//
// Strapwork uses Hankin's method: from the midpoint of every edge, two lines
// run into the tile at STRAP_ANGLE, one toward each end of the edge, and
// stop where they meet the matching line from the next edge. Neighboring
// tiles share edges, so every line leaving a tile continues into the next
// one and the pattern joins up across the whole board. At 36° this works
// for every corner of both the kite and the dart; where the two lines would
// meet exactly on the next edge's midpoint, they become one straight strap.
import type { Point, Player, Owner } from '../types';
import { tracePolygon, centroidOf, mix, rgb } from '../canvas-utils';

const STRAP_ANGLE = (36 * Math.PI) / 180;

export const GROUT = '#6b3a1f';

// Glaze colors: [light, deep] for a soft gradient across each tile
const GLAZE = {
  0: [[250, 243, 227], [230, 214, 184]], // cream
  1: [[59, 110, 214], [23, 45, 120]], // cobalt
  2: [[214, 92, 58], [140, 38, 22]] // terracotta
};

export const STRAP = {
  empty: '#fffaf0',
  stone: '#fbbf24',
  outline: '#3b2415'
};

type Segment = [Point, Point];

// Strapwork segments for a tile, cached per tile (by its verts array)
const cache = new WeakMap<Point[], Segment[]>();

export const strapSegments = (verts: Point[]): Segment[] => {
  const hit = cache.get(verts);
  if (hit) return hit;
  const n = verts.length;
  // Orientation, so "into the tile" is the same turn for every edge
  const area = verts.reduce((s, p, i) => {
    const q = verts[(i + 1) % n];
    return s + p.x * q.y - q.x * p.y;
  }, 0);
  const sign = Math.sign(area) || 1;
  const rot = (v: Point, a: number) => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) });

  const segs: Segment[] = [];
  for (let i = 0; i < n; i++) {
    const a = verts[i], b = verts[(i + 1) % n], c = verts[(i + 2) % n];
    const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    // Both lines head toward the shared corner b, turned into the tile
    const d1 = rot({ x: b.x - a.x, y: b.y - a.y }, sign * STRAP_ANGLE);
    const d2 = rot({ x: b.x - c.x, y: b.y - c.y }, -sign * STRAP_ANGLE);
    const det = d1.x * d2.y - d1.y * d2.x;
    const t = det ? ((m2.x - m1.x) * d2.y - (m2.y - m1.y) * d2.x) / det : 0;
    const u = det ? ((m2.x - m1.x) * d1.y - (m2.y - m1.y) * d1.x) / det : 0;
    if (t > 1e-6 && u > 1e-6) {
      const X = { x: m1.x + d1.x * t, y: m1.y + d1.y * t };
      segs.push([m1, X], [m2, X]);
    } else {
      segs.push([m1, m2]);
    }
  }
  cache.set(verts, segs);
  return segs;
};

// Strapwork as a double line: a dark outline with a colored band inside
export const drawStraps = (ctx, verts: Point[], color: string, width = 2.4, alpha = 1) => {
  const segs = strapSegments(verts);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const [p, q] of segs) {
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
  }
  ctx.strokeStyle = STRAP.outline;
  ctx.lineWidth = width + 1.8;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
};

// A glazed tile: soft gradient, a glossy highlight, then its strapwork
export const drawGlazedTile = (ctx, verts: Point[], stone: Owner, territory: Owner = 0, alpha = 1) => {
  const [light, deep] = GLAZE[stone];
  const c = centroidOf(verts);
  const r = Math.max(...verts.map(p => Math.hypot(p.x - c.x, p.y - c.y)));
  ctx.save();
  ctx.globalAlpha = alpha;
  tracePolygon(ctx, verts);
  const g = ctx.createLinearGradient(c.x - r, c.y - r, c.x + r, c.y + r);
  g.addColorStop(0, rgb(light));
  g.addColorStop(1, rgb(deep));
  ctx.fillStyle = g;
  ctx.fill();
  if (!stone && territory) {
    ctx.fillStyle = territory === 1 ? 'rgba(37, 99, 235, 0.25)' : 'rgba(194, 65, 12, 0.25)';
    ctx.fill();
  }
  // Glaze gloss toward the upper left
  ctx.save();
  ctx.clip();
  const gloss = ctx.createRadialGradient(c.x - r * 0.35, c.y - r * 0.4, 0, c.x - r * 0.35, c.y - r * 0.4, r * 0.7);
  gloss.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
  gloss.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(c.x - r, c.y - r, 2 * r, 2 * r);
  ctx.restore();
  ctx.restore();

  drawStraps(ctx, verts, stone ? STRAP.stone : STRAP.empty, 2.4, alpha);

  // Grout between tiles
  ctx.save();
  ctx.globalAlpha = alpha;
  tracePolygon(ctx, verts);
  ctx.strokeStyle = GROUT;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
};

export const strapColorFor = (player: Player | 0) => (player ? STRAP.stone : STRAP.empty);

// Used by effects: a gold glow along a tile's strapwork, `strength` 0..1
export const drawStrapGlow = (ctx, verts: Point[], strength: number) => {
  const segs = strapSegments(verts);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [p, q] of segs) {
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
  }
  ctx.shadowColor = '#fde047';
  ctx.shadowBlur = 10 * strength;
  ctx.strokeStyle = rgb(mix([253, 224, 71], [255, 255, 255], 0.3), strength);
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.restore();
};
