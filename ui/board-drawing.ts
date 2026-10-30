// Drawing the board on its canvas: the skin's background, tiles, last move
// and target, scaled from board units to the canvas, with the overlays
// that look the same in every skin (atari warnings, the hint) on top.
// BoardCanvas.tsx calls drawBoard whenever the game, the target or the
// skin changes.
import { scoreArea } from '../rules';
import type { AtariGroup, GameState, Tile } from '../game';
import type { Target } from '../targeting';
import { boardSize, centroidOf, tracePolygon, type Point } from '../board-geometry';
import type { Skin } from '../skins';
import type { Player } from '../skins/types';

// The tile a hint suggests, the same in every skin: an amber tint and a
// dashed amber outline on a white halo. Dashed, so it is not mistaken for
// a skin's last-move marker, and haloed, so it shows on dark and light
// boards alike.
const drawHint = (ctx: CanvasRenderingContext2D, verts: Point[]) => {
  ctx.save();
  tracePolygon(ctx, verts);
  ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 3.5;
  ctx.setLineDash([7, 5]);
  ctx.stroke();
  ctx.restore();
};

// A group in atari, the same in every skin: each of its tiles outlined in
// solid red on a white halo, and its last liberty marked with a red ring.
// Solid, so it is not mistaken for the dashed hint or an illegal preview.
const drawAtari = (ctx: CanvasRenderingContext2D, tiles: { verts: Point[] }[], g: AtariGroup) => {
  ctx.save();
  ctx.lineJoin = 'round';
  for (const m of g.members) {
    tracePolygon(ctx, tiles[m].verts);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  const c = centroidOf(tiles[g.liberty].verts);
  ctx.beginPath();
  ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 5.5;
  ctx.stroke();
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
};

// The tiles (stones, empty tiles, and the territory at the end) and the last
// move, with the skin's hooks
const drawStones = (ctx: CanvasRenderingContext2D, skin: Skin, game: GameState, tiles: Tile[],
  fxDrawsLastMove: boolean) => {
  const { stones, lastMove, gameOver } = game;
  const territory = gameOver ? scoreArea(tiles, stones).owner : null;
  tiles.forEach((t, i) => {
    skin.drawTile(ctx, t.verts, { stone: stones[i], territory: territory ? territory[i] : 0 });
  });
  // Unless the skin's effects draw (and animate) it on the overlay
  if (lastMove !== null && stones[lastMove] && !fxDrawsLastMove) skin.drawLastMove(ctx, tiles[lastMove].verts, stones[lastMove] as Player);
};

// The hover/preview target with the skin's hook (unless the skin's effects
// draw a legal one), and a red border while the opening tile would stick
// out of the w x h board
const drawTargetLayer = (ctx: CanvasRenderingContext2D, skin: Skin, target: Target, player: Player,
  fxDrawsTarget: boolean, w: number, h: number) => {
  if (!(fxDrawsTarget && target.legal)) skin.drawTarget(ctx, target.verts, player, target.legal);
  if (target.kind !== 'opening' || target.legal) return;
  ctx.save();
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, w - 8, h - 8);
  ctx.restore();
};

// What goes over the tiles: the groups in atari, the target, and the
// hinted tile on top
const drawOverlays = (ctx: CanvasRenderingContext2D, skin: Skin, game: GameState, target: Target | null,
  atari: AtariGroup[], fxDrawsTarget: boolean, w: number, h: number) => {
  const { tiles, hint, currentPlayer } = game;
  if (tiles) atari.forEach(g => drawAtari(ctx, tiles, g));
  if (target) drawTargetLayer(ctx, skin, target, currentPlayer, fxDrawsTarget, w, h);
  if (tiles && hint?.status === 'shown' && hint.move !== null) drawHint(ctx, tiles[hint.move].verts);
};

// Draws the whole board, scaled from board units to the canvas: the
// background, the tiles and last move, and the overlays
export const drawBoard = (canvas: HTMLCanvasElement, skin: Skin, game: GameState, target: Target | null,
  atari: AtariGroup[], fxDrawsLastMove: boolean, fxDrawsTarget: boolean) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { w, h } = boardSize(game.size);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(canvas.width / w, 0, 0, canvas.width / w, 0, 0);
  skin.drawBackground(ctx, w, h);
  if (game.tiles) drawStones(ctx, skin, game, game.tiles, fxDrawsLastMove);
  drawOverlays(ctx, skin, game, target, atari, fxDrawsTarget, w, h);
};
