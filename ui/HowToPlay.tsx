// The How to Play overlay.
import Dialog from './Dialog';
import type { PlayerStyle } from '../skins';

type HowToPlayProps = {
  panel: string; // the skin's panel classes
  players: { 1: PlayerStyle; 2: PlayerStyle };
  isTouchDevice: boolean;
  onClose: () => void;
};

const HowToPlay = ({ panel, players, isTouchDevice, onClose }: HowToPlayProps) => (
  <Dialog title="How to Play" panel={panel} onClose={onClose}>
    <p className="mb-3">Go, played on a Penrose tiling of kites and darts.</p>
    <ul className="list-disc list-inside space-y-2">
      <li>Choose 2 Players or vs Computer (the computer plays {players[2].name}), pick a board size (smaller boards make shorter games), then press Start. Against the computer you can also pick its level, from Beginner (weaker on purpose) to Strong</li>
      <li>
        Player 1 places the first tile anywhere, as a kite or dart at any rotation
        {isTouchDevice
          ? ' (rotate with the buttons)'
          : ' (rotate with the scroll wheel, right-click, or Left/Right arrow keys)'}.
        A full Penrose tiling is then laid out around it, and that tile is Player 1's first stone
      </li>
      <li>Players then take turns claiming any empty tile</li>
      <li>Tiles that share an edge are neighbors. A group of your tiles is captured, and removed, when none of its neighbors are empty</li>
      <li>You can't claim a tile that would leave your own group with no empty neighbors (suicide), or that repeats an earlier position (ko)</li>
      <li>A group with only one empty neighbor left is in atari: it can be captured next move. Groups in atari are outlined in red, with a red ring on their last empty neighbor, so you can save yours or capture theirs. The warnings can be turned off in Preferences</li>
      <li>Pass when you have nothing useful to play. Two passes in a row end the game</li>
      <li>Stuck? Press Hint and the computer highlights a good move for you, or suggests passing. Hints can be turned off in Preferences (the gear button)</li>
      <li>Undo takes back your last move (against the computer, its reply too), so you can try something else. It can be turned off in Preferences</li>
      <li>Score: tiles you hold plus empty areas surrounded only by your tiles. Surrounded areas are tinted when the game ends</li>
    </ul>
    <p className="mt-4 text-xs text-slate-400">
      Penrogo is open source under the MIT License.{' '}
      <a href="THIRD_PARTY_LICENSES.txt" target="_blank" rel="noopener" className="underline hover:text-slate-200">
        Third-party licenses
      </a>
    </p>
  </Dialog>
);

export default HowToPlay;
