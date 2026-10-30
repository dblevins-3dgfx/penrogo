// The settings remembered in this browser: the skin, the computer's level,
// the board size, and the on/off switches (SWITCHES in prefs.ts: hints,
// atari warnings, undo). What a saved value means is decided in prefs.ts.
import { useState } from 'react';
import { SKINS, DEFAULT_SKIN } from '../skins';
import {
  BOARD_STORAGE_KEY, LEVEL_STORAGE_KEY, OLD_THINK_STORAGE_KEY, SKIN_STORAGE_KEY,
  formatSwitch, parseBoardSize, parseLevel, parseSkinId, readSwitches, switchKey, type SwitchId
} from '../prefs';
import type { LevelId } from '../levels';
import type { BoardSizeId } from '../board-geometry';

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
  const [level, setLevelState] = useState(() => parseLevel(read(LEVEL_STORAGE_KEY), read(OLD_THINK_STORAGE_KEY)));
  const [boardSizeId, setBoardSizeState] = useState(() => parseBoardSize(read(BOARD_STORAGE_KEY)));
  const [switches, setSwitches] = useState(() => readSwitches(read));

  const setSkinId = (id: string) => {
    setSkinIdState(id);
    write(SKIN_STORAGE_KEY, id);
  };
  const setLevel = (l: LevelId) => {
    setLevelState(l);
    write(LEVEL_STORAGE_KEY, l);
  };
  const setBoardSize = (s: BoardSizeId) => {
    setBoardSizeState(s);
    write(BOARD_STORAGE_KEY, s);
  };
  const setSwitch = (id: SwitchId, on: boolean) => {
    setSwitches(prev => ({ ...prev, [id]: on }));
    write(switchKey(id), formatSwitch(on));
  };

  return { skinId, setSkinId, level, setLevel, boardSizeId, setBoardSize, switches, setSwitch };
};
