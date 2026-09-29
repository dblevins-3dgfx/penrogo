// Girih: glazed ceramic tiles in terracotta grout, covered in strapwork
// that joins up across the board, after the Islamic geometric tilings that
// anticipated Penrose's patterns by five centuries. Empty tiles are cream,
// stones cobalt and terracotta. Tile and strapwork drawing is in tiles.ts,
// the light wave animation in effects.ts.
import type { Skin } from '../types';
import { tracePolygon, drawIllegalOutline } from '../canvas-utils';
import { drawGlazedTile, drawStrapGlow, GROUT } from './tiles';
import { GirihEffects } from './effects';

const girih: Skin = {
  id: 'girih',
  name: 'Girih',
  order: 4,
  createEffects: () => new GirihEffects(),
  chrome: {
    page: 'bg-gradient-to-b from-teal-950 via-cyan-950 to-slate-950',
    panel: 'bg-teal-900/60 ring-1 ring-amber-300/30',
    title: 'text-amber-200',
    canvas: 'bg-[#6b3a1f] ring-2 ring-amber-700/60'
  },

  drawBackground(ctx, w, h) {
    ctx.fillStyle = GROUT;
    ctx.fillRect(0, 0, w, h);
  },

  drawTile(ctx, verts, { stone, territory }) {
    drawGlazedTile(ctx, verts, stone, territory);
  },

  drawLastMove(ctx, verts) {
    drawStrapGlow(ctx, verts, 1);
    ctx.save();
    tracePolygon(ctx, verts);
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.9)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#fde047';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
  },

  drawTarget(ctx, verts, player, legal) {
    if (!legal) {
      drawIllegalOutline(ctx, verts);
      return;
    }
    drawGlazedTile(ctx, verts, player, 0, 0.65);
    ctx.save();
    tracePolygon(ctx, verts);
    ctx.strokeStyle = 'rgba(255, 250, 240, 0.95)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
};

export default girih;
