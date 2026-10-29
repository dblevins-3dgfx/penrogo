// A small picture of a skin, for choosing one: a corner of a board with a
// few stones of each player and the last move marked, drawn with the
// skin's own canvas hooks (its animations aren't run).
import { useEffect, useRef } from 'react';
import { buildBoard } from '../penrose-board';
import { BOARD_H, BOARD_W, COMPUTER_OPENING, TILE_SIZE, candidateVertices } from '../opening';
import type { Skin } from '../skins';
import type { Player, Stone, Tile } from '../types';

// The part of the board shown, in board coordinates (4:3, around the centre)
const VIEW = { x: 250, y: 187.5, w: 300, h: 225 };
// The canvas's drawing size; it is scaled to the card's width
const WIDTH = 320;
const HEIGHT = 240;

type Scene = { tiles: Tile[]; stones: Stone[]; last: number };

// One scene shared by every preview, built the first time it is needed:
// the board around the computer's opening, Player 1 holding the opening
// tile and two more, Player 2 three tiles around it, the last move Player 2's.
let scene: Scene | null = null;
const getScene = (): Scene => {
  if (scene) return scene;
  const { tiles, opening } = buildBoard('kite', candidateVertices(COMPUTER_OPENING), BOARD_W, BOARD_H, TILE_SIZE);
  const stones: Stone[] = tiles.map(() => 0);
  const ring = tiles[opening].neighbors;
  const place = (id: number | undefined, p: Player) => { if (id !== undefined) stones[id] = p; };
  const beyond = (id: number) => tiles[id].neighbors.find(n => n !== opening && !ring.includes(n));
  place(opening, 1);
  place(ring[0], 2);
  place(ring[2], 2);
  place(beyond(ring[1]), 1);
  place(beyond(ring[3] ?? ring[1]), 1);
  const last = beyond(ring[2]) ?? ring[2];
  place(last, 2);
  scene = { tiles, stones, last };
  return scene;
};

const inView = (t: Tile) =>
  t.verts.some(v => v.x > VIEW.x - TILE_SIZE && v.x < VIEW.x + VIEW.w + TILE_SIZE && v.y > VIEW.y - TILE_SIZE && v.y < VIEW.y + VIEW.h + TILE_SIZE);

const SkinPreview = ({ skin }: { skin: Skin }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { tiles, stones, last } = getScene();
    const k = WIDTH / VIEW.w;
    ctx.setTransform(k, 0, 0, k, -VIEW.x * k, -VIEW.y * k);
    skin.drawBackground(ctx, BOARD_W, BOARD_H);
    tiles.forEach((t, i) => {
      if (inView(t)) skin.drawTile(ctx, t.verts, { stone: stones[i], territory: 0 });
    });
    const owner = stones[last];
    if (owner) skin.drawLastMove(ctx, tiles[last].verts, owner);
  }, [skin]);

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      aria-hidden="true"
      className="block w-full h-auto rounded"
    />
  );
};

export default SkinPreview;
