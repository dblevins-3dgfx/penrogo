// Penrose kite and dart board generation.
//
// A patch of the tiling is built by repeatedly subdividing ("deflating")
// Robinson half-tiles, starting from a sun of five kites. Each half-kite
// splits into two half-kites and a half-dart, and each half-dart into a
// half-kite and a half-dart, every piece shrinking by the golden ratio.
// Mirror-image halves that share their axis edge are then joined back into
// whole kites and darts. The result is a correct Penrose tiling by
// construction, so the board can never contain an untileable gap.
//
// Half-tiles are [type, apex, axisEnd, side] with points as [x, y]:
//   half-kite: apex = kite tip O (72°), axisEnd = C (144°), side = B or D
//   half-dart: apex = reflex vertex A' (216°), axisEnd = tip M, side = N or N'
// Two mirror halves share apex and axisEnd. The piece orientations below
// were found by exhaustive search as the only choice that keeps Penrose's
// vertex coloring consistent and pairs every half with its mirror.

const PHI = (1 + Math.sqrt(5)) / 2;

const HALF_KITE = 0;
const HALF_DART = 1;

const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];

const deflate = (halves) => {
  const out = [];
  for (const [type, apex, axisEnd, side] of halves) {
    if (type === HALF_KITE) {
      const P = lerp(apex, axisEnd, 1 / PHI);
      const Q = lerp(side, apex, 1 / PHI);
      out.push(
        [HALF_KITE, side, P, axisEnd],
        [HALF_KITE, side, P, Q],
        [HALF_DART, Q, apex, P]
      );
    } else {
      const P = lerp(axisEnd, side, 1 / PHI);
      out.push(
        [HALF_KITE, axisEnd, apex, P],
        [HALF_DART, P, side, apex]
      );
    }
  }
  return out;
};

// Sun of five kites (ten half-kites) around the origin, tips at the center.
const sun = (radius) => {
  const halves = [];
  for (let k = 0; k < 5; k++) {
    const a = (k * 72 * Math.PI) / 180;
    const d = (36 * Math.PI) / 180;
    const C = [radius * Math.cos(a), radius * Math.sin(a)];
    for (const s of [a + d, a - d]) {
      halves.push([HALF_KITE, [0, 0], C, [radius * Math.cos(s), radius * Math.sin(s)]]);
    }
  }
  return halves;
};

const key = (p) => `${Math.round(p[0] * 100)},${Math.round(p[1] * 100)}`;

// Joins mirror halves into whole tiles. Vertices use the game's order:
// kite [O (72°), B, C (144°), D], dart [M (72°), N, A' (216°), N'], where
// vertex 0 to vertex 2 is the axis. Halves at the patch edge whose mirror
// was cut off are dropped.
const joinHalves = (halves) => {
  const byAxis = new Map();
  for (const h of halves) {
    const k = `${h[0]}|${key(h[1])}|${key(h[2])}`;
    if (!byAxis.has(k)) byAxis.set(k, []);
    byAxis.get(k).push(h);
  }

  const tiles = [];
  for (const pair of byAxis.values()) {
    if (pair.length !== 2) continue;
    const [[type, apex, axisEnd, s1], [, , , s2]] = pair;
    tiles.push(type === HALF_KITE
      ? { type: 'kite', verts: [apex, s1, axisEnd, s2] }
      : { type: 'dart', verts: [axisEnd, s1, apex, s2] });
  }
  return tiles;
};

// Generates a patch whose kites have long edge `edge`, large enough to cover
// a disc of about `edge * PHI ** depth` around the origin.
export const generatePatch = (edge, depth) => {
  let tris = sun(edge * PHI ** depth);
  for (let i = 0; i < depth; i++) tris = deflate(tris);
  return joinHalves(tris);
};

const centroid = (vs) => ({
  x: vs.reduce((s, v) => s + v[0], 0) / vs.length,
  y: vs.reduce((s, v) => s + v[1], 0) / vs.length,
});

// Builds the board around an opening tile: the patch is rotated and moved
// so one of its tiles (of the opening's type, near the patch center)
// exactly covers `openingVerts`, then clipped to tiles lying fully inside
// the width x height playfield. Returns tiles with neighbor lists (tiles
// sharing a full edge) and the index of the opening tile.
export const buildBoard = (type, openingVerts, width, height, edge) => {
  const patch = generatePatch(edge, 7);

  let anchor = null;
  let best = Infinity;
  for (const t of patch) {
    if (t.type !== type) continue;
    const c = centroid(t.verts);
    const d = Math.hypot(c.x, c.y);
    if (d < best) { best = d; anchor = t; }
  }

  // Rotation taking the anchor's axis onto the opening's axis
  const axis = (vs) => Math.atan2(vs[2][1] - vs[0][1], vs[2][0] - vs[0][0]);
  const openingPts = openingVerts.map(v => [v.x, v.y]);
  const theta = axis(openingPts) - axis(anchor.verts);
  const cos = Math.cos(theta), sin = Math.sin(theta);
  const rot = ([x, y]) => [x * cos - y * sin, x * sin + y * cos];
  const a0 = rot(anchor.verts[0]);
  const dx = openingPts[0][0] - a0[0];
  const dy = openingPts[0][1] - a0[1];
  const place = (p) => { const [x, y] = rot(p); return { x: x + dx, y: y + dy }; };

  const EDGE_TOL = 0.5;
  const inside = (v) => v.x >= -EDGE_TOL && v.x <= width + EDGE_TOL && v.y >= -EDGE_TOL && v.y <= height + EDGE_TOL;

  const tiles = [];
  let opening = -1;
  for (const t of patch) {
    const verts = t.verts.map(place);
    if (!verts.every(inside)) continue;
    if (t === anchor) opening = tiles.length;
    tiles.push({ id: tiles.length, type: t.type, verts, neighbors: [] });
  }

  // Neighbors: tiles that share a full edge
  const edgeKey = (p, q) => {
    const a = `${Math.round(p.x)},${Math.round(p.y)}`;
    const b = `${Math.round(q.x)},${Math.round(q.y)}`;
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  };
  const byEdge = new Map();
  for (const t of tiles) {
    for (let e = 0; e < 4; e++) {
      const k = edgeKey(t.verts[e], t.verts[(e + 1) % 4]);
      if (!byEdge.has(k)) byEdge.set(k, []);
      byEdge.get(k).push(t.id);
    }
  }
  for (const ids of byEdge.values()) {
    if (ids.length !== 2) continue;
    const [a, b] = ids;
    tiles[a].neighbors.push(b);
    tiles[b].neighbors.push(a);
  }

  return { tiles, opening };
};
