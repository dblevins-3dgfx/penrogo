// Runs the computer player's search off the main thread, so the page stays
// responsive while it thinks.
import { chooseMctsMove } from './go-engine';

self.onmessage = (e) => {
  const { neighbors, stones, history, player, opponentPassed, timeMs } = e.data;
  const tiles = neighbors.map(n => ({ neighbors: n }));
  const result = chooseMctsMove(tiles, stones, new Set(history), player, opponentPassed, { timeMs });
  (self as unknown as Worker).postMessage(result);
};
