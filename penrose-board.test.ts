import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBoard, generatePatch } from './penrose-board';
import type { Point, Tile } from './types';

const PHI = (1 + Math.sqrt(5)) / 2;
const L = 60;
const W = 800;
const H = 600;

// A kite with tip O at (x, y), axis pointing at `deg`, in the game's vertex
// order [O, B, C, D].
const kiteAt = (x: number, y: number, deg: number): Point[] => {
  const r = (deg * Math.PI) / 180;
  const d = (36 * Math.PI) / 180;
  return [
    { x, y },
    { x: x + L * Math.cos(r + d), y: y + L * Math.sin(r + d) },
    { x: x + L * Math.cos(r), y: y + L * Math.sin(r) },
    { x: x + L * Math.cos(r - d), y: y + L * Math.sin(r - d) },
  ];
};

// The same for a dart [M, N, A', N'].
const dartAt = (x: number, y: number, deg: number): Point[] => {
  const v = kiteAt(x, y, deg);
  const r = (deg * Math.PI) / 180;
  v[2] = { x: x + (L / PHI) * Math.cos(r), y: y + (L / PHI) * Math.sin(r) };
  return v;
};

const dist = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y);
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;

const kiteBoard = buildBoard('kite', kiteAt(400, 300, 0), W, H, L);
const dartBoard = buildBoard('dart', dartAt(380, 290, 108), W, H, L);

// Spec 4.1: the patch is about 4,900 tiles, kites to darts about phi
test('the patch has about 4,900 tiles, about phi kites per dart', () => {
  const patch = generatePatch(L, 7);
  assert.ok(patch.length > 4500 && patch.length < 5300, `${patch.length} tiles`);
  const kites = patch.filter(t => t.type === 'kite').length;
  const ratio = kites / (patch.length - kites);
  assert.ok(Math.abs(ratio - PHI) < 0.05, `ratio ${ratio}`);
});

// Spec 3 and 4: every tile has exact kite or dart geometry
test('every tile is an exact kite or dart', () => {
  for (const { tiles } of [kiteBoard, dartBoard]) {
    for (const t of tiles) {
      const v = t.verts;
      const edges = [0, 1, 2, 3].map(e => dist(v[e], v[(e + 1) % 4]));
      // Long, short, short, long for both shapes
      assert.ok(near(edges[0], L, 0.01) && near(edges[3], L, 0.01), `tile ${t.id} long edges ${edges}`);
      assert.ok(near(edges[1], L / PHI, 0.01) && near(edges[2], L / PHI, 0.01), `tile ${t.id} short edges ${edges}`);
      const axis = dist(v[0], v[2]);
      assert.ok(near(axis, t.type === 'kite' ? L : L / PHI, 0.01), `tile ${t.id} axis ${axis}`);
    }
  }
});

// Spec 4.2: the opening tile matches the placement exactly. The axis ends
// (vertices 0 and 2) match; the two side vertices may come in either order.
test('the opening tile covers the placement exactly', () => {
  for (const [board, verts, type] of [
    [kiteBoard, kiteAt(400, 300, 0), 'kite'],
    [dartBoard, dartAt(380, 290, 108), 'dart'],
  ] as const) {
    const t = board.tiles[board.opening];
    assert.equal(t.type, type);
    assert.ok(dist(t.verts[0], verts[0]) < 1e-6, 'vertex 0');
    assert.ok(dist(t.verts[2], verts[2]) < 1e-6, 'vertex 2');
    for (const p of [verts[1], verts[3]]) {
      assert.ok(Math.min(dist(p, t.verts[1]), dist(p, t.verts[3])) < 1e-6, 'side vertex');
    }
  }
});

// Spec 4.3: only tiles entirely inside the board are kept, about 220 of them
test('only tiles inside the board are kept, about 220', () => {
  for (const { tiles } of [kiteBoard, dartBoard]) {
    assert.ok(tiles.length > 180 && tiles.length < 260, `${tiles.length} tiles`);
    for (const t of tiles) {
      for (const p of t.verts) {
        assert.ok(p.x >= -0.5 && p.x <= W + 0.5 && p.y >= -0.5 && p.y <= H + 0.5, `tile ${t.id} sticks out`);
      }
    }
  }
});

// Spec 4.4: neighbors share a full edge; interior tiles have four
test('neighbors share a full edge, both ways', () => {
  const key = (p: Point) => `${Math.round(p.x)},${Math.round(p.y)}`;
  const edgesOf = (t: Tile) => [0, 1, 2, 3].map(e => [key(t.verts[e]), key(t.verts[(e + 1) % 4])].sort().join('|'));
  const { tiles } = kiteBoard;
  for (const t of tiles) {
    const mine = new Set(edgesOf(t));
    for (const n of t.neighbors) {
      assert.ok(tiles[n].neighbors.includes(t.id), `${t.id} and ${n} disagree`);
      assert.ok(edgesOf(tiles[n]).some(e => mine.has(e)), `${t.id} and ${n} share no edge`);
    }
    // Every edge shared with another kept tile makes them neighbors
    for (const o of tiles) {
      if (o === t) continue;
      if (edgesOf(o).some(e => mine.has(e))) assert.ok(t.neighbors.includes(o.id), `${t.id} misses ${o.id}`);
    }
  }
});

test('interior tiles have exactly four neighbors', () => {
  for (const { tiles } of [kiteBoard, dartBoard]) {
    const interior = tiles.filter(t => t.verts.every(p => p.x > L && p.x < W - L && p.y > L && p.y < H - L));
    assert.ok(interior.length > 100);
    for (const t of interior) assert.equal(t.neighbors.length, 4, `tile ${t.id}`);
  }
});
