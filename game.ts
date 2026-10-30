// The game's state and the moves that change it, as a pure reducer: the
// opening, claiming tiles, passing, and the status line and scoreboard
// they lead to. The component holds the state with React's useReducer and
// only draws it; nothing here touches the page.

import { buildBoard } from './penrose-board';
import { groupsInAtari, opponentOf, playMove, positionKey, scoreArea, type AtariGroup } from './rules';
import {
  DEFAULT_BOARD_SIZE, TILE_SIZE, boardSize, candidateVertices, isOutsidePlayfield, type BoardSizeId, type Candidate
} from './board-geometry';

import type { Player, Point, Score, Stone, Tile } from './types';

export type { AtariGroup, Player, Score, Stone, Tile };
// 'ai' plays against the computer (as Player 2); 'two' is two people.
export type Mode = 'ai' | 'two';

// What the last action did, for the skin's animations. A new object each
// time, so the component can react to it once.
export type GameEvent =
  | { kind: 'opening'; tiles: Tile[]; verts: Point[]; player: Player }
  | { kind: 'claim'; id: number; player: Player; lost: number[] };

export type GameState = {
  mode: Mode;
  size: BoardSizeId; // the board size, chosen when the game starts
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
  hint: Hint;
  past: GameState[]; // the state before each move so far (with its own `past` emptied), for Undo
};

// A hint for the player to move: being looked for, or found (a tile, or
// null to suggest passing). Cleared by the next move.
export type Hint = null | { status: 'thinking'; player: Player } | { status: 'shown'; move: number | null };

export type GameAction =
  | { type: 'setMode'; mode: Mode }
  | { type: 'start'; size?: BoardSizeId }
  | { type: 'reset' }
  | { type: 'open'; cand: Candidate }
  | { type: 'claim'; id: number }
  | { type: 'pass' }
  | { type: 'thinking' }
  | { type: 'askHint' }
  | { type: 'hint'; move: number | null }
  | { type: 'clearHint' }
  | { type: 'undo' };

export const OPENING_HINT = 'Place the first tile anywhere: the board is built around it.';
export const THINKING = 'Computer is thinking…';
export const HINT_THINKING = 'Looking for a good move…';
export const HINT_MOVE = 'Hint: the highlighted tile is a good move.';
export const HINT_PASS = 'Hint: passing is a good choice here.';
export const UNDONE = 'Move taken back.';

// How long the search may think for a hint
export const HINT_TIME_MS = 2000;

export const initialGame = (mode: Mode = 'ai', size: BoardSizeId = DEFAULT_BOARD_SIZE): GameState => ({
  mode,
  size,
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
  event: null,
  hint: null,
  past: []
});

export const playerName = (mode: Mode, p: Player) => (mode === 'ai' && p === 2 ? 'Computer' : `Player ${p}`);

export const isComputerTurn = (g: GameState) => g.mode === 'ai' && g.currentPlayer === 2;

// Whether a person may act now (place, pass, rotate the opening tile).
export const isHumanTurn = (g: GameState) => g.started && !g.gameOver && !isComputerTurn(g);

// The state after a move, remembering the one before it for Undo
const after = (g: GameState, next: Omit<GameState, 'past'>): GameState => ({
  ...next,
  past: [...g.past, { ...g, past: [] }]
});

// The opening tile: builds the board around it and makes it the mover's
// first stone. Unchanged if the tile would stick out of the board.
const open = (g: GameState, cand: Candidate): GameState => {
  const verts = candidateVertices(cand);
  const { w, h } = boardSize(g.size);
  if (g.tiles || isOutsidePlayfield(verts, w, h)) return g;
  const player = g.currentPlayer;
  const { tiles, opening } = buildBoard(cand.type, verts, w, h, TILE_SIZE);
  const stones: Stone[] = Array.from({ length: tiles.length }, () => 0);
  stones[opening] = player;
  return after(g, {
    ...g,
    tiles,
    stones,
    history: new Set([positionKey(stones)]),
    lastMove: opening,
    passes: 0,
    currentPlayer: opponentOf(player),
    message: '',
    event: { kind: 'opening', tiles, verts, player }
  });
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
  return after(g, {
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
    event: { kind: 'claim', id, player, lost },
    hint: null
  });
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
    return after(g, { ...g, currentPlayer: opponentOf(player), message: `${name} skipped the opening.` });
  }
  const passes = g.passes + 1;
  if (passes >= 2) {
    const { score } = scoreArea(g.tiles, g.stones);
    return after(g, { ...g, passes, gameOver: score, message: resultText(g.mode, score), hint: null });
  }
  return after(g, { ...g, passes, currentPlayer: opponentOf(player), message: `${name} passes.`, hint: null });
};

