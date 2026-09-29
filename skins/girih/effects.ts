// Animations for the Girih skin, drawn on the overlay canvas:
//
//   light wave   when a stone is placed, golden light flows outward along
//                the strapwork from that tile into its surroundings, showing
//                how the lines join up across tiles
//
// The loop runs only while a wave is spreading.
import type { SkinEffects, Point, Player, Owner } from '../types';
import { centroidOf } from '../canvas-utils';
import { drawStrapGlow } from './tiles';

const WAVE_MS = 1100;
const WAVE_RADIUS = 240; // px the light travels
const WAVE_BAND = 55; // px width of the glowing front

type Wave = { start: number; origin: Point };

export class GirihEffects implements SkinEffects {
  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  raf = 0;
  tiles: { verts: Point[]; c: Point }[] = [];
  waves: Wave[] = [];

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  detach() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.waves = [];
    if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas = null;
    this.ctx = null;
  }

  setBoard(tiles: { verts: Point[] }[] | null, _stones: Owner[]) {
    this.tiles = tiles ? tiles.map(t => ({ verts: t.verts, c: centroidOf(t.verts) })) : [];
  }

  place(verts: Point[], _player: Player) {
    if (!this.ctx) return;
    this.waves.push({ start: performance.now(), origin: centroidOf(verts) });
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  frame = (now: number) => {
    const { ctx, canvas } = this;
    this.raf = 0;
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.waves = this.waves.filter(w => {
      const k = (now - w.start) / WAVE_MS;
      if (k >= 1) return false;
      const front = k * WAVE_RADIUS;
      const fade = 1 - k * k;
      for (const t of this.tiles) {
        const d = Math.hypot(t.c.x - w.origin.x, t.c.y - w.origin.y);
        const behind = front - d; // how far the front has passed this tile
        if (behind < 0 || behind > WAVE_BAND) continue;
        drawStrapGlow(ctx, t.verts, fade * (1 - behind / WAVE_BAND));
      }
      return true;
    });

    if (this.waves.length) this.raf = requestAnimationFrame(this.frame);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
}
