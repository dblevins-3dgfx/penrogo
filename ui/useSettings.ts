// The settings remembered in this browser: the skin, the computer's
// thinking time, whether hints are available and whether atari warnings
// are shown. What a saved value means
// is decided in prefs.ts.
import { useState } from 'react';
import { SKINS, DEFAULT_SKIN } from '../skins';
import {
  ATARI_STORAGE_KEY, HINTS_STORAGE_KEY, SKIN_STORAGE_KEY, THINK_STORAGE_KEY,
  formatSwitch, parseSkinId, parseSwitch, parseThinkSeconds
} from '../prefs';

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
  const [hintsOn, setHintsOnState] = useState(() => parseSwitch(read(HINTS_STORAGE_KEY)));
  const [atariOn, setAtariOnState] = useState(() => parseSwitch(read(ATARI_STORAGE_KEY)));

  const setSkinId = (id: string) => {
    setSkinIdState(id);
    write(SKIN_STORAGE_KEY, id);
  };
  const setThinkSeconds = (s: number) => {
    setThinkSecondsState(s);
    write(THINK_STORAGE_KEY, String(s));
  };

  const setHintsOn = (on: boolean) => {
    setHintsOnState(on);
    write(HINTS_STORAGE_KEY, formatSwitch(on));
  };
  const setAtariOn = (on: boolean) => {
    setAtariOnState(on);
    write(ATARI_STORAGE_KEY, formatSwitch(on));
  };

  return { skinId, setSkinId, thinkSeconds, setThinkSeconds, hintsOn, setHintsOn, atariOn, setAtariOn };
};
