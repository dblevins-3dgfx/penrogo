import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_THINK_SECONDS, THINK_OPTIONS, parseSkinId, parseThinkSeconds } from './prefs';

// Spec 6: thinking time 1, 3 (default), 5 or 10 seconds, remembered
test('the thinking time choices are 1, 3, 5 and 10 seconds, defaulting to 3', () => {
  assert.deepEqual(THINK_OPTIONS, [1, 3, 5, 10]);
  assert.equal(DEFAULT_THINK_SECONDS, 3);
});

test('a saved thinking time is read back; anything else gives the default', () => {
  for (const s of THINK_OPTIONS) assert.equal(parseThinkSeconds(String(s)), s);
  assert.equal(parseThinkSeconds(null), 3, 'nothing saved');
  assert.equal(parseThinkSeconds('7'), 3, 'not a choice');
  assert.equal(parseThinkSeconds('fast'), 3, 'not a number');
  assert.equal(parseThinkSeconds(''), 3, 'empty');
});

// Spec 7b: the chosen skin is remembered
test('a saved skin is read back if it still exists; otherwise the fallback', () => {
  const ids = ['plain', 'dazzle', 'go-classic'];
  assert.equal(parseSkinId('dazzle', ids, 'plain'), 'dazzle');
  assert.equal(parseSkinId(null, ids, 'plain'), 'plain', 'nothing saved');
  assert.equal(parseSkinId('retired-skin', ids, 'plain'), 'plain', 'a skin since removed');
});
