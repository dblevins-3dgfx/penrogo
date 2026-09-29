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

import {
  GEMS, LIGHT, BG_SPARKLES, centroidOf, tracePolygon, drawSparkle,
  drawDazzleBackground, mix, rgb
} from './skins';

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

const rand = (a, b) => a + Math.random() * (b - a);

const pointInPolygon = (x, y, verts) => {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const a = verts[i], b = verts[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

export class DazzleEffects {
  canvas = null;
  ctx = null;
  effects = [];
  raf = 0;
  idleTimer = 0;
  stoneVerts = [];
  freeSparkles = BG_SPARKLES;

  attach(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scheduleIdle();
  }

  detach() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.idleTimer);
    this.raf = 0;
    this.effects = [];
    if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas = null;
    this.ctx = null;
  }

  // Current stones (for idle glints) and the background specks not
  // covered by tiles (for twinkles). Clears effects when the board goes.
  setBoard(tiles, stones) {
    if (!tiles) {
      this.stoneVerts = [];
      this.freeSparkles = BG_SPARKLES;
      this.effects = [];
      return;
    }
    this.stoneVerts = tiles.filter((t, i) => stones[i]).map(t => t.verts);
    this.freeSparkles = BG_SPARKLES.filter(s => !tiles.some(t => pointInPolygon(s.x, s.y, t.verts)));
  }

  place(verts, player) {
    this.add({ kind: 'pop', verts, player });
  }

  capture(vertsList, player, capturer) {
    if (!this.ctx) return;
    const now = performance.now();
    for (const verts of vertsList) {
      const c = centroidOf(verts);
      const gem = GEMS[player];
      // Shards: each edge split at its midpoint, fanned from the center
      const shards = [];
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

  cascade(tiles, originVerts) {
    const o = centroidOf(originVerts);
    const items = tiles.map(t => {
      const c = centroidOf(t.verts);
      return { verts: t.verts, delay: (Math.hypot(c.x - o.x, c.y - o.y) / CASCADE_SPEED) * 1000 };
    });
    const isOrigin = (verts) => verts.every(v => originVerts.some(w => Math.hypot(w.x - v.x, w.y - v.y) < 1));
    this.add({ kind: 'cascade', items: items.filter(it => !isOrigin(it.verts)) });
  }

  add(effect) {
    if (!this.ctx) return;
    effect.start = effect.start || performance.now();
    this.effects.push(effect);
    this.kick();
  }

  kick() {
    if (!this.raf && this.ctx) this.raf = requestAnimationFrame(this.frame);
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

  frame = (now) => {
    const { ctx, canvas } = this;
    this.raf = 0;
    if (!ctx) return;
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

    if (this.effects.length) this.raf = requestAnimationFrame(this.frame);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  drawCascade(e, t) {
    const { ctx, canvas } = this;
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
      drawDazzleBackground(ctx, canvas.width, canvas.height);
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

  drawPop(e, t) {
    const k = t / POP_MS;
    if (k >= 1) return false;
    const { ctx } = this;
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
    e.verts.forEach(v => drawSparkle(this.ctx, c.x + (v.x - c.x) * s, c.y + (v.y - c.y) * s, 5 * (1 - k), 'rgba(255, 255, 255, 0.9)'));
    return true;
  }

  drawShatter(e, t) {
    const k = t / SHATTER_MS;
    if (k >= 1) return false;
    const { ctx } = this;
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

  drawScore(e, t) {
    const k = t / SCORE_MS;
    if (k >= 1) return false;
    const { ctx } = this;
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
  drawGlint(e, t) {
    const k = t / GLINT_MS;
    if (k >= 1) return false;
    const { ctx } = this;
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

  drawTwinkle(e, t) {
    const k = t / TWINKLE_MS;
    if (k >= 1) return false;
    drawSparkle(this.ctx, e.x, e.y, 5 * Math.sin(k * Math.PI), 'rgba(253, 230, 138, 0.9)');
    return true;
  }
}
