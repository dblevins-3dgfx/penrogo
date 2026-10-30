import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FastBoard, WANDER_CHOICES, chooseMctsMove, neighborArrays, pickMove } from './mcts';
import { groupAt, opponentOf, playMove, positionKey, scoreArea } from './rules';
import { buildBoard } from './penrose-board';
import { TILE_SIZE, candidateVertices, computerOpening } from './board-geometry';
import { board, grid } from './test-boards';
import type { GraphTile, Player, Stone } from './types';

// Spec 6, Passing: after the human passes, the computer passes when ahead
test('the computer passes after a pass when it is ahead', () => {
  const tiles = grid(3, 3);
  const stones = board('.2.', '2.2', '.2.');
  const r = chooseMctsMove(tiles, stones, new Set([positionKey(stones)]), 2, true, { maxPlayouts: 50 });
  assert.equal(r.move, null);
});

test('the computer does not pass after a pass when it is behind', () => {
  const tiles = grid(4, 4);
  const stones = board('1...', '....', '....', '....');
  const r = chooseMctsMove(tiles, stones, new Set([positionKey(stones)]), 2, true, { maxPlayouts: 200 });
  assert.notEqual(r.move, null);
});

// Spec 6, Candidates and Passing: no own-eye fills, so with only eyes left it passes
test('the computer never fills its own eye, and passes when only eyes are left', () => {
  const tiles = grid(3, 3);
  const stones = board('.2.', '2.2', '.2.');
  const r = chooseMctsMove(tiles, stones, new Set([positionKey(stones)]), 2, false, { maxPlayouts: 100 });
  assert.equal(r.move, null);
});

// Spec 6, Candidates: the move played is never a self-atari unless it captures
test('the computer does not play a self-atari', () => {
  const tiles = grid(5, 1);
  // Tiles 2 and 4 would each leave 2's group with one liberty; tile 0 is
  // suicide. With no safe move, it passes.
  const stones = board('.1.2.');
  const r = chooseMctsMove(tiles, stones, new Set([positionKey(stones)]), 2, false, { maxPlayouts: 100 });
  assert.equal(r.move, null);
});

test('the computer takes a self-atari that captures', () => {
  const tiles = grid(4, 1);
  // Tile 0 captures 1's stone, leaving the new stone one liberty; tile 3 is suicide
  const stones = board('.12.');
  const r = chooseMctsMove(tiles, stones, new Set([positionKey(stones)]), 2, false, { maxPlayouts: 200 });
  assert.equal(r.move, 0);
});

// Spec 6, Levels: Beginner sometimes plays a runner-up move
// A rand that returns the given numbers in turn
const seq = (...xs: number[]) => () => xs.shift() ?? 0;
const root = [{ move: 5, n: 10 }, { move: 7, n: 40 }, { move: 2, n: 30 }, { move: 9, n: 20 }, { move: 4, n: 5 }];

test('the move played is the most visited, unless the search wanders', () => {
  assert.equal(pickMove(root, 0, seq(0, 0)).move, 7, 'no wandering');
  assert.equal(pickMove(root, 0.3, seq(0.5, 0)).move, 7, 'not this time (0.5 >= 0.3)');
});

test('a wandering search picks one of the next most visited moves', () => {
  assert.equal(WANDER_CHOICES, 3);
  assert.equal(pickMove(root, 0.3, seq(0.1, 0)).move, 2, 'the runner-up');
  assert.equal(pickMove(root, 0.3, seq(0.1, 0.5)).move, 9, 'the second runner-up');
  assert.equal(pickMove(root, 0.3, seq(0.1, 0.99)).move, 5, 'the third runner-up, never further down');
  assert.equal(pickMove(root.slice(0, 2), 1, seq(0, 0.99)).move, 5, 'only one other move');
  assert.equal(pickMove([{ move: 3, n: 9 }], 1, seq(0, 0)).move, 3, 'no other move');
  assert.equal(pickMove([{ move: -1, n: 9 }, { move: 3, n: 1 }], 1, seq(0, 0)).move, -1, 'a pass stays a pass');
});

