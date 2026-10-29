// The playfield and the opening tile: where a kite or dart placed by the
// player lies, whether it fits on the board, and which board tile a point
// is over.

import type { Point, TileType } from './types';

export const PHI = (1 + Math.sqrt(5)) / 2;
export const TILE_SIZE = 60;

// Playfield size (matches the canvas).
export const BOARD_W = 800;
export const BOARD_H = 600;

// Rotation of the opening tile, in degrees, turns in steps of 36.
export const ROTATION_STEP = 36;

export type { Point, TileType };

// An opening tile as the player places it: its centroid and rotation.
export type Candidate = { type: TileType; x: number; y: number; rotation: number };

// The rotation one step clockwise (dir 1) or counter-clockwise (dir -1),
// kept within 0 to 359.
export const rotateStep = (rotation: number, dir: 1 | -1): number =>
  (rotation + dir * ROTATION_STEP + 360) % 360;

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

// Where the computer opens: a kite at the board center.
export const COMPUTER_OPENING: Candidate = { type: 'kite', x: BOARD_W / 2, y: BOARD_H / 2, rotation: 0 };

// True if any vertex lies outside the playfield (small rounding tolerance).
export const isOutsidePlayfield = (verts: Point[]): boolean => {
  const EDGE_TOL = 0.5;
  return verts.some(v =>
    v.x < -EDGE_TOL || v.x > BOARD_W + EDGE_TOL ||
    v.y < -EDGE_TOL || v.y > BOARD_H + EDGE_TOL
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

// Scroll-wheel rotation of the opening tile: up turns it clockwise. A mouse
// wheel notch arrives as one large delta and turns one step. A trackpad
// swipe arrives as a stream of small deltas; it turns one step for every
// TRACKPAD_STEP pixels scrolled, so a longer swipe turns further. The page
// drops any leftover partial step after a short pause (SWIPE_END_MS).
export const WHEEL_NOTCH = 50;
export const TRACKPAD_STEP = 50; // lower = faster trackpad rotation
export const SWIPE_END_MS = 150;

// A wheel event's vertical scroll in pixels, whatever unit it came in
// (deltaMode 1 is lines, 2 is pages).
export const wheelPixels = (deltaY: number, deltaMode: number): number =>
  deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;

// The steps one wheel event turns (1 clockwise, -1 counter-clockwise), and
// the swipe's partial total carried to the next event.
export const wheelTurns = (total: number, dy: number): { turns: (1 | -1)[]; total: number } => {
  const dir = (d: number): 1 | -1 => (d < 0 ? 1 : -1);
  if (Math.abs(dy) >= WHEEL_NOTCH) return { turns: [dir(dy)], total };
  const turns: (1 | -1)[] = [];
  let t = total + dy;
  while (Math.abs(t) >= TRACKPAD_STEP) {
    turns.push(dir(t));
    t -= Math.sign(t) * TRACKPAD_STEP;
  }
  return { turns, total: t };
};
