// Animations for the Kites & Darts skin, drawn on the overlay canvas:
//
//   wind gusts   every few seconds a gust crosses the board; silk kites it
//                passes ripple with moving bands of light and shade
//   ribbon       the last move's ribbon flutters (this takes over drawing
//                the last-move marker from the board canvas)
//   dart glints  now and then a metal dart catches the sun: a bright streak
//                runs along its blade
//
// The loop runs while the last move is shown (capped at PERSISTENT_FPS when
// nothing else moves) or while a gust or glint is in progress.
import type { SkinEffects, Point, Player, Owner } from '../types';
import { tracePolygon, centroidOf } from '../canvas-utils';
import { isKite, drawLastMoveMarker } from './pieces';

const PERSISTENT_FPS = 30;
const GUST_EVERY_MS: [number, number] = [4000, 7000];
const GUST_SPEED = 420; // px/s across the board
const GUST_WIDTH = 90; // px, how wide the rippling front is
const RIPPLE_WAVELENGTH = 14; // px between ripple bands
const GLINT_EVERY_MS: [number, number] = [1500, 3000];
const GLINT_MS = 700;

// The wind blows from the left, slightly downward
const WIND = { x: 0.94, y: 0.34 };

const rand = (a: number, b: number) => a + Math.random() * (b - a);

type Piece = { verts: Point[]; c: Point; r: number; player: Player };

export class KitesAndDartsEffects implements SkinEffects {
  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  raf = 0;
  lastFrame = 0;
  timers: number[] = [];
  kites: Piece[] = [];
  darts: Piece[] = [];
  lastMove: Point[] | null = null;
  gust: { start: number } | null = null;
  glints: { piece: Piece; start: number }[] = [];

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.schedule('gust', GUST_EVERY_MS);
    this.schedule('glint', GLINT_EVERY_MS);
    this.kick();
  }

  detach() {
    cancelAnimationFrame(this.raf);
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
    this.raf = 0;
    this.gust = null;
    this.glints = [];
    this.lastMove = null;
    if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas = null;
    this.ctx = null;
  }

  setBoard(tiles: { verts: Point[] }[] | null, stones: Owner[]) {
    this.kites = [];
    this.darts = [];
    if (!tiles) return;
    tiles.forEach((t, i) => {
      if (!stones[i]) return;
      const c = centroidOf(t.verts);
      const r = Math.max(...t.verts.map(p => Math.hypot(p.x - c.x, p.y - c.y)));
      const piece = { verts: t.verts, c, r, player: stones[i] as Player };
      (isKite(t.verts) ? this.kites : this.darts).push(piece);
    });
  }

  setLastMove(verts: Point[] | null) {
    this.lastMove = verts;
    this.kick();
  }

  // Repeats a gust or glint at random intervals while attached
  schedule(kind: 'gust' | 'glint', [min, max]: [number, number]) {
    const t = window.setTimeout(() => {
      if (!this.ctx) return;
      const now = performance.now();
      if (kind === 'gust' && this.kites.length) this.gust = { start: now };
      if (kind === 'glint' && this.darts.length) {
        this.glints.push({ piece: this.darts[Math.floor(Math.random() * this.darts.length)], start: now });
      }
      this.kick();
      this.schedule(kind, [min, max]);
    }, rand(min, max));
    this.timers.push(t);
  }

  busy() {
    return !!(this.gust || this.glints.length);
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

    if (this.gust && !this.drawGust(now - this.gust.start)) this.gust = null;
    this.glints = this.glints.filter(g => this.drawGlint(g.piece, (now - g.start) / GLINT_MS));
    if (this.lastMove) drawLastMoveMarker(ctx, this.lastMove, now / 1000);

    if (this.lastMove || this.busy()) this.raf = requestAnimationFrame(this.frame);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // A rippling front moving along WIND. Returns false once it has left.
  drawGust(t: number) {
    const { ctx, canvas } = this;
    // Position of the front along the wind axis, starting off the board
    const span = canvas.width * Math.abs(WIND.x) + canvas.height * Math.abs(WIND.y);
    const front = -GUST_WIDTH + (t / 1000) * GUST_SPEED;
    if (front > span + GUST_WIDTH) return false;

    for (const k of this.kites) {
      const along = k.c.x * WIND.x + k.c.y * WIND.y;
      const dist = along - front;
      const strength = Math.exp(-(dist * dist) / (2 * (GUST_WIDTH / 2) ** 2));
      if (strength < 0.03) continue;

      // Bands of light and shade across the kite, sliding with the wind
      ctx.save();
      tracePolygon(ctx, k.verts);
      ctx.clip();
      const x0 = k.c.x - WIND.x * k.r, y0 = k.c.y - WIND.y * k.r;
      const x1 = k.c.x + WIND.x * k.r, y1 = k.c.y + WIND.y * k.r;
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      const phase = ((t / 1000) * 3) % 1;
      const bands = (2 * k.r) / RIPPLE_WAVELENGTH;
      for (let i = 0; i <= 12; i++) {
        const s = i / 12;
        const wave = Math.sin((s * bands - phase) * Math.PI * 2);
        g.addColorStop(s, wave > 0
          ? `rgba(255, 255, 255, ${0.3 * strength * wave})`
          : `rgba(0, 0, 0, ${-0.18 * strength * wave})`);
      }
      ctx.fillStyle = g;
      ctx.fillRect(k.c.x - k.r, k.c.y - k.r, 2 * k.r, 2 * k.r);
      ctx.restore();
    }
    return true;
  }

  // A bright streak running along the dart's blade, from notch to point.
  // `k` runs 0..1; returns false when done.
  drawGlint(piece: Piece, k: number) {
    if (k >= 1) return false;
    const { ctx } = this;
    const [point, , notch] = piece.verts;
    const along = { x: point.x - notch.x, y: point.y - notch.y };
    const p = -0.3 + 1.6 * k;
    const cx = notch.x + along.x * p, cy = notch.y + along.y * p;
    const len = Math.hypot(along.x, along.y);
    const ux = along.x / len, uy = along.y / len;
    const g = ctx.createLinearGradient(cx - ux * 10, cy - uy * 10, cx + ux * 10, cy + uy * 10);
    g.addColorStop(0, 'rgba(255, 255, 255, 0)');
    g.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.save();
    tracePolygon(ctx, piece.verts);
    ctx.clip();
    ctx.fillStyle = g;
    ctx.fillRect(piece.c.x - piece.r, piece.c.y - piece.r, 2 * piece.r, 2 * piece.r);
    ctx.restore();
    // A small flare as the streak passes the middle
    if (k > 0.35 && k < 0.7) {
      const f = Math.sin(((k - 0.35) / 0.35) * Math.PI);
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * f})`;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(piece.c.x, piece.c.y, 2.2 * f, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    return true;
  }
}
