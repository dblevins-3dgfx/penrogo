// Plain Jane: flat colors on a white board with a light grid (the original
// look). No animated effects.
import type { Skin } from '../types';
import { tracePolygon, centroidOf, drawIllegalOutline } from '../canvas-utils';

const PLAIN_FILL = { 1: 'rgba(59, 130, 246, 0.75)', 2: 'rgba(239, 68, 68, 0.75)' };
const PLAIN_STROKE = { 1: '#1e40af', 2: '#991b1b' };
const PLAIN_TERRITORY = { 1: 'rgba(59, 130, 246, 0.25)', 2: 'rgba(239, 68, 68, 0.25)' };

const drawPlainStar = (ctx, c) => {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 9 : 4;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = c.x + r * Math.cos(a);
    const py = c.y + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#facc15';
  ctx.fill();
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
};

const plainJane: Skin = {
  id: 'plain',
  name: 'Plain Jane',
  order: 0,
  chrome: {
    page: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900',
    panel: 'bg-slate-800',
    title: 'text-white',
    canvas: 'bg-white'
  },

  drawBackground(ctx, w, h) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < w; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
      ctx.stroke();
    }
    for (let i = 0; i < h; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(w, i);
      ctx.stroke();
    }
  },

  drawTile(ctx, verts, { stone, territory }) {
    tracePolygon(ctx, verts);
    ctx.fillStyle = stone ? PLAIN_FILL[stone] : territory ? PLAIN_TERRITORY[territory] : '#f1f5f9';
    ctx.fill();
    ctx.strokeStyle = stone ? PLAIN_STROKE[stone] : '#94a3b8';
    ctx.lineWidth = stone ? 1.5 : 1;
    ctx.stroke();
  },

  drawLastMove(ctx, verts) {
    ctx.save();
    tracePolygon(ctx, verts);
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
    drawPlainStar(ctx, centroidOf(verts));
  },

  drawTarget(ctx, verts, player, legal) {
    if (!legal) {
      drawIllegalOutline(ctx, verts);
      return;
    }
    ctx.save();
    tracePolygon(ctx, verts);
    ctx.fillStyle = PLAIN_FILL[player];
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
};

export default plainJane;
