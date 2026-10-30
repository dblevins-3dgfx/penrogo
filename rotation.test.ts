import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRACKPAD_STEP, WHEEL_NOTCH, rotateStep, wheelPixels, wheelTurns } from './rotation';

// Spec 3: rotated in 36 degree steps
test('rotation steps by 36 degrees and wraps within 0 to 359', () => {
  assert.equal(rotateStep(0, 1), 36);
  assert.equal(rotateStep(324, 1), 0);
  assert.equal(rotateStep(0, -1), 324);
  assert.equal(rotateStep(36, -1), 0);
  let r = 0;
  for (let i = 0; i < 10; i++) r = rotateStep(r, 1);
  assert.equal(r, 0, 'ten steps make a full turn');
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

test('a trackpad swipe turns as soon as it reaches TRACKPAD_STEP pixels', () => {
  assert.deepEqual(wheelTurns(-(TRACKPAD_STEP - 10), -10), { turns: [1], total: 0 });
  assert.deepEqual(wheelTurns(0, -(TRACKPAD_STEP - 1)), { turns: [], total: -(TRACKPAD_STEP - 1) });
});
