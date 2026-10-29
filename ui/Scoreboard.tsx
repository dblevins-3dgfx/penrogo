// Each player's score and captures, whose turn it is, and the status line.
import { playerName, shownScore, turnText, type GameState, type Player } from '../game';
import type { PlayerStyle } from '../skins';

type ScoreboardProps = {
  game: GameState;
  panel: string; // the skin's panel classes
  players: { 1: PlayerStyle; 2: PlayerStyle };
};

const Scoreboard = ({ game, panel, players }: ScoreboardProps) => {
  const score = shownScore(game);
  const side = (p: Player) => (
    <div className="text-center">
      <div className={`${players[p].text} text-xl sm:text-2xl font-bold`}>{score[p]}</div>
      <div className="text-slate-400 text-xs sm:text-sm">
        {playerName(game.mode, p)}{game.captured[p] > 0 && ` · ${game.captured[p]} captured`}
      </div>
    </div>
  );

  return (
    <div className={`${panel} rounded-lg px-3 py-2 flex justify-around items-center`}>
      {side(1)}
      <div className="text-center">
        <div className={`text-base sm:text-xl font-bold ${game.gameOver ? 'text-white' : players[game.currentPlayer].text}`}>
          {turnText(game)}
        </div>
        {game.message && (
          <div className="text-yellow-300 text-xs sm:text-sm">{game.message}</div>
        )}
      </div>
      {side(2)}
    </div>
  );
};

export default Scoreboard;
