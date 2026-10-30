import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LEVEL, LEVELS, levelById } from './levels';

// Spec 6: the computer's levels, Medium by default
test('the levels are Beginner, Easy, Medium and Strong, getting stronger, Medium by default', () => {
  assert.deepEqual(LEVELS.map(l => l.name), ['Beginner', 'Easy', 'Medium', 'Strong']);
  assert.equal(DEFAULT_LEVEL, 'medium');
  assert.deepEqual(LEVELS.map(l => l.search.timeMs), [1000, 1000, 3000, 10000]);
  const beginner = levelById('beginner').search;
  assert.equal(beginner.maxPlayouts, 300, 'Beginner searches only a few hundred playouts');
  assert.equal(beginner.wander, 0.3, 'and sometimes picks a runner-up move');
  for (const l of LEVELS.slice(1)) assert.equal(l.search.wander ?? 0, 0, `${l.name} plays its best move`);
});
