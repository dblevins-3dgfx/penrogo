// Each player's score and captures, whose turn it is, the status line and
// the atari warning.
import { playerName, shownScore, turnText, type GameState, type Player } from '../game';
import type { PlayerStyle } from '../skins';

type ScoreboardProps = {
  game: GameState;
  panel: string; // the skin's panel classes
  players: { 1: PlayerStyle; 2: PlayerStyle };
  warning: string; // the atari warning, or ''
};

const Scoreboard = ({ game, panel, players, warning }: ScoreboardProps) => {
  const score = shownScore(game);
  const side = (p: Player) => (
    <div className="text-center">
      <div className={`${players[p].text} text-xl sm:text-2xl short:text-lg font-bold`}>{score[p]}</div>
      <div className="text-slate-400 text-xs sm:text-sm">
        {playerName(game.mode, p)}{game.captured[p] > 0 && ` · ${game.captured[p]} captured`}
      </div>
    </div>
  );

  return (
    // In the landscape side panel, whose turn it is goes on top, across the
    // panel, with the two players' scores below
    <div className={`${panel} rounded-lg px-3 py-2 short:py-1 flex justify-around items-center landscape:flex-wrap landscape:gap-y-1 short:gap-y-0`}>
      {side(1)}
      <div className="text-center landscape:order-first landscape:basis-full">
        <div className={`text-base sm:text-xl font-bold ${game.gameOver ? 'text-white' : players[game.currentPlayer].text}`}>
          {turnText(game)}
        </div>
        {game.message && (
          <div className="text-yellow-300 text-xs sm:text-sm">{game.message}</div>
        )}
        {warning && (
          <div className="text-red-300 text-xs sm:text-sm font-semibold">{warning}</div>
        )}
      </div>
      {side(2)}
    </div>
  );
};

export default Scoreboard;
