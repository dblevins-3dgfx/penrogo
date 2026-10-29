// The title, the skin picker and the How to Play button.
import { CircleHelp, Palette } from 'lucide-react';
import { SKINS, type Skin } from '../skins';

type HeaderProps = {
  skin: Skin;
  onSkin: (id: string) => void;
  onHelp: () => void;
};

const Header = ({ skin, onSkin, onHelp }: HeaderProps) => (
  <div className="flex items-center justify-between">
    <h1 className={`text-xl sm:text-2xl font-bold ${skin.chrome.title}`}>Penrogo</h1>
    <div className="flex items-center gap-3 sm:gap-4">
      <label className="text-slate-300 text-sm flex items-center gap-2">
        <Palette size={18} />
        <select
          value={skin.id}
          onChange={(e) => onSkin(e.target.value)}
          aria-label="Skin"
          className="bg-slate-700 text-white rounded-lg px-2 py-1"
        >
          {SKINS.map(k => (
            <option key={k.id} value={k.id}>{k.name}</option>
          ))}
        </select>
      </label>
      <button
        onClick={onHelp}
        className="text-slate-300 hover:text-white flex items-center gap-1 text-sm"
      >
        <CircleHelp size={20} />
        How to Play
      </button>
    </div>
  </div>
);

export default Header;
