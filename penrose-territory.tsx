// The game screen. It wires the game (ui/useGame.ts) and the remembered
// settings (ui/useSettings.ts) to the pieces of the page: the header, the
// scoreboard, the controls, the board, and the Preferences and How to Play
// dialogs. It also holds what only the screen needs: the opening tile's
// type and rotation, where the pointer is, and which dialog is open. The rules are in
// game.ts, opening.ts and rules.ts; the computer player in mcts.ts.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { atariText, ataris, placeAction, targetAt } from './game';
import { rotateStep, type Point, type TileType } from './opening';
import { DEFAULT_PLAYERS, skinById } from './skins';
import { levelById } from './prefs';
import { useGame } from './ui/useGame';
import { useSettings } from './ui/useSettings';
import Header from './ui/Header';
import Scoreboard from './ui/Scoreboard';
import Controls from './ui/Controls';
import BoardCanvas from './ui/BoardCanvas';
import HowToPlay from './ui/HowToPlay';
import Preferences from './ui/Preferences';

const isTouchDevice = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;

const PenroseTerritoryGame = () => {
  const {
    skinId, setSkinId, level, setLevel, boardSizeId, setBoardSize, switches, setSwitch
  } = useSettings();
  const [game, dispatch] = useGame(levelById(level).search);
  const [tileType, setTileType] = useState<TileType>('kite');
  const [rotation, setRotation] = useState(0);
  const [hoveredPos, setHoveredPos] = useState<Point | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const skin = skinById(skinId);
  const players = skin.players || DEFAULT_PLAYERS;
  const panel = skin.chrome.panel;

  // Stable, so the board's wheel listener isn't re-attached on every render
  const rotate = useCallback((dir: 1 | -1) => setRotation(prev => rotateStep(prev, dir)), []);
  // Kept while nothing it depends on changes, so the board isn't redrawn
  // and the skin's preview animation isn't restarted on every render
  const target = useMemo(() => targetAt(game, hoveredPos, tileType, rotation), [game, hoveredPos, tileType, rotation]);
  // The groups in atari, when the warnings are on
  const atari = useMemo(() => (switches.atari ? ataris(game) : []), [switches.atari, game]);
  const place = (pos: Point) => {
    const a = placeAction(targetAt(game, pos, tileType, rotation));
    if (a) dispatch(a);
  };

  // Left/Right arrows turn the opening tile
  useEffect(() => {
    if (!game.started) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      rotate(e.key === 'ArrowRight' ? 1 : -1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [game.started, rotate]);

  // Turning hints off takes away a hint already shown (or being looked for)
  useEffect(() => {
    if (!switches.hints && game.hint) dispatch({ type: 'clearHint' });
  }, [switches.hints, game.hint, dispatch]);

  const start = () => {
    setRotation(0);
    dispatch({ type: 'start', size: boardSizeId });
  };

  const newGame = () => {
    setHoveredPos(null);
    dispatch({ type: 'reset' });
  };

  // Touch: Place confirms the preview a finger drag left on the board
  const placeTarget = () => {
    const a = target?.legal ? placeAction(target) : null;
    if (a) dispatch(a);
    setHoveredPos(null);
  };

  // The layout fills exactly the visible window (dvh tracks mobile browser
  // toolbars). Portrait: header, scores and controls stack above the board,
  // which scales to the largest 4:3 size that fits in the rest. Landscape:
  // the board is on the left at the full height (a 4:3 box, narrowed if it
  // would leave the side panel less than 18rem), and the header, scores and
  // controls go in a panel on the right that takes the remaining width, up
  // to 28rem, scrolling if it runs out of height.
  return (
    <div className={`safe-area [--pad:0.5rem] sm:[--pad:0.75rem] w-full h-dvh overflow-hidden ${skin.chrome.page} flex flex-col items-center`}>
      <div className="max-w-6xl landscape:max-w-none w-full h-full flex flex-col landscape:flex-row gap-2">
        <div className="flex flex-col gap-2 short:gap-1.5 landscape:order-last landscape:flex-1 landscape:min-w-72 landscape:max-w-md landscape:min-h-0 landscape:overflow-y-auto">
          <Header skin={skin} onPrefs={() => setShowPrefs(true)} onHelp={() => setShowHelp(true)} />
          <Scoreboard game={game} panel={panel} players={players} warning={atariText(game.mode, atari)} />
          <Controls
            game={game}
            dispatch={dispatch}
            panel={panel}
            level={level}
            onLevel={setLevel}
            boardSizeId={boardSizeId}
            onBoardSize={setBoardSize}
            tileType={tileType}
            onTileType={setTileType}
            rotation={rotation}
            onRotate={rotate}
            isTouchDevice={isTouchDevice}
            target={target}
            onPlace={placeTarget}
            hintsOn={switches.hints}
            undoOn={switches.undo}
            onStart={start}
            onNewGame={newGame}
          />
        </div>

        {/* Size container: the canvas width is the smaller of the full
            width and the width a 4:3 board would have at the full height. */}
        <div
          className="flex-1 min-h-0 flex items-start justify-center landscape:flex-none landscape:h-full landscape:aspect-[4/3] landscape:max-w-[calc(100%-18.5rem)] landscape:items-center landscape:justify-start"
          style={{ containerType: 'size' }}
        >
          <BoardCanvas
            skin={skin}
            game={game}
            target={target}
            atari={atari}
            onHover={setHoveredPos}
            onClick={place}
            onRotate={rotate}
          />
        </div>
      </div>

      {showPrefs && (
        <Preferences
          panel={panel}
          skinId={skinId}
          onSkin={setSkinId}
          switches={switches}
          onSwitch={setSwitch}
          onClose={() => setShowPrefs(false)}
        />
      )}
      {showHelp && (
        <HowToPlay panel={panel} players={players} isTouchDevice={isTouchDevice} onClose={() => setShowHelp(false)} />
      )}
    </div>
  );
};

export default PenroseTerritoryGame;