// How many moves Undo takes back: the last one with 2 players; against the
// computer, back to the last time it was the person's turn (their move and
// the computer's reply, or just their move while the computer thinks).
// 0 when there is nothing to take back.
export const undoDepth = (g: GameState): number => {
  if (!g.started) return 0;
  if (g.mode === 'two') return g.past.length > 0 ? 1 : 0;
  for (let i = g.past.length - 1; i >= 0; i--) {
    if (!isComputerTurn(g.past[i])) return g.past.length - i;
  }
  return 0;
};

// Takes moves back (see undoDepth): the board, captures, turn, passes, the
// positions seen for superko and the end of the game all return to what
// they were. Any hint goes.
const undo = (g: GameState): GameState => {
  const depth = undoDepth(g);
  if (depth === 0) return g;
  const keep = g.past.length - depth;
  return { ...g.past[keep], past: g.past.slice(0, keep), hint: null, event: null, message: UNDONE };
};

// Asking for a hint: only on a person's turn once the board exists, and
// not while one is already being looked for.
const askHint = (g: GameState): GameState => {
  if (!g.tiles || !isHumanTurn(g) || g.hint?.status === 'thinking') return g;
  return { ...g, hint: { status: 'thinking', player: g.currentPlayer }, message: HINT_THINKING };
};

// The hint found: shown only if it is still being waited for (a move in
// the meantime clears the request, so a late answer is dropped).
const showHint = (g: GameState, move: number | null): GameState => {
  if (g.hint?.status !== 'thinking') return g;
  return { ...g, hint: { status: 'shown', move }, message: move === null ? HINT_PASS : HINT_MOVE };
};

// Moves are ignored before the game starts and after it ends.
export const gameReducer = (g: GameState, a: GameAction): GameState => {
  switch (a.type) {
    case 'setMode':
      return g.started ? g : { ...g, mode: a.mode };
    case 'start':
      return { ...initialGame(g.mode, a.size ?? g.size), started: true, message: OPENING_HINT };
    case 'reset':
      return initialGame(g.mode, g.size);
    case 'undo':
      return undo(g);
  }
  if (!g.started || g.gameOver) return g;
  switch (a.type) {
    case 'open': return open(g, a.cand);
    case 'claim': return claim(g, a.id);
    case 'pass': return pass(g);
    case 'thinking': return { ...g, message: THINKING };
    case 'askHint': return askHint(g);
    case 'hint': return showHint(g, a.move);
    case 'clearHint': return g.hint ? { ...g, hint: null, message: '' } : g;
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

// The groups in atari while the game is played: none before the board
// exists or once the game is over.
export const ataris = (g: GameState): AtariGroup[] =>
  g.tiles && !g.gameOver ? groupsInAtari(g.tiles, g.stones) : [];

// The atari warning: for each player with tiles in atari, how many, e.g.
// "Your 3 tiles are in atari; the computer's tile is in atari." Empty when
// there are none.
export const atariText = (mode: Mode, groups: AtariGroup[]) => {
  const owner = (p: Player) => (mode === 'ai' ? (p === 1 ? 'your' : "the computer's") : `Player ${p}'s`);
  const parts = ([1, 2] as const).flatMap(p => {
    const n = groups.filter(x => x.player === p).reduce((sum, x) => sum + x.members.length, 0);
    if (n === 0) return [];
    return [n === 1 ? `${owner(p)} tile is in atari` : `${owner(p)} ${n} tiles are in atari`];
  });
  if (!parts.length) return '';
  const text = `${parts.join('; ')}.`;
  return text[0].toUpperCase() + text.slice(1);
};

// The line above the status: whose turn it is.
export const turnText = (g: GameState) => {
  if (!g.started) return 'Press Start';
  if (g.gameOver) return 'Game Over';
  return `${playerName(g.mode, g.currentPlayer)}'s Turn`;
};
