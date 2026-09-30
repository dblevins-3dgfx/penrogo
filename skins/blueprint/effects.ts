// Animations for the Blueprint skin, drawn on the overlay canvas:
//
//   draw-in   a new stone is drafted in pencil: its outline is traced edge
//             by edge, then its hatching sweeps across (while unfinished,
//             the overlay covers the board's finished drawing)
//   erase     captured stones are rubbed out: the hatching disappears line
//             by line, the outline fades, and eraser crumbs fall away
//
// The loop runs only while one of these is in progress.
import type { SkinEffects, Point, Player } from '../types';
import { centroidOf } from '../canvas-utils';
import { drawHatch, drawOutline, coverWithEmpty } from './drafting';

const TRACE_MS = 320;
const HATCH_MS = 260;
const ERASE_MS = 520;
const GRAVITY = 260;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

type Crumb = { x: number; y: number; vx: number; vy: number; size: number };
type Job = { kind: 'draw' | 'erase'; verts: Point[]; player: Player; start: number; crumbs?: Crumb[] };

export class BlueprintEffects implements SkinEffects {
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
    this.add({ kind: 'draw', verts, player, start: performance.now() });
  }

  capture(vertsList: Point[][], player: Player) {
    const now = performance.now();
    for (const verts of vertsList) {
      const c = centroidOf(verts);
      const crumbs = Array.from({ length: 7 }, () => ({
        x: c.x + rand(-10, 10), y: c.y + rand(-8, 8),
        vx: rand(-40, 40), vy: rand(-60, -10), size: rand(1, 2.2)
      }));
      this.add({ kind: 'erase', verts, player, start: now + rand(0, 80), crumbs });
    }
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
    this.jobs = this.jobs.filter(j => (j.kind === 'draw' ? this.drawIn(j, now - j.start) : this.erase(j, now - j.start)));
    if (this.jobs.length) this.raf = requestAnimationFrame(this.frame);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Outline traced, then hatching swept in. Returns false when finished.
  drawIn(j: Job, t: number) {
    if (t >= TRACE_MS + HATCH_MS) return false;
    const { ctx, canvas } = this;
    coverWithEmpty(ctx, j.verts, canvas.width, canvas.height);
    const trace = Math.min(1, t / TRACE_MS);
    const hatch = Math.max(0, (t - TRACE_MS) / HATCH_MS);
    drawHatch(ctx, j.verts, j.player, hatch);
    drawOutline(ctx, j.verts, j.player, trace);
    // The pencil tip, at the end of the line being traced
    if (trace < 1) {
      const n = j.verts.length;
      const lens = j.verts.map((p, i) => Math.hypot(j.verts[(i + 1) % n].x - p.x, j.verts[(i + 1) % n].y - p.y));
      let left = lens.reduce((a, b) => a + b, 0) * trace;
      let tip = j.verts[0];
      for (let i = 0; i < n; i++) {
        if (left <= lens[i]) {
          const a = j.verts[i], b = j.verts[(i + 1) % n], k = left / lens[i];
          tip = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
          break;
        }
        left -= lens[i];
      }
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    return true;
  }

  // The board already shows the tile empty: draw what's left being erased
  erase(j: Job, t: number) {
    if (t < 0) return true; // staggered start
    if (t >= ERASE_MS) return false;
    const { ctx } = this;
    const k = t / ERASE_MS;
    drawHatch(ctx, j.verts, j.player, 1 - k, true);
    ctx.save();
    ctx.globalAlpha = 1 - k;
    drawOutline(ctx, j.verts, j.player);
    ctx.restore();
    const sec = t / 1000;
    ctx.fillStyle = `rgba(254, 226, 226, ${0.8 * (1 - k)})`;
    for (const cr of j.crumbs) {
      ctx.fillRect(cr.x + cr.vx * sec, cr.y + cr.vy * sec + 0.5 * GRAVITY * sec * sec, cr.size, cr.size);
    }
    return true;
  }
}
