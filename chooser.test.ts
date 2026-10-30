import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SWIPE_MIN_PX, stepChoice, swipeStep } from './chooser';

const skins = ['plain', 'dazzle', 'kites', 'glass'];

// Spec 7b: the skin chooser steps through the skins, wrapping around
test('stepping goes to the next or previous choice and wraps at both ends', () => {
  assert.equal(stepChoice(skins, 'dazzle', 1), 'kites');
  assert.equal(stepChoice(skins, 'dazzle', -1), 'plain');
  assert.equal(stepChoice(skins, 'glass', 1), 'plain', 'past the last');
  assert.equal(stepChoice(skins, 'plain', -1), 'glass', 'before the first');
  let s = 'kites';
  for (let i = 0; i < skins.length; i++) s = stepChoice(skins, s, 1);
  assert.equal(s, 'kites', 'a full lap comes back');
  assert.equal(stepChoice(skins, 'retired', 1), 'dazzle', 'an unknown choice starts from the first');
});

test('a swipe left shows the next choice, right the previous; taps and scrolls do nothing', () => {
  assert.equal(swipeStep(-SWIPE_MIN_PX, 0), 1);
  assert.equal(swipeStep(80, 10), -1);
  assert.equal(swipeStep(SWIPE_MIN_PX - 1, 0), 0, 'too short: a tap');
  assert.equal(swipeStep(0, 0), 0);
  assert.equal(swipeStep(-60, 90), 0, 'mostly vertical: scrolling the dialog');
  assert.equal(swipeStep(50, 50), 0, 'diagonal counts as vertical');
});
