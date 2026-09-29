// Dazzle: Bejeweled-inspired. Stones are cut gems (sapphire and ruby) set
// in dark gold-rimmed sockets on a velvet background, with animations.
import type { Skin } from '../types';
import { tracePolygon, centroidOf, drawIllegalOutline, drawSparkle } from '../canvas-utils';
import { GEMS, drawGem, drawDazzleBackground } from './gems';
import { DazzleEffects } from './effects';

const dazzle: Skin = {
  id: 'dazzle',
  name: 'Dazzle',
  order: 1,
  chrome: {
    page: 'bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950',
    panel: 'bg-purple-950/70 ring-1 ring-amber-400/30',
    title: 'bg-gradient-to-r from-amber-300 via-pink-300 to-sky-300 bg-clip-text text-transparent',
    canvas: 'bg-[#12071f] ring-1 ring-amber-400/40'
  },

  // Animations on an overlay canvas (effects.ts)
  createEffects: () => new DazzleEffects(),

  drawBackground(ctx, w, h) {
    drawDazzleBackground(ctx, w, h);
  },

  drawTile(ctx, verts, { stone, territory }) {
    if (stone) {
      drawGem(ctx, verts, stone);
      return;
    }
    // Empty socket: dark and slightly recessed, with a gold rim
    const c = centroidOf(verts);
    const socket = ctx.createLinearGradient(c.x - 25, c.y - 25, c.x + 25, c.y + 25);
    socket.addColorStop(0, '#0b0514');
    socket.addColorStop(1, '#2a1245');
    tracePolygon(ctx, verts);
    ctx.fillStyle = socket;
    ctx.fill();
    if (territory) {
      ctx.fillStyle = territory === 1 ? 'rgba(59, 130, 246, 0.35)' : 'rgba(239, 68, 68, 0.35)';
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
  },

  drawLastMove(ctx, verts) {
    ctx.save();
    tracePolygon(ctx, verts);
    ctx.shadowColor = '#fde68a';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = 'rgba(253, 230, 138, 0.95)';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
    const c = centroidOf(verts);
    drawSparkle(ctx, c.x + 5, c.y - 4, 9, 'rgba(255, 255, 255, 0.95)');
    drawSparkle(ctx, c.x - 7, c.y + 6, 4.5, 'rgba(253, 230, 138, 0.9)');
  },

  drawTarget(ctx, verts, player, legal) {
    if (!legal) {
      drawIllegalOutline(ctx, verts);
      return;
    }
    drawGem(ctx, verts, player, 0.6);
    ctx.save();
    tracePolygon(ctx, verts);
    ctx.shadowColor = GEMS[player].glow;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
};

export default dazzle;
