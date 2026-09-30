// Go Classic drawing, shared by the skin (static board) and its effects.
// A kaya-wood board with ink lines along the tile edges; stones are slate
// (black, Player 1) and clamshell (white, Player 2), shaped to their tiles
// with rounded corners so the kite and dart geometry still reads.
import type { Point, Player, Owner } from '../types';
import { centroidOf } from '../canvas-utils';

const INK = 'rgba(43, 29, 16, 0.75)';
const STONE_INSET = 0.84;
const CORNER = 4;

// Seeded wood grain, so it doesn't change between redraws
const GRAIN = (() => {
  let seed = 23;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 70 }, () => ({
    y: rand() * 600, amp: 1 + rand() * 4, freq: 0.004 + rand() * 0.01, phase: rand() * 6.28,
    alpha: 0.04 + rand() * 0.08, width: 0.5 + rand() * 1.5
  }));
})();

export const drawWood = (ctx, w: number, h: number) => {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#e8bd78');
  g.addColorStop(0.5, '#dcae6a');
  g.addColorStop(1, '#cf9d58');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (const gr of GRAIN) {
    ctx.strokeStyle = `rgba(124, 74, 30, ${gr.alpha})`;
    ctx.lineWidth = gr.width;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 10) {
      const y = gr.y + Math.sin(x * gr.freq + gr.phase) * gr.amp;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
};

const traceLines = (ctx, verts: Point[]) => {
  ctx.beginPath();
  ctx.moveTo(verts[0].x, verts[0].y);
  verts.forEach(v => ctx.lineTo(v.x, v.y));
  ctx.closePath();
};

// An empty point: ink lines along the tile edges, plus a territory marker
// (a small square in the owner's color) at game end
export const drawEmptyPoint = (ctx, verts: Point[], territory: Owner = 0) => {
  traceLines(ctx, verts);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.stroke();
  if (territory) {
    const c = centroidOf(verts);
    ctx.fillStyle = territory === 1 ? '#111111' : '#fafaf9';
    ctx.fillRect(c.x - 4, c.y - 4, 8, 8);
    ctx.strokeStyle = territory === 1 ? '#000000' : '#44403c';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(c.x - 4, c.y - 4, 8, 8);
  }
};

// A polygon with rounded corners
const roundedPath = (ctx, pts: Point[], r: number) => {
  const n = pts.length;
  ctx.beginPath();
  const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const start = mid(pts[n - 1], pts[0]);
  ctx.moveTo(start.x, start.y);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    ctx.arcTo(p.x, p.y, mid(p, q).x, mid(p, q).y, r);
  }
  ctx.closePath();
};

// A stone. `scale` grows it about its center; `lift` raises it off the
// board (a longer, softer shadow); `alpha` fades it.
export const drawStone = (ctx, verts: Point[], player: Player, { scale = 1, lift = 0, alpha = 1 } = {}) => {
  const c = centroidOf(verts);
  const k = STONE_INSET * scale;
  const pts = verts.map(p => ({ x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k }));
  const r = Math.max(...pts.map(p => Math.hypot(p.x - c.x, p.y - c.y)));
  ctx.save();
  ctx.globalAlpha = alpha;

  // Shadow on the board
  roundedPath(ctx, pts, CORNER);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 3 + lift * 1.2;
  ctx.shadowOffsetX = 1.5 + lift * 0.6;
  ctx.shadowOffsetY = 2.5 + lift;
  ctx.fillStyle = player === 1 ? '#111111' : '#e7e5e4';
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Polished shading, lit from the upper left
  const g = ctx.createRadialGradient(c.x - r * 0.35, c.y - r * 0.4, r * 0.05, c.x, c.y, r * 1.1);
  if (player === 1) {
    g.addColorStop(0, '#6b7280');
    g.addColorStop(0.35, '#27272a');
    g.addColorStop(1, '#030303');
  } else {
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, '#f5f5f4');
    g.addColorStop(1, '#c9c4bf');
  }
  roundedPath(ctx, pts, CORNER);
  ctx.fillStyle = g;
  ctx.fill();

  // Clamshell stripes on white stones
  if (player === 2) {
    ctx.save();
    roundedPath(ctx, pts, CORNER);
    ctx.clip();
    ctx.strokeStyle = 'rgba(168, 162, 158, 0.18)';
    ctx.lineWidth = 0.7;
    for (let i = 1; i <= 5; i++) {
      ctx.beginPath();
      ctx.arc(c.x + r * 0.9, c.y + r * 1.4, r * 0.45 * i, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Soft highlight
  ctx.fillStyle = player === 1 ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.ellipse(c.x - r * 0.3, c.y - r * 0.35, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

// Go's last-move marker: a small ring in the opposite color
export const drawLastMoveRing = (ctx, verts: Point[], player: Player) => {
  const c = centroidOf(verts);
  ctx.save();
  ctx.strokeStyle = player === 1 ? '#fafaf9' : '#111111';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

// The empty look over a tile (wood clipped to it plus its ink lines), so
// effects can hide a stone the board has already drawn
export const coverWithEmpty = (ctx, verts: Point[], w: number, h: number) => {
  ctx.save();
  traceLines(ctx, verts);
  ctx.clip();
  drawWood(ctx, w, h);
  ctx.restore();
  drawEmptyPoint(ctx, verts);
};
