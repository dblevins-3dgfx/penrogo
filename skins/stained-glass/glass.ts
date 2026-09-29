// How stained glass panes are drawn, shared by the skin (static board) and
// its effects (animation overlay). Each pane gets small, repeatable
// variations (tint, bubbles, streaks) seeded from its position, so the
// window looks handmade but doesn't change between redraws.
import type { Point, Player } from '../types';
import { tracePolygon, centroidOf, mix, rgb } from '../canvas-utils';

export const GLASS = {
  1: { base: [29, 78, 216], light: [147, 197, 253], deep: [23, 37, 84] }, // cobalt
  2: { base: [185, 28, 28], light: [253, 164, 175], deep: [76, 5, 25] } // ruby
};

export const LEAD = '#1c1917';
const LEAD_WIDTH = 3.2;

// Small deterministic random numbers for a pane, from its center
const paneRandom = (c: Point) => {
  let seed = (Math.floor(c.x * 13.7) * 7919 + Math.floor(c.y * 7.3) * 104729) % 2147483647;
  if (seed <= 0) seed += 2147483646;
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
};

// Radius of the pane from its center
export const paneRadius = (verts: Point[], c = centroidOf(verts)) =>
  Math.max(...verts.map(p => Math.hypot(p.x - c.x, p.y - c.y)));

// A colored glass pane: brighter where light comes through the middle,
// with a slight per-pane tint, a few air bubbles and faint streaks.
export const drawColoredPane = (ctx, verts: Point[], player: Player, alpha = 1) => {
  const glass = GLASS[player];
  const c = centroidOf(verts);
  const r = paneRadius(verts, c);
  const rand = paneRandom(c);
  const tint = rand() * 0.25 - 0.1; // lighter or deeper, per pane
  const base = tint >= 0 ? mix(glass.base, glass.light, tint) : mix(glass.base, glass.deep, -tint);

  ctx.save();
  ctx.globalAlpha = alpha;
  tracePolygon(ctx, verts);
  const g = ctx.createRadialGradient(c.x - r * 0.2, c.y - r * 0.25, r * 0.05, c.x, c.y, r * 1.1);
  g.addColorStop(0, rgb(mix(base, glass.light, 0.55)));
  g.addColorStop(0.55, rgb(base));
  g.addColorStop(1, rgb(mix(base, glass.deep, 0.5)));
  ctx.fillStyle = g;
  ctx.fill();

  ctx.save();
  ctx.clip();
  // Streaks in the glass
  ctx.strokeStyle = rgb(glass.light, 0.14);
  ctx.lineWidth = 2;
  for (let i = 0; i < 2; i++) {
    const a = rand() * Math.PI;
    const off = (rand() - 0.5) * r;
    const dx = Math.cos(a), dy = Math.sin(a);
    const ox = c.x - dy * off, oy = c.y + dx * off;
    ctx.beginPath();
    ctx.moveTo(ox - dx * r, oy - dy * r);
    ctx.quadraticCurveTo(ox + dy * r * 0.3, oy - dx * r * 0.3, ox + dx * r, oy + dy * r);
    ctx.stroke();
  }
  // Air bubbles (seeds)
  const bubbles = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < bubbles; i++) {
    const bx = c.x + (rand() - 0.5) * r * 1.1;
    const by = c.y + (rand() - 0.5) * r * 1.1;
    const br = 0.6 + rand() * 0.9;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
};

// Pale frosted glass for an empty pane, optionally tinted (territory)
export const drawFrostedPane = (ctx, verts: Point[], territory = 0) => {
  const c = centroidOf(verts);
  const r = paneRadius(verts, c);
  const rand = paneRandom(c);
  tracePolygon(ctx, verts);
  const g = ctx.createLinearGradient(c.x - r, c.y - r, c.x + r, c.y + r);
  const v = 238 - Math.floor(rand() * 14);
  g.addColorStop(0, `rgb(${v}, ${v + 2}, ${v + 6})`);
  g.addColorStop(1, `rgb(${v - 22}, ${v - 18}, ${v - 12})`);
  ctx.fillStyle = g;
  ctx.fill();
  if (territory) {
    ctx.fillStyle = territory === 1 ? 'rgba(29, 78, 216, 0.28)' : 'rgba(185, 28, 28, 0.28)';
    ctx.fill();
  }
};

// Lead came around a pane: dark, with a thin metallic highlight
export const drawLead = (ctx, verts: Point[]) => {
  ctx.save();
  tracePolygon(ctx, verts);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = LEAD;
  ctx.lineWidth = LEAD_WIDTH;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(168, 162, 158, 0.45)';
  ctx.lineWidth = 0.7;
  ctx.stroke();
  ctx.restore();
};

// Light coming through a pane, as a lighter version of its own color
// (light blue on cobalt, pink on ruby, warm white on frosted glass), so
// glass looks backlit instead of painted over.
export const LIT = {
  0: [255, 244, 214],
  1: GLASS[1].light,
  2: GLASS[2].light
};

// Fill a pane with `color` in a radial glow; `strength` 0..1
export const drawLitPane = (ctx, verts: Point[], color: number[], strength = 1) => {
  const c = centroidOf(verts);
  const r = paneRadius(verts, c);
  ctx.save();
  tracePolygon(ctx, verts);
  ctx.clip();
  const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
  g.addColorStop(0, rgb(color, 0.85 * strength));
  g.addColorStop(0.65, rgb(color, 0.4 * strength));
  g.addColorStop(1, rgb(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(c.x - r, c.y - r, 2 * r, 2 * r);
  ctx.restore();
};

// The last move: the pane lit from within, with a glowing gold rim;
// `strength` 0..1
export const drawInnerGlow = (ctx, verts: Point[], litColor: number[], strength = 1) => {
  drawLitPane(ctx, verts, litColor, strength);
  ctx.save();
  tracePolygon(ctx, verts);
  ctx.strokeStyle = `rgba(253, 224, 71, ${0.5 + 0.5 * strength})`;
  ctx.lineWidth = 2.2;
  ctx.shadowColor = '#fde047';
  ctx.shadowBlur = 8 + 10 * strength;
  ctx.stroke();
  ctx.restore();
};
