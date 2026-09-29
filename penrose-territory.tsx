import React, { useState, useRef, useEffect, useMemo } from 'react';
import { RotateCw, Play, SkipForward, RotateCcw, CircleHelp, X } from 'lucide-react';

const PHI = (1 + Math.sqrt(5)) / 2;
const TILE_SIZE = 60;
const VERTEX_EPS = 4;

// Edge length labels walking the perimeter from vertex i to vertex i+1.
// Both kite and dart share this long/short/short/long pattern.
const EDGE_LENGTHS = ['long', 'short', 'short', 'long'];

// Penrose's actual matching rule (vertex 2-coloring): whenever a point is
// a vertex of more than one tile, it must be the same color on every tile
// touching it. Colors follow vertex order [O,B,C,D] for the kite and
// [M,N,A',N'] for the dart:
// Kite: axis vertices (O at 72°, C at 144°) = black; off-axis (B,D) = white.
// Dart: axis vertices (M at 72°, A' at 216°) = white; off-axis (N,N') = black.
const KITE_VERTEX_COLORS = ['black', 'white', 'black', 'white'];
const DART_VERTEX_COLORS = ['white', 'black', 'white', 'black'];

const normalize = (dx, dy) => {
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: dx / len, y: dy / len };
};

const samePoint = (p, q) =>
  Math.abs(p.x - q.x) < VERTEX_EPS && Math.abs(p.y - q.y) < VERTEX_EPS;

// Kite: verified via law-of-cosines closure check.
// Vertices O(72°) -> B(72°) -> C(144°) -> D(72°), edges: long,short,short,long
// Axis of symmetry passes through O and C. Centered on centroid so the
// shape is anchored under the cursor/placement point, not by vertex O.
const getKiteVertices = (x, y, rotation) => {
  const r = rotation * Math.PI / 180;
  const long = TILE_SIZE;
  const deg36 = 36 * Math.PI / 180;

  const local = [
    { x: 0, y: 0 },
    { x: long * Math.cos(r + deg36), y: long * Math.sin(r + deg36) },
    { x: long * Math.cos(r), y: long * Math.sin(r) },
    { x: long * Math.cos(r - deg36), y: long * Math.sin(r - deg36) }
  ];

  const cx = local.reduce((s, v) => s + v.x, 0) / local.length;
  const cy = local.reduce((s, v) => s + v.y, 0) / local.length;

  return local.map(v => ({ x: x + v.x - cx, y: y + v.y - cy }));
};

// Dart: verified via law-of-cosines closure check.
// Vertices M(72°) -> N(36°) -> A'(216°, reflex) -> N'(36°), edges: long,short,short,long
// Axis of symmetry passes through M and A'. Centered on centroid so the
// shape is anchored under the cursor/placement point, not by vertex M.
const getDartVertices = (x, y, rotation) => {
  const r = rotation * Math.PI / 180;
  const long = TILE_SIZE;
  const deg36 = 36 * Math.PI / 180;

  const local = [
    { x: 0, y: 0 },
    { x: long * Math.cos(r + deg36), y: long * Math.sin(r + deg36) },
    { x: (long / PHI) * Math.cos(r), y: (long / PHI) * Math.sin(r) },
    { x: long * Math.cos(r - deg36), y: long * Math.sin(r - deg36) }
  ];

  const cx = local.reduce((s, v) => s + v.x, 0) / local.length;
  const cy = local.reduce((s, v) => s + v.y, 0) / local.length;

  return local.map(v => ({ x: x + v.x - cx, y: y + v.y - cy }));
};

// Returns this tile's polygon vertices, dispatching on its type.
const getVertices = (tile) => tile.type === 'kite'
  ? getKiteVertices(tile.x, tile.y, tile.rotation)
  : getDartVertices(tile.x, tile.y, tile.rotation);

const getVertexColors = (tile) =>
  tile.type === 'kite' ? KITE_VERTEX_COLORS : DART_VERTEX_COLORS;

// Checks a candidate tile against all placed tiles: does it touch the
// existing structure at all, and does every coincident vertex agree in
// Penrose color with every tile it touches there? (Edge-length mismatches
// are already ruled out by checkEdgeContact's T-junction test.)
const checkVertexMatching = (candidate, allTiles) => {
  const cVerts = getVertices(candidate);
  const cColors = getVertexColors(candidate);
  let touches = false;
  let colorsMatch = true;

  for (const tile of allTiles) {
    const tVerts = getVertices(tile);
    const tColors = getVertexColors(tile);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (samePoint(cVerts[i], tVerts[j])) {
          touches = true;
          if (cColors[i] !== tColors[j]) colorsMatch = false;
        }
      }
    }
  }
  return { touches, colorsMatch };
};

// Finds every edge shared between two placed tiles (both endpoints
// coincide) where the Penrose vertex colors also agree at both ends -
// i.e. genuinely valid connections, not just geometric proximity.
const findConnectedEdges = (allTiles) => {
  const connected = [];

  for (let i = 0; i < allTiles.length; i++) {
    const vi = getVertices(allTiles[i]);
    const ci = getVertexColors(allTiles[i]);
    for (let j = i + 1; j < allTiles.length; j++) {
      const vj = getVertices(allTiles[j]);
      const cj = getVertexColors(allTiles[j]);
      for (let a = 0; a < 4; a++) {
        const a1 = vi[a], a2 = vi[(a + 1) % 4];
        const ca1 = ci[a], ca2 = ci[(a + 1) % 4];
        for (let b = 0; b < 4; b++) {
          const b1 = vj[b], b2 = vj[(b + 1) % 4];
          const cb1 = cj[b], cb2 = cj[(b + 1) % 4];
          const forward = samePoint(a1, b1) && samePoint(a2, b2) && ca1 === cb1 && ca2 === cb2;
          const reverse = samePoint(a1, b2) && samePoint(a2, b1) && ca1 === cb2 && ca2 === cb1;
          if (forward || reverse) {
            connected.push({ x1: a1.x, y1: a1.y, x2: a2.x, y2: a2.y });
          }
        }
      }
    }
  }
  return connected;
};

// True if point p lies on the interior of segment a-b (not at an endpoint).
const pointOnEdgeInterior = (p, a, b) => {
  const abx = b.x - a.x, aby = b.y - a.y;
  const len2 = abx * abx + aby * aby || 1;
  const t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  if (t <= 0 || t >= 1) return false;
  const px = a.x + t * abx, py = a.y + t * aby;
  if (Math.hypot(p.x - px, p.y - py) > VERTEX_EPS) return false;
  return !samePoint(p, a) && !samePoint(p, b);
};

