// Go Classic: a traditional Go set. A kaya-wood board with ink lines along
// the tile edges; slate (black, Player 1) and clamshell (white, Player 2)
// stones shaped to their tiles; Go's ring marker on the last move and
// square territory markers at the end. Drawing is in stones.ts, animations
// (setting stones down, taking prisoners) in effects.ts.
import type { Skin } from '../types';
import { drawIllegalOutline } from '../canvas-utils';
import { drawWood, drawEmptyPoint, drawStone, drawLastMoveRing } from './stones';
import { GoClassicEffects } from './effects';

const goClassic: Skin = {
  id: 'go-classic',
  name: 'Go Classic',
  order: 7,
  createEffects: () => new GoClassicEffects(),
  chrome: {
    page: 'bg-gradient-to-b from-stone-800 via-amber-950 to-stone-900',
    panel: 'bg-[#7a4e24] ring-1 ring-black/30',
    title: 'text-amber-50 font-serif tracking-wide',
    canvas: 'bg-[#dcae6a] ring-4 ring-[#4a2f14]'
  },
  // Black moves first in Go
  players: {
    1: { text: 'text-black', name: 'black' },
    2: { text: 'text-white', name: 'white' }
  },

  drawBackground(ctx, w, h) {
    drawWood(ctx, w, h);
  },

  drawTile(ctx, verts, { stone, territory }) {
    drawEmptyPoint(ctx, verts, stone ? 0 : territory);
    if (stone) drawStone(ctx, verts, stone);
  },

  drawLastMove(ctx, verts, player) {
    drawLastMoveRing(ctx, verts, player);
  },

  drawTarget(ctx, verts, player, legal) {
    if (!legal) {
      drawIllegalOutline(ctx, verts);
      return;
    }
    drawStone(ctx, verts, player, { alpha: 0.55 });
  }
};

export default goClassic;
