// The board: the canvas the skin draws on (see board-drawing.ts), the
// overlay canvas for the skin's animations, and pointer, wheel and
// right-click input. The canvas is 800 x 600; a smaller board (see
// BOARD_SIZES) is drawn scaled up to fill it. Pointer positions are
// reported in board units; the parent decides what they mean (see
// targetAt in targeting.ts).
import { useEffect, useMemo, useRef } from 'react';
import { opponentOf } from '../rules';
import { isHumanTurn, type AtariGroup, type GameEvent, type GameState } from '../game';
import { isDoubleTap, isTap, type Tap, type Target } from '../targeting';
import { BOARD_H, BOARD_W, boardSize, type Point } from '../board-geometry';
import { SWIPE_END_MS, WHEEL_NOTCH, wheelPixels, wheelTurns } from '../rotation';
import type { Skin } from '../skins';
import { drawBoard } from './board-drawing';

type BoardCanvasProps = {
  skin: Skin;
  game: GameState;
  target: Target | null;
  atari: AtariGroup[]; // the groups to warn about (none when the warnings are off)
  onHover: (pos: Point | null) => void;
  onClick: (pos: Point) => void; // a left mouse click
  onDoubleTap: (pos: Point) => void; // a double tap on a touch screen
  onRotate: (dir: 1 | -1) => void; // the opening tile, by wheel or right-click; keep it stable (useCallback)
};

// The skin's animated effects, if it has any, unless the device asks for
// reduced motion. Null without effects; its event methods are optional
// (see skins/types.ts). It is told the board's size, what each move did,
// the board, the last move and the legal preview.
const useSkinEffects = (skin: Skin, game: GameState, target: Target | null,
  overlayRef: React.RefObject<HTMLCanvasElement | null>) => {
  const { tiles, stones, lastMove, currentPlayer, event } = game;
  const { w, h } = boardSize(game.size);
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  );
  const fx = useMemo(
    () => (skin.createEffects && !reducedMotion ? skin.createEffects() : null),
    [skin, reducedMotion]
  );

  // The effects draw in board units too: the overlay is scaled like the
  // board, and they are told the board's size
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!fx || !overlay) return;
    const scale = overlay.width / w;
    overlay.getContext('2d')?.setTransform(scale, 0, 0, scale, 0, 0);
    fx.setBoardSize?.(w, h);
    fx.attach(overlay);
    return () => fx.detach();
  }, [fx, overlayRef, w, h]);

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

const BoardCanvas = ({ skin, game, target, atari, onHover, onClick, onDoubleTap, onRotate }: BoardCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  // Canvas units per board unit
  const scale = BOARD_W / boardSize(game.size).w;
  const fx = useSkinEffects(skin, game, target, overlayRef);
  // Effects that take over drawing the last move / the legal preview
  const fxDrawsLastMove = !!fx?.setLastMove;
  const fxDrawsTarget = !!fx?.setTarget;
  const { started, tiles } = game;
  const humanTurn = isHumanTurn(game);
  const rotating = started && !tiles; // the opening tile can be turned
  // Touch: where the finger went down (CSS pixels), and the last tap, to
  // spot a tap and a double tap
  const touchDown = useRef<Point | null>(null);
  const lastTap = useRef<Tap | null>(null);

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
    return {
      x: (e.clientX - rect.left) * canvas.width / rect.width / scale,
      y: (e.clientY - rect.top) * canvas.height / rect.height / scale
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!humanTurn) return;
    if (e.pointerType === 'touch') {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      touchDown.current = { x: e.clientX, y: e.clientY };
    }
    onHover(canvasPoint(e));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (humanTurn) onHover(canvasPoint(e));
  };

  // Mouse: left click places at once. Touch: lifting the finger leaves the
  // preview in place so it can be adjusted, and the Place button confirms;
  // a second tap on the same tile soon after the first places it too.
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!humanTurn) return;
    if (e.pointerType === 'mouse' && e.button === 0) onClick(canvasPoint(e));
    if (e.pointerType !== 'touch' || !touchDown.current) return;
    const down = touchDown.current;
    touchDown.current = null;
    if (!isTap(down, { x: e.clientX, y: e.clientY })) {
      lastTap.current = null; // a drag
      return;
    }
    const tap = { time: e.timeStamp, pos: canvasPoint(e) };
    if (isDoubleTap(lastTap.current, tap, tiles)) {
      lastTap.current = null; // so a third tap doesn't place again
      onDoubleTap(tap.pos);
    } else {
      lastTap.current = tap;
    }
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
