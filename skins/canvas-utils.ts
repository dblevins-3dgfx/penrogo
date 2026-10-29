// Drawing helpers any skin may use. Points are { x, y } in the 800x600
// board coordinates; colors for mix() and rgb() are [r, g, b] arrays.
import type { Point } from './types';

export type RGB = number[];

export const tracePolygon = (ctx: CanvasRenderingContext2D, verts: Point[]) => {
  ctx.beginPath();
  ctx.moveTo(verts[0].x, verts[0].y);
  verts.forEach(v => ctx.lineTo(v.x, v.y));
  ctx.closePath();
};

export const centroidOf = (verts: Point[]): Point => ({
  x: verts.reduce((s, v) => s + v.x, 0) / verts.length,
  y: verts.reduce((s, v) => s + v.y, 0) / verts.length
});

// Dashed red outline for a tile that can't be claimed
export const drawIllegalOutline = (ctx: CanvasRenderingContext2D, verts: Point[]) => {
  ctx.save();
  tracePolygon(ctx, verts);
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.restore();
};

export const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => Math.round(v + (b[i] - v) * t));
export const rgb = (c: RGB, alpha = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;

// Four-pointed twinkle
export const drawSparkle = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => {
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = size;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? size : size * 0.18;
    const a = (i * Math.PI) / 4;
    const px = x + r * Math.cos(a);
    const py = y + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};
