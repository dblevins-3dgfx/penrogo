// Kites & Darts: the pieces as their namesakes, flying in a pale sky.
// Kites are silk, stretched on wooden spars; darts are brushed-metal
// arrowheads. Empty tiles are only faint kite-string lines.
//
// Tiles arrive as corner points only, so the kind is read from the shape:
// a kite's axis (vertex 0 to 2) is a long edge (60 px), a dart's is short
// (about 37 px). Vertex order: kite [O tail, B, C nose, D]; dart [M point,
// N, A' notch, N'].
import type { Skin, Point, Player } from '../types';
import { tracePolygon, centroidOf, drawIllegalOutline, mix, rgb } from '../canvas-utils';

const isKite = (v: Point[]) => Math.hypot(v[2].x - v[0].x, v[2].y - v[0].y) > 48;

const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// Light from the upper left (unit vector toward the light)
const LIGHT = { x: -0.6, y: -0.8 };

const SILK = {
  1: { light: [147, 197, 253], base: [37, 99, 235], dark: [30, 58, 138] },
  2: { light: [252, 165, 165], base: [220, 38, 38], dark: [127, 29, 29] }
};

// Tinted steel: slate gray pulled toward the player's color
const SLATE = [148, 163, 184];
const METAL = {
  1: { tint: mix(SLATE, [59, 130, 246], 0.45), dark: [30, 41, 82] },
  2: { tint: mix(SLATE, [239, 68, 68], 0.45), dark: [82, 24, 24] }
};

const fillPolygon = (ctx, pts: Point[], style) => {
  tracePolygon(ctx, pts);
  ctx.fillStyle = style;
  ctx.fill();
};

// Parallel lines across the clip region, for weave and brushing textures
const hatch = (ctx, c: Point, r: number, dir: Point, spacing: number, style: string) => {
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
const drawSilkKite = (ctx, v: Point[], player: Player, alpha = 1) => {
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
const drawMetalDart = (ctx, v: Point[], player: Player, alpha = 1) => {
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

const drawPiece = (ctx, v: Point[], player: Player, alpha = 1) =>
  isKite(v) ? drawSilkKite(ctx, v, player, alpha) : drawMetalDart(ctx, v, player, alpha);

// Fixed clouds (seeded), so they don't move between redraws
const CLOUDS = (() => {
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 7 }, () => ({
    x: rand() * 800, y: 40 + rand() * 520, s: 0.7 + rand() * 0.9,
    puffs: Array.from({ length: 5 }, () => ({ dx: (rand() - 0.5) * 90, dy: (rand() - 0.5) * 18, r: 16 + rand() * 18 }))
  }));
})();

const kitesAndDarts: Skin = {
  id: 'kites-and-darts',
  name: 'Kites & Darts',
  order: 2,
  chrome: {
    page: 'bg-gradient-to-b from-sky-800 via-sky-600 to-sky-400',
    panel: 'bg-sky-950/50 ring-1 ring-white/25',
    title: 'text-white drop-shadow',
    canvas: 'bg-sky-200 ring-1 ring-white/40'
  },

  drawBackground(ctx, w, h) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#7dd3fc');
    sky.addColorStop(1, '#e0f2fe');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const sun = ctx.createRadialGradient(w * 0.85, h * 0.12, 5, w * 0.85, h * 0.12, 220);
    sun.addColorStop(0, 'rgba(255, 251, 235, 0.9)');
    sun.addColorStop(1, 'rgba(255, 251, 235, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
    for (const cl of CLOUDS) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      for (const p of cl.puffs) {
        ctx.beginPath();
        ctx.ellipse(cl.x + p.dx * cl.s, cl.y + p.dy * cl.s, p.r * cl.s * 1.4, p.r * cl.s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  drawTile(ctx, verts, { stone, territory }) {
    if (stone) {
      drawPiece(ctx, verts, stone);
      return;
    }
    tracePolygon(ctx, verts);
    if (territory) {
      ctx.fillStyle = territory === 1 ? 'rgba(37, 99, 235, 0.22)' : 'rgba(220, 38, 38, 0.22)';
      ctx.fill();
    }
    // Faint kite string
    ctx.strokeStyle = 'rgba(14, 116, 144, 0.3)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  },

  drawLastMove(ctx, verts) {
    ctx.save();
    tracePolygon(ctx, verts);
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();

    // A ribbon streaming from the tail (kite: O; dart: the notch A')
    const c = centroidOf(verts);
    const tail = isKite(verts) ? verts[0] : verts[2];
    const d = { x: tail.x - c.x, y: tail.y - c.y };
    const len = Math.hypot(d.x, d.y) || 1;
    const u = { x: d.x / len, y: d.y / len };
    const n = { x: -u.y, y: u.x };
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
      const s = (i / 14) * 30;
      const wave = Math.sin(i * 0.9) * 4;
      const x = tail.x + u.x * s + n.x * wave;
      const y = tail.y + u.y * s + n.y * wave;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    // Bows along the ribbon
    for (const s of [10, 20]) {
      const i = (s / 30) * 14;
      const wave = Math.sin(i * 0.9) * 4;
      const bx = tail.x + u.x * s + n.x * wave;
      const by = tail.y + u.y * s + n.y * wave;
      ctx.fillStyle = '#fbbf24';
      for (const sign of [1, -1]) {
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + n.x * 4 * sign - u.x * 2, by + n.y * 4 * sign - u.y * 2);
        ctx.lineTo(bx + n.x * 4 * sign + u.x * 2, by + n.y * 4 * sign + u.y * 2);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  },

  drawTarget(ctx, verts, player, legal) {
    if (!legal) {
      drawIllegalOutline(ctx, verts);
      return;
    }
    drawPiece(ctx, verts, player, 0.55);
    ctx.save();
    tracePolygon(ctx, verts);
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }
};

export default kitesAndDarts;
