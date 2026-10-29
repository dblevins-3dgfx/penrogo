// Settings remembered in this browser (localStorage), and how a saved value
// is read back. Reading and writing storage itself is in ui/useSettings.ts;
// these functions only decide what a stored string means.

export const SKIN_STORAGE_KEY = 'penrogo.skin';
export const THINK_STORAGE_KEY = 'penrogo.thinkSeconds';
export const HINTS_STORAGE_KEY = 'penrogo.hints';

// How long the computer may think per move, in seconds.
export const THINK_OPTIONS = [1, 3, 5, 10];
export const DEFAULT_THINK_SECONDS = 3;

// A saved thinking time, or the default if it is missing or not one of the
// choices.
export const parseThinkSeconds = (raw: string | null): number => {
  const v = Number(raw);
  return raw !== null && THINK_OPTIONS.includes(v) ? v : DEFAULT_THINK_SECONDS;
};

// A saved skin id, or the fallback if it is missing or names no skin.
export const parseSkinId = (raw: string | null, ids: string[], fallback: string): string =>
  raw !== null && ids.includes(raw) ? raw : fallback;

// Whether the Hint button is available. Saved as 'on' or 'off'; anything
// else (including nothing saved) means on, so new players have it.
export const parseHints = (raw: string | null): boolean => raw !== 'off';
export const formatHints = (on: boolean): string => (on ? 'on' : 'off');
