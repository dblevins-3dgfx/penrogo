import React, { useState, useRef, useEffect, useMemo } from 'react';
import { RotateCw, Play, SkipForward, RotateCcw, CircleHelp, X, Palette } from 'lucide-react';
import { buildBoard } from './penrose-board';
import { opponentOf, playMove, positionKey, scoreArea } from './go-engine';
import { SKINS, DEFAULT_SKIN, skinById } from './skins';
import { DazzleEffects } from './dazzle-effects';

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

const PHI = (1 + Math.sqrt(5)) / 2;
const TILE_SIZE = 60;

// Playfield size (matches the canvas).
const BOARD_W = 800;
const BOARD_H = 600;

// ---------------------------------------------------------------------
// Tile geometry (used for the opening tile, which decides the board)
// ---------------------------------------------------------------------

// Kite: vertices O(72°) -> B(72°) -> C(144°) -> D(72°), edges long, short,
// short, long. Axis of symmetry through O and C. Centered on the centroid.
const getKiteVertices = (x, y, rotation) => {
  const r = rotation * Math.PI / 180;
  const long = TILE_SIZE;
  const deg36 = 36 * Math.PI / 180;

  const local = [
    { x: 0, y: 0 },
    { x: long * Math.cos(r + deg36), y: long * Math.sin(r + deg36) },
    { x: long * Math.cos(r), y: long * Math.sin(r) },
    { x: long * Math.cos(r - deg36), y: long * Math.sin(r - deg36) }
  ];

  const cx = local.reduce((s, v) => s + v.x, 0) / local.length;
  const cy = local.reduce((s, v) => s + v.y, 0) / local.length;

  return local.map(v => ({ x: x + v.x - cx, y: y + v.y - cy }));
};

// Dart: vertices M(72°) -> N(36°) -> A'(216°, reflex) -> N'(36°), edges
// long, short, short, long. Axis of symmetry through M and A'.
const getDartVertices = (x, y, rotation) => {
  const r = rotation * Math.PI / 180;
  const long = TILE_SIZE;
  const deg36 = 36 * Math.PI / 180;

  const local = [
    { x: 0, y: 0 },
    { x: long * Math.cos(r + deg36), y: long * Math.sin(r + deg36) },
    { x: (long / PHI) * Math.cos(r), y: (long / PHI) * Math.sin(r) },
    { x: long * Math.cos(r - deg36), y: long * Math.sin(r - deg36) }
  ];

  const cx = local.reduce((s, v) => s + v.x, 0) / local.length;
  const cy = local.reduce((s, v) => s + v.y, 0) / local.length;

  return local.map(v => ({ x: x + v.x - cx, y: y + v.y - cy }));
};

const getVertices = (tile) => tile.type === 'kite'
  ? getKiteVertices(tile.x, tile.y, tile.rotation)
  : getDartVertices(tile.x, tile.y, tile.rotation);

// Both tiles split into two triangles along the vertex 0 to 2 diagonal
// (the axis), which also handles the dart's concave notch.
const toTriangles = (v) => [[v[0], v[1], v[2]], [v[0], v[2], v[3]]];

const pointInTriangle = (px, py, tri) => {
  const [a, b, c] = tri;
  const d1 = (px - b.x) * (a.y - b.y) - (a.x - b.x) * (py - b.y);
  const d2 = (px - c.x) * (b.y - c.y) - (b.x - c.x) * (py - c.y);
  const d3 = (px - a.x) * (c.y - a.y) - (c.x - a.x) * (py - a.y);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
};

// True if any vertex lies outside the playfield (small rounding tolerance).
const isOutsidePlayfield = (verts) => {
  const EDGE_TOL = 0.5;
  return verts.some(v =>
    v.x < -EDGE_TOL || v.x > BOARD_W + EDGE_TOL ||
    v.y < -EDGE_TOL || v.y > BOARD_H + EDGE_TOL
  );
};

// Index of the board tile containing (x, y), or -1.
const tileAtPoint = (tiles, x, y) =>
  tiles.findIndex(t => toTriangles(t.verts).some(tri => pointInTriangle(x, y, tri)));

