// Go rules on a tile graph: groups and liberties, legal moves (no suicide,
// positional superko), captures and area scoring. The computer player's
// search (mcts.ts) has its own fast copy of these rules for its playouts.
//
// A board is a list of tiles, each with `neighbors` (the tiles sharing an
// edge with it). `stones[i]` is 0 for an empty tile, or the player (1 or 2)
// who holds it.

import type { GraphTile, Player, Score, Stone } from './types';

// The outcome of trying a move: the new position and how many stones it
// captured, or why it is illegal.
export type MoveResult =
  | { ok: true; stones: Stone[]; captured: number }
  | { ok: false; reason: string };

export const opponentOf = (p: Player): Player => (p === 1 ? 2 : 1);

// The connected group of same-colored stones containing `start`, and its
// liberties (empty tiles adjacent to the group).
export const groupAt = (tiles: GraphTile[], stones: Stone[], start: number) => {
  const color = stones[start];
  const members = [start];
  const seen = new Set(members);
  const liberties = new Set<number>();
  for (let k = 0; k < members.length; k++) {
    for (const n of tiles[members[k]].neighbors) {
      if (stones[n] === 0) liberties.add(n);
      else if (stones[n] === color && !seen.has(n)) {
        seen.add(n);
        members.push(n);
      }
    }
  }
  return { members, liberties };
};

// A group down to its last liberty (in atari): whose it is, its tiles and
// that liberty.
export type AtariGroup = { player: Player; members: number[]; liberty: number };

// Every group in atari, each listed once, in the order of its first tile.
export const groupsInAtari = (tiles: GraphTile[], stones: Stone[]): AtariGroup[] => {
  const seen = new Set<number>();
  const found: AtariGroup[] = [];
  stones.forEach((s, i) => {
    if (s === 0 || seen.has(i)) return;
    const { members, liberties } = groupAt(tiles, stones, i);
    members.forEach(m => seen.add(m));
    if (liberties.size === 1) found.push({ player: s, members, liberty: [...liberties][0] });
  });
  return found;
};

export const positionKey = (stones: Stone[]) => stones.join('');

// Plays `player` on tile `id`. Opponent groups left without liberties are
// removed; a move that leaves its own group without liberties (suicide) or
// repeats an earlier position (superko) is illegal.
export const playMove = (tiles: GraphTile[], stones: Stone[], history: Set<string>, id: number, player: Player): MoveResult => {
  if (stones[id] !== 0) return { ok: false, reason: 'That tile is taken.' };

  const next = stones.slice();
  next[id] = player;
  const opp = opponentOf(player);
  let captured = 0;
  for (const n of tiles[id].neighbors) {
    if (next[n] !== opp) continue;
    const g = groupAt(tiles, next, n);
    if (g.liberties.size === 0) {
      for (const m of g.members) next[m] = 0;
      captured += g.members.length;
    }
  }

  if (groupAt(tiles, next, id).liberties.size === 0) {
    return { ok: false, reason: 'Illegal: that tile would have no liberties (suicide).' };
  }
  if (history.has(positionKey(next))) {
    return { ok: false, reason: 'Illegal: that would repeat an earlier position (ko).' };
  }
  return { ok: true, stones: next, captured };
};

// The connected empty region containing empty tile `start`, and the
// players whose stones border it. Marks the region's tiles in `seen`.
const emptyRegion = (tiles: GraphTile[], stones: Stone[], start: number, seen: Set<number>) => {
  const region = [start];
  seen.add(start);
  const borders = new Set<Player>();
  for (let k = 0; k < region.length; k++) {
    for (const n of tiles[region[k]].neighbors) {
      const s = stones[n];
      if (s !== 0) borders.add(s);
      else if (!seen.has(n)) { seen.add(n); region.push(n); }
    }
  }
  return { region, borders };
};

// Area scoring: each player's stones plus the empty regions bordered only
// by that player's stones. Also returns the owner of every empty tile.
export const scoreArea = (tiles: GraphTile[], stones: Stone[]) => {
  const owner: Stone[] = Array.from({ length: tiles.length }, () => 0);
  const score: Score = { 1: 0, 2: 0 };
  stones.forEach(s => { if (s) score[s] += 1; });

  const seen = new Set<number>();
  for (let i = 0; i < tiles.length; i++) {
    if (stones[i] !== 0 || seen.has(i)) continue;
    const { region, borders } = emptyRegion(tiles, stones, i, seen);
    if (borders.size === 1) {
      const p = [...borders][0];
      score[p] += region.length;
      for (const r of region) owner[r] = p;
    }
  }
  return { score, owner };
};
