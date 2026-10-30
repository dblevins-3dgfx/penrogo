// The board's geometry: the tile shapes, the canvas and the board sizes,
// the opening tile (where a kite or dart placed by the player lies and
// whether it fits on the board), which board tile a point is over, and
// small helpers for a tile's centroid and outline. Turning the opening tile
// is in rotation.ts.

import type { Point, TileType } from './types';

export const PHI = (1 + Math.sqrt(5)) / 2;
export const TILE_SIZE = 60;

// The canvas's drawing size, and the playfield of a full board.
export const BOARD_W = 800;
export const BOARD_H = 600;

// The board sizes: the tiling cut to a w x h region (4:3, in the same units
// as the tiles), drawn scaled up to fill the canvas. Smaller boards have
// fewer, larger-looking tiles; the tile counts are typical.
export type BoardSizeId = 'small' | 'medium' | 'large' | 'full';
export type BoardSize = { id: BoardSizeId; name: string; tiles: number; w: number; h: number };
export const BOARD_SIZES: BoardSize[] = [
  { id: 'small', name: 'Small', tiles: 60, w: 448, h: 336 },
  { id: 'medium', name: 'Medium', tiles: 100, w: 560, h: 420 },
  { id: 'large', name: 'Large', tiles: 155, w: 680, h: 510 },
  { id: 'full', name: 'Full', tiles: 220, w: BOARD_W, h: BOARD_H }
];
export const DEFAULT_BOARD_SIZE: BoardSizeId = 'full';
export const boardSize = (id: BoardSizeId): BoardSize =>
  BOARD_SIZES.find(s => s.id === id) ?? BOARD_SIZES[BOARD_SIZES.length - 1];


export type { Point, TileType };

// An opening tile as the player places it: its centroid and rotation.
export type Candidate = { type: TileType; x: number; y: number; rotation: number };


// A tile's vertices around its tip at the origin, rotated so its axis
// points along `rotation`, then moved so its centroid is at (x, y). The
// third vertex is at `axis` along the axis.
const placeTile = (x: number, y: number, rotation: number, axis: number): Point[] => {
  const r = rotation * Math.PI / 180;
  const long = TILE_SIZE;
  const deg36 = 36 * Math.PI / 180;

  const local = [
    { x: 0, y: 0 },
    { x: long * Math.cos(r + deg36), y: long * Math.sin(r + deg36) },
    { x: axis * Math.cos(r), y: axis * Math.sin(r) },
    { x: long * Math.cos(r - deg36), y: long * Math.sin(r - deg36) }
  ];

  const cx = local.reduce((s, v) => s + v.x, 0) / local.length;
  const cy = local.reduce((s, v) => s + v.y, 0) / local.length;

  return local.map(v => ({ x: x + v.x - cx, y: y + v.y - cy }));
};

// Kite: vertices O(72°) -> B(72°) -> C(144°) -> D(72°), edges long, short,
// short, long. Axis of symmetry through O and C. Centered on the centroid.
export const kiteVertices = (x: number, y: number, rotation: number): Point[] =>
  placeTile(x, y, rotation, TILE_SIZE);

// Dart: vertices M(72°) -> N(36°) -> A'(216°, reflex) -> N'(36°), edges
// long, short, short, long. Axis of symmetry through M and A'.
export const dartVertices = (x: number, y: number, rotation: number): Point[] =>
  placeTile(x, y, rotation, TILE_SIZE / PHI);

export const candidateVertices = (c: Candidate): Point[] => c.type === 'kite'
  ? kiteVertices(c.x, c.y, c.rotation)
  : dartVertices(c.x, c.y, c.rotation);

// Where the computer opens: a kite at the center of a board of the given
// size (a full board by default).
export const computerOpening = (s: { w: number; h: number } = boardSize('full')): Candidate =>
  ({ type: 'kite', x: s.w / 2, y: s.h / 2, rotation: 0 });
export const COMPUTER_OPENING: Candidate = computerOpening();

// True if any vertex lies outside a w x h playfield (a full board by
// default; small rounding tolerance).
export const isOutsidePlayfield = (verts: Point[], w = BOARD_W, h = BOARD_H): boolean => {
  const EDGE_TOL = 0.5;
  return verts.some(v =>
    v.x < -EDGE_TOL || v.x > w + EDGE_TOL ||
    v.y < -EDGE_TOL || v.y > h + EDGE_TOL
  );
};

// Both tiles split into two triangles along the vertex 0 to 2 diagonal
// (the axis), which also handles the dart's concave notch.
const toTriangles = (v: Point[]) => [[v[0], v[1], v[2]], [v[0], v[2], v[3]]];

const pointInTriangle = (px: number, py: number, tri: Point[]) => {
  const [a, b, c] = tri;
  const d1 = (px - b.x) * (a.y - b.y) - (a.x - b.x) * (py - b.y);
  const d2 = (px - c.x) * (b.y - c.y) - (b.x - c.x) * (py - c.y);
  const d3 = (px - a.x) * (c.y - a.y) - (c.x - a.x) * (py - a.y);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
};

// Index of the board tile containing (x, y), or -1.
export const tileAtPoint = (tiles: { verts: Point[] }[], x: number, y: number): number =>
  tiles.findIndex(t => toTriangles(t.verts).some(tri => pointInTriangle(x, y, tri)));

// The average of a tile's corners: inside a kite, and inside a dart short of
// its notch.
export const centroidOf = (verts: Point[]): Point => ({
  x: verts.reduce((s, v) => s + v.x, 0) / verts.length,
  y: verts.reduce((s, v) => s + v.y, 0) / verts.length
});

// Starts a canvas path around a tile's corners, ready to fill or stroke.
export const tracePolygon = (ctx: CanvasRenderingContext2D, verts: Point[]) => {
  ctx.beginPath();
  ctx.moveTo(verts[0].x, verts[0].y);
  verts.forEach(v => ctx.lineTo(v.x, v.y));
  ctx.closePath();
};
