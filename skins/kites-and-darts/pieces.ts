// How kites and darts are drawn, shared by the skin (static board) and its
// effects (animation overlay).
//
// Tiles arrive as corner points only, so the kind is read from the shape:
// a kite's axis (vertex 0 to 2) is a long edge (60 px), a dart's is short
// (about 37 px). Vertex order: kite [O tail, B, C nose, D]; dart [M point,
// N, A' notch, N'].
import type { Point, Player } from '../types';
import { tracePolygon, centroidOf, mix, rgb } from '../canvas-utils';

export const isKite = (v: Point[]) => Math.hypot(v[2].x - v[0].x, v[2].y - v[0].y) > 48;

export const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// Light from the upper left (unit vector toward the light)
export const LIGHT = { x: -0.6, y: -0.8 };

export const SILK = {
  1: { light: [147, 197, 253], base: [37, 99, 235], dark: [30, 58, 138] },
  2: { light: [252, 165, 165], base: [220, 38, 38], dark: [127, 29, 29] }
};

// Tinted steel: slate gray pulled toward the player's color
export const SLATE = [148, 163, 184];
export const METAL = {
  1: { tint: mix(SLATE, [59, 130, 246], 0.45), dark: [30, 41, 82] },
  2: { tint: mix(SLATE, [220, 38, 38], 0.72), dark: [92, 14, 14] }
};

export const fillPolygon = (ctx, pts: Point[], style) => {
  tracePolygon(ctx, pts);
  ctx.fillStyle = style;
  ctx.fill();
};

// Parallel lines across the clip region, for weave and brushing textures
export const hatch = (ctx, c: Point, r: number, dir: Point, spacing: number, style: string) => {
  const nx = -dir.y, ny = dir.x;
  ctx.strokeStyle = style;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let d = -r; d <= r; d += spacing) {
    ctx.moveTo(c.x + nx * d - dir.x * r, c.y + ny * d - dir.y * r);
    ctx.lineTo(c.x + nx * d + dir.x * r, c.y + ny * d + dir.y * r);
  }
  ctx.stroke();
};

// A silk kite: four panels split by the spars, two-tone (nose panels
// lighter), with sheen, weave, stitching and wooden spars.
export const drawSilkKite = (ctx, v: Point[], player: Player, alpha = 1) => {
  const silk = SILK[player];
  const m = lerp(v[1], v[3], 0.5); // where the spars cross
  const c = centroidOf(v);
  const r = Math.max(...v.map(p => Math.hypot(p.x - c.x, p.y - c.y)));
  ctx.save();
  ctx.globalAlpha = alpha;

  fillPolygon(ctx, [v[1], v[2], m], rgb(mix(silk.base, silk.light, 0.45)));
  fillPolygon(ctx, [v[2], v[3], m], rgb(mix(silk.base, silk.light, 0.25)));
  fillPolygon(ctx, [v[0], v[1], m], rgb(silk.base));
  fillPolygon(ctx, [v[3], v[0], m], rgb(mix(silk.base, silk.dark, 0.3)));

  ctx.save();
  tracePolygon(ctx, v);
  ctx.clip();
  // Sheen across the kite, perpendicular to its axis
  const ax = { x: v[2].x - v[0].x, y: v[2].y - v[0].y };
  const alen = Math.hypot(ax.x, ax.y);
  const across = { x: -ax.y / alen, y: ax.x / alen };
  const sheen = ctx.createLinearGradient(c.x - across.x * r, c.y - across.y * r, c.x + across.x * r, c.y + across.y * r);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0)');
  sheen.addColorStop(0.38, 'rgba(255, 255, 255, 0.28)');
  sheen.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(c.x - r, c.y - r, 2 * r, 2 * r);
  // Weave
  hatch(ctx, c, r, { x: Math.SQRT1_2, y: Math.SQRT1_2 }, 3.5, 'rgba(255, 255, 255, 0.07)');
  hatch(ctx, c, r, { x: Math.SQRT1_2, y: -Math.SQRT1_2 }, 3.5, 'rgba(0, 0, 0, 0.06)');
  ctx.restore();

  // Stitching just inside the edge
  ctx.save();
  tracePolygon(ctx, v.map(p => lerp(c, p, 0.88)));
  ctx.setLineDash([2, 2]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();

  // Wooden spars: spine along the axis and the crossbar
  ctx.lineCap = 'round';
  for (const [a, b] of [[v[0], v[2]], [v[1], v[3]]]) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(253, 230, 138, 0.6)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  tracePolygon(ctx, v);
  ctx.strokeStyle = rgb(silk.dark);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
};

