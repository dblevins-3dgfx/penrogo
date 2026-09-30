// Neon Arcade: synthwave. Stones are glowing neon tubes (cyan and hot pink)
// tracing their tiles on a dark arcade screen with a faint grid and
// scanlines; empty tiles are crisp dim outlines so the geometry stays easy
// to read. Drawing is in neon.ts, animations (flicker on, blink out,
// breathing last move, CRT roll bar) in effects.ts.
import type { Skin } from '../types';
import { centroidOf, drawIllegalOutline } from '../canvas-utils';
import { NEON, drawScreen, drawEmptyTile, drawTube, drawSpark } from './neon';
import { NeonArcadeEffects } from './effects';

const neonArcade: Skin = {
  id: 'neon-arcade',
  name: 'Neon Arcade',
  order: 5,
  createEffects: () => new NeonArcadeEffects(),
  chrome: {
    page: 'bg-gradient-to-b from-black via-indigo-950 to-fuchsia-950',
    panel: 'bg-black/60 ring-1 ring-fuchsia-500/40',
    title: 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.9)]',
    canvas: 'bg-black ring-1 ring-cyan-400/40'
  },

  drawBackground(ctx, w, h) {
    drawScreen(ctx, w, h);
  },

  drawTile(ctx, verts, { stone, territory }) {
    drawEmptyTile(ctx, verts, stone ? 0 : territory);
    if (stone) drawTube(ctx, verts, NEON[stone]);
  },

  // Still version (without effects): a brighter tube isn't possible without
  // knowing the owner, so mark it with a white spark and outline
  drawLastMove(ctx, verts) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    verts.forEach(v => ctx.lineTo(v.x, v.y));
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
    drawSpark(ctx, centroidOf(verts), 4, [255, 255, 255]);
  },

  drawTarget(ctx, verts, player, legal) {
    if (!legal) {
      drawIllegalOutline(ctx, verts);
      return;
    }
    drawTube(ctx, verts, NEON[player], 0.55);
  }
};

export default neonArcade;
