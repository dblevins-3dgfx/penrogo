// Visual skins. A skin decides how the page chrome looks (Tailwind classes)
// and how the board is drawn on the canvas; it never affects the game.
//
// Canvas hooks, all given 800x600 board coordinates:
//   drawBackground(ctx, w, h)                  behind everything
//   drawTile(ctx, verts, { stone, territory }) one board tile; stone and
//                                              territory are 0, 1 or 2
//   drawLastMove(ctx, verts)                   marks the most recent stone
//   drawTarget(ctx, verts, player, legal)      the tile under the pointer, or
//                                              the opening tile preview

const tracePolygon = (ctx, verts) => {
  ctx.beginPath();
  ctx.moveTo(verts[0].x, verts[0].y);
  verts.forEach(v => ctx.lineTo(v.x, v.y));
  ctx.closePath();
};

const centroidOf = (verts) => ({
  x: verts.reduce((s, v) => s + v.x, 0) / verts.length,
  y: verts.reduce((s, v) => s + v.y, 0) / verts.length
});

const drawIllegalOutline = (ctx, verts) => {
  ctx.save();
  tracePolygon(ctx, verts);
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.restore();
};

// ---------------------------------------------------------------------
// Plain Jane: flat colors on a white board (the original look)
// ---------------------------------------------------------------------

const PLAIN_FILL = { 1: 'rgba(59, 130, 246, 0.75)', 2: 'rgba(239, 68, 68, 0.75)' };
const PLAIN_STROKE = { 1: '#1e40af', 2: '#991b1b' };
const PLAIN_TERRITORY = { 1: 'rgba(59, 130, 246, 0.25)', 2: 'rgba(239, 68, 68, 0.25)' };

const drawPlainStar = (ctx, c) => {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 9 : 4;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = c.x + r * Math.cos(a);
    const py = c.y + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#facc15';
  ctx.fill();
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
};

const plainJane = {
  id: 'plain',
  name: 'Plain Jane',
  chrome: {
    page: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900',
    panel: 'bg-slate-800',
    title: 'text-white',
    canvas: 'bg-white'
  },

  drawBackground(ctx, w, h) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < w; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
      ctx.stroke();
    }
    for (let i = 0; i < h; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(w, i);
      ctx.stroke();
    }
  },

  drawTile(ctx, verts, { stone, territory }) {
    tracePolygon(ctx, verts);
    ctx.fillStyle = stone ? PLAIN_FILL[stone] : territory ? PLAIN_TERRITORY[territory] : '#f1f5f9';
    ctx.fill();
    ctx.strokeStyle = stone ? PLAIN_STROKE[stone] : '#94a3b8';
    ctx.lineWidth = stone ? 1.5 : 1;
    ctx.stroke();
  },

  drawLastMove(ctx, verts) {
    ctx.save();
    tracePolygon(ctx, verts);
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
    drawPlainStar(ctx, centroidOf(verts));
  },

  drawTarget(ctx, verts, player, legal) {
    if (!legal) {
      drawIllegalOutline(ctx, verts);
      return;
    }
    ctx.save();
    tracePolygon(ctx, verts);
    ctx.fillStyle = PLAIN_FILL[player];
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
};

// ---------------------------------------------------------------------
// Dazzle: Bejeweled-inspired. Stones are cut gems (sapphire and ruby) set
// in dark gold-rimmed sockets on a velvet background.
// ---------------------------------------------------------------------

// Gem palettes: facet shading runs from dark to light
const GEMS = {
  1: { dark: [23, 37, 84], mid: [37, 99, 235], light: [191, 219, 254], glow: 'rgba(96, 165, 250, 0.9)' },
  2: { dark: [69, 10, 10], mid: [220, 38, 38], light: [254, 202, 202], glow: 'rgba(248, 113, 113, 0.9)' }
};

// Light comes from the upper left (unit vector toward the light)
const LIGHT = { x: -0.6, y: -0.8 };

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c, alpha = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;

// Fixed sparkle positions for the background, so they don't jump around
// between redraws.
const BG_SPARKLES = (() => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 70 }, () => ({ x: rand() * 800, y: rand() * 600, r: 0.4 + rand() * 1.3, a: 0.15 + rand() * 0.5 }));
})();

