// The settings remembered in this browser: the skin and the computer's
// thinking time. What a saved value means is decided in prefs.ts.
import { useState } from 'react';
import { SKINS, DEFAULT_SKIN } from '../skins';
import { SKIN_STORAGE_KEY, THINK_STORAGE_KEY, parseSkinId, parseThinkSeconds } from '../prefs';

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (e.g. private mode): the choice lasts this visit
  }
};

export const useSettings = () => {
  const [skinId, setSkinIdState] = useState(() =>
    parseSkinId(read(SKIN_STORAGE_KEY), SKINS.map(s => s.id), DEFAULT_SKIN));
  const [thinkSeconds, setThinkSecondsState] = useState(() => parseThinkSeconds(read(THINK_STORAGE_KEY)));

  const setSkinId = (id: string) => {
    setSkinIdState(id);
    write(SKIN_STORAGE_KEY, id);
  };
  const setThinkSeconds = (s: number) => {
    setThinkSecondsState(s);
    write(THINK_STORAGE_KEY, String(s));
  };

  return { skinId, setSkinId, thinkSeconds, setThinkSeconds };
};
