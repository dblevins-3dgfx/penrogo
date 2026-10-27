import React, { useState, useRef, useEffect, useMemo, useReducer } from 'react';
import { RotateCw, Play, SkipForward, RotateCcw, CircleHelp, X, Palette } from 'lucide-react';
import { opponentOf, playMove, scoreArea } from './go-engine';
import { gameReducer, initialGame, isComputerTurn, isHumanTurn, playerName, shownScore, turnText } from './game';
import {
  BOARD_H, BOARD_W, COMPUTER_OPENING,
  candidateVertices, isOutsidePlayfield, rotateStep, tileAtPoint,
  type TileType
} from './opening';
import { SKINS, DEFAULT_SKIN, DEFAULT_PLAYERS, skinById } from './skins';
import type { Player } from './skins/types';

// The chosen skin is remembered in this browser (localStorage).
const SKIN_STORAGE_KEY = 'penrogo.skin';

const loadSkin = () => {
  try {
    return skinById(localStorage.getItem(SKIN_STORAGE_KEY) || DEFAULT_SKIN).id;
  } catch {
    return DEFAULT_SKIN;
  }
};

const saveSkin = (id) => {
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, id);
  } catch {
    // Storage unavailable (e.g. private mode): the choice lasts this visit
  }
};

// How long the computer may think per move, in seconds. The choice is
// remembered in this browser (localStorage) and defaults to 3.
const THINK_OPTIONS = [1, 3, 5, 10];
const DEFAULT_THINK_SECONDS = 3;
const THINK_STORAGE_KEY = 'penrogo.thinkSeconds';

const loadThinkSeconds = () => {
  try {
    const v = Number(localStorage.getItem(THINK_STORAGE_KEY));
    return THINK_OPTIONS.includes(v) ? v : DEFAULT_THINK_SECONDS;
  } catch {
    return DEFAULT_THINK_SECONDS;
  }
};

const saveThinkSeconds = (v) => {
  try {
    localStorage.setItem(THINK_STORAGE_KEY, String(v));
  } catch {
    // Storage unavailable (e.g. private mode): the choice lasts this visit
  }
};