const PenroseTerritoryGame = () => {
  const canvasRef = useRef(null);
  const [mode, setMode] = useState('ai'); // 'ai' (vs computer) or 'two'
  const [thinkSeconds, setThinkSeconds] = useState(loadThinkSeconds);
  const [gameStarted, setGameStarted] = useState(false);
  const [board, setBoard] = useState(null); // tiles, created by the opening move
  const [stones, setStones] = useState([]);
  const [history, setHistory] = useState(() => new Set());
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [passes, setPasses] = useState(0); // consecutive passes
  const [captured, setCaptured] = useState({ 1: 0, 2: 0 });
  const [lastMove, setLastMove] = useState(null); // tile id
  const [gameOver, setGameOver] = useState(null); // final area scores
  const [statusMsg, setStatusMsg] = useState('');
  const [selectedTileType, setSelectedTileType] = useState('kite');
  const [rotation, setRotation] = useState(0);
  const [hoveredPos, setHoveredPos] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [skinId, setSkinId] = useState(loadSkin);
  const skin = skinById(skinId);

  // Animated effects (Dazzle) on an overlay canvas above the board, unless
  // the device asks for reduced motion.
  const overlayRef = useRef(null);
  const effectsRef = useRef(null);
  if (!effectsRef.current) effectsRef.current = new DazzleEffects();
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  );
  const effectsOn = !!skin.effects && !reducedMotion;

  const tiles = board ? board.tiles : null;
  const isComputerTurn = mode === 'ai' && currentPlayer === 2;
  const humanTurn = gameStarted && !gameOver && !isComputerTurn;
  const playerName = (p) => (mode === 'ai' && p === 2 ? 'Computer' : `Player ${p}`);

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
    if (!effectsOn || !overlayRef.current) return;
    const fx = effectsRef.current;
    fx.attach(overlayRef.current);
    return () => fx.detach();
  }, [effectsOn]);

  useEffect(() => {
    effectsRef.current.setBoard(tiles, stones);
  }, [board, stones]);

  useEffect(() => {
    const show = effectsOn && board && lastMove !== null && stones[lastMove];
    effectsRef.current.setLastMove(show ? tiles[lastMove].verts : null);
  }, [effectsOn, board, stones, lastMove]);

  // Live score is stones on the board; at the end it is area (stones plus
  // surrounded empty tiles).
  const stoneCount = useMemo(() => {
    const c = { 1: 0, 2: 0 };
    stones.forEach(s => { if (s) c[s] += 1; });
    return c;
  }, [stones]);
  const shownScore = gameOver || stoneCount;

  const initGame = () => {
    setBoard(null);
    setStones([]);
    setHistory(new Set());
    setCurrentPlayer(1);
    setPasses(0);
    setCaptured({ 1: 0, 2: 0 });
    setLastMove(null);
    setGameOver(null);
    setRotation(0);
    setGameStarted(true);
    setStatusMsg('Place the first tile anywhere: the board is built around it.');
  };

  const resetGame = () => {
    setGameStarted(false);
    setBoard(null);
    setStones([]);
    setGameOver(null);
    setLastMove(null);
    setHoveredPos(null);
    setStatusMsg('');
  };

  // The opening tile: generates the board around it and claims it.
  const placeOpening = (cand, player) => {
    const verts = getVertices(cand);
    if (isOutsidePlayfield(verts)) return false;
    const { tiles: newTiles, opening } = buildBoard(cand.type, verts, BOARD_W, BOARD_H, TILE_SIZE);
    const newStones = new Array(newTiles.length).fill(0);
    newStones[opening] = player;
    effectsRef.current.cascade(newTiles, verts);
    effectsRef.current.place(verts, player);
    setBoard({ tiles: newTiles });
    setStones(newStones);
    setHistory(new Set([positionKey(newStones)]));
    setLastMove(opening);
    setPasses(0);
    setCurrentPlayer(opponentOf(player));
    setStatusMsg('');
    return true;
  };

  // Claims board tile `id` for `player`, if legal.
  const claimTile = (id, player) => {
    const r = playMove(tiles, stones, history, id, player);
    if (!r.ok) {
      setStatusMsg(r.reason);
      return false;
    }
    const opp = opponentOf(player);
    const lost = stones.map((s, i) => (s === opp && r.stones[i] === 0 ? i : -1)).filter(i => i >= 0);
    effectsRef.current.place(tiles[id].verts, player);
    if (lost.length) effectsRef.current.capture(lost.map(i => tiles[i].verts), opp, player);
    setStones(r.stones);
    setHistory(prev => new Set(prev).add(positionKey(r.stones)));
    setLastMove(id);
    setPasses(0);
    if (r.captured > 0) {
      setCaptured(prev => ({ ...prev, [player]: prev[player] + r.captured }));
      setStatusMsg(`${playerName(player)} captured ${r.captured} tile${r.captured === 1 ? '' : 's'}!`);
    } else {
      setStatusMsg('');
    }
    setCurrentPlayer(opponentOf(player));
    return true;
  };

  const pass = (player) => {
    if (!board) {
      // Skipping the opening hands it to the other player
      setCurrentPlayer(opponentOf(player));
      setStatusMsg(`${playerName(player)} skipped the opening.`);
      return;
    }
    const n = passes + 1;
    setPasses(n);
    if (n >= 2) {
      const { score } = scoreArea(tiles, stones);
      setGameOver(score);
      const winner = score[1] === score[2] ? null : score[1] > score[2] ? 1 : 2;
      setStatusMsg(winner
        ? `Game over: ${playerName(winner)} wins ${score[winner]} to ${score[opponentOf(winner)]}.`
        : `Game over: a tie at ${score[1]}.`);
      return;
    }
    setStatusMsg(`${playerName(player)} passes.`);
    setCurrentPlayer(opponentOf(player));
  };

  // The computer's turn: open the board if needed, otherwise search for a
  // move in a background worker (go-engine's Monte Carlo player) and play
  // it, or pass. The worker is discarded if the turn is abandoned (e.g. New
  // Game), so a stale answer can never be played.
  useEffect(() => {
    if (!gameStarted || gameOver || !isComputerTurn) return;

    setStatusMsg('Computer is thinking…');
    if (!board) {
      const timer = setTimeout(() => {
        placeOpening({ type: 'kite', x: BOARD_W / 2, y: BOARD_H / 2, rotation: 0 }, 2);
      }, 400);
      return () => clearTimeout(timer);
    }

    const worker = new Worker(new URL('./ai-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { move } = e.data;
      if (move === null) pass(2);
      else claimTile(move, 2);
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
  }, [gameStarted, gameOver, isComputerTurn, board, stones]);

  // Rotation controls (only matter for the opening tile)
  useEffect(() => {
    if (!gameStarted) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setRotation(prev => (prev - 36 + 360) % 360);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setRotation(prev => (prev + 36) % 360);
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
    if (!canvas || !gameStarted || board) return;

    const WHEEL_NOTCH = 50;
    const TRACKPAD_STEP = 50; // lower = faster trackpad rotation
    const SWIPE_END_MS = 150;
    const swipe = { total: 0, timer: null };

    const rotateBy = (dy) => setRotation(prev => (prev + (dy < 0 ? 36 : -36) + 360) % 360);

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
  }, [gameStarted, board]);

  // What a point is over: the opening tile preview, or a board tile and
  // whether claiming it is legal.
  const targetAt = (pos) => {
    if (!pos || !humanTurn) return null;
    if (!board) {
      const cand = { type: selectedTileType, x: pos.x, y: pos.y, rotation };
      const verts = getVertices(cand);
      return { kind: 'opening', cand, verts, legal: !isOutsidePlayfield(verts) };
    }
    const id = tileAtPoint(tiles, pos.x, pos.y);
    if (id < 0) return null;
    const r = playMove(tiles, stones, history, id, currentPlayer);
    return { kind: 'tile', id, verts: tiles[id].verts, legal: r.ok };
  };

  const target = useMemo(
    () => targetAt(hoveredPos),
    [hoveredPos, humanTurn, board, stones, history, currentPlayer, selectedTileType, rotation]
  );

  const placeTarget = (t) => {
    if (!t || !t.legal) return;
    if (t.kind === 'opening') placeOpening(t.cand, currentPlayer);
    else claimTile(t.id, currentPlayer);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    skin.drawBackground(ctx, canvas.width, canvas.height);

    if (board) {
      const territory = gameOver ? scoreArea(tiles, stones).owner : null;
      tiles.forEach((t, i) => {
        skin.drawTile(ctx, t.verts, { stone: stones[i], territory: territory ? territory[i] : 0 });
      });
      // With effects on, the overlay animates the last move instead
      if (lastMove !== null && stones[lastMove] && !effectsOn) skin.drawLastMove(ctx, tiles[lastMove].verts);
    }

    if (target) {
      // With effects on, the overlay floats a legal preview instead
      if (!(effectsOn && target.legal)) skin.drawTarget(ctx, target.verts, currentPlayer, target.legal);

      // Red border while the opening tile would stick out of the board
      if (target.kind === 'opening' && !target.legal) {
        ctx.save();
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, BOARD_W - 8, BOARD_H - 8);
        ctx.restore();
      }
    }
  }, [board, stones, lastMove, gameOver, target, currentPlayer, skin, effectsOn]);

  useEffect(() => {
    const show = effectsOn && target && target.legal;
    effectsRef.current.setTarget(show ? { verts: target.verts, player: currentPlayer } : null);
  }, [effectsOn, target, currentPlayer]);

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
    if (t && t.kind === 'tile' && !t.legal) {
      setStatusMsg(playMove(tiles, stones, history, t.id, currentPlayer).reason);
    }
    placeTarget(t);
  };

  // Right-click rotates the opening tile clockwise (Shift + right-click
  // counter-clockwise) instead of opening the browser menu.
  const handleContextMenu = (e) => {
    e.preventDefault();
    if (!gameStarted || board) return;
    setRotation(prev => (prev + (e.shiftKey ? -36 : 36) + 360) % 360);
  };

  const handlePointerLeave = (e) => {
    if (e.pointerType === 'mouse') setHoveredPos(null);
  };

  const turnText = !gameStarted
    ? 'Press Start'
    : gameOver
      ? 'Game Over'
      : `${playerName(currentPlayer)}'s Turn`;

  // The layout fills exactly the visible window (dvh tracks mobile browser
  // toolbars): header, scores and controls take their natural height and the
  // board scales to the largest 4:3 size that fits in the rest.
  return (
    <div className={`w-full h-dvh overflow-hidden ${skin.chrome.page} flex flex-col items-center p-2 sm:p-3`}>
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
            <div className="text-blue-400 text-xl sm:text-2xl font-bold">{shownScore[1]}</div>
            <div className="text-slate-400 text-xs sm:text-sm">
              {playerName(1)}{captured[1] > 0 && ` · ${captured[1]} captured`}
            </div>
          </div>

          <div className="text-center">
            <div className={`text-base sm:text-xl font-bold ${gameOver ? 'text-white' : currentPlayer === 1 ? 'text-blue-400' : 'text-red-400'}`}>
              {turnText}
            </div>
            {statusMsg && (
              <div className="text-yellow-300 text-xs sm:text-sm">{statusMsg}</div>
            )}
          </div>

          <div className="text-center">
            <div className="text-red-400 text-xl sm:text-2xl font-bold">{shownScore[2]}</div>
            <div className="text-slate-400 text-xs sm:text-sm">
              {playerName(2)}{captured[2] > 0 && ` · ${captured[2]} captured`}
            </div>
          </div>
        </div>

        <div className={`${skin.chrome.panel} rounded-lg p-2 flex gap-2 sm:gap-3 items-center justify-center flex-wrap`}>
          {!gameStarted ? (
            <>
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('two')}
                  className={`px-4 py-3 rounded-lg font-semibold ${
                    mode === 'two' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  2 Players
                </button>
                <button
                  onClick={() => setMode('ai')}
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
              {!board && (
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
                        onClick={() => setRotation((rotation - 36 + 360) % 360)}
                        aria-label="Rotate counter-clockwise"
                        className="bg-slate-700 active:bg-slate-600 text-white px-5 py-3 rounded-lg flex items-center gap-2"
                      >
                        <RotateCw size={22} style={{ transform: 'scaleX(-1)' }} />
                      </button>

                      <button
                        onClick={() => setRotation((rotation + 36) % 360)}
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
                  onClick={() => pass(currentPlayer)}
                  disabled={!humanTurn}
                  className={`bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 ${
                    humanTurn ? '' : 'opacity-50'
                  }`}
                >
                  <SkipForward size={20} />
                  {board ? 'Pass' : 'Skip Opening'}
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
          className="fixed inset-0 z-10 bg-slate-900/95 overflow-y-auto p-4"
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
              <li>Choose 2 Players or vs Computer (the computer plays red), then press Start. Against the computer you can also choose how long it thinks per move: longer thinking makes it stronger</li>
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
          </div>
        </div>
      )}
    </div>
  );
};

export default PenroseTerritoryGame;
