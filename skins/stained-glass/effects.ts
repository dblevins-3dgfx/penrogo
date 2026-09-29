// Animations for the Stained Glass skin, drawn on the overlay canvas:
//
//   sunbeam     every several seconds a broad band of light sweeps
//               diagonally across the window, brightening each pane it
//               passes with a lighter version of its own color (the lead
//               lines stay dark)
//   last move   lit from within, its glow slowly pulsing (this takes over
//               drawing the last move from the board canvas)
//   shatter     captured panes crack from an impact point, then break into
//               shards that drop out of the frame, tumbling and glinting
//
// The loop runs while the last move is shown (capped at PERSISTENT_FPS when
// nothing else moves) or while a sunbeam or falling glass is in progress.
import type { SkinEffects, Point, Player, Owner } from '../types';
import { centroidOf, tracePolygon, drawSparkle, mix, rgb } from '../canvas-utils';
import { GLASS, LIT, drawInnerGlow, paneRadius } from './glass';

const PERSISTENT_FPS = 30;
const BEAM_EVERY_MS: [number, number] = [6000, 10000];
const BEAM_MS = 3200; // time to cross the window
const BEAM_WIDTH = 150; // px
const PULSE_MS = 2400;
// Beam light stays inside panes (shrunk toward their centers), off the lead
const GLASS_INSET = 0.86;

const CRACK_MS = 160; // cracks flash before the glass falls
const FALL_MS = 1300;
const GRAVITY = 900; // px/s²: glass drops fast

// The beam travels from the upper left toward the lower right
const DIR = { x: 0.8, y: 0.6 };

const rand = (a: number, b: number) => a + Math.random() * (b - a);

type Pane = { verts: Point[]; inset: Point[]; c: Point; r: number; stone: Owner };
type Shard = { pts: Point[]; x: number; y: number; vx: number; vy: number; spin: number; color: string; glint: number };
type Break = { start: number; impact: Point; rim: Point[]; shards: Shard[] };

