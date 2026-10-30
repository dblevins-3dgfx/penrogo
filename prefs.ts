// Settings remembered in this browser (localStorage), and how a saved value
// is read back. Reading and writing storage itself is in ui/useSettings.ts;
// these functions only decide what a stored string means.

import { BOARD_SIZES, DEFAULT_BOARD_SIZE, type BoardSizeId } from './opening';
import type { SearchOptions } from './go-engine';

export const SKIN_STORAGE_KEY = 'penrogo.skin';
export const LEVEL_STORAGE_KEY = 'penrogo.computer';
export const BOARD_STORAGE_KEY = 'penrogo.board';
// The thinking time saved before levels existed, read once to pick a level
export const OLD_THINK_STORAGE_KEY = 'penrogo.thinkSeconds';

// How strong the computer plays: how long it may think per move, and for
// Beginner a cap on its playouts and a chance of picking a runner-up move
// (see chooseMctsMove).
export type LevelId = 'beginner' | 'easy' | 'medium' | 'strong';
export type Level = { id: LevelId; name: string; search: SearchOptions & { timeMs: number } };
export const LEVELS: Level[] = [
  { id: 'beginner', name: 'Beginner', search: { timeMs: 1000, maxPlayouts: 300, wander: 0.3 } },
  { id: 'easy', name: 'Easy', search: { timeMs: 1000 } },
  { id: 'medium', name: 'Medium', search: { timeMs: 3000 } },
  { id: 'strong', name: 'Strong', search: { timeMs: 10000 } }
];
export const DEFAULT_LEVEL: LevelId = 'medium';
export const levelById = (id: LevelId): Level => LEVELS.find(l => l.id === id) ?? LEVELS[2];

// A saved level, or else the level matching a thinking time saved before
// levels existed (1 s Easy, 3 or 5 s Medium, 10 s Strong), or else Medium.
export const parseLevel = (raw: string | null, oldThinkSeconds: string | null = null): LevelId => {
  const saved = LEVELS.find(l => l.id === raw);
  if (saved) return saved.id;
  const old: Record<string, LevelId> = { 1: 'easy', 3: 'medium', 5: 'medium', 10: 'strong' };
  return (oldThinkSeconds !== null && old[oldThinkSeconds]) || DEFAULT_LEVEL;
};

// A saved board size, or the default (Full) if it is missing or unknown.
export const parseBoardSize = (raw: string | null): BoardSizeId =>
  BOARD_SIZES.find(s => s.id === raw)?.id ?? DEFAULT_BOARD_SIZE;

// A saved skin id, or the fallback if it is missing or names no skin.
export const parseSkinId = (raw: string | null, ids: string[], fallback: string): string =>
  raw !== null && ids.includes(raw) ? raw : fallback;

// The on/off settings in Preferences, in the order shown there: the
// storage key, and the label and line explaining it. Adding a switch is a
// row here plus the code that uses it (penrose-territory.tsx reads
// `switches[id]`).
export const SWITCHES = [
  {
    id: 'hints', key: 'penrogo.hints', label: 'Hints',
    detail: 'Show a Hint button that highlights a good move for the player to move (or suggests passing).'
  },
  {
    id: 'atari', key: 'penrogo.atari', label: 'Atari warnings',
    detail: 'Outline any group down to its last liberty (it can be captured next move), mark that liberty, and say so under the turn.'
  },
  {
    id: 'undo', key: 'penrogo.undo', label: 'Undo',
    detail: 'Show an Undo button that takes back your last move (against the computer, its reply too). Turn it off for a game without take-backs.'
  }
] as const;
export type SwitchId = (typeof SWITCHES)[number]['id'];
export type Switches = Record<SwitchId, boolean>;

// Every switch is on by default. Saved as 'on' or 'off'; anything else
// (including nothing saved) means on, so new players have it.
export const parseSwitch = (raw: string | null): boolean => raw !== 'off';
export const formatSwitch = (on: boolean): string => (on ? 'on' : 'off');

// Every switch read back, given a way to read a stored value by key.
export const readSwitches = (read: (key: string) => string | null): Switches => {
  const switches = {} as Switches;
  for (const s of SWITCHES) switches[s.id] = parseSwitch(read(s.key));
  return switches;
};

// Where a switch is stored.
export const switchKey = (id: SwitchId): string => SWITCHES.find(s => s.id === id)?.key ?? `penrogo.${id}`;
