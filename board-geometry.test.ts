import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_H, BOARD_W, COMPUTER_OPENING, PHI, TILE_SIZE, boardSize, candidateVertices, centroidOf, dartVertices, isKite,
  isOutsidePlayfield, kiteVertices, tileAtPoint, tracePolygon, type BoardSizeId
} from './board-geometry';
import { buildBoard } from './penrose-board';
import type { Point } from './types';

const L = TILE_SIZE;
const dist = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y);
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const centroid = (vs: Point[]) => ({
  x: vs.reduce((s, v) => s + v.x, 0) / vs.length,
  y: vs.reduce((s, v) => s + v.y, 0) / vs.length,
});
const edges = (v: Point[]) => [0, 1, 2, 3].map(e => dist(v[e], v[(e + 1) % 4]));
// Angle at vertex i, in degrees, measured inside the tile (vertices run
// one way round, so a reflex angle comes out above 180)
const angleAt = (v: Point[], i: number) => {
  const p = v[(i + 3) % 4], q = v[i], r = v[(i + 1) % 4];
  const a1 = Math.atan2(p.y - q.y, p.x - q.x);
  const a2 = Math.atan2(r.y - q.y, r.x - q.x);
  return (((a2 - a1) * 180 / Math.PI) + 720) % 360;
};

// Spec 3: kite and dart shapes, long edge L and short edge L / phi
// At several rotations: at 0 alone, a corner misplaced by mirroring it
// across the axis would go unnoticed (cos 36° = cos -36°)
const ROTATIONS = [0, 36, 108, 252];

test('a kite has edges long, short, short, long, and angles 72, 72, 144, 72', () => {
  for (const rotation of ROTATIONS) {
    const v = kiteVertices(100, 100, rotation);
    const e = edges(v);
    assert.ok(near(e[0], L) && near(e[3], L), `long edges ${e} at ${rotation}°`);
    assert.ok(near(e[1], L / PHI) && near(e[2], L / PHI), `short edges ${e} at ${rotation}°`);
    const angles = [0, 1, 2, 3].map(i => angleAt(v, i));
    [72, 72, 144, 72].forEach((a, i) => assert.ok(Math.abs(angles[i] - a) < 1e-6, `angles ${angles} at ${rotation}°`));
  }
});

test('a dart has edges long, short, short, long, and angles 72, 36, 216, 36', () => {
  for (const rotation of ROTATIONS) {
    const v = dartVertices(100, 100, rotation);
    const e = edges(v);
    assert.ok(near(e[0], L) && near(e[3], L), `long edges ${e} at ${rotation}°`);
    assert.ok(near(e[1], L / PHI) && near(e[2], L / PHI), `short edges ${e} at ${rotation}°`);
    const angles = [0, 1, 2, 3].map(i => angleAt(v, i));
    [72, 36, 216, 36].forEach((a, i) => assert.ok(Math.abs(angles[i] - a) < 1e-6, `angles ${angles} at ${rotation}°`));
  }
});

test('an opening tile of each type has that type\'s shape', () => {
  assert.deepEqual(candidateVertices({ type: 'kite', x: 300, y: 200, rotation: 72 }), kiteVertices(300, 200, 72));
  assert.deepEqual(candidateVertices({ type: 'dart', x: 300, y: 200, rotation: 72 }), dartVertices(300, 200, 72));
});

// Spec 3: positioned by its centroid
test('the opening tile is centered on its centroid', () => {
  for (const type of ['kite', 'dart'] as const) {
    for (const rotation of [0, 36, 180, 324]) {
      const c = centroid(candidateVertices({ type, x: 321, y: 123, rotation }));
      assert.ok(near(c.x, 321) && near(c.y, 123), `${type} at ${rotation}: ${c.x}, ${c.y}`);
    }
  }
});

// Spec 3: rotated in 36 degree steps
test('rotation turns the axis by the same angle', () => {
  const axis = (v: Point[]) => Math.atan2(v[2].y - v[0].y, v[2].x - v[0].x) * 180 / Math.PI;
  const a0 = axis(kiteVertices(0, 0, 0));
  const a36 = axis(kiteVertices(0, 0, 36));
  assert.ok(near(a36 - a0, 36));
});

