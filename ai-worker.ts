// Runs the computer player's search off the main thread, so the page stays
// responsive while it thinks.
import { chooseMctsMove } from './go-engine';
import type { GraphTile, Player, Stone } from './types';

// What the page sends: the board as neighbor lists, the position, every
// earlier position (for superko), whose move it is, whether the other
// player just passed, and how long to think.
export type ThinkRequest = {
  neighbors: number[][];
  stones: Stone[];
  history: string[];
  player: Player;
  opponentPassed: boolean;
  timeMs: number;
};

self.onmessage = (e: MessageEvent<ThinkRequest>) => {
  const { neighbors, stones, history, player, opponentPassed, timeMs } = e.data;
  const tiles: GraphTile[] = neighbors.map(n => ({ neighbors: n }));
  const result = chooseMctsMove(tiles, stones, new Set(history), player, opponentPassed, { timeMs });
  (self as unknown as Worker).postMessage(result);
};
