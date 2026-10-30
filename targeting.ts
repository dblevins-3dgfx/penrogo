// What the pointer or a finger is over, and what placing there does: the
// preview target, the action a click or Place makes, and on touch screens
// what counts as a tap and a double tap (a shortcut for Place).

import { isHumanTurn, type GameAction, type GameState } from './game';
import { playMove } from './rules';
import {
  boardSize, candidateVertices, isOutsidePlayfield, tileAtPoint, type Candidate
} from './board-geometry';
import type { Point, Tile, TileType } from './types';

// What a point on the board (in board units: see BOARD_SIZES) is over, for
// the preview and for placing: the opening tile (of the chosen type and
// rotation, centered on the point) and whether it fits, or the board tile
// under it and whether claiming it is legal. Null when it isn't a person's
// turn or the point is off every tile.
export type Target =
  | { kind: 'opening'; cand: Candidate; verts: Point[]; legal: boolean }
  | { kind: 'tile'; id: number; verts: Point[]; legal: boolean };

export const targetAt = (g: GameState, pos: Point | null, type: TileType, rotation: number): Target | null => {
  if (!pos || !isHumanTurn(g)) return null;
  if (!g.tiles) {
    const cand = { type, x: pos.x, y: pos.y, rotation };
    const verts = candidateVertices(cand);
    const { w, h } = boardSize(g.size);
    return { kind: 'opening', cand, verts, legal: !isOutsidePlayfield(verts, w, h) };
  }
  const id = tileAtPoint(g.tiles, pos.x, pos.y);
  if (id < 0) return null;
  const r = playMove(g.tiles, g.stones, g.history, id, g.currentPlayer);
  return { kind: 'tile', id, verts: g.tiles[id].verts, legal: r.ok };
};

// The action placing on a target: the opening, or claiming the tile. Null
// for an illegal opening (it is not placed). An illegal tile is still
// claimed, so the status line says why not.
export const placeAction = (t: Target | null): GameAction | null => {
  if (!t) return null;
  if (t.kind === 'opening') return t.legal ? { type: 'open', cand: t.cand } : null;
  return { type: 'claim', id: t.id };
};

// A finger lifted where it went down (within TAP_SLOP_PX CSS pixels) is a
// tap; further is a drag, which only moves the preview.
export const TAP_SLOP_PX = 10;
export const isTap = (down: Point, up: Point): boolean =>
  Math.hypot(up.x - down.x, up.y - down.y) <= TAP_SLOP_PX;

// A tap: when (ms) and where (board units).
export type Tap = { time: number; pos: Point };

// Two taps make a double tap when the second comes within DOUBLE_TAP_MS of
// the first and lands on the same board tile, or before the board exists
// (placing the opening tile) within DOUBLE_TAP_DIST board units of it.
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_DIST = 20;
export const isDoubleTap = (first: Tap | null, second: Tap, tiles: Tile[] | null): boolean => {
  if (!first || second.time - first.time > DOUBLE_TAP_MS) return false;
  if (!tiles) return Math.hypot(second.pos.x - first.pos.x, second.pos.y - first.pos.y) <= DOUBLE_TAP_DIST;
  const id = tileAtPoint(tiles, first.pos.x, first.pos.y);
  return id >= 0 && tileAtPoint(tiles, second.pos.x, second.pos.y) === id;
};

// What the Place button or a double tap places: the target, only if placing
// it is legal (an illegal tile is left alone, unlike a mouse click, which
// claims it so the status line says why not).
export const confirmAction = (t: Target | null): GameAction | null => (t?.legal ? placeAction(t) : null);