// A metal arrowhead: two halves meeting at a raised ridge, each brushed
// metal shaded by how it faces the light, with a glint and a rivet.
export const drawMetalDart = (ctx, v: Point[], player: Player, alpha = 1) => {
  const metal = METAL[player];
  const c = centroidOf(v);
  const r = Math.max(...v.map(p => Math.hypot(p.x - c.x, p.y - c.y)));
  const mid = lerp(v[0], v[2], 0.5);
  const ax = { x: v[0].x - v[2].x, y: v[0].y - v[2].y };
  const alen = Math.hypot(ax.x, ax.y);
  const dir = { x: ax.x / alen, y: ax.y / alen };
  ctx.save();
  ctx.globalAlpha = alpha;

  for (const [half, side] of [[[v[0], v[1], v[2]], v[1]], [[v[0], v[2], v[3]], v[3]]] as [Point[], Point][]) {
    const out = { x: side.x - mid.x, y: side.y - mid.y };
    const olen = Math.hypot(out.x, out.y);
    const facing = ((out.x / olen) * LIGHT.x + (out.y / olen) * LIGHT.y + 1) / 2; // 0..1
    const hi = mix(metal.tint, [255, 255, 255], 0.35 + 0.45 * facing);
    const lo = mix(metal.tint, metal.dark, 0.55 - 0.35 * facing);
    const g = ctx.createLinearGradient(mid.x, mid.y, side.x, side.y);
    g.addColorStop(0, rgb(hi));
    g.addColorStop(0.35, rgb(metal.tint));
    g.addColorStop(0.7, rgb(lo));
    g.addColorStop(1, rgb(mix(lo, hi, 0.4)));
    fillPolygon(ctx, half, g);

    // Brushing along the axis
    ctx.save();
    tracePolygon(ctx, half);
    ctx.clip();
    hatch(ctx, c, r, dir, 1.6, facing > 0.5 ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)');
    ctx.restore();
  }

  // Raised ridge
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(v[0].x, v[0].y);
  ctx.lineTo(v[2].x, v[2].y);
  ctx.strokeStyle = rgb(metal.dark, 0.7);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 0.7;
  ctx.stroke();

  // Glint near the point
  const gp = lerp(v[0], c, 0.35);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.ellipse(gp.x, gp.y, 3, 1, Math.atan2(dir.y, dir.x), 0, Math.PI * 2);
  ctx.fill();

  // Rivet near the notch
  const rp = lerp(v[2], v[0], 0.28);
  ctx.fillStyle = rgb(metal.dark);
  ctx.beginPath();
  ctx.arc(rp.x, rp.y, 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.beginPath();
  ctx.arc(rp.x - 0.5, rp.y - 0.6, 0.8, 0, Math.PI * 2);
  ctx.fill();

  tracePolygon(ctx, v);
  ctx.strokeStyle = rgb(metal.dark);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
};

export const drawPiece = (ctx, v: Point[], player: Player, alpha = 1) =>
  isKite(v) ? drawSilkKite(ctx, v, player, alpha) : drawMetalDart(ctx, v, player, alpha);

// The last-move marker: a white outline, plus a tail. Kites trail a ribbon
// with two bows from their tail (O); darts become arrowheads, with a shaft
// and fletching behind the notch (A'). With `t` (seconds) the ribbon or
// fletching flutters; without it they are drawn still.
export const drawLastMoveMarker = (ctx, verts: Point[], t: number | null = null) => {
  ctx.save();
  tracePolygon(ctx, verts);
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 10;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();

  if (isKite(verts)) drawRibbon(ctx, verts, t);
  else drawFletching(ctx, verts, t);
};

// Unit vector from the piece's center out through its tail vertex, and
// its perpendicular
const tailFrame = (verts: Point[], tail: Point) => {
  const c = centroidOf(verts);
  const d = { x: tail.x - c.x, y: tail.y - c.y };
  const len = Math.hypot(d.x, d.y) || 1;
  const u = { x: d.x / len, y: d.y / len };
  return { u, n: { x: -u.y, y: u.x } };
};

const drawRibbon = (ctx, verts: Point[], t: number | null) => {
  const tail = verts[0];
  const { u, n } = tailFrame(verts, tail);
  // Wave offset at step i (0..14): travels down the ribbon over time and
  // grows toward the free end
  const waveAt = (i: number) => t === null
    ? Math.sin(i * 0.9) * 4
    : Math.sin(i * 0.9 - t * 7) * (1.5 + 3.5 * (i / 14));
  const pointAt = (i: number) => {
    const s = (i / 14) * 30;
    const wave = waveAt(i);
    return { x: tail.x + u.x * s + n.x * wave, y: tail.y + u.y * s + n.y * wave };
  };
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= 14; i++) {
    const p = pointAt(i);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.stroke();
  // Bows along the ribbon
  ctx.fillStyle = '#fbbf24';
  for (const i of [14 / 3, 28 / 3]) {
    const b = pointAt(i);
    for (const sign of [1, -1]) {
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + n.x * 4 * sign - u.x * 2, b.y + n.y * 4 * sign - u.y * 2);
      ctx.lineTo(b.x + n.x * 4 * sign + u.x * 2, b.y + n.y * 4 * sign + u.y * 2);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
};

// Arrow fletching: the dart becomes the head of an arrow. A short wooden
// shaft runs back from the notch to a nock, with two swept-back vanes (one
// each side) near its end and the third, "cock" feather seen edge-on as a
// gold stripe along the shaft.
const SHAFT_LENGTH = 36;
const VANE_FRONT = 15; // where the vanes start, measured from the notch
const VANE_BACK = 33; // where they end (squared-off back edge)
const VANE_HEIGHT = 8.5;

const drawFletching = (ctx, verts: Point[], t: number | null) => {
  const notch = verts[2];
  const { u } = tailFrame(verts, notch);
  const sway = t === null ? 0 : Math.sin(t * 5) * 0.035;
  const a = Math.atan2(u.y, u.x) + sway;
  const f = { x: Math.cos(a), y: Math.sin(a) }; // back along the shaft
  const n = { x: -f.y, y: f.x };
  const at = (along: number, across: number) => ({
    x: notch.x + f.x * along + n.x * across,
    y: notch.y + f.y * along + n.y * across
  });
  ctx.save();
  ctx.lineCap = 'round';

  // Vanes: low at the front, rising to full height, then a straight back
  // edge down to the shaft. The trailing edge ripples when fluttering.
  for (const side of [1, -1]) {
    const ripple = (k: number) => (t === null ? 0 : Math.sin(t * 11 + k * 3 + (side > 0 ? 0 : 1.7)) * 0.9);
    const h = (along: number, k: number) => side * (VANE_HEIGHT + ripple(k)) * Math.pow((along - VANE_FRONT) / (VANE_BACK - VANE_FRONT), 0.8);
    ctx.beginPath();
    const p0 = at(VANE_FRONT, 0);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i <= 8; i++) {
      const along = VANE_FRONT + ((VANE_BACK - VANE_FRONT) * i) / 8;
      const p = at(along, h(along, i / 8));
      ctx.lineTo(p.x, p.y);
    }
    const back = at(VANE_BACK, 0);
    ctx.lineTo(back.x, back.y);
    ctx.closePath();
    const g = ctx.createLinearGradient(p0.x, p0.y, back.x, back.y);
    g.addColorStop(0, '#fef3c7');
    g.addColorStop(1, '#f59e0b');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // Barbs slanting back from the shaft
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(146, 64, 14, 0.45)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let along = VANE_FRONT + 1.5; along < VANE_BACK + 2; along += 1.8) {
      const q = at(along, 0);
      const e = at(along + 3, side * VANE_HEIGHT * 1.3);
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(e.x, e.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Shaft from the notch to the nock
  const end = at(SHAFT_LENGTH, 0);
  ctx.beginPath();
  ctx.moveTo(notch.x, notch.y);
  ctx.lineTo(end.x, end.y);
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(253, 230, 138, 0.55)';
  ctx.lineWidth = 0.6;
  ctx.stroke();

  // Cock feather, edge-on along the shaft
  const c0 = at(VANE_FRONT + 1, 0), c1 = at(VANE_BACK, 0);
  ctx.beginPath();
  ctx.moveTo(c0.x, c0.y);
  ctx.lineTo(c1.x, c1.y);
  ctx.strokeStyle = '#b91c1c';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Nock: a small dark V at the end
  const nl = at(SHAFT_LENGTH + 2.5, 1.6), nr = at(SHAFT_LENGTH + 2.5, -1.6);
  ctx.beginPath();
  ctx.moveTo(nl.x, nl.y);
  ctx.lineTo(end.x, end.y);
  ctx.lineTo(nr.x, nr.y);
  ctx.strokeStyle = '#44403c';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
};
