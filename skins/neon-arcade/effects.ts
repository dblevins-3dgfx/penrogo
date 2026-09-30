// Animations for the Neon Arcade skin, drawn on the overlay canvas:
//
//   flicker on   a new stone's tube stutters on like a neon sign warming up
//                (while "off", the overlay covers it with the empty look)
//   blink out    captured tubes flash, stutter, then fade dark
//   last move    its tube's glow breathes (this takes over drawing the
//                last move from the board canvas)
//   roll bar     now and then a faint CRT roll bar drifts down the screen
//
// The loop runs while the last move is shown (capped at PERSISTENT_FPS when
// nothing else moves) or while any other effect is in progress.
import type { SkinEffects, Point, Player, Owner } from '../types';
import { centroidOf } from '../canvas-utils';
import { NEON, drawTube, drawSpark, coverWithEmpty } from './neon';

const PERSISTENT_FPS = 30;
const PULSE_MS = 1800;
const ROLL_EVERY_MS: [number, number] = [7000, 11000];
const ROLL_MS = 1800;
const ROLL_HEIGHT = 70;

// Flicker-on: [until ms, tube intensity] steps; 0 = off
const FLICKER_ON: [number, number][] = [[60, 0], [110, 0.6], [170, 0], [215, 0.9], [255, 0], [330, 1.3]];
// Blink-out: steps, then a fade from the last intensity to dark
const BLINK_OUT: [number, number][] = [[90, 1.4], [150, 0], [210, 0.7], [260, 0]];
const FADE_MS = 380;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

type Flicker = { verts: Point[]; player: Player; start: number; kind: 'on' | 'out' };

const stepAt = (steps: [number, number][], t: number) => {
  for (const [until, v] of steps) if (t < until) return v;
  return null; // past the last step
};

export class NeonArcadeEffects implements SkinEffects {
  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  raf = 0;
  lastFrame = 0;
  timer = 0;
  lastMove: Point[] | null = null;
  lastMovePlayer: Player = 1;
  stoneOf = new Map<Point[], Owner>();
  flickers: Flicker[] = [];
  rollStart: number | null = null;

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scheduleRoll();
    this.kick();
  }

  detach() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
    this.raf = 0;
    this.flickers = [];
    this.rollStart = null;
    this.lastMove = null;
    if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas = null;
    this.ctx = null;
  }

  setBoard(tiles: { verts: Point[] }[] | null, stones: Owner[]) {
    this.stoneOf = new Map(tiles ? tiles.map((t, i) => [t.verts, stones[i]]) : []);
  }

  setLastMove(verts: Point[] | null) {
    this.lastMove = verts;
    this.kick();
  }

  place(verts: Point[], player: Player) {
    if (!this.ctx) return;
    this.flickers.push({ verts, player, start: performance.now(), kind: 'on' });
    this.kick();
  }

  capture(vertsList: Point[][], player: Player) {
    if (!this.ctx) return;
    const now = performance.now();
    // Slightly staggered, so a big capture ripples out rather than blinking in unison
    vertsList.forEach(verts => this.flickers.push({ verts, player, start: now + rand(0, 90), kind: 'out' }));
    this.kick();
  }

  scheduleRoll() {
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      if (!this.ctx) return;
      this.rollStart = performance.now();
      this.kick();
      this.scheduleRoll();
    }, rand(...ROLL_EVERY_MS));
  }

  busy() {
    return this.flickers.length > 0 || this.rollStart !== null;
  }

  kick() {
    if (!this.raf && this.ctx && (this.lastMove || this.busy())) {
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  frame = (now: number) => {
    const { ctx, canvas } = this;
    this.raf = 0;
    if (!ctx) return;

    if (!this.busy() && now - this.lastFrame < 1000 / PERSISTENT_FPS) {
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    this.lastFrame = now;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // The last move breathes, unless it is still flickering on
    const flickering = new Set(this.flickers.filter(f => f.kind === 'on').map(f => f.verts));
    if (this.lastMove && !flickering.has(this.lastMove)) {
      const owner = this.stoneOf.get(this.lastMove) || 1;
      const p = (Math.sin((now / PULSE_MS) * Math.PI * 2) + 1) / 2;
      drawTube(ctx, this.lastMove, NEON[owner], 0.9 + 0.6 * p);
      drawSpark(ctx, centroidOf(this.lastMove), 3 + 2.5 * p, NEON[owner]);
    }

    this.flickers = this.flickers.filter(f => this.drawFlicker(f, now - f.start));

    if (this.rollStart !== null) {
      const k = (now - this.rollStart) / ROLL_MS;
      if (k >= 1) this.rollStart = null;
      else this.drawRoll(k);
    }

    if (this.lastMove || this.busy()) this.raf = requestAnimationFrame(this.frame);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  drawFlicker(f: Flicker, t: number) {
    if (t < 0) return true; // staggered start
    const { ctx, canvas } = this;
    const color = NEON[f.player];
    if (f.kind === 'on') {
      const v = stepAt(FLICKER_ON, t);
      if (v === null) return false;
      // The board already shows the tube lit: cover it while "off"
      coverWithEmpty(ctx, f.verts, canvas.width, canvas.height);
      drawTube(ctx, f.verts, color, v);
      return true;
    }
    // Blink out: the board already shows the tile empty
    const v = stepAt(BLINK_OUT, t);
    if (v !== null) {
      drawTube(ctx, f.verts, color, v);
      return true;
    }
    const k = (t - BLINK_OUT[BLINK_OUT.length - 1][0]) / FADE_MS;
    if (k >= 1) return false;
    drawTube(ctx, f.verts, color, 0.5 * (1 - k));
    return true;
  }

  // A faint bright band drifting down the screen
  drawRoll(k: number) {
    const { ctx, canvas } = this;
    const y = -ROLL_HEIGHT + k * (canvas.height + 2 * ROLL_HEIGHT);
    const g = ctx.createLinearGradient(0, y - ROLL_HEIGHT / 2, 0, y + ROLL_HEIGHT / 2);
    g.addColorStop(0, 'rgba(255, 255, 255, 0)');
    g.addColorStop(0.5, 'rgba(200, 230, 255, 0.07)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - ROLL_HEIGHT / 2, canvas.width, ROLL_HEIGHT);
  }
}
