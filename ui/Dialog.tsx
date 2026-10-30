// A dialog over the page: a titled panel with a close button. Escape, the X
// or a click outside closes it.
import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

type DialogProps = {
  title: string;
  panel: string; // the skin's panel classes
  onClose: () => void;
  children: ReactNode;
};

const Dialog = ({ title, panel, onClose, children }: DialogProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="safe-area [--pad:1rem] short:[--pad:0.5rem] fixed inset-0 z-10 bg-slate-900/95 overflow-y-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={title}
        className={`max-w-2xl mx-auto ${panel} rounded-lg p-4 sm:p-6 short:p-3 text-slate-300 text-sm sm:text-base`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2 short:mb-1">
          <h2 className="text-xl sm:text-2xl short:text-lg font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-300 hover:text-white p-1"
          >
            <X size={24} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default Dialog;