test('a wandering computer still never fills its own eye or plays a self-atari', () => {
  const opts = { maxPlayouts: 100, wander: 1, rand: () => 0 };
  const eyes = board('.2.', '2.2', '.2.');
  assert.equal(chooseMctsMove(grid(3, 3), eyes, new Set([positionKey(eyes)]), 2, false, opts).move, null);
  const capture = board('.12.');
  assert.equal(chooseMctsMove(grid(4, 1), capture, new Set([positionKey(capture)]), 2, false, opts).move, 0);
});

// The search's playouts run on FastBoard, its own copy of the rules (with
// simple ko instead of superko); these random games check the two agree.

// A seeded random number generator (mulberry32), so a failing game can be replayed
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const penrose = buildBoard('kite', candidateVertices(computerOpening()), 800, 600, TILE_SIZE).tiles;

// Plays a random game, checking FastBoard against the rules before and after
// every move; returns how many captures and simple-ko refusals it saw
const crossCheck = (name: string, tiles: GraphTile[], seed: number) => {
  const rand = seeded(seed);
  const { start, list, n } = neighborArrays(tiles);
  const fast = new FastBoard(start, list, n);
  let stones: Stone[] = tiles.map(() => 0);
  fast.load(stones);
  const history = new Set([positionKey(stones)]);
  let player: Player = 1;
  const seen = { captures: 0, kos: 0 };
  for (let move = 0; move < 150; move++) {
    const empties = stones.flatMap((s, i) => (s === 0 ? [i] : []));
    if (empties.length === 0) break;
    const p = empties[Math.floor(rand() * empties.length)];
    const where = `${name}, seed ${seed}, move ${move}, tile ${p}`;
    if (fast.ko === p) {
      // A simple-ko refusal: the full rules refuse it too (it repeats a position)
      assert.equal(fast.legal(p, player), false, `${where}: simple ko`);
      assert.equal(playMove(tiles, stones, history, p, player).ok, false, `${where}: a simple ko is also a superko`);
      seen.kos++;
      continue;
    }
    // Legal by the rules apart from superko, which FastBoard doesn't check
    const plain = playMove(tiles, stones, new Set(), p, player);
    assert.equal(fast.legal(p, player), plain.ok, `${where}: legal`);
    const full = playMove(tiles, stones, history, p, player);
    if (!full.ok) continue;
    // Liberties after the move, capped at 2, a capture counting as 2
    const libs = full.captured > 0 ? 2 : Math.min(2, groupAt(tiles, full.stones, p).liberties.size);
    assert.equal(fast.libsAfter(p, player), libs, `${where}: liberties after`);
    assert.equal(fast.play(p, player), full.captured, `${where}: captured`);
    assert.deepEqual(Array.from(fast.stones), full.stones, `${where}: the position`);
    if (full.captured > 0) seen.captures++;
    stones = full.stones;
    history.add(positionKey(stones));
    player = opponentOf(player);
  }
  return seen;
};

test('the search\'s fast board agrees with the rules on legal moves, liberties and captures', () => {
  const total = { captures: 0, kos: 0 };
  for (let seed = 1; seed <= 20; seed++) {
    for (const [name, tiles] of [['7 x 7 grid', grid(7, 7)], ['Penrose board', penrose]] as const) {
      const seen = crossCheck(name, tiles, seed);
      total.captures += seen.captures;
      total.kos += seen.kos;
    }
  }
  assert.ok(total.captures > 50, `the games captured (${total.captures})`);
  assert.ok(total.kos > 0, `and met simple ko (${total.kos})`);
});

// Who won a playout: FastBoard's quick count agrees with area scoring when
// every empty region is a single tile, as at the end of a playout
test('the playout score matches area scoring at the end of a game', () => {
  const tiles = grid(5, 5);
  for (const stones of [
    board('1.122', '11.22', '1112.', '.1122', '11122'),
    board('22222', '2.2.2', '22222', '11111', '1.1.1'),
    board('.1.2.', '11222', '1.12.', '11122', '1.1.2')
  ]) {
    const { start, list, n } = neighborArrays(tiles);
    const fast = new FastBoard(start, list, n);
    fast.load(stones);
    const { score } = scoreArea(tiles, stones);
    assert.equal(fast.scoreDiff(), score[1] - score[2]);
  }
});
