// The board: the canvas the skin draws on, the overlay canvas for the
// skin's animations, and pointer, wheel and right-click input. Pointer
// positions are reported in the canvas's internal 800 x 600 coordinates;
// the parent decides what they mean (see targetAt in game.ts).
import { useEffect, useMemo, useRef } from 'react';
import { opponentOf, scoreArea } from '../go-engine';
import { isHumanTurn, type GameEvent, type GameState, type Target } from '../game';
import { BOARD_H, BOARD_W, SWIPE_END_MS, WHEEL_NOTCH, wheelPixels, wheelTurns, type Point } from '../opening';
import type { Skin } from '../skins';
import type { Player } from '../skins/types';

// Touch devices have no hover, so the preview follows a finger drag and is
// lifted above the fingertip so it isn't hidden under it.
const TOUCH_OFFSET_Y = 60;

type BoardCanvasProps = {
  skin: Skin;
  game: GameState;
  target: Target | null;
  onHover: (pos: Point | null) => void;
  onClick: (pos: Point) => void; // a left mouse click
  onRotate: (dir: 1 | -1) => void; // the opening tile, by wheel or right-click; keep it stable (useCallback)
};

// The skin's animated effects, if it has any, unless the device asks for
// reduced motion. Null without effects; its event methods are optional
// (see skins/types.ts). It is told what each move did, the board, the last
// move and the legal preview.
const useSkinEffects = (skin: Skin, game: GameState, target: Target | null,
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

  useEffect(() => {
    if (!fx || !overlayRef.current) return;
    fx.attach(overlayRef.current);
    return () => fx.detach();
  }, [fx, overlayRef]);

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

// Draws the board, the last move and the target with the skin's hooks
const drawBoard = (canvas: HTMLCanvasElement, skin: Skin, game: GameState, target: Target | null,
  fxDrawsLastMove: boolean, fxDrawsTarget: boolean) => {
  const { tiles, stones, lastMove, gameOver, currentPlayer } = game;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  skin.drawBackground(ctx, canvas.width, canvas.height);

  if (tiles) {
    const territory = gameOver ? scoreArea(tiles, stones).owner : null;
    tiles.forEach((t, i) => {
      skin.drawTile(ctx, t.verts, { stone: stones[i], territory: territory ? territory[i] : 0 });
    });
    // Unless the skin's effects draw (and animate) it on the overlay
    if (lastMove !== null && stones[lastMove] && !fxDrawsLastMove) skin.drawLastMove(ctx, tiles[lastMove].verts, stones[lastMove] as Player);
  }

  if (target) {
    // A legal preview may be drawn by the skin's effects instead
    if (!(fxDrawsTarget && target.legal)) skin.drawTarget(ctx, target.verts, currentPlayer, target.legal);

    // Red border while the opening tile would stick out of the board
    if (target.kind === 'opening' && !target.legal) {
      ctx.save();
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, BOARD_W - 8, BOARD_H - 8);
      ctx.restore();
    }
  }
};

const BoardCanvas = ({ skin, game, target, onHover, onClick, onRotate }: BoardCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const fx = useSkinEffects(skin, game, target, overlayRef);
  // Effects that take over drawing the last move / the legal preview
  const fxDrawsLastMove = !!fx?.setLastMove;
  const fxDrawsTarget = !!fx?.setTarget;
  const { started, tiles } = game;
  const humanTurn = isHumanTurn(game);
  const rotating = started && !tiles; // the opening tile can be turned

  useEffect(() => {
    if (canvasRef.current) drawBoard(canvasRef.current, skin, game, target, fxDrawsLastMove, fxDrawsTarget);
  }, [game, target, skin, fxDrawsLastMove, fxDrawsTarget]);

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

  // A pointer event's CSS pixel position in the canvas's internal 800 x 600
  // drawing coordinates (the canvas is scaled to fit the window)
  const canvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const touch = e.pointerType === 'touch';
    return {
      x: (e.clientX - rect.left) * canvas.width / rect.width,
      y: (e.clientY - rect.top) * canvas.height / rect.height - (touch ? TOUCH_OFFSET_Y : 0)
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
