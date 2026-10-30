// The panel under the scoreboard. Before a game: the mode, the board size,
// the computer's level and Start. During one: the opening tile's type and
// rotation (until the board exists), Place on touch screens, Hint (when
// hints are on), Undo (when undo is on), Pass (Skip Opening before the
// board exists) and New Game.
import { Lightbulb, Play, RotateCcw, RotateCw, SkipForward, Undo2 } from 'lucide-react';
import { isHumanTurn, undoDepth, type GameAction, type GameState } from '../game';
import type { Target } from '../targeting';
import { BOARD_SIZES, type BoardSizeId, type TileType } from '../board-geometry';
import { LEVELS, type LevelId } from '../levels';

// What every panel gets: the game and a way to act on it
type GameProps = {
  game: GameState;
  dispatch: (a: GameAction) => void;
};

// Before a game: the board size and the computer's level (saved settings),
// and Start
type StartPanelProps = GameProps & {
  level: LevelId;
  onLevel: (l: LevelId) => void;
  boardSizeId: BoardSizeId;
  onBoardSize: (s: BoardSizeId) => void;
  onStart: () => void;
};

// Until the board exists: the opening tile's type and rotation
type OpeningControlsProps = {
  tileType: TileType;
  onTileType: (t: TileType) => void;
  rotation: number;
  onRotate: (dir: 1 | -1) => void;
  isTouchDevice: boolean;
};

// During a game: Place (touch), Hint, Undo, Pass and New Game, and the
// opening controls until the board exists
type PlayControlsProps = GameProps & {
  isTouchDevice: boolean;
  target: Target | null;
  onPlace: () => void;
  hintsOn: boolean;
  undoOn: boolean;
  onNewGame: () => void;
  opening: OpeningControlsProps;
};

// The panel: the game, the skin's panel classes, and each panel's own props
type ControlsProps = GameProps & {
  panel: string;
  start: Omit<StartPanelProps, keyof GameProps>;
  play: Omit<PlayControlsProps, keyof GameProps>;
};

// A two-way choice button, highlighted when chosen
const choiceClass = (chosen: boolean, size: string) =>
  `${size} rounded-lg font-semibold ${chosen ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`;

// A labeled drop-down of choices
const Choice = <T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { id: T; text: string }[]; onChange: (v: T) => void;
}) => (
  <label className="text-slate-300 text-sm flex items-center gap-2">
    {label}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="bg-slate-700 text-white rounded-lg px-2 py-2"
    >
      {options.map(o => (
        <option key={o.id} value={o.id}>{o.text}</option>
      ))}
    </select>
  </label>
);

const SIZE_OPTIONS = BOARD_SIZES.map(s => ({ id: s.id, text: `${s.name} (~${s.tiles} tiles)` }));
const LEVEL_OPTIONS = LEVELS.map(l => ({ id: l.id, text: l.name }));

const StartPanel = ({ game, dispatch, level, onLevel, boardSizeId, onBoardSize, onStart }: StartPanelProps) => (
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
    <Choice label="Board" value={boardSizeId} options={SIZE_OPTIONS} onChange={onBoardSize} />
    {game.mode === 'ai' && <Choice label="Computer" value={level} options={LEVEL_OPTIONS} onChange={onLevel} />}
    <button
      onClick={onStart}
      className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-semibold"
    >
      <Play size={20} />
      Start Game
    </button>
  </>
);

const OpeningControls = ({ tileType, onTileType, rotation, onRotate, isTouchDevice }: OpeningControlsProps) => (
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

const PlayControls = (props: PlayControlsProps) => {
  const { game, dispatch, isTouchDevice, target, onPlace, hintsOn, undoOn, onNewGame, opening } = props;
  const humanTurn = isHumanTurn(game);
  const canPlace = !!target && target.legal;
  const canHint = humanTurn && game.hint?.status !== 'thinking';
  const canUndo = undoDepth(game) > 0;
  return (
    <>
      {!game.tiles && <OpeningControls {...opening} />}

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

      {hintsOn && game.tiles && !game.gameOver && (
        <button
          onClick={() => dispatch({ type: 'askHint' })}
          disabled={!canHint}
          className={`bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 ${
            canHint ? '' : 'opacity-50'
          }`}
        >
          <Lightbulb size={20} />
          Hint
        </button>
      )}

      {undoOn && (
        <button
          onClick={() => dispatch({ type: 'undo' })}
          disabled={!canUndo}
          className={`bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 ${
            canUndo ? '' : 'opacity-50'
          }`}
        >
          <Undo2 size={20} />
          Undo
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

const Controls = ({ game, dispatch, panel, start, play }: ControlsProps) => (
  // On a phone held sideways, every button is shorter so the panel fits
  <div className={`${panel} rounded-lg p-2 flex gap-2 sm:gap-3 short:gap-1.5 items-center justify-center flex-wrap short:[&_button]:py-1.5 short:[&_button]:px-3`}>
    {game.started
      ? <PlayControls game={game} dispatch={dispatch} {...play} />
      : <StartPanel game={game} dispatch={dispatch} {...start} />}
  </div>
);

export default Controls;
