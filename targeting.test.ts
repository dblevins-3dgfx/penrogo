import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameReducer, initialGame, type GameAction, type GameState } from './game';
import {
  DOUBLE_TAP_DIST, DOUBLE_TAP_MS, TAP_SLOP_PX, confirmAction, isDoubleTap, isTap, placeAction, targetAt
} from './targeting';
import { COMPUTER_OPENING, candidateVertices, centroidOf } from './board-geometry';

const run = (g: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, g);
const started = (mode: 'ai' | 'two' = 'two') => run(initialGame(mode), { type: 'start' });
const opened = (mode: 'ai' | 'two' = 'two') => run(started(mode), { type: 'open', cand: COMPUTER_OPENING });

// The board and the last move, which exist once the opening is played
const tilesOf = (g: GameState) => {
  assert.ok(g.tiles, 'the board exists');
  return g.tiles;
};
const lastOf = (g: GameState) => {
  assert.ok(g.lastMove !== null, 'there is a last move');
  return g.lastMove;
};
// What a point is over, which the test expects to be something
const targetOf = (...args: Parameters<typeof targetAt>) => {
  const t = targetAt(...args);
  assert.ok(t, 'there is a target');
  return t;
};
// An empty tile whose neighbors are all empty too, so claiming it captures nothing
const quietTile = (g: GameState) =>
  tilesOf(g).findIndex((t, i) => g.stones[i] === 0 && t.neighbors.length === 4 && t.neighbors.every(n => g.stones[n] === 0));

// Spec 7, Hover and Opening preview: what the pointer is over
test('before the board exists, the target is the opening tile under the pointer', () => {
  const g = started();
  const t = targetOf(g, { x: 400, y: 300 }, 'dart', 72);
  assert.equal(t.kind, 'opening');
  assert.equal(t.legal, true);
  assert.deepEqual(t.kind === 'opening' && t.cand, { type: 'dart', x: 400, y: 300, rotation: 72 });
  assert.deepEqual(t.verts, candidateVertices({ type: 'dart', x: 400, y: 300, rotation: 72 }));
  assert.equal(targetOf(g, { x: 3, y: 300 }, 'kite', 0).legal, false, 'sticking out of the board');
});

test('on the board, the target is the tile under the pointer and whether claiming it is legal', () => {
  const g = opened();
  const tiles = tilesOf(g);
  const free = quietTile(g);
  const c = centroidOf(tiles[free].verts);
  // A kite's centroid is inside it; a dart's is too (short of the notch)
  const t = targetAt(g, c, 'kite', 0);
  assert.deepEqual(t, { kind: 'tile', id: free, verts: tiles[free].verts, legal: true });
  const taken = centroidOf(tiles[lastOf(g)].verts);
  assert.equal(targetOf(g, taken, 'kite', 0).legal, false);
});

test('there is no target off the tiles, without a pointer, or on the computer\'s turn', () => {
  const g = opened();
  assert.equal(targetAt(g, null, 'kite', 0), null);
  assert.equal(targetAt(g, { x: -50, y: -50 }, 'kite', 0), null);
  assert.equal(targetAt(initialGame(), { x: 400, y: 300 }, 'kite', 0), null, 'not started');
  const ai = opened('ai');
  assert.equal(targetAt(ai, { x: 400, y: 300 }, 'kite', 0), null);
});

test('placing on a target: the opening only if it fits; a tile is claimed even if illegal', () => {
  const g = started();
  const fits = targetAt(g, { x: 400, y: 300 }, 'kite', 0);
  assert.deepEqual(placeAction(fits), { type: 'open', cand: { type: 'kite', x: 400, y: 300, rotation: 0 } });
  assert.equal(placeAction(targetAt(g, { x: 3, y: 300 }, 'kite', 0)), null);
  assert.equal(placeAction(null), null);
  const o = opened();
  const taken = targetAt(o, centroidOf(tilesOf(o)[lastOf(o)].verts), 'kite', 0);
  assert.deepEqual(placeAction(taken), { type: 'claim', id: lastOf(o) });
});

// Spec 8: Place, and a double tap, place only a legal target
test('Place and a double tap place a legal target and leave an illegal one alone', () => {
  const g = opened();
  const free = targetOf(g, centroidOf(tilesOf(g)[quietTile(g)].verts), 'kite', 0);
  assert.deepEqual(confirmAction(free), placeAction(free));
  const taken = targetOf(g, centroidOf(tilesOf(g)[lastOf(g)].verts), 'kite', 0);
  assert.equal(confirmAction(taken), null, 'a taken tile: nothing, unlike a click');
  assert.equal(confirmAction(targetAt(started(), { x: 3, y: 300 }, 'kite', 0)), null, 'an opening that sticks out');
  assert.equal(confirmAction(null), null);
});

// Spec 8: on touch screens, a tap (not a drag) and a double tap to place
test('a finger lifted close to where it went down is a tap; further is a drag', () => {
  assert.equal(isTap({ x: 100, y: 100 }, { x: 100, y: 100 }), true);
  assert.equal(isTap({ x: 100, y: 100 }, { x: 100 + TAP_SLOP_PX, y: 100 }), true);
  assert.equal(isTap({ x: 100, y: 100 }, { x: 108, y: 108 }), false, 'about 11 px away');
});

test('a double tap is a second tap on the same tile soon after the first', () => {
  const g = opened();
  const tiles = tilesOf(g);
  const a = centroidOf(tiles[quietTile(g)].verts);
  const near = { x: a.x + 2, y: a.y + 1 }; // the same tile
  const other = centroidOf(tiles[tiles[quietTile(g)].neighbors[0]].verts);
  assert.equal(isDoubleTap({ time: 1000, pos: a }, { time: 1200, pos: near }, tiles), true);
  assert.equal(isDoubleTap({ time: 1000, pos: a }, { time: 1000 + DOUBLE_TAP_MS, pos: a }, tiles), true, 'at the limit');
  assert.equal(isDoubleTap({ time: 1000, pos: a }, { time: 1001 + DOUBLE_TAP_MS, pos: a }, tiles), false, 'too slow');
  assert.equal(isDoubleTap({ time: 1000, pos: a }, { time: 1100, pos: other }, tiles), false, 'a different tile');
  assert.equal(isDoubleTap({ time: 1000, pos: { x: -50, y: -50 } }, { time: 1100, pos: { x: -50, y: -50 } }, tiles), false, 'off the board');
  assert.equal(isDoubleTap(null, { time: 1000, pos: a }, tiles), false, 'no first tap');
});

test('before the board exists, a double tap is a second tap close to the first', () => {
  const p = { x: 400, y: 300 };
  assert.equal(isDoubleTap({ time: 0, pos: p }, { time: 200, pos: { x: 400 + DOUBLE_TAP_DIST, y: 300 } }, null), true);
  assert.equal(isDoubleTap({ time: 0, pos: p }, { time: 200, pos: { x: 400, y: 301 + DOUBLE_TAP_DIST } }, null), false, 'too far');
  assert.equal(isDoubleTap({ time: 0, pos: p }, { time: 400, pos: p }, null), false, 'too slow');
});
