import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_H, BOARD_W, COMPUTER_OPENING, PHI, TILE_SIZE, TRACKPAD_STEP, WHEEL_NOTCH,
  candidateVertices, dartVertices, isOutsidePlayfield, kiteVertices, rotateStep, tileAtPoint,
  wheelPixels, wheelTurns
} from './opening';
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
test('a kite has edges long, short, short, long, and angles 72, 72, 144, 72', () => {
  const v = kiteVertices(100, 100, 0);
  const e = edges(v);
  assert.ok(near(e[0], L) && near(e[3], L), `long edges ${e}`);
  assert.ok(near(e[1], L / PHI) && near(e[2], L / PHI), `short edges ${e}`);
  const angles = [0, 1, 2, 3].map(i => angleAt(v, i));
  [72, 72, 144, 72].forEach((a, i) => assert.ok(Math.abs(angles[i] - a) < 1e-6, `angles ${angles}`));
});

test('a dart has edges long, short, short, long, and angles 72, 36, 216, 36', () => {
  const v = dartVertices(100, 100, 0);
  const e = edges(v);
  assert.ok(near(e[0], L) && near(e[3], L), `long edges ${e}`);
  assert.ok(near(e[1], L / PHI) && near(e[2], L / PHI), `short edges ${e}`);
  const angles = [0, 1, 2, 3].map(i => angleAt(v, i));
  [72, 36, 216, 36].forEach((a, i) => assert.ok(Math.abs(angles[i] - a) < 1e-6, `angles ${angles}`));
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

test('rotation steps by 36 degrees and wraps within 0 to 359', () => {
  assert.equal(rotateStep(0, 1), 36);
  assert.equal(rotateStep(324, 1), 0);
  assert.equal(rotateStep(0, -1), 324);
  assert.equal(rotateStep(36, -1), 0);
  let r = 0;
  for (let i = 0; i < 10; i++) r = rotateStep(r, 1);
  assert.equal(r, 0, 'ten steps make a full turn');
});

// Spec 5, Opening: every vertex must be inside the board
test('a tile is outside the playfield when any vertex sticks out', () => {
  assert.equal(isOutsidePlayfield(kiteVertices(BOARD_W / 2, BOARD_H / 2, 0)), false);
  assert.equal(isOutsidePlayfield(kiteVertices(5, BOARD_H / 2, 0)), true);
  assert.equal(isOutsidePlayfield(dartVertices(BOARD_W / 2, BOARD_H - 2, 90)), true);
  // Rounding on an edge is tolerated
  assert.equal(isOutsidePlayfield([{ x: -0.4, y: 0 }, { x: BOARD_W + 0.4, y: BOARD_H }]), false);
  assert.equal(isOutsidePlayfield([{ x: -0.6, y: 0 }]), true);
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

// Spec 8: the scroll wheel rotates the opening tile
test('a wheel event in lines or pages is converted to pixels', () => {
  assert.equal(wheelPixels(3, 0), 3);
  assert.equal(wheelPixels(3, 1), 48);
  assert.equal(wheelPixels(-1, 2), -400);
});

test('a mouse wheel notch turns one step: up clockwise, down counter-clockwise', () => {
  assert.deepEqual(wheelTurns(0, -WHEEL_NOTCH), { turns: [1], total: 0 });
  assert.deepEqual(wheelTurns(0, 120), { turns: [-1], total: 0 });
  // A notch leaves a trackpad swipe's partial total alone
  assert.deepEqual(wheelTurns(20, 100), { turns: [-1], total: 20 });
});

test('a trackpad swipe turns one step per TRACKPAD_STEP pixels, carrying the rest', () => {
  let total = 0;
  const turns = [];
  for (let i = 0; i < 12; i++) {
    const r = wheelTurns(total, 10); // twelve small scrolls down: 120 pixels
    turns.push(...r.turns);
    total = r.total;
  }
  assert.equal(TRACKPAD_STEP, 50);
  assert.deepEqual(turns, [-1, -1]);
  assert.equal(total, 20);
  // Scrolling back up uses up the partial total before turning
  assert.deepEqual(wheelTurns(20, -40), { turns: [], total: -20 });
  assert.deepEqual(wheelTurns(-20, -40), { turns: [1], total: -10 });
});