// Penrose kite/dart tilings are edge-to-edge. A candidate must share at
// least one full edge with an existing tile (a single-vertex contact is not
// enough), and no corner may land in the middle of another tile's edge
// (a T-junction), in either direction.
const checkEdgeContact = (candidate, allTiles) => {
  const cv = getVertices(candidate);
  let sharesEdge = false;
  let tJunction = false;

  for (const tile of allTiles) {
    const tv = getVertices(tile);

    for (let a = 0; a < 4; a++) {
      const a1 = cv[a], a2 = cv[(a + 1) % 4];
      for (let b = 0; b < 4; b++) {
        const b1 = tv[b], b2 = tv[(b + 1) % 4];
        if ((samePoint(a1, b1) && samePoint(a2, b2)) ||
            (samePoint(a1, b2) && samePoint(a2, b1))) {
          sharesEdge = true;
        }
      }
    }

    for (const p of cv) {
      for (let b = 0; b < 4; b++) {
        if (pointOnEdgeInterior(p, tv[b], tv[(b + 1) % 4])) tJunction = true;
      }
    }
    for (const p of tv) {
      for (let a = 0; a < 4; a++) {
        if (pointOnEdgeInterior(p, cv[a], cv[(a + 1) % 4])) tJunction = true;
      }
    }
  }
  return { sharesEdge, tJunction };
};

const centroidOf = (verts) => ({
  x: verts.reduce((s, v) => s + v.x, 0) / verts.length,
  y: verts.reduce((s, v) => s + v.y, 0) / verts.length
});

// Separating-axis test for two triangles. Shapes that merely touch (or
// overlap by less than `tol` pixels) are NOT considered overlapping, so
// tiles sharing an edge or vertex are fine.
const trianglesOverlap = (t1, t2, tol) => {
  for (const tri of [t1, t2]) {
    for (let i = 0; i < 3; i++) {
      const p = tri[i], q = tri[(i + 1) % 3];
      const n = normalize(-(q.y - p.y), q.x - p.x);
      let min1 = Infinity, max1 = -Infinity, min2 = Infinity, max2 = -Infinity;
      for (const v of t1) {
        const d = v.x * n.x + v.y * n.y;
        min1 = Math.min(min1, d); max1 = Math.max(max1, d);
      }
      for (const v of t2) {
        const d = v.x * n.x + v.y * n.y;
        min2 = Math.min(min2, d); max2 = Math.max(max2, d);
      }
      if (max1 <= min2 + tol || max2 <= min1 + tol) return false;
    }
  }
  return true;
};

// Both the kite and the dart split cleanly into two triangles along the
// diagonal from vertex 0 to vertex 2 (their axis of symmetry), which also
// handles the dart's concave notch correctly.
const toTriangles = (v) => [[v[0], v[1], v[2]], [v[0], v[2], v[3]]];

const tilesOverlap = (vertsA, vertsB) => {
  for (const ta of toTriangles(vertsA)) {
    for (const tb of toTriangles(vertsB)) {
      if (trianglesOverlap(ta, tb, 1.5)) return true;
    }
  }
  return false;
};

// ---------------------------------------------------------------------
// Capture and territory
//
// The board is rasterized onto a coarse grid (CELL px per cell). Each cell
// records which player's tile covers it (0 = empty space). Enclosure is then
// a flood fill, Go-style:
//   - Capture: for player X, flood outward from beyond the structure through
//     every cell NOT covered by X. Any opponent tile the flood never reaches
//     is completely walled in by X and is captured.
//   - Territory: empty space the outside flood can't reach is a hole. If
//     every tile bordering the hole belongs to one player, it is theirs.
//
// Scoring: 1 point per tile owned (kite and dart alike), plus each owned
// hole in tile-equivalents: a hole with n real corners triangulates into
// n - 2 triangles, and a tile is two triangles, so it is worth (n - 2) / 2.
// ---------------------------------------------------------------------
const CELL = 3;

// Inside test with a small tolerance so adjacent tiles leave no cracks.
const pointInTriangle = (px, py, tri, tol) => {
  const [a, b, c] = tri;
  const area2 = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const sgn = area2 >= 0 ? 1 : -1;
  const edges = [[a, b], [b, c], [c, a]];
  for (const [p, q] of edges) {
    const ex = q.x - p.x, ey = q.y - p.y;
    const len = Math.hypot(ex, ey) || 1;
    const d = sgn * (ex * (py - p.y) - ey * (px - p.x)) / len;
    if (d < -tol) return false;
  }
  return true;
};

const buildGrid = (allTiles) => {
  const vertsList = allTiles.map(getVertices);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const vs of vertsList) {
    for (const v of vs) {
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
  }
  // Padding guarantees cell 0 (the corner) is always empty outside space.
  const pad = 3 * CELL;
  const x0 = Math.floor((minX - pad) / CELL) * CELL;
  const y0 = Math.floor((minY - pad) / CELL) * CELL;
  const w = Math.ceil((maxX + pad - x0) / CELL) + 1;
  const h = Math.ceil((maxY + pad - y0) / CELL) + 1;

  const owner = new Uint8Array(w * h);
  const tileAt = new Int16Array(w * h).fill(-1);

  allTiles.forEach((tile, t) => {
    const vs = vertsList[t];
    const tris = toTriangles(vs);
    const bx0 = Math.max(0, Math.floor((Math.min(...vs.map(v => v.x)) - x0) / CELL) - 1);
    const bx1 = Math.min(w - 1, Math.ceil((Math.max(...vs.map(v => v.x)) - x0) / CELL) + 1);
    const by0 = Math.max(0, Math.floor((Math.min(...vs.map(v => v.y)) - y0) / CELL) - 1);
    const by1 = Math.min(h - 1, Math.ceil((Math.max(...vs.map(v => v.y)) - y0) / CELL) + 1);

    for (let j = by0; j <= by1; j++) {
      for (let i = bx0; i <= bx1; i++) {
        const cx = x0 + (i + 0.5) * CELL;
        const cy = y0 + (j + 0.5) * CELL;
        if (tris.some(tr => pointInTriangle(cx, cy, tr, 0.75))) {
          owner[j * w + i] = tile.player;
          tileAt[j * w + i] = t;
        }
      }
    }
  });

  return { x0, y0, w, h, owner, tileAt };
};

