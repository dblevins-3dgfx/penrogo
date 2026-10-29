import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OPENING_HINT, THINKING, gameReducer, initialGame, isComputerTurn, isHumanTurn,
  placeAction, playerName, resultText, shownScore, targetAt, turnText, type GameAction, type GameState
} from './game';
import { BOARD_W, COMPUTER_OPENING, candidateVertices } from './opening';
import { centroidOf } from './skins/canvas-utils';
import { positionKey } from './go-engine';

const run = (g: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, g);
const started = (mode: 'ai' | 'two' = 'two') => run(initialGame(mode), { type: 'start' });
const opened = (mode: 'ai' | 'two' = 'two') => run(started(mode), { type: 'open', cand: COMPUTER_OPENING });

// The board, the last move and the last event, which exist once the
// opening is played; each fails the test if it doesn't
const tilesOf = (g: GameState) => {
  assert.ok(g.tiles, 'the board exists');
  return g.tiles;
};
const lastOf = (g: GameState) => {
  assert.ok(g.lastMove !== null, 'there is a last move');
  return g.lastMove;
};
const eventOf = (g: GameState) => {
  assert.ok(g.event, 'there is an event');
  return g.event;
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

test('a new game starts with the opening hint, Player 1 to move', () => {
  const g = started();
  assert.equal(g.started, true);
  assert.equal(g.tiles, null);
  assert.equal(g.currentPlayer, 1);
  assert.equal(g.message, OPENING_HINT);
  assert.equal(turnText(g), "Player 1's Turn");
});

test('the mode can change before the game starts, not during it', () => {
  assert.equal(run(initialGame('ai'), { type: 'setMode', mode: 'two' }).mode, 'two');
  assert.equal(run(started('ai'), { type: 'setMode', mode: 'two' }).mode, 'ai');
  assert.equal(started('ai').mode, 'ai', 'start keeps the chosen mode');
});

// Spec 5, Opening
test('the opening builds the board and becomes the opener\'s first stone', () => {
  const g = opened();
  assert.ok(tilesOf(g).length > 150);
  assert.equal(g.stones.filter(s => s !== 0).length, 1);
  assert.equal(g.stones[lastOf(g)], 1);
  assert.equal(g.currentPlayer, 2, 'the other player moves next');
  assert.equal(g.message, '');
  assert.deepEqual([...g.history], [positionKey(g.stones)]);
  const ev = eventOf(g);
  assert.equal(ev.kind, 'opening');
  assert.deepEqual(ev.kind === 'opening' && ev.verts, candidateVertices(COMPUTER_OPENING));
});

test('an opening tile sticking out of the board is ignored', () => {
  const g = started();
  const out = run(g, { type: 'open', cand: { type: 'kite', x: 2, y: 300, rotation: 0 } });
  assert.equal(out, g);
});

test('a second opening is ignored once the board exists', () => {
  const g = opened();
  assert.equal(run(g, { type: 'open', cand: { type: 'kite', x: BOARD_W / 3, y: 200, rotation: 0 } }), g);
});

// Spec 5, Opening: Skip Opening hands it to the other player
test('Skip Opening hands the opening to the other player', () => {
  const g = run(started('ai'), { type: 'pass' });
  assert.equal(g.tiles, null);
  assert.equal(g.currentPlayer, 2);
  assert.equal(g.passes, 0, 'skipping is not a pass');
  assert.equal(g.message, 'Player 1 skipped the opening.');
  assert.equal(isComputerTurn(g), true);
  const h = run(g, { type: 'open', cand: COMPUTER_OPENING });
  assert.equal(h.stones[lastOf(h)], 2, 'the computer opens');
  assert.equal(h.currentPlayer, 1);
});

// Spec 5, Moves: players alternate
test('claiming a tile places a stone and passes the turn', () => {
  const g = opened();
  const id = quietTile(g);
  const h = run(g, { type: 'claim', id });
  assert.equal(h.stones[id], 2);
  assert.equal(h.currentPlayer, 1);
  assert.equal(h.lastMove, id);
  assert.equal(h.message, '');
  assert.equal(h.history.size, 2);
  assert.ok(!g.history.has(positionKey(h.stones)), 'the earlier state is not changed');
  assert.deepEqual(h.event, { kind: 'claim', id, player: 2, lost: [] });
});

test('an illegal claim leaves the board alone and says why', () => {
  const g = opened();
  const h = run(g, { type: 'claim', id: lastOf(g) });
  assert.equal(h.stones, g.stones);
  assert.equal(h.currentPlayer, 2);
  assert.equal(h.message, 'That tile is taken.');
});

// Spec 5, Capture and the scoreboard's capture count
test('a capture removes the group, counts it and names the capturer', () => {
  let g = opened('ai');
  // Surround Player 1's opening stone with the computer's stones
  const target = lastOf(g);
  const ring = tilesOf(g)[target].neighbors;
  for (let k = 0; k < ring.length; k++) {
    g = run(g, { type: 'claim', id: ring[k] });
    if (k < ring.length - 1) {
      // Player 1 plays somewhere harmless
      g = run(g, { type: 'claim', id: quietTile(g) });
    }
  }
  assert.equal(g.stones[target], 0);
  assert.equal(g.captured[2], 1);
  assert.equal(g.captured[1], 0);
  assert.equal(g.message, 'Computer captured 1 tile!');
  const ev = eventOf(g);
  assert.ok(ev.kind === 'claim' && ev.lost.includes(target));
});

// Spec 5, End: two consecutive passes end the game
test('one pass hands over the turn; a move resets the count', () => {
  const g = run(opened(), { type: 'pass' });
  assert.equal(g.passes, 1);
  assert.equal(g.currentPlayer, 1);
  assert.equal(g.message, 'Player 2 passes.');
  assert.equal(g.gameOver, null);
  const h = run(g, { type: 'claim', id: quietTile(g) });
  assert.equal(h.passes, 0);
});

test('two passes in a row end the game with the area score', () => {
  const g = run(opened(), { type: 'pass' }, { type: 'pass' });
  assert.ok(g.gameOver);
  // Player 1's lone opening stone surrounds the whole empty board
  const n = tilesOf(g).length;
  assert.equal(g.gameOver[1], n);
  assert.equal(g.gameOver[2], 0);
  assert.equal(g.message, `Game over: Player 1 wins ${n} to 0.`);
  assert.equal(turnText(g), 'Game Over');
  assert.equal(isHumanTurn(g), false);
});

test('moves are ignored once the game is over, and before it starts', () => {
  const over = run(opened(), { type: 'pass' }, { type: 'pass' });
  assert.equal(run(over, { type: 'claim', id: quietTile(over) }), over);
  assert.equal(run(over, { type: 'pass' }), over);
  const idle = initialGame();
  assert.equal(run(idle, { type: 'open', cand: COMPUTER_OPENING }), idle);
  assert.equal(run(idle, { type: 'thinking' }), idle);
});

test('the result names the winner, or a tie', () => {
  assert.equal(resultText('two', { 1: 40, 2: 52 }), 'Game over: Player 2 wins 52 to 40.');
  assert.equal(resultText('ai', { 1: 40, 2: 52 }), 'Game over: Computer wins 52 to 40.');
  assert.equal(resultText('ai', { 1: 61, 2: 30 }), 'Game over: Player 1 wins 61 to 30.');
  assert.equal(resultText('two', { 1: 45, 2: 45 }), 'Game over: a tie at 45.');
});

// Spec 5, Score: the scoreboard
test('the scoreboard shows stones during play and the area score at the end', () => {
  const g = opened();
  const h = run(g, { type: 'claim', id: quietTile(g) });
  assert.deepEqual(shownScore(h), { 1: 1, 2: 1 });
  const over = run(h, { type: 'pass' }, { type: 'pass' });
  assert.equal(shownScore(over), over.gameOver);
});

test('player names: the computer is Player 2 against the computer', () => {
  assert.equal(playerName('ai', 1), 'Player 1');
  assert.equal(playerName('ai', 2), 'Computer');
  assert.equal(playerName('two', 2), 'Player 2');
});

test('whose turn: a person, unless the computer plays Player 2', () => {
  assert.equal(turnText(initialGame()), 'Press Start');
  const ai = run(started('ai'), { type: 'open', cand: COMPUTER_OPENING });
  assert.equal(isComputerTurn(ai), true);
  assert.equal(isHumanTurn(ai), false);
  assert.equal(turnText(ai), "Computer's Turn");
  const two = opened('two');
  assert.equal(isComputerTurn(two), false);
  assert.equal(isHumanTurn(two), true);
});

test('the computer thinking shows on the status line', () => {
  assert.equal(run(opened('ai'), { type: 'thinking' }).message, THINKING);
});

test('New Game clears the board and the capture counts, keeping the mode', () => {
  const g = run(opened('ai'), { type: 'pass' }, { type: 'reset' });
  assert.deepEqual(g, initialGame('ai'));
});

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
