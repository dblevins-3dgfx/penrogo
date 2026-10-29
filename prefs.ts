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
export const HINTS_STORAGE_KEY = 'penrogo.hints';
export const ATARI_STORAGE_KEY = 'penrogo.atari';
export const UNDO_STORAGE_KEY = 'penrogo.undo';

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

// A switch that is on by default: whether the Hint and Undo buttons are
// available, and whether atari warnings are shown. Saved as 'on' or 'off'; anything
// else (including nothing saved) means on, so new players have it.
export const parseSwitch = (raw: string | null): boolean => raw !== 'off';
export const formatSwitch = (on: boolean): string => (on ? 'on' : 'off');