// Spec 5, Opening: every vertex must be inside the board
test('a tile is outside the playfield when any vertex sticks out', () => {
  assert.equal(isOutsidePlayfield(kiteVertices(BOARD_W / 2, BOARD_H / 2, 0)), false);
  assert.equal(isOutsidePlayfield(kiteVertices(5, BOARD_H / 2, 0)), true);
  assert.equal(isOutsidePlayfield(dartVertices(BOARD_W / 2, BOARD_H - 2, 90)), true);
  // Rounding on an edge is tolerated
  assert.equal(isOutsidePlayfield([{ x: -0.4, y: 0 }, { x: BOARD_W + 0.4, y: BOARD_H }]), false);
  assert.equal(isOutsidePlayfield([{ x: -0.6, y: 0 }]), true);
  // The top and bottom edges too, and a smaller board's own edges
  assert.equal(isOutsidePlayfield(kiteVertices(BOARD_W / 2, 5, 90)), true, 'over the top');
  assert.equal(isOutsidePlayfield([{ x: 10, y: BOARD_H + 0.6 }]), true, 'below the bottom');
  assert.equal(isOutsidePlayfield([{ x: 10, y: -0.6 }]), true, 'above the top');
  assert.equal(isOutsidePlayfield([{ x: 10, y: 350 }], 448, 336), true, 'below a small board');
  assert.equal(isOutsidePlayfield([{ x: 450, y: 10 }], 448, 336), true, 'right of a small board');
});

test('an unknown board size falls back to Full', () => {
  assert.equal(boardSize('huge' as BoardSizeId).id, 'full');
});

test('tracePolygon traces a closed path through every corner', () => {
  const calls: string[] = [];
  const ctx = {
    beginPath: () => calls.push('begin'),
    moveTo: (x: number, y: number) => calls.push(`move ${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`line ${x},${y}`),
    closePath: () => calls.push('close')
  } as unknown as CanvasRenderingContext2D;
  tracePolygon(ctx, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }]);
  assert.deepEqual(calls, ['begin', 'move 0,0', 'line 0,0', 'line 4,0', 'line 4,2', 'close']);
});

// Spec 5, Opening: the computer opens with a kite at the board center
test('the computer opens with a kite at the board center', () => {
  assert.deepEqual(COMPUTER_OPENING, { type: 'kite', x: BOARD_W / 2, y: BOARD_H / 2, rotation: 0 });
  assert.equal(isOutsidePlayfield(candidateVertices(COMPUTER_OPENING)), false);
});

test('tileAtPoint finds the tile under a point, and misses the dart notch', () => {
  const kite = { verts: kiteVertices(100, 100, 0) };
  const dart = { verts: dartVertices(300, 100, 0) };
  const tiles = [kite, dart];
  assert.equal(tileAtPoint(tiles, 100, 100), 0);
  // On the axis: short of the reflex vertex A' is inside the dart; just
  // past it is in the notch, outside the tile
  const [m, , a] = dart.verts;
  const onAxis = (t: number) => ({ x: m.x + (a.x - m.x) * t, y: m.y + (a.y - m.y) * t });
  const inside = onAxis(0.8);
  const notch = onAxis(1.2);
  assert.equal(tileAtPoint(tiles, inside.x, inside.y), 1);
  assert.equal(tileAtPoint(tiles, notch.x, notch.y), -1);
  assert.equal(tileAtPoint(tiles, 500, 500), -1);
});

test('centroidOf is the average of the corners, inside a kite and a dart', () => {
  assert.deepEqual(centroidOf([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 0, y: 2 }]), { x: 2, y: 1 });
  for (const verts of [kiteVertices(300, 200, 72), dartVertices(300, 200, 72)]) {
    const c = centroidOf(verts);
    assert.ok(near(c.x, 300) && near(c.y, 200), 'a placed tile is centered on its centroid');
    assert.equal(tileAtPoint([{ verts }], c.x, c.y), 0, 'and the centroid is inside it');
  }
});

// Spec 7b: a skin can tell a kite from a dart by its shape, at any size
test('isKite tells kites from darts by shape, at any rotation and scale', () => {
  for (const rotation of [0, 36, 108, 252]) {
    assert.equal(isKite(kiteVertices(300, 200, rotation)), true, `kite at ${rotation}°`);
    assert.equal(isKite(dartVertices(300, 200, rotation)), false, `dart at ${rotation}°`);
  }
  const scaled = (verts: Point[], k: number) => verts.map(v => ({ x: v.x * k, y: v.y * k }));
  for (const k of [0.25, 1.786, 4]) {
    assert.equal(isKite(scaled(kiteVertices(0, 0, 72), k)), true, `kite scaled by ${k}`);
    assert.equal(isKite(scaled(dartVertices(0, 0, 72), k)), false, `dart scaled by ${k}`);
  }
  // Every tile of a generated board
  const { tiles } = buildBoard('kite', kiteVertices(400, 300, 0), BOARD_W, BOARD_H, TILE_SIZE);
  assert.ok(tiles.every(t => isKite(t.verts) === (t.type === 'kite')));
});
