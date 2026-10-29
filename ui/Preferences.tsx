// The Preferences dialog: settings that change how the game helps the
// player. Each change takes effect at once and is remembered in this
// browser.
import Dialog from './Dialog';

type PreferencesProps = {
  panel: string; // the skin's panel classes
  hintsOn: boolean;
  onHintsOn: (on: boolean) => void;
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

const Preferences = ({ panel, hintsOn, onHintsOn, onClose }: PreferencesProps) => (
  <Dialog title="Preferences" panel={panel} onClose={onClose}>
    <Toggle
      label="Hints"
      detail="Show a Hint button that highlights a good move for the player to move (or suggests passing)."
      on={hintsOn}
      onChange={onHintsOn}
    />
  </Dialog>
);

export default Preferences;
