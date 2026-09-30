// Blueprint: the board as a drafting sheet. Stones are outlined and
// hatched (Player 1 white with diagonal hatching, Player 2 red-line pencil
// with cross-hatching) on blueprint paper; empty tiles are thin
// construction lines; the last move is dimensioned. Drawing is in
// drafting.ts, animations (pencil draw-in, erasing captures) in effects.ts.
import type { Skin } from '../types';
import { tracePolygon, drawIllegalOutline } from '../canvas-utils';
import { drawPaper, drawEmptyTile, drawStone, drawHatch, drawDimensions, INK } from './drafting';
import { BlueprintEffects } from './effects';

const blueprint: Skin = {
  id: 'blueprint',
  name: 'Blueprint',
  order: 6,
  createEffects: () => new BlueprintEffects(),
  chrome: {
    page: 'bg-gradient-to-b from-blue-950 via-blue-900 to-blue-950',
    panel: 'bg-blue-900/70 ring-1 ring-white/30',
    title: 'text-white font-mono tracking-widest uppercase',
    canvas: 'bg-blue-800 ring-1 ring-white/40'
  },

  drawBackground(ctx, w, h) {
    drawPaper(ctx, w, h);
  },

  drawTile(ctx, verts, { stone, territory }) {
    drawEmptyTile(ctx, verts, stone ? 0 : territory);
    if (stone) drawStone(ctx, verts, stone);
  },

  drawLastMove(ctx, verts) {
    drawDimensions(ctx, verts);
  },

  // Preview: a dashed construction outline with light hatching
  drawTarget(ctx, verts, player, legal) {
    if (!legal) {
      drawIllegalOutline(ctx, verts);
      return;
    }
    ctx.save();
    ctx.globalAlpha = 0.6;
    drawHatch(ctx, verts, player);
    ctx.restore();
    ctx.save();
    tracePolygon(ctx, verts);
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = INK[player];
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
};

export default blueprint;
