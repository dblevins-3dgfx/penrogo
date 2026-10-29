// The How to Play overlay. Escape, the X or a click outside closes it.
import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { PlayerStyle } from '../skins';

type HowToPlayProps = {
  panel: string; // the skin's panel classes
  players: { 1: PlayerStyle; 2: PlayerStyle };
  isTouchDevice: boolean;
  onClose: () => void;
};

const HowToPlay = ({ panel, players, isTouchDevice, onClose }: HowToPlayProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="safe-area [--pad:1rem] fixed inset-0 z-10 bg-slate-900/95 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`max-w-2xl mx-auto ${panel} rounded-lg p-4 sm:p-6 text-slate-300 text-sm sm:text-base`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl sm:text-2xl font-bold text-white">How to Play</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-300 hover:text-white p-1"
          >
            <X size={24} />
          </button>
        </div>
        <p className="mb-3">Go, played on a Penrose tiling of kites and darts.</p>
        <ul className="list-disc list-inside space-y-2">
          <li>Choose 2 Players or vs Computer (the computer plays {players[2].name}), then press Start. Against the computer you can also choose how long it thinks per move: longer thinking makes it stronger</li>
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
          <li>Pass when you have nothing useful to play. Two passes in a row end the game</li>
          <li>Score: tiles you hold plus empty areas surrounded only by your tiles. Surrounded areas are tinted when the game ends</li>
        </ul>
        <p className="mt-4 text-xs text-slate-400">
          Penrogo is open source under the MIT License.{' '}
          <a href="THIRD_PARTY_LICENSES.txt" target="_blank" rel="noopener" className="underline hover:text-slate-200">
            Third-party licenses
          </a>
        </p>
      </div>
    </div>
  );
};

export default HowToPlay;
