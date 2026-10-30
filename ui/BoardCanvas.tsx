// The board: the canvas the skin draws on, the overlay canvas for the
// skin's animations, and pointer, wheel and right-click input. The canvas is
// 800 x 600; a smaller board (see BOARD_SIZES) is drawn scaled up to fill
// it. Pointer positions are reported in board units; the parent decides
// what they mean (see targetAt in game.ts).
import { useEffect, useMemo, useRef } from 'react';
import { opponentOf, scoreArea } from '../rules';
import { isHumanTurn, type AtariGroup, type GameEvent, type GameState, type Target, type Tile } from '../game';
import { BOARD_H, BOARD_W, SWIPE_END_MS, WHEEL_NOTCH, boardSize, wheelPixels, wheelTurns, type Point } from '../opening';
import type { Skin } from '../skins';
import { centroidOf, tracePolygon } from '../skins/canvas-utils';
import type { Player } from '../skins/types';

// Touch devices have no hover, so the preview follows a finger drag and is
// lifted above the fingertip (in canvas units) so it isn't hidden under it.
const TOUCH_OFFSET_Y = 60;

type BoardCanvasProps = {
  skin: Skin;
  game: GameState;
  target: Target | null;
  atari: AtariGroup[]; // the groups to warn about (none when the warnings are off)
  onHover: (pos: Point | null) => void;
  onClick: (pos: Point) => void; // a left mouse click
  onRotate: (dir: 1 | -1) => void; // the opening tile, by wheel or right-click; keep it stable (useCallback)
};

// The skin's animated effects, if it has any, unless the device asks for
// reduced motion. Null without effects; its event methods are optional
// (see skins/types.ts). It is told what each move did, the board, the last
// move and the legal preview.
const useSkinEffects = (skin: Skin, game: GameState, target: Target | null, scale: number,
  overlayRef: React.RefObject<HTMLCanvasElement | null>) => {
  const { tiles, stones, lastMove, currentPlayer, event } = game;
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  );
  const fx = useMemo(
    () => (skin.createEffects && !reducedMotion ? skin.createEffects() : null),
    [skin, reducedMotion]
  );

  // The effects draw in board units too: the overlay is scaled like the board
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!fx || !overlay) return;
    overlay.getContext('2d')?.setTransform(scale, 0, 0, scale, 0, 0);
    fx.attach(overlay);
    return () => fx.detach();
  }, [fx, overlayRef, scale]);

  // Only on a new event, so switching skins doesn't replay the last one
  const forwarded = useRef<GameEvent | null>(null);
  useEffect(() => {
    if (!event || event === forwarded.current) return;
    forwarded.current = event;
    if (event.kind === 'opening') {
      fx?.cascade?.(event.tiles, event.verts);
      fx?.place?.(event.verts, event.player);
    } else if (tiles) {
      fx?.place?.(tiles[event.id].verts, event.player);
      if (event.lost.length) fx?.capture?.(event.lost.map(i => tiles[i].verts), opponentOf(event.player), event.player);
    }
  }, [event, fx, tiles]);

  useEffect(() => {
    fx?.setBoard?.(tiles, stones);
  }, [fx, tiles, stones]);

  useEffect(() => {
    const show = tiles && lastMove !== null && stones[lastMove];
    fx?.setLastMove?.(show ? tiles[lastMove].verts : null);
  }, [fx, tiles, stones, lastMove]);

  useEffect(() => {
    const show = target && target.legal;
    fx?.setTarget?.(show ? { verts: target.verts, player: currentPlayer } : null);
  }, [fx, target, currentPlayer]);

  return fx;
};

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
const drawBoard = (canvas: HTMLCanvasElement, skin: Skin, game: GameState, target: Target | null,
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

const BoardCanvas = ({ skin, game, target, atari, onHover, onClick, onRotate }: BoardCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  // Canvas units per board unit
  const scale = BOARD_W / boardSize(game.size).w;
  const fx = useSkinEffects(skin, game, target, scale, overlayRef);
  // Effects that take over drawing the last move / the legal preview
  const fxDrawsLastMove = !!fx?.setLastMove;
  const fxDrawsTarget = !!fx?.setTarget;
  const { started, tiles } = game;
  const humanTurn = isHumanTurn(game);
  const rotating = started && !tiles; // the opening tile can be turned

  useEffect(() => {
    if (canvasRef.current) drawBoard(canvasRef.current, skin, game, target, atari, fxDrawsLastMove, fxDrawsTarget);
  }, [game, target, atari, skin, fxDrawsLastMove, fxDrawsTarget]);

  // The wheel turns the opening tile (see wheelTurns). Non-passive so
  // preventDefault can stop the page from scrolling.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rotating) return;
    const swipe: { total: number; timer?: ReturnType<typeof setTimeout> } = { total: 0 };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = wheelPixels(e.deltaY, e.deltaMode);
      const r = wheelTurns(swipe.total, dy);
      r.turns.forEach(onRotate);
      if (Math.abs(dy) >= WHEEL_NOTCH) return; // a mouse wheel notch
      swipe.total = r.total;
      clearTimeout(swipe.timer);
      swipe.timer = setTimeout(() => { swipe.total = 0; }, SWIPE_END_MS);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      clearTimeout(swipe.timer);
    };
  }, [rotating, onRotate]);

  // A pointer event's CSS pixel position in board units: the canvas's
  // internal 800 x 600 drawing coordinates (the canvas is scaled to fit the
  // window), divided by the board's scale
  const canvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const touch = e.pointerType === 'touch';
    return {
      x: (e.clientX - rect.left) * canvas.width / rect.width / scale,
      y: ((e.clientY - rect.top) * canvas.height / rect.height - (touch ? TOUCH_OFFSET_Y : 0)) / scale
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!humanTurn) return;
    if (e.pointerType === 'touch') e.currentTarget.setPointerCapture?.(e.pointerId);
    onHover(canvasPoint(e));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (humanTurn) onHover(canvasPoint(e));
  };

  // Mouse: left click places at once. Touch: lifting the finger leaves the
  // preview in place so it can be adjusted, and the Place button confirms.
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (humanTurn && e.pointerType === 'mouse' && e.button === 0) onClick(canvasPoint(e));
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse') onHover(null);
  };

  // Right-click turns the opening tile clockwise (Shift + right-click
  // counter-clockwise) instead of opening the browser menu
  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (rotating) onRotate(e.shiftKey ? -1 : 1);
  };

  return (
    <div className="relative" style={{ width: 'min(100cqw, 100cqh * 4 / 3)' }}>
      <canvas
        ref={canvasRef}
        width={BOARD_W}
        height={BOARD_H}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onContextMenu={handleContextMenu}
        style={{ touchAction: 'none' }}
        className={`block w-full h-auto ${skin.chrome.canvas} rounded shadow-2xl cursor-crosshair`}
      />
      {fx && (
        <canvas
          ref={overlayRef}
          width={BOARD_W}
          height={BOARD_H}
          aria-hidden="true"
          className="absolute inset-0 w-full h-full rounded pointer-events-none"
        />
      )}
    </div>
  );
};

export default BoardCanvas;
