// The contract every skin implements. A skin decides how the page chrome
// looks and how the board is drawn; it never affects the game.
//
// To add a skin, create a folder skins/<name>/ with an index.ts whose
// default export is a Skin. It is picked up automatically (see index.ts);
// no other file needs to change.

export type Point = { x: number; y: number };

// 0 = none, 1 = Player 1, 2 = Player 2 (or the computer)
export type Owner = 0 | 1 | 2;
export type Player = 1 | 2;

export interface TileState {
  stone: Owner; // who holds the tile
  territory: Owner; // at game end, who owns this empty tile
}

// Tailwind classes for the page around the board. Tailwind finds classes by
// scanning source files, so write them out in full (no string building).
export interface SkinChrome {
  page: string; // the whole page background
  panel: string; // score bar, controls and How to Play panels
  title: string; // the "Penrogo" heading
  canvas: string; // the board canvas element
}

// How a player is shown in the page text (scoreboard, turn indicator, How
// to Play). Skins that don't set `players` get blue and red.
export interface PlayerStyle {
  text: string; // Tailwind text color class(es), e.g. 'text-blue-400'
  name: string; // color word for the rules text, e.g. 'blue'
}

// Optional animations, drawn on a transparent overlay canvas (800x600, same
// coordinates as the board) above the board canvas. The game creates one
// instance per skin selection and calls these as play happens; every event
// method is optional, so a skin implements only what it animates.
export interface SkinEffects {
  // Start drawing on the overlay / stop and clear everything
  attach(canvas: HTMLCanvasElement): void;
  detach(): void;

  // The current board: tiles (with verts) and who holds each one
  setBoard?(tiles: { verts: Point[] }[] | null, stones: Owner[]): void;
  // A stone was placed
  place?(verts: Point[], player: Player): void;
  // Stones of `player` were captured by `capturer`
  capture?(vertsList: Point[][], player: Player, capturer: Player): void;
  // The opening created a new board around `originVerts`
  cascade?(tiles: { verts: Point[] }[], originVerts: Point[]): void;

  // Taking over static drawing: if an effects object implements one of
  // these, the board canvas skips the skin's drawLastMove / legal
  // drawTarget and the overlay draws (and can animate) it instead.
  setLastMove?(verts: Point[] | null): void;
  setTarget?(target: { verts: Point[]; player: Player } | null): void;
}

export interface Skin {
  id: string; // stored in localStorage; keep it stable once released
  name: string; // shown in the skin picker
  order?: number; // position in the picker (lower first; default 100)
  chrome: SkinChrome;
  // Player colors in the page text; default blue (1) and red (2)
  players?: { 1: PlayerStyle; 2: PlayerStyle };

  // Canvas hooks, all in 800x600 board coordinates
  drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void;
  drawTile(ctx: CanvasRenderingContext2D, verts: Point[], state: TileState): void;
  // `player` is who holds the last move's tile
  drawLastMove(ctx: CanvasRenderingContext2D, verts: Point[], player: Player): void;
  // The tile under the pointer, or the opening tile preview
  drawTarget(ctx: CanvasRenderingContext2D, verts: Point[], player: Player, legal: boolean): void;

  // Optional animations. Skipped when the device asks for reduced motion.
  createEffects?(): SkinEffects;
}
