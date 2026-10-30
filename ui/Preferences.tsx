// The Preferences dialog: the skin, and settings that change how the game
// helps the player. Each change takes effect at once and is remembered in
// this browser.
import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Dialog from './Dialog';
import SkinPreview from './SkinPreview';
import { SKINS } from '../skins';
import { SWITCHES, type SwitchId, type Switches } from '../prefs';
import { stepChoice, swipeStep } from '../chooser';

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
  <label className="flex items-start justify-between gap-4 py-2 short:py-1 cursor-pointer">
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

// The chosen skin's preview, with previous and next buttons either side
// (wrapping around), its name and place in the list underneath. A swipe
// across the preview or the Left/Right keys also step. Each step switches
// the skin at once.
const SkinChooser = ({ skinId, onSkin }: { skinId: string; onSkin: (id: string) => void }) => {
  const ids = SKINS.map(k => k.id);
  const index = Math.max(0, ids.indexOf(skinId));
  const skin = SKINS[index];
  const step = (dir: 1 | -1) => onSkin(stepChoice(ids, skin.id, dir));
  const swipeFrom = useRef<{ x: number; y: number } | null>(null);

  // The arrow keys step the skin here, not the opening tile behind the dialog
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    e.stopPropagation();
    step(e.key === 'ArrowRight' ? 1 : -1);
  };
  const handlePointerDown = (e: React.PointerEvent) => {
    swipeFrom.current = e.pointerType === 'touch' ? { x: e.clientX, y: e.clientY } : null;
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    const from = swipeFrom.current;
    swipeFrom.current = null;
    const dir = from ? swipeStep(e.clientX - from.x, e.clientY - from.y) : 0;
    if (dir) step(dir);
  };

  const arrow = 'shrink-0 p-2 rounded-full text-white bg-slate-800/60 hover:bg-slate-700/60';
  return (
    <div role="group" aria-label="Skin" className="mt-1 mb-3" onKeyDown={handleKeyDown}>
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        <button onClick={() => step(-1)} aria-label="Previous skin" className={arrow}>
          <ChevronLeft size={22} />
        </button>
        <div
          className="w-full max-w-48 sm:max-w-52 short:max-w-40"
          style={{ touchAction: 'pan-y' }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => { swipeFrom.current = null; }}
        >
          <SkinPreview skin={skin} />
        </div>
        <button onClick={() => step(1)} aria-label="Next skin" className={arrow}>
          <ChevronRight size={22} />
        </button>
      </div>
      <p aria-live="polite" className="mt-1.5 text-center">
        <span className="text-white font-semibold">{skin.name}</span>
        <span className="text-slate-400 text-xs sm:text-sm"> · {index + 1} of {SKINS.length}</span>
      </p>
    </div>
  );
};

// The skin above the switches; on a phone held sideways (short), side by
// side, so everything fits without scrolling
const Preferences = ({ panel, skinId, onSkin, switches, onSwitch, onClose }: PreferencesProps) => (
  <Dialog title="Preferences" panel={panel} onClose={onClose}>
    <div className="short:grid short:grid-cols-[auto_1fr] short:gap-5 short:items-start">
      <div>
        <h3 className="text-white font-semibold">Skin</h3>
        <p className="text-slate-400 text-xs sm:text-sm short:hidden">How the board and page look. It never changes the game.</p>
        <SkinChooser skinId={skinId} onSkin={onSkin} />
      </div>
      <div>
        {SWITCHES.map(s => (
          <Toggle key={s.id} label={s.label} detail={s.detail} on={switches[s.id]} onChange={on => onSwitch(s.id, on)} />
        ))}
      </div>
    </div>
  </Dialog>
);

export default Preferences;