// 4-connected flood fill from the corner cell through passable cells.
const floodFromCorner = (g, passable) => {
  const { w, h, owner } = g;
  const seen = new Uint8Array(w * h);
  const stack = [0];
  seen[0] = 1;
  const push = (n) => {
    if (!seen[n] && passable(owner[n])) {
      seen[n] = 1;
      stack.push(n);
    }
  };
  while (stack.length) {
    const idx = stack.pop();
    const x = idx % w, y = (idx / w) | 0;
    if (x > 0) push(idx - 1);
    if (x < w - 1) push(idx + 1);
    if (y > 0) push(idx - w);
    if (y < h - 1) push(idx + w);
  }
  return seen;
};

// Indices of tiles owned by the opponent of `capturer` that are completely
// walled in by `capturer`'s tiles (no path to the outside).
const findCaptured = (allTiles, capturer) => {
  const g = buildGrid(allTiles);
  const reach = floodFromCorner(g, (o) => o !== capturer);
  const hasCells = new Uint8Array(allTiles.length);
  const free = new Uint8Array(allTiles.length);

  for (let i = 0; i < g.tileAt.length; i++) {
    const t = g.tileAt[i];
    if (t < 0) continue;
    hasCells[t] = 1;
    if (reach[i]) free[t] = 1;
  }

  const ids = [];
  allTiles.forEach((tile, t) => {
    if (tile.player !== capturer && hasCells[t] && !free[t]) ids.push(t);
  });
  return ids;
};

// Applies captures after a move: the mover first, then the opponent (so a
// move that walls in the mover's own tiles counts against them). Repeats
// until stable, since a capture can complete another enclosure.
const resolveCaptures = (allTiles, mover) => {
  let current = allTiles;
  const captured = { 1: 0, 2: 0 };

  for (const capturer of [mover, mover === 1 ? 2 : 1]) {
    for (let iter = 0; iter < 10; iter++) {
      const ids = findCaptured(current, capturer);
      if (ids.length === 0) break;
      current = current.map((t, i) => (ids.includes(i) ? { ...t, player: capturer } : t));
      captured[capturer] += ids.length;
    }
  }
  return { tiles: current, captured };
};

// Number of real corners on a hole's boundary, from the tile edges that
// border it. Points where two boundary edges run in a straight line are not
// corners. (A point where the boundary touches itself counts as two.)
const countHoleCorners = (edges) => {
  const pts = [];
  const dirs = [];
  const indexOf = (p) => {
    let i = pts.findIndex(q => samePoint(p, q));
    if (i < 0) {
      pts.push(p);
      dirs.push([]);
      i = pts.length - 1;
    }
    return i;
  };

  for (const [a, b] of edges) {
    const ia = indexOf(a);
    const ib = indexOf(b);
    dirs[ia].push(normalize(b.x - a.x, b.y - a.y));
    dirs[ib].push(normalize(a.x - b.x, a.y - b.y));
  }

  let corners = 0;
  for (const d of dirs) {
    if (d.length === 2) {
      if (d[0].x * d[1].x + d[0].y * d[1].y > -0.999) corners += 1;
    } else {
      corners += Math.floor(d.length / 2);
    }
  }
  return corners;
};

// Enclosed empty holes, who owns them (bordered by one player only), and
// each player's territory score in tile-equivalents.
const computeTerritory = (allTiles) => {
  if (!allTiles.length) return null;
  const g = buildGrid(allTiles);
  const { x0, y0, w, h, owner } = g;
  const outside = floodFromCorner(g, (o) => o === 0);
  const holeOwner = new Uint8Array(w * h);
  const holeId = new Int16Array(w * h);
  const visited = new Uint8Array(w * h);
  const holes = [];

  for (let s = 0; s < w * h; s++) {
    if (owner[s] !== 0 || outside[s] || visited[s]) continue;

    const cells = [s];
    visited[s] = 1;
    const borderOwners = new Set();

    for (let k = 0; k < cells.length; k++) {
      const idx = cells[k];
      const x = idx % w, y = (idx / w) | 0;
      const neighbors = [];
      if (x > 0) neighbors.push(idx - 1);
      if (x < w - 1) neighbors.push(idx + 1);
      if (y > 0) neighbors.push(idx - w);
      if (y < h - 1) neighbors.push(idx + w);
      for (const n of neighbors) {
        if (owner[n] === 0) {
          if (!visited[n]) { visited[n] = 1; cells.push(n); }
        } else {
          borderOwners.add(owner[n]);
        }
      }
    }

    if (borderOwners.size === 1) {
      const p = [...borderOwners][0];
      holes.push({ owner: p, edges: [] });
      const id = holes.length; // ids start at 1
      for (const c of cells) {
        holeOwner[c] = p;
        holeId[c] = id;
      }
    }
  }

  // Attach each unshared tile edge to the hole it borders by sampling a
  // point just outside the edge, then score each hole from its corners.
  const holeScore = { 1: 0, 2: 0 };
  if (holes.length) {
    const vertsList = allTiles.map(getVertices);
    vertsList.forEach((vs, t) => {
      const c = centroidOf(vs);
      for (let e = 0; e < 4; e++) {
        const a = vs[e], b = vs[(e + 1) % 4];
        const shared = vertsList.some((os, j) => j !== t && os.some((p, k) => {
          const q = os[(k + 1) % 4];
          return (samePoint(a, p) && samePoint(b, q)) || (samePoint(a, q) && samePoint(b, p));
        }));
        if (shared) continue;

        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        let n = normalize(-(b.y - a.y), b.x - a.x);
        if (n.x * (mx - c.x) + n.y * (my - c.y) < 0) n = { x: -n.x, y: -n.y };

        const i = Math.floor((mx + n.x * 4 - x0) / CELL);
        const j = Math.floor((my + n.y * 4 - y0) / CELL);
        if (i < 0 || j < 0 || i >= w || j >= h) continue;
        const id = holeId[j * w + i];
        if (id > 0) holes[id - 1].edges.push([a, b]);
      }
    });

    for (const hole of holes) {
      const corners = countHoleCorners(hole.edges);
      holeScore[hole.owner] += Math.max(0, (corners - 2) / 2);
    }
  }

  return { ...g, holeOwner, holeScore };
};

const holeOwnerAt = (terr, x, y) => {
  if (!terr) return 0;
  const i = Math.floor((x - terr.x0) / CELL);
  const j = Math.floor((y - terr.y0) / CELL);
  if (i < 0 || j < 0 || i >= terr.w || j >= terr.h) return 0;
  return terr.holeOwner[j * terr.w + i];
};

