// Neon drawing, shared by the skin (static board) and its effects.
// Stones are neon tubes tracing the tile outline, inset a little so the
// tubes of neighboring tiles stay separate; empty tiles are crisp dim
// outlines, so the kite and dart shapes always read clearly.
import type { Point, Owner } from '../types';
import { tracePolygon, centroidOf, mix, rgb } from '../canvas-utils';

export const NEON = {
  1: [34, 211, 238], // cyan
  2: [244, 114, 182] // hot pink
};

const TUBE_INSET = 0.86;
const EMPTY_OUTLINE = 'rgba(167, 139, 250, 0.45)';

export const insetPolygon = (verts: Point[], k = TUBE_INSET) => {
  const c = centroidOf(verts);
  return verts.map(p => ({ x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k }));
};

// The arcade screen: near-black, a faint magenta grid and scanlines
export const drawScreen = (ctx, w: number, h: number) => {
  ctx.fillStyle = '#07020f';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(236, 72, 153, 0.09)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = 0; y <= h; y += 40) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
};

// An empty tile: a crisp dim outline, optionally tinted (territory)
export const drawEmptyTile = (ctx, verts: Point[], territory: Owner = 0) => {
  tracePolygon(ctx, verts);
  if (territory) {
    ctx.fillStyle = rgb(NEON[territory], 0.12);
    ctx.fill();
  }
  ctx.strokeStyle = EMPTY_OUTLINE;
  ctx.lineWidth = 1;
  ctx.stroke();
};

// A neon tube around the tile. `intensity` 0..1 (above 1 flares brighter).
export const drawTube = (ctx, verts: Point[], color: number[], intensity = 1) => {
  if (intensity <= 0) return;
  const tube = insetPolygon(verts);
  const a = Math.min(1, intensity);
  ctx.save();
  // Faint gas glow filling the tile
  tracePolygon(ctx, tube);
  ctx.fillStyle = rgb(color, 0.13 * a);
  ctx.fill();
  ctx.lineJoin = 'round';
  // Colored glow
  ctx.shadowColor = rgb(color, a);
  ctx.shadowBlur = 12 * intensity;
  ctx.strokeStyle = rgb(color, 0.9 * a);
  ctx.lineWidth = 3;
  ctx.stroke();
  // Bright core
  ctx.shadowBlur = 4 * intensity;
  ctx.strokeStyle = rgb(mix(color, [255, 255, 255], 0.65), a);
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.restore();
};

// A small four-way spark
export const drawSpark = (ctx, p: Point, size: number, color: number[]) => {
  ctx.save();
  ctx.strokeStyle = rgb(mix(color, [255, 255, 255], 0.7));
  ctx.shadowColor = rgb(color);
  ctx.shadowBlur = 8;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(p.x - size, p.y); ctx.lineTo(p.x + size, p.y);
  ctx.moveTo(p.x, p.y - size); ctx.lineTo(p.x, p.y + size);
  ctx.stroke();
  ctx.restore();
};

// Covers a tile with the empty look (the screen clipped to it, plus its
// outline): lets the effects make a static tube appear switched off
export const coverWithEmpty = (ctx, verts: Point[], w: number, h: number) => {
  ctx.save();
  tracePolygon(ctx, verts);
  ctx.clip();
  drawScreen(ctx, w, h);
  ctx.restore();
  drawEmptyTile(ctx, verts);
};
