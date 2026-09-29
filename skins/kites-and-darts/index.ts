// Kites & Darts: the pieces as their namesakes, flying in a pale sky.
// Kites are silk, stretched on wooden spars; darts are brushed-metal
// arrowheads. Empty tiles are only faint kite-string lines. Drawing of the
// pieces is in pieces.ts; animations in effects.ts.
import type { Skin } from '../types';
import { tracePolygon, drawIllegalOutline } from '../canvas-utils';
import { drawPiece, drawLastMoveMarker } from './pieces';
import { KitesAndDartsEffects } from './effects';

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
  // Wind ripples on the silk, a fluttering ribbon and dart glints
  createEffects: () => new KitesAndDartsEffects(),
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
    drawLastMoveMarker(ctx, verts);
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
