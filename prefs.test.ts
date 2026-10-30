import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_STORAGE_KEY, DEFAULT_LEVEL, LEVELS, LEVEL_STORAGE_KEY, OLD_THINK_STORAGE_KEY, SKIN_STORAGE_KEY, SWITCHES,
  formatSwitch, levelById, parseBoardSize, parseLevel, parseSkinId, parseSwitch, readSwitches, switchKey
} from './prefs';

// Spec 6: the computer's level, Medium by default, remembered
test('the levels are Beginner, Easy, Medium and Strong, getting stronger, Medium by default', () => {
  assert.deepEqual(LEVELS.map(l => l.name), ['Beginner', 'Easy', 'Medium', 'Strong']);
  assert.equal(DEFAULT_LEVEL, 'medium');
  assert.deepEqual(LEVELS.map(l => l.search.timeMs), [1000, 1000, 3000, 10000]);
  const beginner = levelById('beginner').search;
  assert.equal(beginner.maxPlayouts, 300, 'Beginner searches only a few hundred playouts');
  assert.equal(beginner.wander, 0.3, 'and sometimes picks a runner-up move');
  for (const l of LEVELS.slice(1)) assert.equal(l.search.wander ?? 0, 0, `${l.name} plays its best move`);
});

test('a saved level is read back; an old thinking time picks the matching level; else Medium', () => {
  for (const l of LEVELS) assert.equal(parseLevel(l.id), l.id);
  assert.equal(parseLevel(null), 'medium', 'nothing saved');
  assert.equal(parseLevel('grandmaster'), 'medium', 'not a level');
  assert.equal(parseLevel(null, '1'), 'easy');
  assert.equal(parseLevel(null, '3'), 'medium');
  assert.equal(parseLevel(null, '5'), 'medium');
  assert.equal(parseLevel(null, '10'), 'strong');
  assert.equal(parseLevel(null, '7'), 'medium', 'not an old choice');
  assert.equal(parseLevel('beginner', '10'), 'beginner', 'a saved level wins');
});

// Spec 4: the board size, Full by default, remembered
test('a saved board size is read back; anything else gives Full', () => {
  for (const id of ['small', 'medium', 'large', 'full']) assert.equal(parseBoardSize(id), id);
  assert.equal(parseBoardSize(null), 'full');
  assert.equal(parseBoardSize('huge'), 'full');
});

// Spec 7b: the chosen skin is remembered
test('a saved skin is read back if it still exists; otherwise the fallback', () => {
  const ids = ['plain', 'dazzle', 'go-classic'];
  assert.equal(parseSkinId('dazzle', ids, 'plain'), 'dazzle');
  assert.equal(parseSkinId(null, ids, 'plain'), 'plain', 'nothing saved');
  assert.equal(parseSkinId('retired-skin', ids, 'plain'), 'plain', 'a skin since removed');
});

// Spec 5, Undo, 6, Hints, and 7, Atari warnings: on unless turned off, remembered
test('undo, hints and atari warnings are on unless saved as off', () => {
  assert.equal(parseSwitch(null), true, 'nothing saved: on for new players');
  assert.equal(parseSwitch('on'), true);
  assert.equal(parseSwitch('off'), false);
  assert.equal(parseSwitch('garbage'), true);
  assert.equal(parseSwitch(formatSwitch(false)), false, 'off round-trips');
  assert.equal(parseSwitch(formatSwitch(true)), true, 'on round-trips');
});

// Spec 8: the Preferences switches, in order, each with its saved key
test('the switches are Hints, Atari warnings and Undo, saved under their existing keys', () => {
  assert.deepEqual(SWITCHES.map(s => s.label), ['Hints', 'Atari warnings', 'Undo']);
  // Unchanged keys, so settings saved before the table existed carry over
  assert.deepEqual(SWITCHES.map(s => s.key), ['penrogo.hints', 'penrogo.atari', 'penrogo.undo']);
  for (const s of SWITCHES) {
    assert.equal(switchKey(s.id), s.key);
    assert.ok(s.detail.length > 0, `${s.label} explains itself`);
  }
});

test('the switches are read back from storage: on unless saved as off', () => {
  assert.deepEqual(readSwitches(() => null), { hints: true, atari: true, undo: true }, 'nothing saved');
  const saved: Record<string, string> = { 'penrogo.atari': 'off', 'penrogo.undo': 'on' };
  assert.deepEqual(readSwitches(k => saved[k] ?? null), { hints: true, atari: false, undo: true });
});

test('each setting is saved under its own key', () => {
  const keys = [
    SKIN_STORAGE_KEY, LEVEL_STORAGE_KEY, BOARD_STORAGE_KEY, OLD_THINK_STORAGE_KEY, ...SWITCHES.map(s => s.key)
  ];
  assert.equal(new Set(keys).size, keys.length);
});
