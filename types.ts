// Types shared by the board, the rules, the computer player, the game and
// the skins.

export type Point = { x: number; y: number };

// 1 = Player 1, 2 = Player 2 (or the computer)
export type Player = 1 | 2;
// What a tile holds: 0 = empty, or the player whose stone it is. Also used
// for who owns an empty region at the end.
export type Stone = 0 | Player;

// Each player's count of something (stones, area, captures)
export type Score = Record<Player, number>;

export type TileType = 'kite' | 'dart';

// A tile of the board: its shape, its corners in board coordinates, and the
// tiles sharing a full edge with it.
export type Tile = { id: number; type: TileType; verts: Point[]; neighbors: number[] };

// What the rules need of a tile: only its neighbors. The computer's worker
// gets just these.
export type GraphTile = { neighbors: number[] };