export class StainedGlassEffects implements SkinEffects {
  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  raf = 0;
  lastFrame = 0;
  timer = 0;
  panes: Pane[] = [];
  lastMove: Point[] | null = null;
  beamStart: number | null = null;
  breaks: Break[] = [];

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scheduleBeam();
    this.kick();
  }

  detach() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
    this.raf = 0;
    this.beamStart = null;
    this.breaks = [];
    this.lastMove = null;
    if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas = null;
    this.ctx = null;
  }

  setBoard(tiles: { verts: Point[] }[] | null, stones: Owner[]) {
    this.panes = tiles
      ? tiles.map((t, i) => {
          const c = centroidOf(t.verts);
          const inset = t.verts.map(p => ({ x: c.x + (p.x - c.x) * GLASS_INSET, y: c.y + (p.y - c.y) * GLASS_INSET }));
          return { verts: t.verts, inset, c, r: paneRadius(t.verts, c), stone: stones[i] };
        })
      : [];
  }

  setLastMove(verts: Point[] | null) {
    this.lastMove = verts;
    this.kick();
  }

  // Captured panes crack, then break into shards that fall out of the frame
  capture(vertsList: Point[][], player: Player) {
    if (!this.ctx) return;
    const now = performance.now();
    const glass = GLASS[player];
    for (const verts of vertsList) {
      const c = centroidOf(verts);
      const r = paneRadius(verts, c);
      const impact = { x: c.x + rand(-0.2, 0.2) * r, y: c.y + rand(-0.2, 0.2) * r };
      // Crack ends around the rim: the corners plus random points on edges
      const rim: Point[] = [];
      verts.forEach((a, i) => {
        const b = verts[(i + 1) % verts.length];
        rim.push(a);
        const cuts = Math.random() < 0.5 ? 1 : 2;
        const ts = Array.from({ length: cuts }, () => rand(0.2, 0.8)).sort((x, y) => x - y);
        for (const t of ts) rim.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      });
      // One wedge shard between each pair of neighboring crack ends
      const shards = rim.map((a, i) => {
        const b = rim[(i + 1) % rim.length];
        const tri = [impact, a, b];
        const sc = centroidOf(tri);
        const dx = sc.x - impact.x, dy = sc.y - impact.y;
        const len = Math.hypot(dx, dy) || 1;
        const push = rand(15, 55);
        return {
          pts: tri.map(p => ({ x: p.x - sc.x, y: p.y - sc.y })),
          x: sc.x, y: sc.y,
          vx: (dx / len) * push + rand(-10, 10),
          vy: (dy / len) * push - rand(20, 70),
          spin: rand(-4, 4),
          color: rgb(mix(glass.base, rand(0, 1) < 0.5 ? glass.light : glass.deep, rand(0.1, 0.45))),
          glint: rand(0.25, 0.85)
        };
      });
      this.breaks.push({ start: now, impact, rim, shards });
    }
    this.kick();
  }

  scheduleBeam() {
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      if (!this.ctx) return;
      if (this.panes.length) this.beamStart = performance.now();
      this.kick();
      this.scheduleBeam();
    }, rand(...BEAM_EVERY_MS));
  }

  busy() {
    return this.beamStart !== null || this.breaks.length > 0;
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

    if (this.beamStart !== null && !this.drawBeam((now - this.beamStart) / BEAM_MS)) this.beamStart = null;
    if (this.lastMove) {
      const p = (Math.sin((now / PULSE_MS) * Math.PI * 2) + 1) / 2;
      const pane = this.panes.find(pn => pn.verts === this.lastMove);
      drawInnerGlow(ctx, this.lastMove, LIT[pane ? pane.stone : 0], 0.55 + 0.45 * p);
    }
    this.breaks = this.breaks.filter(b => this.drawBreak(b, now - b.start));

    if (this.lastMove || this.busy()) this.raf = requestAnimationFrame(this.frame);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // `k` runs 0..1 as the beam crosses; returns false when it has passed.
  // Each pane in the band is lit with its own lighter color.
  drawBeam(k: number) {
    if (k >= 1) return false;
    const { ctx, canvas } = this;
    const span = canvas.width * DIR.x + canvas.height * DIR.y;
    const pos = -BEAM_WIDTH + k * (span + 2 * BEAM_WIDTH);
    const fade = Math.sin(k * Math.PI); // swell in, fade out
    const x0 = DIR.x * (pos - BEAM_WIDTH), y0 = DIR.y * (pos - BEAM_WIDTH);
    const x1 = DIR.x * (pos + BEAM_WIDTH), y1 = DIR.y * (pos + BEAM_WIDTH);

    for (const pane of this.panes) {
      const along = pane.c.x * DIR.x + pane.c.y * DIR.y;
      if (Math.abs(along - pos) > BEAM_WIDTH + pane.r) continue;
      const lit = LIT[pane.stone];
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, rgb(lit, 0));
      g.addColorStop(0.5, rgb(lit, (pane.stone ? 0.6 : 0.5) * fade));
      g.addColorStop(1, rgb(lit, 0));
      ctx.save();
      tracePolygon(ctx, pane.inset);
      ctx.clip();
      ctx.fillStyle = g;
      ctx.fillRect(pane.c.x - pane.r, pane.c.y - pane.r, 2 * pane.r, 2 * pane.r);
      ctx.restore();
    }
    return true;
  }

  // Cracks flash, then the shards fall. Returns false once they are gone.
  drawBreak(b: Break, t: number) {
    const { ctx } = this;
    if (t >= CRACK_MS + FALL_MS) return false;

    const fallT = Math.max(0, t - CRACK_MS) / 1000;
    const fade = Math.min(1, Math.max(0, 1 - (t - CRACK_MS - FALL_MS * 0.55) / (FALL_MS * 0.45)));
    ctx.save();
    ctx.globalAlpha = fade;
    for (const sh of b.shards) {
      const x = sh.x + sh.vx * fallT;
      const y = sh.y + sh.vy * fallT + 0.5 * GRAVITY * fallT * fallT;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(sh.spin * fallT);
      ctx.beginPath();
      sh.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = sh.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
      // A glint as the shard turns through the light
      const k = fallT / (FALL_MS / 1000);
      if (Math.abs(k - sh.glint) < 0.08) {
        drawSparkle(ctx, x, y, 5 * (1 - Math.abs(k - sh.glint) / 0.08), 'rgba(255, 255, 255, 0.95)');
      }
    }
    ctx.restore();

    // Crack lines flash at the moment of impact
    if (t < CRACK_MS * 1.6) {
      const k = t / (CRACK_MS * 1.6);
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${1 - k})`;
      ctx.lineWidth = 1.2;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      for (const p of b.rim) {
        ctx.moveTo(b.impact.x, b.impact.y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.restore();
    }
    return true;
  }
}
