// The computer's levels, chosen on the start screen. Reading a saved level
// back is in prefs.ts.
import type { SearchOptions } from './mcts';

// How strong the computer plays: how long it may think per move, and for
// Beginner a cap on its playouts and a chance of picking a runner-up move
// (see chooseMctsMove).
export type LevelId = 'beginner' | 'easy' | 'medium' | 'strong';
export type Level = { id: LevelId; name: string; search: SearchOptions & { timeMs: number } };
export const LEVELS: Level[] = [
  { id: 'beginner', name: 'Beginner', search: { timeMs: 1000, maxPlayouts: 300, wander: 0.3 } },
  { id: 'easy', name: 'Easy', search: { timeMs: 1000 } },
  { id: 'medium', name: 'Medium', search: { timeMs: 3000 } },
  { id: 'strong', name: 'Strong', search: { timeMs: 10000 } }
];
export const DEFAULT_LEVEL: LevelId = 'medium';
export const levelById = (id: LevelId): Level => LEVELS.find(l => l.id === id) ?? LEVELS[2];
