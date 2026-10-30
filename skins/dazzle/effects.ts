// Animated effects for the Dazzle skin, drawn on a transparent overlay
// canvas above the board. The board canvas itself is never redrawn per
// frame: the overlay's animation loop runs only while an effect is in
// progress, and between effects an idle timer schedules the next glint.
//
//   place(verts, player)                  gem pop: flash and expanding glow
//   capture(vertsList, player, capturer)  captured gems shatter into shards
//                                         with sparkles and a floating "+N"
//   cascade(tiles, originVerts)           a new board appears in a wave
//                                         spreading from the opening tile
//   setBoard(tiles, stones)               stones that may glint when idle
//   setLastMove(verts)                    last move: breathing glow and
//                                         twinkling, circling sparkles
//   setTarget({ verts, player })          hover preview: a translucent gem
//                                         floating and bobbing over its
//                                         socket, with a recurring shimmer
//
// The last move and the preview are persistent: while either is shown the
// loop keeps running, capped at PERSISTENT_FPS when nothing else moves.

import type { Owner, Player, Point, SkinEffects } from '../types';
import { centroidOf, tracePolygon, BOARD_H, BOARD_W } from '../../board-geometry';
import { drawSparkle, mix, rgb } from '../canvas-utils';
import { GEMS, LIGHT, BG_SPARKLES, drawDazzleBackground, drawGem } from './gems';

const POP_MS = 320;
const SHATTER_MS = 850;
const SCORE_MS = 1100;
const CASCADE_SPEED = 900; // px per second from the opening tile
const CASCADE_FLASH_MS = 260;
const GLINT_MS = 650;
const TWINKLE_MS = 900;
const IDLE_MIN_MS = 1200;
const IDLE_MAX_MS = 2800;
const GRAVITY = 320; // px/s², pulls shards and sparkles down
const PULSE_MS = 1600; // last move breathing period
const BOB_MS = 1400; // preview float period
const SHIMMER_MS = 1800; // preview shimmer repeat
const PERSISTENT_FPS = 30;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