// Four-pointed twinkle
const drawSparkle = (ctx, x, y, size, color) => {
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = size;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? size : size * 0.18;
    const a = (i * Math.PI) / 4;
    const px = x + r * Math.cos(a);
    const py = y + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

// A faceted gem filling the tile: a smaller "table" facet in the middle,
// and one side facet per edge, each shaded by how much it faces the light.
const drawGem = (ctx, verts, player, alpha = 1) => {
  const gem = GEMS[player];
  const c = centroidOf(verts);
  const inner = verts.map(v => ({ x: c.x + (v.x - c.x) * 0.5, y: c.y + (v.y - c.y) * 0.5 }));

  ctx.save();
  ctx.globalAlpha = alpha;

  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    // Outward normal of this edge (pointing away from the centroid)
    let nx = b.y - a.y;
    let ny = -(b.x - a.x);
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    const mx = (a.x + b.x) / 2 - c.x;
    const my = (a.y + b.y) / 2 - c.y;
    if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }

    const facing = (nx * LIGHT.x + ny * LIGHT.y + 1) / 2; // 0 (away) .. 1 (toward)
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(inner[(i + 1) % verts.length].x, inner[(i + 1) % verts.length].y);
    ctx.lineTo(inner[i].x, inner[i].y);
    ctx.closePath();
    ctx.fillStyle = rgb(facing > 0.5 ? mix(gem.mid, gem.light, (facing - 0.5) * 1.4) : mix(gem.dark, gem.mid, facing * 2));
    ctx.fill();
  }

  // Table facet: bright toward the light, deepening away from it
  const r = Math.max(...inner.map(v => Math.hypot(v.x - c.x, v.y - c.y)));
  const grad = ctx.createLinearGradient(c.x + LIGHT.x * r, c.y + LIGHT.y * r, c.x - LIGHT.x * r, c.y - LIGHT.y * r);
  grad.addColorStop(0, rgb(gem.light));
  grad.addColorStop(0.45, rgb(gem.mid));
  grad.addColorStop(1, rgb(mix(gem.dark, gem.mid, 0.5)));
  tracePolygon(ctx, inner);
  ctx.fillStyle = grad;
  ctx.fill();

  // Facet edges and outline
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 0.75;
  tracePolygon(ctx, inner);
  ctx.stroke();
  ctx.beginPath();
  verts.forEach((v, i) => {
    ctx.moveTo(v.x, v.y);
    ctx.lineTo(inner[i].x, inner[i].y);
  });
  ctx.stroke();
  tracePolygon(ctx, verts);
  ctx.strokeStyle = rgb(gem.dark);
  ctx.lineWidth = 1.25;
  ctx.stroke();

  // Specular glint on the table
  const gx = c.x + LIGHT.x * r * 0.45;
  const gy = c.y + LIGHT.y * r * 0.45;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.ellipse(gx, gy, 2.6, 1.6, -0.9, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

const dazzle = {
  id: 'dazzle',
  name: 'Dazzle',
  chrome: {
    page: 'bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950',
    panel: 'bg-purple-950/70 ring-1 ring-amber-400/30',
    title: 'bg-gradient-to-r from-amber-300 via-pink-300 to-sky-300 bg-clip-text text-transparent',
    canvas: 'bg-[#12071f] ring-1 ring-amber-400/40'
  },

  drawBackground(ctx, w, h) {
    const bg = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, Math.hypot(w, h) / 2);
    bg.addColorStop(0, '#3b0764');
    bg.addColorStop(1, '#0c0418');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    for (const s of BG_SPARKLES) {
      ctx.fillStyle = `rgba(253, 230, 138, ${s.a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawTile(ctx, verts, { stone, territory }) {
    if (stone) {
      drawGem(ctx, verts, stone);
      return;
    }
    // Empty socket: dark and slightly recessed, with a gold rim
    const c = centroidOf(verts);
    const socket = ctx.createLinearGradient(c.x - 25, c.y - 25, c.x + 25, c.y + 25);
    socket.addColorStop(0, '#0b0514');
    socket.addColorStop(1, '#2a1245');
    tracePolygon(ctx, verts);
    ctx.fillStyle = socket;
    ctx.fill();
    if (territory) {
      ctx.fillStyle = territory === 1 ? 'rgba(59, 130, 246, 0.35)' : 'rgba(239, 68, 68, 0.35)';
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
  },

  drawLastMove(ctx, verts) {
    ctx.save();
    tracePolygon(ctx, verts);
    ctx.shadowColor = '#fde68a';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = 'rgba(253, 230, 138, 0.95)';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
    const c = centroidOf(verts);
    drawSparkle(ctx, c.x + 5, c.y - 4, 9, 'rgba(255, 255, 255, 0.95)');
    drawSparkle(ctx, c.x - 7, c.y + 6, 4.5, 'rgba(253, 230, 138, 0.9)');
  },

  drawTarget(ctx, verts, player, legal) {
    if (!legal) {
      drawIllegalOutline(ctx, verts);
      return;
    }
    drawGem(ctx, verts, player, 0.6);
    ctx.save();
    tracePolygon(ctx, verts);
    ctx.shadowColor = GEMS[player].glow;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
};

export const SKINS = [plainJane, dazzle];
export const DEFAULT_SKIN = 'plain';
export const skinById = (id) => SKINS.find(s => s.id === id) || SKINS[0];
