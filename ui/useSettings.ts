// The settings remembered in this browser: the skin, the computer's level,
// the board size, whether hints and undo are available and whether atari
// warnings are shown. What a saved value means is decided in prefs.ts.
import { useState } from 'react';
import { SKINS, DEFAULT_SKIN } from '../skins';
import {
  ATARI_STORAGE_KEY, BOARD_STORAGE_KEY, HINTS_STORAGE_KEY, LEVEL_STORAGE_KEY, OLD_THINK_STORAGE_KEY, SKIN_STORAGE_KEY,
  UNDO_STORAGE_KEY, formatSwitch, parseBoardSize, parseLevel, parseSkinId, parseSwitch, type LevelId
} from '../prefs';
import type { BoardSizeId } from '../opening';

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
  const [hintsOn, setHintsOnState] = useState(() => parseSwitch(read(HINTS_STORAGE_KEY)));
  const [atariOn, setAtariOnState] = useState(() => parseSwitch(read(ATARI_STORAGE_KEY)));
  const [undoOn, setUndoOnState] = useState(() => parseSwitch(read(UNDO_STORAGE_KEY)));

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

  const setHintsOn = (on: boolean) => {
    setHintsOnState(on);
    write(HINTS_STORAGE_KEY, formatSwitch(on));
  };
  const setAtariOn = (on: boolean) => {
    setAtariOnState(on);
    write(ATARI_STORAGE_KEY, formatSwitch(on));
  };
  const setUndoOn = (on: boolean) => {
    setUndoOnState(on);
    write(UNDO_STORAGE_KEY, formatSwitch(on));
  };

  return {
    skinId, setSkinId, level, setLevel, boardSizeId, setBoardSize, hintsOn, setHintsOn, atariOn, setAtariOn, undoOn, setUndoOn
  };
};
