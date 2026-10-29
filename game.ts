// The game's state and the moves that change it, as a pure reducer: the
// opening, claiming tiles, passing, and the status line and scoreboard
// they lead to. The component holds the state with React's useReducer and
// only draws it; nothing here touches the page.

import { buildBoard } from './penrose-board';
import { opponentOf, playMove, positionKey, scoreArea } from './go-engine';
import {
  BOARD_H, BOARD_W, TILE_SIZE, candidateVertices, isOutsidePlayfield, tileAtPoint, type Candidate
} from './opening';

import type { Player, Point, Score, Stone, Tile, TileType } from './types';

export type { Player, Score, Stone, Tile };
// 'ai' plays against the computer (as Player 2); 'two' is two people.
export type Mode = 'ai' | 'two';

// What the last action did, for the skin's animations. A new object each
// time, so the component can react to it once.
export type GameEvent =
  | { kind: 'opening'; tiles: Tile[]; verts: Point[]; player: Player }
  | { kind: 'claim'; id: number; player: Player; lost: number[] };

export type GameState = {
  mode: Mode;
  started: boolean;
  tiles: Tile[] | null; // null until the opening builds the board
  stones: Stone[];
  history: Set<string>; // every position so far, for superko
  currentPlayer: Player;
  passes: number; // consecutive passes
  captured: Score; // tiles each player has captured
  lastMove: number | null; // tile id
  gameOver: Score | null; // final area scores
  message: string; // the status line under the turn
  event: GameEvent | null;
};

export type GameAction =
  | { type: 'setMode'; mode: Mode }
  | { type: 'start' }
  | { type: 'reset' }
  | { type: 'open'; cand: Candidate }
  | { type: 'claim'; id: number }
  | { type: 'pass' }
  | { type: 'thinking' };

export const OPENING_HINT = 'Place the first tile anywhere: the board is built around it.';
export const THINKING = 'Computer is thinking…';

export const initialGame = (mode: Mode = 'ai'): GameState => ({
  mode,
  started: false,
  tiles: null,
  stones: [],
  history: new Set(),
  currentPlayer: 1,
  passes: 0,
  captured: { 1: 0, 2: 0 },
  lastMove: null,
  gameOver: null,
  message: '',
  event: null
});

export const playerName = (mode: Mode, p: Player) => (mode === 'ai' && p === 2 ? 'Computer' : `Player ${p}`);

export const isComputerTurn = (g: GameState) => g.mode === 'ai' && g.currentPlayer === 2;

// Whether a person may act now (place, pass, rotate the opening tile).
export const isHumanTurn = (g: GameState) => g.started && !g.gameOver && !isComputerTurn(g);

// The opening tile: builds the board around it and makes it the mover's
// first stone. Unchanged if the tile would stick out of the board.
const open = (g: GameState, cand: Candidate): GameState => {
  const verts = candidateVertices(cand);
  if (g.tiles || isOutsidePlayfield(verts)) return g;
  const player = g.currentPlayer;
  const { tiles, opening } = buildBoard(cand.type, verts, BOARD_W, BOARD_H, TILE_SIZE);
  const stones: Stone[] = Array.from({ length: tiles.length }, () => 0);
  stones[opening] = player;
  return {
    ...g,
    tiles,
    stones,
    history: new Set([positionKey(stones)]),
    lastMove: opening,
    passes: 0,
    currentPlayer: opponentOf(player),
    message: '',
    event: { kind: 'opening', tiles, verts, player }
  };
};

// Claims tile `id` for the mover, if legal; otherwise the status line
// gives the reason.
const claim = (g: GameState, id: number): GameState => {
  if (!g.tiles) return g;
  const player = g.currentPlayer;
  const r = playMove(g.tiles, g.stones, g.history, id, player);
  if (r.ok === false) return { ...g, message: r.reason };
  const opp = opponentOf(player);
  const lost = g.stones.map((s, i) => (s === opp && r.stones[i] === 0 ? i : -1)).filter(i => i >= 0);
  return {
    ...g,
    stones: r.stones,
    history: new Set(g.history).add(positionKey(r.stones)),
    lastMove: id,
    passes: 0,
    captured: r.captured > 0 ? { ...g.captured, [player]: g.captured[player] + r.captured } : g.captured,
    message: r.captured > 0
      ? `${playerName(g.mode, player)} captured ${r.captured} tile${r.captured === 1 ? '' : 's'}!`
      : '',
    currentPlayer: opp,
    event: { kind: 'claim', id, player, lost }
  };
};