const PenroseTerritoryGame = () => {
  const canvasRef = useRef(null);
  const [game, dispatch] = useReducer(gameReducer, undefined, () => initialGame());
  const { mode, started: gameStarted, tiles, stones, history, currentPlayer, passes, captured, lastMove, gameOver } = game;
  const [thinkSeconds, setThinkSeconds] = useState(loadThinkSeconds);
  const [selectedTileType, setSelectedTileType] = useState<TileType>('kite');
  const [rotation, setRotation] = useState(0);
  const [hoveredPos, setHoveredPos] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [skinId, setSkinId] = useState(loadSkin);
  const skin = skinById(skinId);
  const players = skin.players || DEFAULT_PLAYERS;

  // The skin's animated effects, if it has any, on an overlay canvas above
  // the board, unless the device asks for reduced motion. `fx` is null
  // without effects; its event methods are optional (see skins/types.ts).
  const overlayRef = useRef(null);
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  );
  const fx = useMemo(
    () => (skin.createEffects && !reducedMotion ? skin.createEffects() : null),
    [skin, reducedMotion]
  );
  const effectsOn = !!fx;
  // Effects that take over drawing the last move / the legal preview
  const fxDrawsLastMove = !!fx?.setLastMove;
  const fxDrawsTarget = !!fx?.setTarget;

  const computerTurn = isComputerTurn(game);
  const humanTurn = isHumanTurn(game);

  // Escape closes the How to Play screen
  useEffect(() => {
    if (!showHelp) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowHelp(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHelp]);

  useEffect(() => {
    if (!fx || !overlayRef.current) return;
    fx.attach(overlayRef.current);
    return () => fx.detach();
  }, [fx]);

  // Tell the skin's effects what the last move did. Only on a new event,
  // so switching skins doesn't replay it.
  useEffect(() => {
    const ev = game.event;
    if (!ev) return;
    if (ev.kind === 'opening') {
      fx?.cascade?.(ev.tiles, ev.verts);
      fx?.place?.(ev.verts, ev.player);
    } else {
      fx?.place?.(tiles[ev.id].verts, ev.player);
      if (ev.lost.length) fx?.capture?.(ev.lost.map(i => tiles[i].verts), opponentOf(ev.player), ev.player);
    }
  }, [game.event]);

  useEffect(() => {
    fx?.setBoard?.(tiles, stones);
  }, [fx, tiles, stones]);

  useEffect(() => {
    const show = tiles && lastMove !== null && stones[lastMove];
    fx?.setLastMove?.(show ? tiles[lastMove].verts : null);
  }, [fx, tiles, stones, lastMove]);

  const score = shownScore(game);

  const initGame = () => {
    setRotation(0);
    dispatch({ type: 'start' });
  };

  const resetGame = () => {
    setHoveredPos(null);
    dispatch({ type: 'reset' });
  };

  // The computer's turn: open the board if needed, otherwise search for a
  // move in a background worker (go-engine's Monte Carlo player) and play
  // it, or pass. The worker is discarded if the turn is abandoned (e.g. New
  // Game), so a stale answer can never be played.
  useEffect(() => {
    if (!gameStarted || gameOver || !computerTurn) return;

    dispatch({ type: 'thinking' });
    if (!tiles) {
      const timer = setTimeout(() => dispatch({ type: 'open', cand: COMPUTER_OPENING }), 400);
      return () => clearTimeout(timer);
    }

    const worker = new Worker(new URL('./ai-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { move } = e.data;
      dispatch(move === null ? { type: 'pass' } : { type: 'claim', id: move });
    };
    worker.postMessage({
      neighbors: tiles.map(t => t.neighbors),
      stones,
      history: [...history],
      player: 2,
      opponentPassed: passes > 0,
      timeMs: thinkSeconds * 1000
    });

    return () => worker.terminate();
  }, [gameStarted, gameOver, computerTurn, tiles, stones]);

  // Rotation controls (only matter for the opening tile)
  useEffect(() => {
    if (!gameStarted) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setRotation(prev => rotateStep(prev, -1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setRotation(prev => rotateStep(prev, 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStarted]);

  // Mouse wheel over the board rotates the tile: up = clockwise. A mouse
  // wheel notch arrives as one large delta and turns one step. A trackpad
  // swipe arrives as a stream of small deltas; it turns one step for every
  // TRACKPAD_STEP pixels scrolled, so a longer swipe turns further. Any
  // leftover partial step is dropped after a short pause in the stream.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameStarted || tiles) return;

    const WHEEL_NOTCH = 50;
    const TRACKPAD_STEP = 50; // lower = faster trackpad rotation
    const SWIPE_END_MS = 150;
    const swipe = { total: 0, timer: null };

    const rotateBy = (dy) => setRotation(prev => rotateStep(prev, dy < 0 ? 1 : -1));

    const handleWheel = (e) => {
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      if (Math.abs(dy) >= WHEEL_NOTCH) {
        rotateBy(dy);
        return;
      }

      clearTimeout(swipe.timer);
      swipe.timer = setTimeout(() => { swipe.total = 0; }, SWIPE_END_MS);
      swipe.total += dy;
      while (Math.abs(swipe.total) >= TRACKPAD_STEP) {
        rotateBy(swipe.total);
        swipe.total -= Math.sign(swipe.total) * TRACKPAD_STEP;
      }
    };

    // Non-passive so preventDefault can stop the page from scrolling
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      clearTimeout(swipe.timer);
    };
  }, [gameStarted, tiles]);

  // What a point is over: the opening tile preview, or a board tile and
  // whether claiming it is legal.
  const targetAt = (pos) => {
    if (!pos || !humanTurn) return null;
    if (!tiles) {
      const cand = { type: selectedTileType, x: pos.x, y: pos.y, rotation };
      const verts = candidateVertices(cand);
      return { kind: 'opening', cand, verts, legal: !isOutsidePlayfield(verts) };
    }
    const id = tileAtPoint(tiles, pos.x, pos.y);
    if (id < 0) return null;
    const r = playMove(tiles, stones, history, id, currentPlayer);
    return { kind: 'tile', id, verts: tiles[id].verts, legal: r.ok };
  };

  const target = useMemo(
    () => targetAt(hoveredPos),
    [hoveredPos, humanTurn, tiles, stones, history, currentPlayer, selectedTileType, rotation]
  );

  const placeTarget = (t) => {
    if (!t || !t.legal) return;
    dispatch(t.kind === 'opening' ? { type: 'open', cand: t.cand } : { type: 'claim', id: t.id });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
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
      if (!(fxDrawsTarget && target.legal)) skin.drawTarget(ctx, target.verts, currentPlayer as Player, target.legal);

      // Red border while the opening tile would stick out of the board
      if (target.kind === 'opening' && !target.legal) {
        ctx.save();
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, BOARD_W - 8, BOARD_H - 8);
        ctx.restore();
      }
    }
  }, [tiles, stones, lastMove, gameOver, target, currentPlayer, skin, fxDrawsLastMove, fxDrawsTarget]);

  useEffect(() => {
    const show = target && target.legal;
    fx?.setTarget?.(show ? { verts: target.verts, player: currentPlayer as Player } : null);
  }, [fx, target, currentPlayer]);

  // Touch devices have no hover, so the preview follows a finger drag and
  // is lifted above the fingertip so it isn't hidden under it.
  const TOUCH_OFFSET_Y = 60;
  const isTouchDevice = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;

  // Convert a pointer event's CSS pixel position into the canvas's internal
  // 800x600 drawing coordinates (the canvas is scaled to fit the window).
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touch = e.pointerType === 'touch';
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY - (touch ? TOUCH_OFFSET_Y : 0),
      touch
    };
  };

  const handlePointerDown = (e) => {
    if (!humanTurn) return;
    if (e.pointerType === 'touch') e.currentTarget.setPointerCapture?.(e.pointerId);
    setHoveredPos(getCanvasCoords(e));
  };

  const handlePointerMove = (e) => {
    if (!humanTurn) return;
    setHoveredPos(getCanvasCoords(e));
  };

  // Mouse: left click places immediately. Touch: lifting the finger leaves
  // the preview in place so it can be adjusted, and the Place button confirms.
  const handlePointerUp = (e) => {
    if (!humanTurn || e.pointerType !== 'mouse' || e.button !== 0) return;
    const t = targetAt(getCanvasCoords(e));
    // A click on an illegal tile still claims it, so the status line says why not
    if (t && t.kind === 'tile') dispatch({ type: 'claim', id: t.id });
    else placeTarget(t);
  };

  // Right-click rotates the opening tile clockwise (Shift + right-click
  // counter-clockwise) instead of opening the browser menu.
  const handleContextMenu = (e) => {
    e.preventDefault();
    if (!gameStarted || tiles) return;
    setRotation(prev => rotateStep(prev, e.shiftKey ? -1 : 1));
  };

  const handlePointerLeave = (e) => {
    if (e.pointerType === 'mouse') setHoveredPos(null);
  };


  // The layout fills exactly the visible window (dvh tracks mobile browser
  // toolbars): header, scores and controls take their natural height and the
  // board scales to the largest 4:3 size that fits in the rest.
  return (
    <div className={`safe-area [--pad:0.5rem] sm:[--pad:0.75rem] w-full h-dvh overflow-hidden ${skin.chrome.page} flex flex-col items-center`}>
      <div className="max-w-6xl w-full h-full flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className={`text-xl sm:text-2xl font-bold ${skin.chrome.title}`}>Penrogo</h1>
          <div className="flex items-center gap-3 sm:gap-4">
            <label className="text-slate-300 text-sm flex items-center gap-2">
              <Palette size={18} />
              <select
                value={skinId}
                onChange={(e) => {
                  setSkinId(e.target.value);
                  saveSkin(e.target.value);
                }}
                aria-label="Skin"
                className="bg-slate-700 text-white rounded-lg px-2 py-1"
              >
                {SKINS.map(k => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            </label>
            <button
              onClick={() => setShowHelp(true)}
              className="text-slate-300 hover:text-white flex items-center gap-1 text-sm"
            >
              <CircleHelp size={20} />
              How to Play
            </button>
          </div>
        </div>

        <div className={`${skin.chrome.panel} rounded-lg px-3 py-2 flex justify-around items-center`}>
          <div className="text-center">
            <div className={`${players[1].text} text-xl sm:text-2xl font-bold`}>{score[1]}</div>
            <div className="text-slate-400 text-xs sm:text-sm">
              {playerName(mode, 1)}{captured[1] > 0 && ` · ${captured[1]} captured`}
            </div>
          </div>

          <div className="text-center">
            <div className={`text-base sm:text-xl font-bold ${gameOver ? 'text-white' : players[currentPlayer].text}`}>
              {turnText(game)}
            </div>
            {game.message && (
              <div className="text-yellow-300 text-xs sm:text-sm">{game.message}</div>
            )}
          </div>

          <div className="text-center">
            <div className={`${players[2].text} text-xl sm:text-2xl font-bold`}>{score[2]}</div>
            <div className="text-slate-400 text-xs sm:text-sm">
              {playerName(mode, 2)}{captured[2] > 0 && ` · ${captured[2]} captured`}
            </div>
          </div>
        </div>

        <div className={`${skin.chrome.panel} rounded-lg p-2 flex gap-2 sm:gap-3 items-center justify-center flex-wrap`}>
          {!gameStarted ? (
            <>
              <div className="flex gap-2">
                <button
                  onClick={() => dispatch({ type: 'setMode', mode: 'two' })}
                  className={`px-4 py-3 rounded-lg font-semibold ${
                    mode === 'two' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  2 Players
                </button>
                <button
                  onClick={() => dispatch({ type: 'setMode', mode: 'ai' })}
                  className={`px-4 py-3 rounded-lg font-semibold ${
                    mode === 'ai' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  vs Computer
                </button>
              </div>
              {mode === 'ai' && (
                <label className="text-slate-300 text-sm flex items-center gap-2">
                  Computer thinks
                  <select
                    value={thinkSeconds}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setThinkSeconds(v);
                      saveThinkSeconds(v);
                    }}
                    className="bg-slate-700 text-white rounded-lg px-2 py-2"
                  >
                    {THINK_OPTIONS.map(s => (
                      <option key={s} value={s}>{s} s</option>
                    ))}
                  </select>
                </label>
              )}
              <button
                onClick={initGame}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-semibold"
              >
                <Play size={20} />
                Start Game
              </button>
            </>
          ) : (
            <>
              {!tiles && (
                <>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedTileType('kite')}
                      className={`px-4 py-2 rounded-lg font-semibold ${
                        selectedTileType === 'kite'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      Kite
                    </button>
                    <button
                      onClick={() => setSelectedTileType('dart')}
                      className={`px-4 py-2 rounded-lg font-semibold ${
                        selectedTileType === 'dart'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      Dart
                    </button>
                  </div>

                  {isTouchDevice ? (
                    <>
                      <button
                        onClick={() => setRotation(rotateStep(rotation, -1))}
                        aria-label="Rotate counter-clockwise"
                        className="bg-slate-700 active:bg-slate-600 text-white px-5 py-3 rounded-lg flex items-center gap-2"
                      >
                        <RotateCw size={22} style={{ transform: 'scaleX(-1)' }} />
                      </button>

                      <button
                        onClick={() => setRotation(rotateStep(rotation, 1))}
                        aria-label="Rotate clockwise"
                        className="bg-slate-700 active:bg-slate-600 text-white px-5 py-3 rounded-lg flex items-center gap-2"
                      >
                        <RotateCw size={22} />
                        <span className="text-sm">{rotation}°</span>
                      </button>
                    </>
                  ) : (
                    <div className="text-slate-300 text-sm flex items-center gap-2">
                      <RotateCw size={18} />
                      <span>Rotate: scroll wheel, right-click, or ←/→</span>
                      <span className="text-white font-semibold w-10">{rotation}°</span>
                    </div>
                  )}
                </>
              )}

              {isTouchDevice && !gameOver && (
                <button
                  onClick={() => { placeTarget(target); setHoveredPos(null); }}
                  disabled={!target || !target.legal}
                  className={`px-6 py-3 rounded-lg font-semibold text-white ${
                    target && target.legal ? 'bg-green-600 active:bg-green-700' : 'bg-slate-600 opacity-50'
                  }`}
                >
                  Place
                </button>
              )}

              {!gameOver && (
                <button
                  onClick={() => dispatch({ type: 'pass' })}
                  disabled={!humanTurn}
                  className={`bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 ${
                    humanTurn ? '' : 'opacity-50'
                  }`}
                >
                  <SkipForward size={20} />
                  {tiles ? 'Pass' : 'Skip Opening'}
                </button>
              )}

              <button
                onClick={resetGame}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <RotateCcw size={18} />
                New Game
              </button>
            </>
          )}
        </div>

        {/* Size container: the canvas width is the smaller of the full
            width and the width a 4:3 board would have at the full height. */}
        <div className="flex-1 min-h-0 flex items-start justify-center" style={{ containerType: 'size' }}>
          <div className="relative" style={{ width: 'min(100cqw, 100cqh * 4 / 3)' }}>
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onContextMenu={handleContextMenu}
            style={{ touchAction: 'none' }}
            className={`block w-full h-auto ${skin.chrome.canvas} rounded shadow-2xl cursor-crosshair`}
          />
          {effectsOn && (
            <canvas
              ref={overlayRef}
              width={800}
              height={600}
              aria-hidden="true"
              className="absolute inset-0 w-full h-full rounded pointer-events-none"
            />
          )}
          </div>
        </div>
      </div>

      {showHelp && (
        <div
          className="safe-area [--pad:1rem] fixed inset-0 z-10 bg-slate-900/95 overflow-y-auto"
          onClick={() => setShowHelp(false)}
        >
          <div
            className={`max-w-2xl mx-auto ${skin.chrome.panel} rounded-lg p-4 sm:p-6 text-slate-300 text-sm sm:text-base`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl sm:text-2xl font-bold text-white">How to Play</h2>
              <button
                onClick={() => setShowHelp(false)}
                aria-label="Close"
                className="text-slate-300 hover:text-white p-1"
              >
                <X size={24} />
              </button>
            </div>
            <p className="mb-3">Go, played on a Penrose tiling of kites and darts.</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Choose 2 Players or vs Computer (the computer plays {players[2].name}), then press Start. Against the computer you can also choose how long it thinks per move: longer thinking makes it stronger</li>
              <li>
                Player 1 places the first tile anywhere, as a kite or dart at any rotation
                {isTouchDevice
                  ? ' (rotate with the buttons)'
                  : ' (rotate with the scroll wheel, right-click, or Left/Right arrow keys)'}.
                A full Penrose tiling is then laid out around it, and that tile is Player 1's first stone
              </li>
              <li>Players then take turns claiming any empty tile</li>
              <li>Tiles that share an edge are neighbors. A group of your tiles is captured, and removed, when none of its neighbors are empty</li>
              <li>You can't claim a tile that would leave your own group with no empty neighbors (suicide), or that repeats an earlier position (ko)</li>
              <li>Pass when you have nothing useful to play. Two passes in a row end the game</li>
              <li>Score: tiles you hold plus empty areas surrounded only by your tiles. Surrounded areas are tinted when the game ends</li>
            </ul>
            <p className="mt-4 text-xs text-slate-400">
              Penrogo is open source under the MIT License.{' '}
              <a href="THIRD_PARTY_LICENSES.txt" target="_blank" rel="noopener" className="underline hover:text-slate-200">
                Third-party licenses
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PenroseTerritoryGame;
