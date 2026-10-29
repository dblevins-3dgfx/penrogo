// The title, and the Preferences and How to Play buttons.
import { CircleHelp, Settings } from 'lucide-react';
import type { Skin } from '../skins';

type HeaderProps = {
  skin: Skin;
  onPrefs: () => void;
  onHelp: () => void;
};

const Header = ({ skin, onPrefs, onHelp }: HeaderProps) => (
  <div className="flex items-center justify-between gap-3">
    <h1 className={`text-xl sm:text-2xl short:text-lg font-bold ${skin.chrome.title}`}>Penrogo</h1>
    <div className="flex items-center gap-3 sm:gap-4">
      <button
        onClick={onPrefs}
        aria-label="Preferences"
        title="Preferences"
        className="text-slate-300 hover:text-white flex items-center gap-1 text-sm"
      >
        <Settings size={20} />
      </button>
      <button
        onClick={onHelp}
        className="text-slate-300 hover:text-white flex items-center gap-1 text-sm whitespace-nowrap"
      >
        <CircleHelp size={20} />
        How to Play
      </button>
    </div>
  </div>
);

export default Header;
