// Stained Glass: the board as a leaded window. Stones are cobalt and ruby
// glass with light coming through; empty tiles are frosted glass; every
// edge is a lead line. Pane drawing is in glass.ts, animations (a sweeping
// sunbeam, a pulsing last move, and captured glass shattering) in
// effects.ts.
import type { Skin } from '../types';
import { drawIllegalOutline } from '../canvas-utils';
import { drawColoredPane, drawFrostedPane, drawLead, drawInnerGlow, LEAD, LIT } from './glass';
import { StainedGlassEffects } from './effects';

const stainedGlass: Skin = {
  id: 'stained-glass',
  name: 'Stained Glass',
  order: 3,
  createEffects: () => new StainedGlassEffects(),
  chrome: {
    page: 'bg-gradient-to-b from-stone-900 via-stone-800 to-stone-950',
    panel: 'bg-stone-800/80 ring-1 ring-amber-200/20',
    title: 'text-amber-100',
    canvas: 'bg-stone-900 ring-4 ring-stone-700'
  },

  // The window frame behind the glass (shows only at the board's edges)
  drawBackground(ctx, w, h) {
    ctx.fillStyle = LEAD;
    ctx.fillRect(0, 0, w, h);
  },

  drawTile(ctx, verts, { stone, territory }) {
    if (stone) drawColoredPane(ctx, verts, stone);
    else drawFrostedPane(ctx, verts, territory);
    drawLead(ctx, verts);
  },

  // Still version (without effects): warm light, screen-blended so it only
  // brightens the glass drawn beneath it on this canvas
  drawLastMove(ctx, verts) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    drawInnerGlow(ctx, verts, LIT[0], 0.7);
    ctx.restore();
  },

  drawTarget(ctx, verts, player, legal) {
    if (!legal) {
      drawIllegalOutline(ctx, verts);
      return;
    }
    drawColoredPane(ctx, verts, player, 0.6);
    drawLead(ctx, verts);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    verts.forEach(v => ctx.lineTo(v.x, v.y));
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
  }
};

export default stainedGlass;
