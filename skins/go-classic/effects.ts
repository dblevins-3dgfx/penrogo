// Animations for the Go Classic skin, drawn on the overlay canvas:
//
//   set down   a new stone is placed with a drop: it starts slightly large
//              with a long shadow and settles onto the board (the overlay
//              covers the board's finished stone meanwhile)
//   prisoners  captured stones are lifted off the board and slide away
//              toward the capturer's side (Player 1's score is on the left,
//              Player 2's on the right), fading as they go
//
// The loop runs only while one of these is in progress.
import type { SkinEffects, Point, Player } from '../types';
import { drawStone, coverWithEmpty } from './stones';

const DROP_MS = 190;
const LIFT_MS = 180;
const SLIDE_MS = 520;
const SLIDE_DISTANCE = 260;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

type Job =
  | { kind: 'drop'; verts: Point[]; player: Player; start: number }
  | { kind: 'take'; verts: Point[]; player: Player; capturer: Player; start: number };

export class GoClassicEffects implements SkinEffects {
  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  raf = 0;
  jobs: Job[] = [];

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  detach() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.jobs = [];
    if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas = null;
    this.ctx = null;
  }

  place(verts: Point[], player: Player) {
    this.add({ kind: 'drop', verts, player, start: performance.now() });
  }

  capture(vertsList: Point[][], player: Player, capturer: Player) {
    const now = performance.now();
    // Picked up one after another, like a hand gathering prisoners
    vertsList.forEach((verts, i) => this.add({ kind: 'take', verts, player, capturer, start: now + i * 70 + rand(0, 30) }));
  }

  add(job: Job) {
    if (!this.ctx) return;
    this.jobs.push(job);
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  frame = (now: number) => {
    const { ctx, canvas } = this;
    this.raf = 0;
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.jobs = this.jobs.filter(j => (j.kind === 'drop' ? this.drawDrop(j, now - j.start) : this.drawTake(j, now - j.start)));
    if (this.jobs.length) this.raf = requestAnimationFrame(this.frame);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  drawDrop(j: Job, t: number) {
    if (t >= DROP_MS) return false;
    const { ctx, canvas } = this;
    const k = t / DROP_MS;
    const ease = 1 - (1 - k) * (1 - k); // fast, then settling
    coverWithEmpty(ctx, j.verts, canvas.width, canvas.height);
    drawStone(ctx, j.verts, j.player, { scale: 1.22 - 0.22 * ease, lift: 7 * (1 - ease), alpha: 0.5 + 0.5 * ease });
    return true;
  }

  // The board already shows the point empty: draw the stone being taken
  drawTake(j: Job & { kind: 'take' }, t: number) {
    if (t < 0) return true;
    if (t >= LIFT_MS + SLIDE_MS) return false;
    const { ctx } = this;
    const lift = Math.min(1, t / LIFT_MS);
    const s = Math.max(0, (t - LIFT_MS) / SLIDE_MS);
    const dx = (j.capturer === 1 ? -1 : 1) * SLIDE_DISTANCE * s * s;
    ctx.save();
    ctx.translate(dx, -6 * lift);
    drawStone(ctx, j.verts, j.player, { scale: 1 + 0.12 * lift, lift: 3 + 7 * lift, alpha: 1 - s });
    ctx.restore();
    return true;
  }
}