const pointInPolygon = (x: number, y: number, verts: Point[]) => {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const a = verts[i], b = verts[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

type Shard = { pts: Point[]; x: number; y: number; vx: number; vy: number; spin: number; color: string };
type Spark = { x: number; y: number; vx: number; vy: number; size: number };

// An animation in progress, started at `start` (performance.now() time)
type Effect = { start: number } & (
  | { kind: 'pop'; verts: Point[]; player: Player }
  | { kind: 'shatter'; shards: Shard[]; sparks: Spark[] }
  | { kind: 'score'; x: number; y: number; text: string; player: Player }
  | { kind: 'cascade'; items: { verts: Point[]; delay: number }[] }
  | { kind: 'glint'; verts: Point[] }
  | { kind: 'twinkle'; x: number; y: number }
);
type Of<K extends Effect['kind']> = Extract<Effect, { kind: K }>;
// An effect to start now
type NewEffect = Effect extends infer E ? (E extends Effect ? Omit<E, 'start'> : never) : never;

export class DazzleEffects implements SkinEffects {
  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  // The board's size in board units (see setBoardSize); a captured stone's
  // patch of background is drawn at it, so it matches the board's
  boardW = BOARD_W;
  boardH = BOARD_H;
  effects: Effect[] = [];
  raf = 0;
  idleTimer: ReturnType<typeof setTimeout> | undefined;
  stoneVerts: Point[][] = [];
  freeSparkles = BG_SPARKLES;
  lastMove: Point[] | null = null;
  target: { verts: Point[]; player: Player } | null = null;
  lastFrame = 0;

  setBoardSize(w: number, h: number) {
    this.boardW = w;
    this.boardH = h;
  }

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scheduleIdle();
    this.kick();
  }

  detach() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.idleTimer);
    this.raf = 0;
    this.effects = [];
    this.lastMove = null;
    this.target = null;
    if (this.ctx && this.canvas) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas = null;
    this.ctx = null;
  }

  // Current stones (for idle glints) and the background specks not
  // covered by tiles (for twinkles). Clears effects when the board goes.
  setBoard(tiles: { verts: Point[] }[] | null, stones: Owner[]) {
    if (!tiles) {
      this.stoneVerts = [];
      this.freeSparkles = BG_SPARKLES;
      this.effects = [];
      return;
    }
    this.stoneVerts = tiles.filter((t, i) => stones[i]).map(t => t.verts);
    this.freeSparkles = BG_SPARKLES.filter(s => !tiles.some(t => pointInPolygon(s.x, s.y, t.verts)));
  }

  setLastMove(verts: Point[] | null) {
    this.lastMove = verts;
    this.kick();
  }

  setTarget(target: { verts: Point[]; player: Player } | null) {
    this.target = target;
    this.kick();
  }

  place(verts: Point[], player: Player) {
    this.add({ kind: 'pop', verts, player });
  }

  capture(vertsList: Point[][], player: Player, capturer: Player) {
    if (!this.ctx) return;
    const now = performance.now();
    for (const verts of vertsList) {
      const c = centroidOf(verts);
      const gem = GEMS[player];
      // Shards: each edge split at its midpoint, fanned from the center
      const shards: Shard[] = [];
      verts.forEach((a, i) => {
        const b = verts[(i + 1) % verts.length];
        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        for (const tri of [[c, a, m], [c, m, b]]) {
          const sc = centroidOf(tri);
          const dx = sc.x - c.x, dy = sc.y - c.y;
          const len = Math.hypot(dx, dy) || 1;
          const speed = rand(70, 160);
          shards.push({
            pts: tri.map(p => ({ x: p.x - sc.x, y: p.y - sc.y })),
            x: sc.x, y: sc.y,
            vx: (dx / len) * speed + rand(-30, 30),
            vy: (dy / len) * speed + rand(-60, 10),
            spin: rand(-5, 5),
            color: rgb(mix(gem.dark, gem.light, rand(0.2, 0.9)))
          });
        }
      });
      const sparks = Array.from({ length: 10 }, () => {
        const a = rand(0, Math.PI * 2);
        const speed = rand(80, 220);
        return { x: c.x, y: c.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 40, size: rand(2, 4.5) };
      });
      this.effects.push({ kind: 'shatter', start: now, shards, sparks });
    }

    // Floating "+N" at the middle of the captured stones
    const all = vertsList.map(centroidOf);
    const cx = all.reduce((s, p) => s + p.x, 0) / all.length;
    const cy = all.reduce((s, p) => s + p.y, 0) / all.length;
    this.add({ kind: 'score', x: cx, y: cy, text: `+${vertsList.length}`, player: capturer });
  }

  cascade(tiles: { verts: Point[] }[], originVerts: Point[]) {
    const o = centroidOf(originVerts);
    const items = tiles.map(t => {
      const c = centroidOf(t.verts);
      return { verts: t.verts, delay: (Math.hypot(c.x - o.x, c.y - o.y) / CASCADE_SPEED) * 1000 };
    });
    const isOrigin = (verts: Point[]) => verts.every(v => originVerts.some(w => Math.hypot(w.x - v.x, w.y - v.y) < 1));
    this.add({ kind: 'cascade', items: items.filter(it => !isOrigin(it.verts)) });
  }

  add(effect: NewEffect) {
    if (!this.ctx) return;
    this.effects.push({ ...effect, start: performance.now() });
    this.kick();
  }

  kick() {
    if (!this.raf && this.ctx && (this.effects.length || this.lastMove || this.target)) {
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  scheduleIdle() {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (!this.ctx) return;
      if (this.stoneVerts.length) {
        const verts = this.stoneVerts[Math.floor(Math.random() * this.stoneVerts.length)];
        this.add({ kind: 'glint', verts });
      }
      if (this.freeSparkles.length) {
        const s = this.freeSparkles[Math.floor(Math.random() * this.freeSparkles.length)];
        this.add({ kind: 'twinkle', x: s.x, y: s.y });
      }
      this.scheduleIdle();
    }, rand(IDLE_MIN_MS, IDLE_MAX_MS));
  }

  frame = (now: number) => {
    const { ctx, canvas } = this;
    this.raf = 0;
    if (!ctx || !canvas) return;

    // With only the persistent effects showing, redraw at a lower rate
    if (!this.effects.length && now - this.lastFrame < 1000 / PERSISTENT_FPS) {
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    this.lastFrame = now;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Cascades first: they mask tiles that haven't appeared yet
    this.effects = this.effects.filter(e => {
      const t = now - e.start;
      switch (e.kind) {
        case 'cascade': return this.drawCascade(e, t);
        default: return true;
      }
    });
    this.effects = this.effects.filter(e => {
      const t = now - e.start;
      switch (e.kind) {
        case 'cascade': return true;
        case 'pop': return this.drawPop(e, t);
        case 'shatter': return this.drawShatter(e, t);
        case 'score': return this.drawScore(e, t);
        case 'glint': return this.drawGlint(e, t);
        case 'twinkle': return this.drawTwinkle(e, t);
        default: return false;
      }
    });

    if (this.lastMove) this.drawLastMovePulse(now);
    if (this.target) this.drawFloatingTarget(now);

    if (this.effects.length || this.lastMove || this.target) this.raf = requestAnimationFrame(this.frame);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Breathing gold glow, a twinkling sparkle and a smaller one circling
  drawLastMovePulse(now: number) {
    const { ctx, lastMove: verts } = this;
    if (!ctx || !verts) return;
    const p = (Math.sin((now / PULSE_MS) * Math.PI * 2) + 1) / 2; // 0..1
    ctx.save();
    tracePolygon(ctx, verts);
    ctx.shadowColor = '#fde68a';
    ctx.shadowBlur = 8 + 14 * p;
    ctx.strokeStyle = `rgba(253, 230, 138, ${0.55 + 0.45 * p})`;
    ctx.lineWidth = 2 + 1.5 * p;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
    const c = centroidOf(verts);
    drawSparkle(ctx, c.x + 5, c.y - 4, 6 + 4 * p, 'rgba(255, 255, 255, 0.95)');
    const a = (now / 2400) * Math.PI * 2;
    drawSparkle(ctx, c.x + Math.cos(a) * 11, c.y + Math.sin(a) * 8, 2.5 + 2 * (1 - p), 'rgba(253, 230, 138, 0.9)');
  }

  // The preview gem lifted off its socket: a soft shadow below, a gentle
  // bob, a glowing outline and a shimmer that sweeps across now and then
  drawFloatingTarget(now: number) {
    const { ctx, target } = this;
    if (!ctx || !target) return;
    const { verts, player } = target;
    const lift = 3 + 1.5 * Math.sin((now / BOB_MS) * Math.PI * 2);
    ctx.save();
    tracePolygon(ctx, verts);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 6 + lift;
    ctx.fill();
    ctx.restore();

    const lifted = verts.map(v => ({ x: v.x, y: v.y - lift }));
    drawGem(ctx, lifted, player, 0.7);
    ctx.save();
    tracePolygon(ctx, lifted);
    ctx.shadowColor = GEMS[player].glow;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    const k = (now % SHIMMER_MS) / GLINT_MS;
    if (k < 1) this.drawGlint({ verts: lifted }, k * GLINT_MS);
  }

  drawCascade(e: Of<'cascade'>, t: number) {
    const { ctx, canvas } = this;
    if (!ctx || !canvas) return false;
    const hidden = e.items.filter(it => t < it.delay);
    if (hidden.length) {
      ctx.save();
      ctx.beginPath();
      for (const it of hidden) {
        ctx.moveTo(it.verts[0].x, it.verts[0].y);
        it.verts.forEach(v => ctx.lineTo(v.x, v.y));
        ctx.closePath();
      }
      ctx.clip();
      drawDazzleBackground(ctx, this.boardW, this.boardH);
      ctx.restore();
    }
    // Each socket flashes gold as it appears
    let active = hidden.length > 0;
    for (const it of e.items) {
      const k = (t - it.delay) / CASCADE_FLASH_MS;
      if (k < 0 || k > 1) continue;
      active = true;
      ctx.save();
      tracePolygon(ctx, it.verts);
      ctx.strokeStyle = `rgba(253, 230, 138, ${1 - k})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#fde68a';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();
    }
    return active;
  }

  drawPop(e: Of<'pop'>, t: number) {
    const k = t / POP_MS;
    if (k >= 1) return false;
    const { ctx } = this;
    if (!ctx) return false;
    const c = centroidOf(e.verts);
    ctx.save();
    // White flash over the new gem
    tracePolygon(ctx, e.verts);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.75 * (1 - k)})`;
    ctx.fill();
    // Glow ring expanding outward
    const s = 1 + 0.6 * k;
    tracePolygon(ctx, e.verts.map(v => ({ x: c.x + (v.x - c.x) * s, y: c.y + (v.y - c.y) * s })));
    ctx.strokeStyle = GEMS[e.player].glow;
    ctx.globalAlpha = 1 - k;
    ctx.lineWidth = 3;
    ctx.shadowColor = GEMS[e.player].glow;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.restore();
    // Sparks at the corners
    e.verts.forEach(v => drawSparkle(ctx, c.x + (v.x - c.x) * s, c.y + (v.y - c.y) * s, 5 * (1 - k), 'rgba(255, 255, 255, 0.9)'));
    return true;
  }

  drawShatter(e: Of<'shatter'>, t: number) {
    const k = t / SHATTER_MS;
    if (k >= 1) return false;
    const { ctx } = this;
    if (!ctx) return false;
    const sec = t / 1000;
    ctx.save();
    ctx.globalAlpha = 1 - k * k;
    for (const sh of e.shards) {
      ctx.save();
      ctx.translate(sh.x + sh.vx * sec, sh.y + sh.vy * sec + 0.5 * GRAVITY * sec * sec);
      ctx.rotate(sh.spin * sec);
      ctx.beginPath();
      sh.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = sh.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 0.75;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    for (const sp of e.sparks) {
      drawSparkle(ctx, sp.x + sp.vx * sec, sp.y + sp.vy * sec + 0.5 * GRAVITY * sec * sec, sp.size * (1 - k), `rgba(253, 230, 138, ${1 - k})`);
    }
    return true;
  }

  drawScore(e: Of<'score'>, t: number) {
    const k = t / SCORE_MS;
    if (k >= 1) return false;
    const { ctx } = this;
    if (!ctx) return false;
    ctx.save();
    ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    ctx.font = `bold ${Math.round(26 + 8 * Math.min(1, k * 4))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const y = e.y - 50 * k;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(12, 4, 24, 0.9)';
    ctx.strokeText(e.text, e.x, y);
    ctx.shadowColor = GEMS[e.player].glow;
    ctx.shadowBlur = 12;
    ctx.fillStyle = e.player === 1 ? '#bfdbfe' : '#fecaca';
    ctx.fillText(e.text, e.x, y);
    ctx.restore();
    return true;
  }

  // A bright band sweeping across the gem, from the lit corner away
  drawGlint(e: { verts: Point[] }, t: number) {
    const k = t / GLINT_MS;
    if (k >= 1) return false;
    const { ctx } = this;
    if (!ctx) return false;
    const c = centroidOf(e.verts);
    const r = Math.max(...e.verts.map(v => Math.hypot(v.x - c.x, v.y - c.y)));
    const p = -1.2 + 2.4 * k; // band position along the sweep
    const dx = -LIGHT.x, dy = -LIGHT.y;
    const x0 = c.x + dx * r * (p - 0.35), y0 = c.y + dy * r * (p - 0.35);
    const x1 = c.x + dx * r * (p + 0.35), y1 = c.y + dy * r * (p + 0.35);
    const band = ctx.createLinearGradient(x0, y0, x1, y1);
    band.addColorStop(0, 'rgba(255, 255, 255, 0)');
    band.addColorStop(0.5, 'rgba(255, 255, 255, 0.75)');
    band.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.save();
    tracePolygon(ctx, e.verts);
    ctx.clip();
    ctx.fillStyle = band;
    ctx.fillRect(c.x - r, c.y - r, 2 * r, 2 * r);
    ctx.restore();
    if (k > 0.35 && k < 0.75) {
      drawSparkle(ctx, c.x + LIGHT.x * r * 0.4, c.y + LIGHT.y * r * 0.4, 6 * Math.sin(((k - 0.35) / 0.4) * Math.PI), 'rgba(255, 255, 255, 0.95)');
    }
    return true;
  }

  drawTwinkle(e: Of<'twinkle'>, t: number) {
    const k = t / TWINKLE_MS;
    if (k >= 1 || !this.ctx) return false;
    drawSparkle(this.ctx, e.x, e.y, 5 * Math.sin(k * Math.PI), 'rgba(253, 230, 138, 0.9)');
    return true;
  }
}