// Does a tile polygon cover any part of the territory owned by `owner`?
const overlapsTerritory = (terr, verts, owner) => {
  if (!terr) return false;
  for (const tri of toTriangles(verts)) {
    const xs = tri.map(p => p.x), ys = tri.map(p => p.y);
    const maxX = Math.max(...xs), maxY = Math.max(...ys);
    for (let cx = Math.floor(Math.min(...xs) / CELL) * CELL + CELL / 2; cx <= maxX; cx += CELL) {
      for (let cy = Math.floor(Math.min(...ys) / CELL) * CELL + CELL / 2; cy <= maxY; cy += CELL) {
        if (pointInTriangle(cx, cy, tri, 0) && holeOwnerAt(terr, cx, cy) === owner) return true;
      }
    }
  }
  return false;
};

// ---------------------------------------------------------------------
// Placement rules (shared by the human player and the computer)
// ---------------------------------------------------------------------

// Playfield size (matches the canvas). Every tile vertex must stay inside it.
const BOARD_W = 800;
const BOARD_H = 600;

// True if any vertex lies outside the playfield (small rounding tolerance).
const isOutsidePlayfield = (verts) => {
  const EDGE_TOL = 0.5;
  return verts.some(v =>
    v.x < -EDGE_TOL || v.x > BOARD_W + EDGE_TOL ||
    v.y < -EDGE_TOL || v.y > BOARD_H + EDGE_TOL
  );
};

// Is `candidate` ({type, x, y, rotation}) a legal placement for `player`?
// `ignoreBounds` skips only the playfield test; it lets the preview show a
// snapped position that is blocked solely for being out of bounds.
const isLegalPlacement = (allTiles, terr, candidate, player, ignoreBounds = false) => {
  const candVerts = getVertices(candidate);

  // Keep every vertex inside the playfield
  if (!ignoreBounds && isOutsidePlayfield(candVerts)) return false;

  if (allTiles.length === 0) return true;

  // Reject real overlaps (positive-area intersection with any tile)
  for (const tile of allTiles) {
    if (tilesOverlap(candVerts, getVertices(tile))) return false;
  }

  // Must touch the existing structure, and every point where tiles meet
  // must agree in Penrose vertex color - the real matching rule.
  const { touches, colorsMatch } = checkVertexMatching(candidate, allTiles);
  if (!touches || !colorsMatch) return false;

  // Must be edge-to-edge: share a full edge, and no T-junctions.
  const { sharesEdge, tJunction } = checkEdgeContact(candidate, allTiles);
  if (!sharesEdge || tJunction) return false;

  // Enclosed territory owned by the opponent is off limits.
  const opponent = player === 1 ? 2 : 1;
  if (overlapsTerritory(terr, candVerts, opponent)) return false;

  return true;
};

// ---------------------------------------------------------------------
// Computer opponent
//
// Generates every legal move by laying each tile type, at each rotation,
// with one edge exactly on an open edge of the structure, then plays the
// move whose resulting position (after captures and territory) scores best
// for it. It looks one move ahead only.
// ---------------------------------------------------------------------

// Tile edges that are not shared with another tile (they border empty space).
const findOpenEdges = (allTiles) => {
  const vertsList = allTiles.map(getVertices);
  const open = [];
  vertsList.forEach((vs, t) => {
    for (let e = 0; e < 4; e++) {
      const a = vs[e], b = vs[(e + 1) % 4];
      const shared = vertsList.some((os, j) => j !== t && os.some((p, k) => {
        const q = os[(k + 1) % 4];
        return (samePoint(a, p) && samePoint(b, q)) || (samePoint(a, q) && samePoint(b, p));
      }));
      if (!shared) open.push({ a, b, label: EDGE_LENGTHS[e] });
    }
  });
  return open;
};

const generateMoves = (allTiles, terr, player) => {
  const open = findOpenEdges(allTiles);
  const seen = new Set();
  const moves = [];

  for (const type of ['kite', 'dart']) {
    for (let rot = 0; rot < 360; rot += 36) {
      const base = getVertices({ type, x: 0, y: 0, rotation: rot });
      for (const oe of open) {
        for (let k = 0; k < 4; k++) {
          if (EDGE_LENGTHS[k] !== oe.label) continue;
          const c1 = base[k], c2 = base[(k + 1) % 4];

          for (const [t1, t2] of [[oe.a, oe.b], [oe.b, oe.a]]) {
            const tx = t1.x - c1.x, ty = t1.y - c1.y;
            // Both endpoints must land on the open edge
            if (Math.hypot(c2.x + tx - t2.x, c2.y + ty - t2.y) > 2) continue;

            const key = `${type}|${rot}|${Math.round(tx)}|${Math.round(ty)}`;
            if (seen.has(key)) continue;
            seen.add(key);

            const cand = { type, x: tx, y: ty, rotation: rot };
            if (isLegalPlacement(allTiles, terr, cand, player)) moves.push(cand);
          }
        }
      }
    }
  }
  return moves;
};

// Number of the candidate's edges that would sit directly against a tile
// owned by `opp` (a mild reason to prefer blocking moves).
const edgesTouchingPlayer = (cand, allTiles, opp) => {
  const cv = getVertices(cand);
  let count = 0;
  for (const tile of allTiles) {
    if (tile.player !== opp) continue;
    const tv = getVertices(tile);
    for (let a = 0; a < 4; a++) {
      const a1 = cv[a], a2 = cv[(a + 1) % 4];
      for (let b = 0; b < 4; b++) {
        const b1 = tv[b], b2 = tv[(b + 1) % 4];
        if ((samePoint(a1, b1) && samePoint(a2, b2)) || (samePoint(a1, b2) && samePoint(a2, b1))) {
          count += 1;
        }
      }
    }
  }
  return count;
};

// Score difference (player minus opponent) after playing `cand`, with
// captures and territory applied, plus small tie-breakers that favor
// compact shapes and blocking the opponent.
const evaluateMove = (allTiles, cand, player) => {
  const opp = player === 1 ? 2 : 1;
  const newTile = { ...cand, player, id: allTiles.length };
  const { tiles: after } = resolveCaptures([...allTiles, newTile], player);
  const terr = computeTerritory(after);

  const pts = { 1: 0, 2: 0 };
  after.forEach(t => { pts[t.player] += 1; });
  pts[1] += terr.holeScore[1];
  pts[2] += terr.holeScore[2];

  let score = pts[player] - pts[opp];
  score += 0.05 * edgesTouchingPlayer(cand, allTiles, opp);
  score -= 0.02 * findOpenEdges(after).length;
  return score;
};

