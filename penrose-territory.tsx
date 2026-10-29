// The game screen. It wires the game (ui/useGame.ts) and the remembered
// settings (ui/useSettings.ts) to the pieces of the page: the header, the
// scoreboard, the controls, the board and the How to Play overlay. It also
// holds what only the screen needs: the opening tile's type and rotation,
// where the pointer is, and whether How to Play is open. The rules are in
// game.ts, opening.ts and go-engine.ts.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { placeAction, targetAt } from './game';
import { rotateStep, type Point, type TileType } from './opening';
import { DEFAULT_PLAYERS, skinById } from './skins';
import { useGame } from './ui/useGame';
import { useSettings } from './ui/useSettings';
import Header from './ui/Header';
import Scoreboard from './ui/Scoreboard';
import Controls from './ui/Controls';
import BoardCanvas from './ui/BoardCanvas';
import HowToPlay from './ui/HowToPlay';

const isTouchDevice = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;

const PenroseTerritoryGame = () => {
  const { skinId, setSkinId, thinkSeconds, setThinkSeconds } = useSettings();
  const [game, dispatch] = useGame(thinkSeconds);
  const [tileType, setTileType] = useState<TileType>('kite');
  const [rotation, setRotation] = useState(0);
  const [hoveredPos, setHoveredPos] = useState<Point | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const skin = skinById(skinId);
  const players = skin.players || DEFAULT_PLAYERS;
  const panel = skin.chrome.panel;

  // Stable, so the board's wheel listener isn't re-attached on every render
  const rotate = useCallback((dir: 1 | -1) => setRotation(prev => rotateStep(prev, dir)), []);
  // Kept while nothing it depends on changes, so the board isn't redrawn
  // and the skin's preview animation isn't restarted on every render
  const target = useMemo(() => targetAt(game, hoveredPos, tileType, rotation), [game, hoveredPos, tileType, rotation]);
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

  const start = () => {
    setRotation(0);
    dispatch({ type: 'start' });
  };

  const newGame = () => {
    setHoveredPos(null);
    dispatch({ type: 'reset' });
  };

  // Touch: Place confirms the preview a finger drag left on the board
  const placeTarget = () => {
    if (target?.legal) dispatch(placeAction(target));
    setHoveredPos(null);
  };

  // The layout fills exactly the visible window (dvh tracks mobile browser
  // toolbars): header, scores and controls take their natural height and the
  // board scales to the largest 4:3 size that fits in the rest.
  return (
    <div className={`safe-area [--pad:0.5rem] sm:[--pad:0.75rem] w-full h-dvh overflow-hidden ${skin.chrome.page} flex flex-col items-center`}>
      <div className="max-w-6xl w-full h-full flex flex-col gap-2">
        <Header skin={skin} onSkin={setSkinId} onHelp={() => setShowHelp(true)} />
        <Scoreboard game={game} panel={panel} players={players} />
        <Controls
          game={game}
          dispatch={dispatch}
          panel={panel}
          thinkSeconds={thinkSeconds}
          onThinkSeconds={setThinkSeconds}
          tileType={tileType}
          onTileType={setTileType}
          rotation={rotation}
          onRotate={rotate}
          isTouchDevice={isTouchDevice}
          target={target}
          onPlace={placeTarget}
          onStart={start}
          onNewGame={newGame}
        />

        {/* Size container: the canvas width is the smaller of the full
            width and the width a 4:3 board would have at the full height. */}
        <div className="flex-1 min-h-0 flex items-start justify-center" style={{ containerType: 'size' }}>
          <BoardCanvas
            skin={skin}
            game={game}
            target={target}
            onHover={setHoveredPos}
            onClick={place}
            onRotate={rotate}
          />
        </div>
      </div>

      {showHelp && (
        <HowToPlay panel={panel} players={players} isTouchDevice={isTouchDevice} onClose={() => setShowHelp(false)} />
      )}
    </div>
  );
};

export default PenroseTerritoryGame;
