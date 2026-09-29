// Dazzle's gem drawing, shared by the skin (static board) and its effects.
import { tracePolygon, centroidOf, mix, rgb } from '../canvas-utils';

// Gem palettes: facet shading runs from dark to light
export const GEMS = {
  1: { dark: [23, 37, 84], mid: [37, 99, 235], light: [191, 219, 254], glow: 'rgba(96, 165, 250, 0.9)' },
  2: { dark: [69, 10, 10], mid: [220, 38, 38], light: [254, 202, 202], glow: 'rgba(248, 113, 113, 0.9)' }
};

// Light comes from the upper left (unit vector toward the light)
export const LIGHT = { x: -0.6, y: -0.8 };

// Fixed sparkle positions for the background, so they don't jump around
// between redraws.
export const BG_SPARKLES = (() => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 70 }, () => ({ x: rand() * 800, y: rand() * 600, r: 0.4 + rand() * 1.3, a: 0.15 + rand() * 0.5 }));
})();

// A faceted gem filling the tile: a smaller "table" facet in the middle,
// and one side facet per edge, each shaded by how much it faces the light.
export const drawGem = (ctx, verts, player, alpha = 1) => {
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

// Velvet background with fixed gold specks
export const drawDazzleBackground = (ctx, w, h) => {
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
};