// The status line at the end of the game.
export const resultText = (mode: Mode, score: Score) => {
  if (score[1] === score[2]) return `Game over: a tie at ${score[1]}.`;
  const winner: Player = score[1] > score[2] ? 1 : 2;
  return `Game over: ${playerName(mode, winner)} wins ${score[winner]} to ${score[opponentOf(winner)]}.`;
};

// Passing. Before the board exists, it skips the opening and hands it to
// the other player. Two passes in a row end the game, scored by area.
const pass = (g: GameState): GameState => {
  const player = g.currentPlayer;
  const name = playerName(g.mode, player);
  if (!g.tiles) {
    return { ...g, currentPlayer: opponentOf(player), message: `${name} skipped the opening.` };
  }
  const passes = g.passes + 1;
  if (passes >= 2) {
    const { score } = scoreArea(g.tiles, g.stones);
    return { ...g, passes, gameOver: score, message: resultText(g.mode, score) };
  }
  return { ...g, passes, currentPlayer: opponentOf(player), message: `${name} passes.` };
};

// Moves are ignored before the game starts and after it ends.
export const gameReducer = (g: GameState, a: GameAction): GameState => {
  switch (a.type) {
    case 'setMode':
      return g.started ? g : { ...g, mode: a.mode };
    case 'start':
      return { ...initialGame(g.mode), started: true, message: OPENING_HINT };
    case 'reset':
      return initialGame(g.mode);
  }
  if (!g.started || g.gameOver) return g;
  switch (a.type) {
    case 'open': return open(g, a.cand);
    case 'claim': return claim(g, a.id);
    case 'pass': return pass(g);
    case 'thinking': return { ...g, message: THINKING };
  }
};

// The scoreboard's numbers: stones on the board during play, the area
// score once the game is over.
export const shownScore = (g: GameState): Score => {
  if (g.gameOver) return g.gameOver;
  const c = { 1: 0, 2: 0 };
  g.stones.forEach(s => { if (s) c[s] += 1; });
  return c;
};

// The line above the status: whose turn it is.
export const turnText = (g: GameState) => {
  if (!g.started) return 'Press Start';
  if (g.gameOver) return 'Game Over';
  return `${playerName(g.mode, g.currentPlayer)}'s Turn`;
};

// What a point on the board is over, for the preview and for placing: the
// opening tile (of the chosen type and rotation, centered on the point) and
// whether it fits, or the board tile under it and whether claiming it is
// legal. Null when it isn't a person's turn or the point is off every tile.
export type Target =
  | { kind: 'opening'; cand: Candidate; verts: Point[]; legal: boolean }
  | { kind: 'tile'; id: number; verts: Point[]; legal: boolean };

export const targetAt = (g: GameState, pos: Point | null, type: TileType, rotation: number): Target | null => {
  if (!pos || !isHumanTurn(g)) return null;
  if (!g.tiles) {
    const cand = { type, x: pos.x, y: pos.y, rotation };
    const verts = candidateVertices(cand);
    return { kind: 'opening', cand, verts, legal: !isOutsidePlayfield(verts) };
  }
  const id = tileAtPoint(g.tiles, pos.x, pos.y);
  if (id < 0) return null;
  const r = playMove(g.tiles, g.stones, g.history, id, g.currentPlayer);
  return { kind: 'tile', id, verts: g.tiles[id].verts, legal: r.ok };
};

// The action placing on a target: the opening, or claiming the tile. Null
// for an illegal opening (it is not placed). An illegal tile is still
// claimed, so the status line says why not.
export const placeAction = (t: Target | null): GameAction | null => {
  if (!t) return null;
  if (t.kind === 'opening') return t.legal ? { type: 'open', cand: t.cand } : null;
  return { type: 'claim', id: t.id };
};
