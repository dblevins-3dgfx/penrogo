// Small boards for the rules and search tests: square grids as tile
// graphs, and positions written as rows of '.', '1' and '2'.
import type { GraphTile, Stone } from './types';

// A w x h square grid as a tile graph; tile (x, y) has id y * w + x.
export const grid = (w: number, h: number): GraphTile[] => {
  const tiles: GraphTile[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const neighbors: number[] = [];
      if (x > 0) neighbors.push(y * w + x - 1);
      if (x < w - 1) neighbors.push(y * w + x + 1);
      if (y > 0) neighbors.push((y - 1) * w + x);
      if (y < h - 1) neighbors.push((y + 1) * w + x);
      tiles.push({ neighbors });
    }
  }
  return tiles;
};

// Stones from rows of '.', '1' and '2'.
export const board = (...rows: string[]): Stone[] => rows.join('').split('').map(c => (c === '.' ? 0 : Number(c) as Stone));
