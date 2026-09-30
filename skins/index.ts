// The skin registry. Every skins/<name>/index.ts whose default export is a
// Skin is found automatically at build time (Vite's import.meta.glob), and
// listed by its `order`, then name.
import type { Skin } from './types';

export type { Skin, SkinEffects, PlayerStyle } from './types';
import type { PlayerStyle } from './types';

// Player text colors for skins that don't choose their own
export const DEFAULT_PLAYERS: { 1: PlayerStyle; 2: PlayerStyle } = {
  1: { text: 'text-blue-400', name: 'blue' },
  2: { text: 'text-red-400', name: 'red' }
};

const modules = import.meta.glob<Skin>('./*/index.ts', { eager: true, import: 'default' });

export const SKINS: Skin[] = Object.values(modules).sort(
  (a, b) => (a.order ?? 100) - (b.order ?? 100) || a.name.localeCompare(b.name)
);

export const DEFAULT_SKIN = 'plain';

export const skinById = (id: string): Skin =>
  SKINS.find(s => s.id === id) || SKINS.find(s => s.id === DEFAULT_SKIN) || SKINS[0];
