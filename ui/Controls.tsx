// The panel under the scoreboard. Before a game: the mode, the computer's
// thinking time and Start. During one: the opening tile's type and
// rotation (until the board exists), Place on touch screens, Pass (Skip
// Opening before the board exists) and New Game.
import { Play, RotateCcw, RotateCw, SkipForward } from 'lucide-react';
import { isHumanTurn, type GameAction, type GameState, type Target } from '../game';
import type { TileType } from '../opening';
import { THINK_OPTIONS } from '../prefs';

type ControlsProps = {
  game: GameState;
  dispatch: (a: GameAction) => void;
  panel: string; // the skin's panel classes
  thinkSeconds: number;
  onThinkSeconds: (s: number) => void;
  tileType: TileType;
  onTileType: (t: TileType) => void;
  rotation: number;
  onRotate: (dir: 1 | -1) => void;
  isTouchDevice: boolean;
  target: Target | null;
  onPlace: () => void;
  onStart: () => void;
  onNewGame: () => void;
};

// A two-way choice button, highlighted when chosen
const choiceClass = (chosen: boolean, size: string) =>
  `${size} rounded-lg font-semibold ${chosen ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`;

const StartPanel = ({ game, dispatch, thinkSeconds, onThinkSeconds, onStart }: ControlsProps) => (
  <>
    <div className="flex gap-2">
      <button
        onClick={() => dispatch({ type: 'setMode', mode: 'two' })}
        className={choiceClass(game.mode === 'two', 'px-4 py-3')}
      >
        2 Players
      </button>
      <button
        onClick={() => dispatch({ type: 'setMode', mode: 'ai' })}
        className={choiceClass(game.mode === 'ai', 'px-4 py-3')}
      >
        vs Computer
      </button>
    </div>
    {game.mode === 'ai' && (
      <label className="text-slate-300 text-sm flex items-center gap-2">
        Computer thinks
        <select
          value={thinkSeconds}
          onChange={(e) => onThinkSeconds(Number(e.target.value))}
          className="bg-slate-700 text-white rounded-lg px-2 py-2"
        >
          {THINK_OPTIONS.map(s => (
            <option key={s} value={s}>{s} s</option>
          ))}
        </select>
      </label>
    )}
    <button
      onClick={onStart}
      className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-semibold"
    >
      <Play size={20} />
      Start Game
    </button>
  </>
);

const OpeningControls = ({ tileType, onTileType, rotation, onRotate, isTouchDevice }: ControlsProps) => (
  <>
    <div className="flex gap-2">
      <button onClick={() => onTileType('kite')} className={choiceClass(tileType === 'kite', 'px-4 py-2')}>
        Kite
      </button>
      <button onClick={() => onTileType('dart')} className={choiceClass(tileType === 'dart', 'px-4 py-2')}>
        Dart
      </button>
    </div>

    {isTouchDevice ? (
      <>
        <button
          onClick={() => onRotate(-1)}
          aria-label="Rotate counter-clockwise"
          className="bg-slate-700 active:bg-slate-600 text-white px-5 py-3 rounded-lg flex items-center gap-2"
        >
          <RotateCw size={22} style={{ transform: 'scaleX(-1)' }} />
        </button>

        <button
          onClick={() => onRotate(1)}
          aria-label="Rotate clockwise"
          className="bg-slate-700 active:bg-slate-600 text-white px-5 py-3 rounded-lg flex items-center gap-2"
        >
          <RotateCw size={22} />
          <span className="text-sm">{rotation}°</span>
        </button>
      </>
    ) : (
      <div className="text-slate-300 text-sm flex items-center gap-2">
        <RotateCw size={18} />
        <span>Rotate: scroll wheel, right-click, or ←/→</span>
        <span className="text-white font-semibold w-10">{rotation}°</span>
      </div>
    )}
  </>
);

const PlayControls = (props: ControlsProps) => {
  const { game, dispatch, isTouchDevice, target, onPlace, onNewGame } = props;
  const humanTurn = isHumanTurn(game);
  const canPlace = !!target && target.legal;
  return (
    <>
      {!game.tiles && <OpeningControls {...props} />}

      {isTouchDevice && !game.gameOver && (
        <button
          onClick={onPlace}
          disabled={!canPlace}
          className={`px-6 py-3 rounded-lg font-semibold text-white ${
            canPlace ? 'bg-green-600 active:bg-green-700' : 'bg-slate-600 opacity-50'
          }`}
        >
          Place
        </button>
      )}

      {!game.gameOver && (
        <button
          onClick={() => dispatch({ type: 'pass' })}
          disabled={!humanTurn}
          className={`bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 ${
            humanTurn ? '' : 'opacity-50'
          }`}
        >
          <SkipForward size={20} />
          {game.tiles ? 'Pass' : 'Skip Opening'}
        </button>
      )}

      <button
        onClick={onNewGame}
        className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
      >
        <RotateCcw size={18} />
        New Game
      </button>
    </>
  );
};

const Controls = (props: ControlsProps) => (
  // On a phone held sideways, every button is shorter so the panel fits
  <div className={`${props.panel} rounded-lg p-2 flex gap-2 sm:gap-3 short:gap-1.5 items-center justify-center flex-wrap short:[&_button]:py-1.5 short:[&_button]:px-3`}>
    {props.game.started ? <PlayControls {...props} /> : <StartPanel {...props} />}
  </div>
);

export default Controls;
