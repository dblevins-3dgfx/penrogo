// Runs the computer player's search off the main thread, so the page stays
// responsive while it thinks.
import { chooseMctsMove, type SearchOptions } from './mcts';
import type { GraphTile, Player, Stone } from './types';

// What the page sends: the board as neighbor lists, the position, every
// earlier position (for superko), whose move it is, whether the other
// player just passed, and the search's limits (its options can't include
// `rand`, a function, which can't be sent to a worker).
export type ThinkRequest = {
  neighbors: number[][];
  stones: Stone[];
  history: string[];
  player: Player;
  opponentPassed: boolean;
  search: Omit<SearchOptions, 'rand'>;
};

self.onmessage = (e: MessageEvent<ThinkRequest>) => {
  const { neighbors, stones, history, player, opponentPassed, search } = e.data;
  const tiles: GraphTile[] = neighbors.map(n => ({ neighbors: n }));
  const result = chooseMctsMove(tiles, stones, new Set(history), player, opponentPassed, search);
  (self as unknown as Worker).postMessage(result);
};
