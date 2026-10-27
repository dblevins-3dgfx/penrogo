import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseHeuristicMove, chooseMctsMove, groupAt, playMove, positionKey, scoreArea } from './go-engine';

// A w x h square grid as a tile graph; tile (x, y) has id y * w + x.
const grid = (w, h) => {
  const tiles = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const neighbors = [];
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
const board = (...rows) => rows.join('').split('').map(c => (c === '.' ? 0 : Number(c)));

// Spec 5, Moves: an occupied tile can't be claimed
test('a taken tile is illegal', () => {
  const tiles = grid(3, 3);
  const stones = board('1..', '...', '...');
  const r = playMove(tiles, stones, new Set(), 0, 2);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'That tile is taken.');
});

test('an ordinary move claims the tile and nothing else', () => {
  const tiles = grid(3, 3);
  const stones = board('...', '...', '...');
  const r = playMove(tiles, stones, new Set(), 4, 1);
  assert.equal(r.ok, true);
  assert.deepEqual(r.stones, board('...', '.1.', '...'));
  assert.equal(r.captured, 0);
  assert.deepEqual(stones, board('...', '...', '...'), 'the input is not changed');
});

// Spec 5, Capture
test('capturing a group removes all of its tiles and counts them', () => {
  const tiles = grid(4, 3);
  const stones = board('22..', '11..', '....');
  const r = playMove(tiles, stones, new Set(), 2, 1);
  assert.equal(r.ok, true);
  assert.deepEqual(r.stones, board('..1.', '11..', '....'));
  assert.equal(r.captured, 2);
});

test('a group with a liberty left is not captured', () => {
  const tiles = grid(3, 3);
  const stones = board('2..', '...', '...');
  const r = playMove(tiles, stones, new Set(), 1, 1);
  assert.equal(r.ok, true);
  assert.equal(r.stones[0], 2);
  assert.equal(r.captured, 0);
});

test('groupAt finds the connected group and its liberties', () => {
  const tiles = grid(3, 3);
  const stones = board('11.', '.2.', '1..');
  const g = groupAt(tiles, stones, 0);
  assert.deepEqual(g.members.sort(), [0, 1]);
  assert.deepEqual([...g.liberties].sort(), [2, 3]);
});

// Spec 5, Suicide
test('suicide is illegal', () => {
  const tiles = grid(3, 3);
  const stones = board('.1.', '1..', '...');
  const r = playMove(tiles, stones, new Set(), 0, 2);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'Illegal: that tile would have no liberties (suicide).');
});

test('a move with no liberties is legal when it captures', () => {
  const tiles = grid(3, 3);
  // 2 at the corner fills 1's last liberty, so 1 is captured first
  const stones = board('.12', '122', '2..');
  const r = playMove(tiles, stones, new Set(), 0, 2);
  assert.equal(r.ok, true);
  assert.equal(r.captured, 2);
  assert.deepEqual(r.stones, board('2.2', '.22', '2..'));
});

// Spec 5, Ko: positional superko
test('retaking a ko at once is illegal', () => {
  const tiles = grid(4, 3);
  // Player 1 takes the ko at 6, capturing 2's stone at 5; 2 retaking at 5
  // would capture back and recreate the start
  const start = board('.12.', '12.2', '.12.');
  const history = new Set([positionKey(start)]);
  const take = playMove(tiles, start, history, 6, 1);
  assert.equal(take.ok, true);
  assert.equal(take.captured, 1);
  assert.deepEqual(take.stones, board('.12.', '1.12', '.12.'));
  history.add(positionKey(take.stones));

  const retake = playMove(tiles, take.stones, history, 5, 2);
  assert.equal(retake.ok, false);
  assert.equal(retake.reason, 'Illegal: that would repeat an earlier position (ko).');

  // Without the earlier position in the history, the retake is fine
  assert.equal(playMove(tiles, take.stones, new Set(), 5, 2).ok, true);
});

// Spec 5, Score: area scoring
test('area score is tiles held plus empty regions bordered by one player', () => {
  const tiles = grid(4, 3);
  const stones = board('.1.2', '.12.', '.12.');
  const { score, owner } = scoreArea(tiles, stones);
  // Player 1: 3 stones + 3 empty on the left. Player 2: 3 stones + 2 on the
  // right. The tile at 2 touches both, so it belongs to no one.
  assert.deepEqual(score, { 1: 6, 2: 5 });
  assert.deepEqual(owner, [1, 0, 0, 0, 1, 0, 0, 2, 1, 0, 0, 2]);
});

test('an empty board scores nothing', () => {
  const tiles = grid(3, 3);
  const { score, owner } = scoreArea(tiles, board('...', '...', '...'));
  assert.deepEqual(score, { 1: 0, 2: 0 });
  assert.ok(owner.every(o => o === 0));
});

// Spec 6, Passing: after the human passes, the computer passes when ahead
test('the computer passes after a pass when it is ahead', () => {
  const tiles = grid(3, 3);
  const stones = board('.2.', '2.2', '.2.');
  const r = chooseMctsMove(tiles, stones, new Set([positionKey(stones)]), 2, true, { maxPlayouts: 50 });
  assert.equal(r.move, null);
  assert.equal(chooseHeuristicMove(tiles, stones, new Set([positionKey(stones)]), 2, true), null);
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