const chooseComputerMove = (allTiles, terr, player) => {
  // Opening on an empty board (the human skipped the first move)
  if (allTiles.length === 0) {
    return { type: 'kite', x: BOARD_W / 2, y: BOARD_H / 2, rotation: 0 };
  }

  let moves = generateMoves(allTiles, terr, player);
  if (moves.length === 0) return null;

  // Cap the work per turn: evaluate a random sample if there are many moves.
  if (moves.length > 150) {
    for (let i = moves.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [moves[i], moves[j]] = [moves[j], moves[i]];
    }
    moves = moves.slice(0, 150);
  }

  let best = null;
  let bestScore = -Infinity;
  for (const cand of moves) {
    const s = evaluateMove(allTiles, cand, player) + Math.random() * 0.01;
    if (s > bestScore) {
      bestScore = s;
      best = cand;
    }
  }
  return best;
};

const PenroseTerritoryGame = () => {
  const canvasRef = useRef(null);
  const [tiles, setTiles] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [selectedTileType, setSelectedTileType] = useState('kite');
  const [rotation, setRotation] = useState(0);
  const [hoveredPos, setHoveredPos] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [mode, setMode] = useState('ai'); // 'ai' (vs computer) or 'two'

  // In vs-computer mode the computer plays Player 2.
  const isComputerTurn = mode === 'ai' && currentPlayer === 2;
  const humanTurn = !isComputerTurn;
  const playerName = (p) => (mode === 'ai' && p === 2 ? 'Computer' : `Player ${p}`);

  // Enclosed empty areas and their owners, recomputed when tiles change.
  const [showSafety, setShowSafety] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Escape closes the How to Play screen
  useEffect(() => {
    if (!showHelp) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowHelp(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHelp]);
  const [lastMove, setLastMove] = useState(null); // most recent move and what it captured

  const territory = useMemo(() => computeTerritory(tiles), [tiles]);

  // Safety view: the same flood fill the capture test uses. For each tile,
  // mark its cells 1 if they connect to open space without crossing the
  // opponent's tiles (safe), or 2 if they are walled in.
  const safety = useMemo(() => {
    if (!showSafety || tiles.length === 0) return null;
    const g = buildGrid(tiles);
    const reachAvoidingRed = floodFromCorner(g, (o) => o !== 2);
    const reachAvoidingBlue = floodFromCorner(g, (o) => o !== 1);
    const cells = new Uint8Array(g.w * g.h);
    for (let i = 0; i < cells.length; i++) {
      const o = g.owner[i];
      if (!o) continue;
      const reachable = o === 1 ? reachAvoidingRed[i] : reachAvoidingBlue[i];
      cells[i] = reachable ? 1 : 2;
    }
    return { x0: g.x0, y0: g.y0, w: g.w, cells };
  }, [tiles, showSafety]);

  // Score = 1 point per tile owned (captured tiles included, kites and
  // darts alike) plus enclosed territory in tile-equivalents.
  const scores = useMemo(() => {
    const pts = { 1: 0, 2: 0 };
    tiles.forEach(t => { pts[t.player] += 1; });
    if (territory) {
      pts[1] += territory.holeScore[1];
      pts[2] += territory.holeScore[2];
    }
    return { player1: pts[1], player2: pts[2] };
  }, [tiles, territory]);

  // The board starts empty: Player 1 opens with any tile, at any rotation
  // and position on the board.
  const initGame = () => {
    setTiles([]);
    setGameStarted(true);
    setCurrentPlayer(1);
    setStatusMsg('Place the first tile anywhere on the board.');
  };

  const resetGame = () => {
    setTiles([]);
    setGameStarted(false);
    setCurrentPlayer(1);
    setRotation(0);
    setHoveredPos(null);
    setStatusMsg('');
  };

  const drawTile = (ctx, tile) => {
    const vertices = getVertices(tile);

    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    vertices.forEach(v => ctx.lineTo(v.x, v.y));
    ctx.closePath();

    ctx.fillStyle = tile.player === 1
      ? 'rgba(59, 130, 246, 0.6)'
      : 'rgba(239, 68, 68, 0.6)';
    ctx.fill();

    ctx.strokeStyle = tile.player === 1 ? '#1e40af' : '#991b1b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Small tick marks along each edge (visual texture only)
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    for (let i = 0; i < vertices.length; i++) {
      const v1 = vertices[i];
      const v2 = vertices[(i + 1) % vertices.length];
      const midX = (v1.x + v2.x) / 2;
      const midY = (v1.y + v2.y) / 2;
      const dx = v2.y - v1.y;
      const dy = v1.x - v2.x;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      ctx.beginPath();
      ctx.moveTo(midX - dx / len * 3, midY - dy / len * 3);
      ctx.lineTo(midX + dx / len * 3, midY + dy / len * 3);
      ctx.stroke();
    }

    // Vertex colors (the Penrose matching labels): filled dots with a
    // contrasting ring so both black and white read on any tile fill.
    const colors = getVertexColors(tile);
    vertices.forEach((v, i) => {
      const isBlack = colors[i] === 'black';
      ctx.beginPath();
      ctx.arc(v.x, v.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = isBlack ? '#000' : '#fff';
      ctx.fill();
      ctx.strokeStyle = isBlack ? '#fff' : '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  };

  // Legality of placing the currently selected tile at (x, y) this turn.
  const isValidPlacement = (x, y) =>
    isLegalPlacement(
      tiles,
      territory,
      { type: selectedTileType, x, y, rotation },
      currentPlayer
    );

  // Snaps the tile so one of its edges lands exactly on an existing tile's
  // edge (no gaps). Tries every equal-length edge pairing, keeps only those
  // that put the tile on the opposite side of the shared edge and pass the
  // full placement rules, and picks the smallest movement.
  const SNAP_RADIUS = 45;
  const getSnappedPosition = (x, y) => {
    if (tiles.length === 0) return { x, y, snapped: false };

    const cv = getVertices({ type: selectedTileType, x, y, rotation });
    const cc = centroidOf(cv);
    let best = null;

    for (const tile of tiles) {
      const tv = getVertices(tile);
      const tc = centroidOf(tv);

      for (let a = 0; a < 4; a++) {
        const a1 = tv[a], a2 = tv[(a + 1) % 4];

        for (let k = 0; k < 4; k++) {
          if (EDGE_LENGTHS[k] !== EDGE_LENGTHS[a]) continue;
          const c1 = cv[k], c2 = cv[(k + 1) % 4];

          // The edges can coincide in either direction
          for (const [t1, t2] of [[a1, a2], [a2, a1]]) {
            const tx = t1.x - c1.x, ty = t1.y - c1.y;

            // Both endpoints must land on the target edge (edge is parallel)
            if (Math.hypot(c2.x + tx - t2.x, c2.y + ty - t2.y) > 2) continue;

            const dist = Math.hypot(tx, ty);
            if (dist > SNAP_RADIUS) continue;
            if (best && dist >= best.dist) continue;

            // Tiles must sit on opposite sides of the shared edge
            const ex = a2.x - a1.x, ey = a2.y - a1.y;
            const sideExisting = ex * (tc.y - a1.y) - ey * (tc.x - a1.x);
            const sideCandidate = ex * (cc.y + ty - a1.y) - ey * (cc.x + tx - a1.x);
            if (sideExisting * sideCandidate >= 0) continue;

            // A snap position that fails only the playfield test is still
            // shown (so the red border warning can appear), but any
            // in-bounds legal snap always wins over it.
            const nx = x + tx, ny = y + ty;
            const oob = isOutsidePlayfield(cv.map(v => ({ x: v.x + tx, y: v.y + ty })));
            const legal = isLegalPlacement(
              tiles,
              territory,
              { type: selectedTileType, x: nx, y: ny, rotation },
              currentPlayer,
              oob
            );
            if (!legal) continue;

            const rank = dist + (oob ? 1000 : 0);
            if (best && rank >= best.dist) continue;

            best = { x: nx, y: ny, dist: rank, snapped: true };
          }
        }
      }
    }

    return best || { x, y, snapped: false };
  };

  const drawPreview = (ctx, rawX, rawY) => {
    const { x, y } = getSnappedPosition(rawX, rawY);
    const previewTile = {
      type: selectedTileType,
      x,
      y,
      rotation,
      player: currentPlayer
    };

    ctx.save();
    ctx.globalAlpha = 0.55;
    drawTile(ctx, previewTile);
    ctx.restore();

    const valid = isValidPlacement(x, y);
    const vertices = getVertices(previewTile);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    vertices.forEach(v => ctx.lineTo(v.x, v.y));
    ctx.closePath();
    ctx.strokeStyle = valid ? '#16a34a' : '#dc2626';
    ctx.lineWidth = 3;
    ctx.setLineDash(valid ? [] : [6, 4]);
    ctx.stroke();
    ctx.restore();

    // Red border around the whole playfield while the previewed tile has a
    // vertex outside it.
    if (isOutsidePlayfield(vertices)) {
      ctx.save();
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, BOARD_W - 8, BOARD_H - 8);
      ctx.restore();
    }
  };

  // Places a tile for `player`, resolves captures, and passes the turn.
  // Used by both the human (via placeTile) and the computer.
  const applyPlacement = (cand, player) => {
    const newTile = {
      type: cand.type,
      x: cand.x,
      y: cand.y,
      rotation: cand.rotation,
      player,
      id: tiles.length
    };

    const opponent = player === 1 ? 2 : 1;
    const { tiles: resolved, captured } = resolveCaptures([...tiles, newTile], player);

    const plural = (n) => `${n} tile${n === 1 ? '' : 's'}`;
    const messages = [];
    if (captured[player] > 0) {
      messages.push(`${playerName(player)} captured ${plural(captured[player])}!`);
    }
    if (captured[opponent] > 0) {
      messages.push(`${playerName(opponent)} captured ${plural(captured[opponent])}!`);
    }

    // What this move changed: tiles that flipped owner, and empty space that
    // newly became someone's territory (compared by position, since the two
    // territory grids can have different extents).
    const flippedIds = resolved
      .filter((t, i) => i < tiles.length && t.player !== tiles[i].player)
      .map(t => t.id);
    const territoryAfter = computeTerritory(resolved);
    const capturedCells = new Set();
    if (territoryAfter) {
      const { x0, y0, w, holeOwner } = territoryAfter;
      for (let idx = 0; idx < holeOwner.length; idx++) {
        const o = holeOwner[idx];
        if (!o) continue;
        const cx = x0 + ((idx % w) + 0.5) * CELL;
        const cy = y0 + (((idx / w) | 0) + 0.5) * CELL;
        if (holeOwnerAt(territory, cx, cy) !== o) {
          capturedCells.add(`${Math.floor(cx / CELL)},${Math.floor(cy / CELL)}`);
        }
      }
    }

    setTiles(resolved);
    setLastMove({
      tileId: newTile.id,
      regionIds: [newTile.id, ...flippedIds],
      capturedCells
    });
    setStatusMsg(messages.join(' '));
    setCurrentPlayer(opponent);
    setRotation(0);
  };

  const placeTile = (x, y) => {
    if (!humanTurn || !isValidPlacement(x, y)) return;
    applyPlacement({ type: selectedTileType, x, y, rotation }, currentPlayer);
  };

  // The computer's turn: think briefly (so the board updates first), then
  // play the best move found, or pass if it has none.
  useEffect(() => {
    if (!gameStarted || !isComputerTurn) return;

    setStatusMsg('Computer is thinking…');
    const timer = setTimeout(() => {
      const move = chooseComputerMove(tiles, territory, 2);
      if (!move) {
        setStatusMsg('Computer has no legal move and passes.');
        setCurrentPlayer(1);
        return;
      }
      applyPlacement(move, 2);
    }, 600);

    return () => clearTimeout(timer);
  }, [gameStarted, isComputerTurn, tiles, territory]);

  useEffect(() => {
    if (!gameStarted) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setRotation(prev => (prev - 36 + 360) % 360);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setRotation(prev => (prev + 36) % 360);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStarted]);

  // Mouse wheel over the board rotates the tile: up = clockwise. A mouse
  // wheel notch arrives as one large delta and turns one step. A trackpad
  // swipe arrives as a stream of small deltas; it turns one step for every
  // TRACKPAD_STEP pixels scrolled, so a longer swipe turns further. Any
  // leftover partial step is dropped after a short pause in the stream.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameStarted) return;

    const WHEEL_NOTCH = 50;
    const TRACKPAD_STEP = 50; // lower = faster trackpad rotation
    const SWIPE_END_MS = 150;
    const swipe = { total: 0, timer: null };

    const rotateBy = (dy) => setRotation(prev => (prev + (dy < 0 ? 36 : -36) + 360) % 360);

    const handleWheel = (e) => {
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      if (Math.abs(dy) >= WHEEL_NOTCH) {
        rotateBy(dy);
        return;
      }

      clearTimeout(swipe.timer);
      swipe.timer = setTimeout(() => { swipe.total = 0; }, SWIPE_END_MS);
      swipe.total += dy;
      while (Math.abs(swipe.total) >= TRACKPAD_STEP) {
        rotateBy(swipe.total);
        swipe.total -= Math.sign(swipe.total) * TRACKPAD_STEP;
      }
    };

    // Non-passive so preventDefault can stop the page from scrolling
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      clearTimeout(swipe.timer);
    };
  }, [gameStarted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid background
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < canvas.width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // Tint enclosed territory in its owner's color (under the tiles)
    if (territory) {
      const { x0, y0, w, holeOwner } = territory;
      for (let idx = 0; idx < holeOwner.length; idx++) {
        const o = holeOwner[idx];
        if (!o) continue;
        ctx.fillStyle = o === 1 ? 'rgba(59, 130, 246, 0.22)' : 'rgba(239, 68, 68, 0.22)';
        ctx.fillRect(x0 + (idx % w) * CELL, y0 + ((idx / w) | 0) * CELL, CELL + 0.5, CELL + 0.5);
      }
    }

    tiles.forEach(tile => drawTile(ctx, tile));

    // Highlight edges shared between two tiles (valid connections) in green
    const connectedEdges = findConnectedEdges(tiles);
    ctx.save();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    connectedEdges.forEach(seg => {
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();
    });
    ctx.restore();

    // Safety view overlay: yellow = this part of a tile connects to open
    // space without crossing the opponent's tiles; purple = walled in.
    if (safety) {
      const { x0, y0, w, cells } = safety;
      for (let idx = 0; idx < cells.length; idx++) {
        const c = cells[idx];
        if (!c) continue;
        ctx.fillStyle = c === 1 ? 'rgba(250, 204, 21, 0.55)' : 'rgba(168, 85, 247, 0.75)';
        ctx.fillRect(x0 + (idx % w) * CELL, y0 + ((idx / w) | 0) * CELL, CELL, CELL);
      }
    }

    // Mark the last move: a glowing gold outline around the whole area it
    // affected (the new tile, every tile it flipped, and any empty space it
    // newly enclosed), plus a star on the tile just played. Drawn on top so
    // it stays visible.
    const lastTile = lastMove ? tiles.find(t => t.id === lastMove.tileId) : null;
    if (lastTile) {
      const regionSet = new Set(lastMove.regionIds);
      const vertsList = tiles.map(getVertices);
      const segs = [];

      // An edge is on the outline when the region is on one side only.
      tiles.forEach((tile, t) => {
        const vs = vertsList[t];
        const tc = centroidOf(vs);
        const inside = regionSet.has(tile.id);
        for (let e = 0; e < 4; e++) {
          const a = vs[e], b = vs[(e + 1) % 4];

          const neighbor = vertsList.findIndex((os, j) => j !== t && os.some((p, k) => {
            const q = os[(k + 1) % 4];
            return (samePoint(a, p) && samePoint(b, q)) || (samePoint(a, q) && samePoint(b, p));
          }));

          let across;
          if (neighbor >= 0) {
            across = regionSet.has(tiles[neighbor].id);
          } else {
            // Empty side: is it space this move newly captured?
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            let n = normalize(-(b.y - a.y), b.x - a.x);
            if (n.x * (mx - tc.x) + n.y * (my - tc.y) < 0) n = { x: -n.x, y: -n.y };
            const key = `${Math.floor((mx + n.x * 4) / CELL)},${Math.floor((my + n.y * 4) / CELL)}`;
            across = lastMove.capturedCells.has(key);
          }

          if (inside !== across) segs.push([a, b]);
        }
      });

      ctx.save();
      ctx.beginPath();
      segs.forEach(([a, b]) => {
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      });
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();

      const c = centroidOf(vertsList[tiles.indexOf(lastTile)]);
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
    }

    if (hoveredPos && gameStarted && humanTurn) {
      drawPreview(ctx, hoveredPos.x, hoveredPos.y);
    }
  }, [tiles, territory, safety, lastMove, hoveredPos, rotation, selectedTileType, gameStarted, humanTurn]);

  // Touch devices have no hover, so the preview follows a finger drag and
  // is lifted above the fingertip so it isn't hidden under it.
  const TOUCH_OFFSET_Y = 60;
  const isTouchDevice = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;

  // Convert a pointer event's CSS pixel position into the canvas's internal
  // drawing coordinate space, since the canvas is styled with "w-full" and
  // can be stretched relative to its 800x600 drawing buffer.
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touch = e.pointerType === 'touch';
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY - (touch ? TOUCH_OFFSET_Y : 0),
      touch
    };
  };

  const handlePointerDown = (e) => {
    if (!gameStarted || !humanTurn) return;
    if (e.pointerType === 'touch') e.currentTarget.setPointerCapture?.(e.pointerId);
    setHoveredPos(getCanvasCoords(e));
  };

  const handlePointerMove = (e) => {
    if (!gameStarted || !humanTurn) return;
    setHoveredPos(getCanvasCoords(e));
  };

  // Mouse: click places immediately. Touch: lifting the finger leaves the
  // preview in place so it can be adjusted, and the Place button confirms.
  const handlePointerUp = (e) => {
    if (!gameStarted || !humanTurn || e.pointerType !== 'mouse' || e.button !== 0) return;
    const { x, y } = getCanvasCoords(e);
    const pos = getSnappedPosition(x, y);
    placeTile(pos.x, pos.y);
  };

  // Right-click rotates clockwise (Shift + right-click counter-clockwise)
  // instead of opening the browser menu.
  const handleContextMenu = (e) => {
    e.preventDefault();
    if (!gameStarted) return;
    setRotation(prev => (prev + (e.shiftKey ? -36 : 36) + 360) % 360);
  };

  const handlePointerLeave = (e) => {
    if (e.pointerType === 'mouse') setHoveredPos(null);
  };

  const snappedPreview = hoveredPos && humanTurn ? getSnappedPosition(hoveredPos.x, hoveredPos.y) : null;
  const previewValid = snappedPreview ? isValidPlacement(snappedPreview.x, snappedPreview.y) : false;

  const placeAtPreview = () => {
    if (!snappedPreview || !previewValid) return;
    placeTile(snappedPreview.x, snappedPreview.y);
    setHoveredPos(null);
  };

  // The layout fills exactly the visible window (dvh tracks mobile browser
  // toolbars): header, scores and controls take their natural height and the
  // board scales to the largest 4:3 size that fits in the rest.
  return (
    <div className="w-full h-dvh overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center p-2 sm:p-3">
      <div className="max-w-6xl w-full h-full flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Penrogo</h1>
          <button
            onClick={() => setShowHelp(true)}
            className="text-slate-300 hover:text-white flex items-center gap-1 text-sm"
          >
            <CircleHelp size={20} />
            How to Play
          </button>
        </div>

        <div className="bg-slate-800 rounded-lg px-3 py-2 flex justify-around items-center">
          <div className="text-center">
            <div className="text-blue-400 text-xl sm:text-2xl font-bold">{scores.player1}</div>
            <div className="text-slate-400 text-xs sm:text-sm">{playerName(1)}</div>
          </div>

          <div className="text-center">
            <div className={`text-base sm:text-xl font-bold ${currentPlayer === 1 ? 'text-blue-400' : 'text-red-400'}`}>
              {gameStarted ? `${playerName(currentPlayer)}'s Turn` : 'Press Start'}
            </div>
            {statusMsg && (
              <div className="text-yellow-300 text-xs sm:text-sm">{statusMsg}</div>
            )}
          </div>

          <div className="text-center">
            <div className="text-red-400 text-xl sm:text-2xl font-bold">{scores.player2}</div>
            <div className="text-slate-400 text-xs sm:text-sm">{playerName(2)}</div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-2 flex gap-2 sm:gap-3 items-center justify-center flex-wrap">
          {!gameStarted ? (
            <>
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('two')}
                  className={`px-4 py-3 rounded-lg font-semibold ${
                    mode === 'two' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  2 Players
                </button>
                <button
                  onClick={() => setMode('ai')}
                  className={`px-4 py-3 rounded-lg font-semibold ${
                    mode === 'ai' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  vs Computer
                </button>
              </div>
              <button
                onClick={initGame}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-semibold"
              >
                <Play size={20} />
                Start Game
              </button>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedTileType('kite')}
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    selectedTileType === 'kite'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  Kite
                </button>
                <button
                  onClick={() => setSelectedTileType('dart')}
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    selectedTileType === 'dart'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  Dart
                </button>
              </div>

              {isTouchDevice ? (
                <>
                  <button
                    onClick={() => setRotation((rotation - 36 + 360) % 360)}
                    aria-label="Rotate counter-clockwise"
                    className="bg-slate-700 active:bg-slate-600 text-white px-5 py-3 rounded-lg flex items-center gap-2"
                  >
                    <RotateCw size={22} style={{ transform: 'scaleX(-1)' }} />
                  </button>

                  <button
                    onClick={() => setRotation((rotation + 36) % 360)}
                    aria-label="Rotate clockwise"
                    className="bg-slate-700 active:bg-slate-600 text-white px-5 py-3 rounded-lg flex items-center gap-2"
                  >
                    <RotateCw size={22} />
                    <span className="text-sm">{rotation}°</span>
                  </button>
                </>
              ) : (
                <div className="text-slate-300 text-sm flex items-center gap-2">
                  <RotateCw size={18} />
                  <span>Rotate: scroll wheel, right-click, or ←/→</span>
                  <span className="text-white font-semibold w-10">{rotation}°</span>
                </div>
              )}

              {isTouchDevice && (
                <button
                  onClick={placeAtPreview}
                  disabled={!previewValid}
                  className={`px-6 py-3 rounded-lg font-semibold text-white ${
                    previewValid ? 'bg-green-600 active:bg-green-700' : 'bg-slate-600 opacity-50'
                  }`}
                >
                  Place
                </button>
              )}

              <button
                onClick={() => setCurrentPlayer(currentPlayer === 1 ? 2 : 1)}
                disabled={!humanTurn}
                className={`bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 ${
                  humanTurn ? '' : 'opacity-50'
                }`}
              >
                <SkipForward size={20} />
                Skip Turn
              </button>

              <button
                onClick={resetGame}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <RotateCcw size={18} />
                New Game
              </button>

              <button
                onClick={() => setShowSafety(s => !s)}
                className={`px-4 py-2 rounded-lg font-semibold ${
                  showSafety ? 'bg-yellow-500 text-slate-900' : 'bg-slate-700 text-slate-300'
                }`}
              >
                Safety view
              </button>

              {showSafety && (
                <div className="w-full text-center text-sm text-slate-300">
                  <span className="text-yellow-300 font-semibold">Yellow</span> = connected to open
                  space (safe). <span className="text-purple-300 font-semibold">Purple</span> = walled
                  in (would be captured). A tile is only captured if none of it is yellow.
                </div>
              )}
            </>
          )}
        </div>

        {/* Size container: the canvas width is the smaller of the full
            width and the width a 4:3 board would have at the full height. */}
        <div className="flex-1 min-h-0 flex items-start justify-center" style={{ containerType: 'size' }}>
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onContextMenu={handleContextMenu}
            style={{ touchAction: 'none', width: 'min(100cqw, 100cqh * 4 / 3)' }}
            className="h-auto bg-white rounded shadow-2xl cursor-crosshair"
          />
        </div>
      </div>

      {showHelp && (
        <div
          className="fixed inset-0 z-10 bg-slate-900/95 overflow-y-auto p-4"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="max-w-2xl mx-auto bg-slate-800 rounded-lg p-4 sm:p-6 text-slate-300 text-sm sm:text-base"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl sm:text-2xl font-bold text-white">How to Play</h2>
              <button
                onClick={() => setShowHelp(false)}
                aria-label="Close"
                className="text-slate-300 hover:text-white p-1"
              >
                <X size={24} />
              </button>
            </div>
            <p className="mb-3">Penrose tiling meets Go: build, surround, capture.</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Choose 2 Players or vs Computer (the computer plays red), then press Start</li>
              <li>Player 1 places the first tile anywhere; then players alternate placing kite or dart tiles edge-to-edge</li>
              <li>
                {isTouchDevice
                  ? 'Rotate with the buttons (36° steps)'
                  : 'Rotate with the scroll wheel over the board, right-click (Shift + right-click for the other way), or Left/Right arrow keys (36° steps)'}
              </li>
              <li>Green preview outline = valid Penrose-matched placement; red dashed = blocked</li>
              <li>Surround an area completely and it is yours: enemy tiles inside flip to your color</li>
              <li>Empty space you fully enclose is tinted as your territory; opponents can't build there</li>
              <li>Score: 1 point per tile you own (kite or dart), plus enclosed territory counted in tile-equivalents</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default PenroseTerritoryGame;