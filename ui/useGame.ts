// The game as React state: the reducer from game.ts, plus the two searches
// that run in a Web Worker (go-engine's Monte Carlo player):
// - the computer's turn: it opens the board (after a short pause) or
//   searches for a move and plays it, or passes;
// - a hint: when one is asked for, the search looks for the best move for
//   the player to move and the reducer shows it.
// A search is discarded if the position changes first (e.g. New Game, or a
// move while a hint is being looked for), so a stale answer is never used.
import { useEffect, useReducer } from 'react';
import { HINT_TIME_MS, gameReducer, initialGame, isComputerTurn, type GameState } from '../game';
import { boardSize, computerOpening } from '../opening';
import type { ThinkRequest } from '../ai-worker';
import type { SearchOptions } from '../go-engine';
import type { Player } from '../types';

const COMPUTER_OPENING_DELAY_MS = 400;

// The part of the game a search needs
type Position = Pick<GameState, 'stones' | 'history' | 'passes'> & { tiles: NonNullable<GameState['tiles']> };

// Starts a search for `player` in a worker and calls `onMove` with its
// answer (a tile, or null to pass). Returns a function that discards it.
const search = (pos: Position, player: Player, limits: ThinkRequest['search'], onMove: (move: number | null) => void) => {
  const worker = new Worker(new URL('../ai-worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => onMove(e.data.move);
  const request: ThinkRequest = {
    neighbors: pos.tiles.map(t => t.neighbors),
    stones: pos.stones,
    history: [...pos.history],
    player,
    opponentPassed: pos.passes > 0,
    search: limits
  };
  worker.postMessage(request);
  return () => worker.terminate();
};

// `computer` is how the computer searches (its level: see LEVELS in prefs.ts)
export const useGame = (computer: Omit<SearchOptions, 'rand'>) => {
  const [game, dispatch] = useReducer(gameReducer, undefined, () => initialGame());
  const { started, gameOver, tiles, stones, history, passes, hint, size } = game;
  const computerTurn = isComputerTurn(game);

  useEffect(() => {
    if (!started || gameOver || !computerTurn) return;

    dispatch({ type: 'thinking' });
    if (!tiles) {
      const cand = computerOpening(boardSize(size));
      const timer = setTimeout(() => dispatch({ type: 'open', cand }), COMPUTER_OPENING_DELAY_MS);
      return () => clearTimeout(timer);
    }

    return search({ tiles, stones, history, passes }, 2, computer,
      move => dispatch(move === null ? { type: 'pass' } : { type: 'claim', id: move }));
  }, [started, gameOver, computerTurn, tiles, stones, history, passes, size, computer]);

  useEffect(() => {
    if (hint?.status !== 'thinking' || !tiles) return;
    return search({ tiles, stones, history, passes }, hint.player, { timeMs: HINT_TIME_MS }, move => dispatch({ type: 'hint', move }));
  }, [hint, tiles, stones, history, passes]);

  return [game, dispatch] as const;
};
