// The skin registry. Every skins/<name>/index.ts whose default export is a
// Skin is found automatically at build time (Vite's import.meta.glob), and
// listed by its `order`, then name.
import type { Skin } from './types';

export type { Skin, SkinEffects } from './types';

const modules = import.meta.glob<Skin>('./*/index.ts', { eager: true, import: 'default' });

export const SKINS: Skin[] = Object.values(modules).sort(
  (a, b) => (a.order ?? 100) - (b.order ?? 100) || a.name.localeCompare(b.name)
);

export const DEFAULT_SKIN = 'plain';

export const skinById = (id: string): Skin =>
  SKINS.find(s => s.id === id) || SKINS.find(s => s.id === DEFAULT_SKIN) || SKINS[0];
