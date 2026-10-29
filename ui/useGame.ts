// The game as React state: the reducer from game.ts, plus the computer's
// turn. When it is the computer's move it opens the board (after a short
// pause) or searches for a move in a Web Worker (go-engine's Monte Carlo
// player) and plays it, or passes. The worker is discarded if the turn is
// abandoned (e.g. New Game), so a stale answer can never be played.
import { useEffect, useReducer } from 'react';
import { gameReducer, initialGame, isComputerTurn } from '../game';
import { COMPUTER_OPENING } from '../opening';

const COMPUTER_OPENING_DELAY_MS = 400;

export const useGame = (thinkSeconds: number) => {
  const [game, dispatch] = useReducer(gameReducer, undefined, () => initialGame());
  const { started, gameOver, tiles, stones, history, passes } = game;
  const computerTurn = isComputerTurn(game);

  useEffect(() => {
    if (!started || gameOver || !computerTurn) return;

    dispatch({ type: 'thinking' });
    if (!tiles) {
      const timer = setTimeout(() => dispatch({ type: 'open', cand: COMPUTER_OPENING }), COMPUTER_OPENING_DELAY_MS);
      return () => clearTimeout(timer);
    }

    const worker = new Worker(new URL('../ai-worker.ts', import.meta.url), { type: 'module' });
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
  }, [started, gameOver, computerTurn, tiles, stones]);

  return [game, dispatch] as const;
};
