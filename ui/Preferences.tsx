// The Preferences dialog: the skin, and settings that change how the game
// helps the player. Each change takes effect at once and is remembered in
// this browser.
import { Check } from 'lucide-react';
import Dialog from './Dialog';
import SkinPreview from './SkinPreview';
import { SKINS } from '../skins';
import { SWITCHES, type SwitchId, type Switches } from '../prefs';

type PreferencesProps = {
  panel: string; // the skin's panel classes
  skinId: string;
  onSkin: (id: string) => void;
  switches: Switches;
  onSwitch: (id: SwitchId, on: boolean) => void;
  onClose: () => void;
};

// An on/off switch with a label and a line explaining it
const Toggle = ({ label, detail, on, onChange }: { label: string; detail: string; on: boolean; onChange: (on: boolean) => void }) => (
  <label className="flex items-start justify-between gap-4 py-2 cursor-pointer">
    <span>
      <span className="block text-white font-semibold">{label}</span>
      <span className="block text-slate-400 text-xs sm:text-sm">{detail}</span>
    </span>
    <span className="relative shrink-0 mt-1">
      <input
        type="checkbox"
        role="switch"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="block w-11 h-6 rounded-full bg-slate-600 peer-checked:bg-green-600 transition-colors" />
      <span className="absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
    </span>
  </label>
);

// Every skin as a card with a preview; the chosen one is outlined and ticked
const SkinChooser = ({ skinId, onSkin }: { skinId: string; onSkin: (id: string) => void }) => (
  <div role="radiogroup" aria-label="Skin" className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mt-1 mb-3">
    {SKINS.map(k => {
      const chosen = k.id === skinId;
      return (
        <button
          key={k.id}
          role="radio"
          aria-checked={chosen}
          onClick={() => onSkin(k.id)}
          className={`rounded-lg p-1.5 text-left bg-slate-800/60 hover:bg-slate-700/60 ring-2 ${
            chosen ? 'ring-white' : 'ring-transparent'
          }`}
        >
          <SkinPreview skin={k} />
          <span className="flex items-center justify-between mt-1 px-0.5 text-sm text-white">
            {k.name}
            {chosen && <Check size={16} aria-hidden="true" />}
          </span>
        </button>
      );
    })}
  </div>
);

const Preferences = ({ panel, skinId, onSkin, switches, onSwitch, onClose }: PreferencesProps) => (
  <Dialog title="Preferences" panel={panel} onClose={onClose}>
    <h3 className="text-white font-semibold">Skin</h3>
    <p className="text-slate-400 text-xs sm:text-sm">How the board and page look. It never changes the game.</p>
    <SkinChooser skinId={skinId} onSkin={onSkin} />
    {SWITCHES.map(s => (
      <Toggle key={s.id} label={s.label} detail={s.detail} on={switches[s.id]} onChange={on => onSwitch(s.id, on)} />
    ))}
  </Dialog>
);

export default Preferences;
