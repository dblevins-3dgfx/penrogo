// The title, the skin picker, and the Preferences and How to Play buttons.
import { CircleHelp, Palette, Settings } from 'lucide-react';
import { SKINS, type Skin } from '../skins';

type HeaderProps = {
  skin: Skin;
  onSkin: (id: string) => void;
  onPrefs: () => void;
  onHelp: () => void;
};

const Header = ({ skin, onSkin, onPrefs, onHelp }: HeaderProps) => (
  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
    <h1 className={`text-xl sm:text-2xl short:text-lg font-bold ${skin.chrome.title}`}>Penrogo</h1>
    <div className="flex items-center gap-3 sm:gap-4 short:gap-2">
      <label className="text-slate-300 text-sm flex items-center gap-2">
        <Palette size={18} className="short:hidden" />
        <select
          value={skin.id}
          onChange={(e) => onSkin(e.target.value)}
          aria-label="Skin"
          className="bg-slate-700 text-white rounded-lg px-2 py-1 short:text-sm"
        >
          {SKINS.map(k => (
            <option key={k.id} value={k.id}>{k.name}</option>
          ))}
        </select>
      </label>
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
        aria-label="How to Play"
        title="How to Play"
        className="text-slate-300 hover:text-white flex items-center gap-1 text-sm"
      >
        <CircleHelp size={20} />
        {/* Just the icon on a narrow screen and in the landscape side panel */}
        <span className="hidden sm:inline landscape:hidden whitespace-nowrap">How to Play</span>
      </button>
    </div>
  </div>
);

export default Header;
