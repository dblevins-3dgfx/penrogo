// Go rules on a tile graph, and the computer players.
//
// A board is a list of tiles, each with `neighbors` (the tiles sharing an
// edge with it). `stones[i]` is 0 for an empty tile, or the player (1 or 2)
// who holds it.

export const opponentOf = (p) => (p === 1 ? 2 : 1);

// ---------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------

// The connected group of same-colored stones containing `start`, and its
// liberties (empty tiles adjacent to the group).
export const groupAt = (tiles, stones, start) => {
  const color = stones[start];
  const members = [start];
  const seen = new Set(members);
  const liberties = new Set<number>();
  for (let k = 0; k < members.length; k++) {
    for (const n of tiles[members[k]].neighbors) {
      if (stones[n] === 0) liberties.add(n);
      else if (stones[n] === color && !seen.has(n)) {
        seen.add(n);
        members.push(n);
      }
    }
  }
  return { members, liberties };
};

export const positionKey = (stones) => stones.join('');

// Plays `player` on tile `id`. Opponent groups left without liberties are
// removed; a move that leaves its own group without liberties (suicide) or
// repeats an earlier position (superko) is illegal.
export const playMove = (tiles, stones, history, id, player) => {
  if (stones[id] !== 0) return { ok: false, reason: 'That tile is taken.' };

  const next = stones.slice();
  next[id] = player;
  const opp = opponentOf(player);
  let captured = 0;
  for (const n of tiles[id].neighbors) {
    if (next[n] !== opp) continue;
    const g = groupAt(tiles, next, n);
    if (g.liberties.size === 0) {
      for (const m of g.members) next[m] = 0;
      captured += g.members.length;
    }
  }

  if (groupAt(tiles, next, id).liberties.size === 0) {
    return { ok: false, reason: 'Illegal: that tile would have no liberties (suicide).' };
  }
  if (history.has(positionKey(next))) {
    return { ok: false, reason: 'Illegal: that would repeat an earlier position (ko).' };
  }
  return { ok: true, stones: next, captured };
};

// Area scoring: each player's stones plus the empty regions bordered only
// by that player's stones. Also returns the owner of every empty tile.
export const scoreArea = (tiles, stones) => {
  const owner = new Array(tiles.length).fill(0);
  const score = { 1: 0, 2: 0 };
  stones.forEach(s => { if (s) score[s] += 1; });

  const seen = new Set();
  for (let i = 0; i < tiles.length; i++) {
    if (stones[i] !== 0 || seen.has(i)) continue;
    const region = [i];
    seen.add(i);
    const borders = new Set<number>();
    for (let k = 0; k < region.length; k++) {
      for (const n of tiles[region[k]].neighbors) {
        if (stones[n] === 0) {
          if (!seen.has(n)) { seen.add(n); region.push(n); }
        } else {
          borders.add(stones[n]);
        }
      }
    }
    if (borders.size === 1) {
      const p = [...borders][0];
      score[p] += region.length;
      for (const r of region) owner[r] = p;
    }
  }
  return { score, owner };
};

const isOwnEye = (tiles, stones, id, player) =>
  tiles[id].neighbors.every(n => stones[n] === player);

// ---------------------------------------------------------------------
// Heuristic player (the original computer opponent, kept as a baseline)
//
// Looks one move ahead, scoring stones plus an influence estimate (empty
// tiles within 3 steps count for the nearer player) and penalizing its own
// groups left in atari.
// ---------------------------------------------------------------------

const INFLUENCE_RANGE = 3;

const evaluate = (tiles, stones, player) => {
  const opp = opponentOf(player);
  const dist = { 1: new Array(tiles.length).fill(Infinity), 2: new Array(tiles.length).fill(Infinity) };
  for (const p of [1, 2]) {
    const queue = [];
    stones.forEach((s, i) => { if (s === p) { dist[p][i] = 0; queue.push(i); } });
    for (let k = 0; k < queue.length; k++) {
      const i = queue[k];
      if (dist[p][i] >= INFLUENCE_RANGE) continue;
      for (const n of tiles[i].neighbors) {
        if (stones[n] === 0 && dist[p][n] === Infinity) {
          dist[p][n] = dist[p][i] + 1;
          queue.push(n);
        }
      }
    }
  }

  let value = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (stones[i] === player) value += 1;
    else if (stones[i] === opp) value -= 1;
    else if (dist[player][i] < dist[opp][i]) value += 1;
    else if (dist[opp][i] < dist[player][i]) value -= 1;
  }

  const seen = new Set();
  for (let i = 0; i < tiles.length; i++) {
    if (stones[i] === 0 || seen.has(i)) continue;
    const g = groupAt(tiles, stones, i);
    g.members.forEach(m => seen.add(m));
    if (g.liberties.size === 1) {
      value += stones[i] === player ? -2 * g.members.length : 0.5 * g.members.length;
    }
  }
  return value;
};

// Returns a tile id to play, or null to pass.
export const chooseHeuristicMove = (tiles, stones, history, player, opponentPassed) => {
  if (opponentPassed) {
    const { score } = scoreArea(tiles, stones);
    if (score[player] > score[opponentOf(player)]) return null;
  }

  const current = evaluate(tiles, stones, player);
  let best = null;
  let bestValue = -Infinity;
  for (let id = 0; id < tiles.length; id++) {
    if (stones[id] !== 0 || isOwnEye(tiles, stones, id, player)) continue;
    const r = playMove(tiles, stones, history, id, player);
    if (!r.ok) continue;
    const v = evaluate(tiles, r.stones, player) + Math.random() * 0.01;
    if (v > bestValue) {
      bestValue = v;
      best = id;
    }
  }

  if (best === null || bestValue <= current + 0.05) return null;
  return best;
};

// ---------------------------------------------------------------------
// Monte Carlo tree search player
//
// Builds a search tree of moves; each iteration walks down the tree, then
// finishes the game with a fast "playout" (quick, mostly random moves
// guided by simple tactics: capture, escape atari, avoid self-atari, never
// fill own eyes) and records who won. Statistics use UCT plus RAVE (moves
// are also credited when played later in the same playout), which learns
// quickly from few playouts. Moves get prior values from the same tactics.
// It plays the most-visited move at the root.
// ---------------------------------------------------------------------

// Board with typed arrays and allocation-free group scans, for playouts.
class FastBoard {
  n: number;
  start: Int32Array;
  list: Int32Array;
  stones: Int8Array;
  empty: Int32Array;
  emptyPos: Int32Array;
  emptyCount = 0;
  ko = -1;
  mark: Int32Array;
  libMark: Int32Array;
  lib2: Int32Array;
  stamp = 0;
  stack: Int32Array;
  groupSize = 0;
  lastLib = -1;

  constructor(start, list, n) {
    this.n = n;
    this.start = start;
    this.list = list;
    this.stones = new Int8Array(n);
    this.empty = new Int32Array(n);
    this.emptyPos = new Int32Array(n);
    this.mark = new Int32Array(n);
    this.libMark = new Int32Array(n);
    this.lib2 = new Int32Array(n);
    this.stack = new Int32Array(n);
  }

  load(stones) {
    this.emptyCount = 0;
    for (let p = 0; p < this.n; p++) {
      this.stones[p] = stones[p];
      if (stones[p] === 0) this.addEmpty(p);
    }
    this.ko = -1;
  }

  copyFrom(b) {
    this.stones.set(b.stones);
    this.empty.set(b.empty);
    this.emptyPos.set(b.emptyPos);
    this.emptyCount = b.emptyCount;
    this.ko = b.ko;
  }

  addEmpty(p) {
    this.emptyPos[p] = this.emptyCount;
    this.empty[this.emptyCount++] = p;
  }

  removeEmpty(p) {
    const i = this.emptyPos[p];
    const last = this.empty[--this.emptyCount];
    this.empty[i] = last;
    this.emptyPos[last] = i;
  }

  // Scans the group at p: returns its liberty count, leaves its members in
  // stack[0..groupSize) and one liberty in lastLib.
  group(p) {
    const { start, list, stones, mark, libMark, stack } = this;
    const color = stones[p];
    const s = ++this.stamp;
    let size = 0;
    let libs = 0;
    stack[size++] = p;
    mark[p] = s;
    for (let k = 0; k < size; k++) {
      const q = stack[k];
      for (let j = start[q]; j < start[q + 1]; j++) {
        const r = list[j];
        const c = stones[r];
        if (c === 0) {
          if (libMark[r] !== s) { libMark[r] = s; libs++; this.lastLib = r; }
        } else if (c === color && mark[r] !== s) {
          mark[r] = s;
          stack[size++] = r;
        }
      }
    }
    this.groupSize = size;
    return libs;
  }

  // Like group(), but stops as soon as it finds 2 liberties: returns 0, 1
  // or 2 (meaning "2 or more"), with one liberty in lastLib.
  libs2(p) {
    const { start, list, stones, mark, libMark, stack } = this;
    const color = stones[p];
    const s = ++this.stamp;
    let size = 0;
    let libs = 0;
    stack[size++] = p;
    mark[p] = s;
    for (let k = 0; k < size; k++) {
      const q = stack[k];
      for (let j = start[q]; j < start[q + 1]; j++) {
        const r = list[j];
        const c = stones[r];
        if (c === 0) {
          if (libMark[r] !== s) {
            libMark[r] = s;
            this.lastLib = r;
            if (++libs >= 2) return 2;
          }
        } else if (c === color && mark[r] !== s) {
          mark[r] = s;
          stack[size++] = r;
        }
      }
    }
    return libs;
  }

  isOwnEye(p, c) {
    for (let j = this.start[p]; j < this.start[p + 1]; j++) {
      if (this.stones[this.list[j]] !== c) return false;
    }
    return true;
  }

  // Legal under the playout rules (no suicide, simple ko).
  legal(p, c) {
    const { start, list, stones } = this;
    if (stones[p] !== 0 || p === this.ko) return false;
    for (let j = start[p]; j < start[p + 1]; j++) {
      if (stones[list[j]] === 0) return true;
    }
    const opp = 3 - c;
    for (let j = start[p]; j < start[p + 1]; j++) {
      const r = list[j];
      if (stones[r] === c && this.libs2(r) > 1) return true;
      if (stones[r] === opp && this.libs2(r) === 1) return true;
    }
    return false;
  }

  // Liberties the stone at p would have after playing there, capped at 2.
  // A capture always counts as 2. Scans the joined own groups only until
  // two liberties (other than p) are found.
  libsAfter(p, c) {
    const { start, list, stones, lib2, mark, stack } = this;
    const opp = 3 - c;
    for (let j = start[p]; j < start[p + 1]; j++) {
      const r = list[j];
      if (stones[r] === opp && this.libs2(r) === 1) return 2;
    }
    const s = ++this.stamp;
    lib2[p] = s;
    mark[p] = s;
    let libs = 0;
    let size = 0;
    stack[size++] = p;
    for (let k = 0; k < size; k++) {
      const q = stack[k];
      for (let i = start[q]; i < start[q + 1]; i++) {
        const t = list[i];
        const tc = stones[t];
        if (tc === 0) {
          if (lib2[t] !== s) {
            lib2[t] = s;
            if (++libs >= 2) return 2;
          }
        } else if (tc === c && mark[t] !== s) {
          mark[t] = s;
          stack[size++] = t;
        }
      }
    }
    return libs;
  }

  // Plays a legal move and returns the number of stones captured.
  play(p, c) {
    const { start, list, stones, stack } = this;
    const opp = 3 - c;
    this.removeEmpty(p);
    stones[p] = c;
    let captured = 0;
    let capturedAt = -1;
    for (let j = start[p]; j < start[p + 1]; j++) {
      const r = list[j];
      if (stones[r] !== opp || this.libs2(r) !== 0) continue;
      this.group(r);
      for (let k = 0; k < this.groupSize; k++) {
        const m = stack[k];
        stones[m] = 0;
        this.addEmpty(m);
      }
      captured += this.groupSize;
      capturedAt = r;
    }
    this.ko = -1;
    if (captured === 1 && this.group(p) === 1 && this.groupSize === 1) this.ko = capturedAt;
    return captured;
  }

  // Area score difference (player 1 minus player 2) at the end of a
  // playout: stones plus empty tiles whose neighbors are all one color.
  scoreDiff() {
    const { start, list, stones, n } = this;
    let diff = 0;
    for (let p = 0; p < n; p++) {
      const s = stones[p];
      if (s === 1) diff++;
      else if (s === 2) diff--;
      else {
        let seen = 0;
        for (let j = start[p]; j < start[p + 1]; j++) seen |= stones[list[j]];
        if (seen === 1) diff++;
        else if (seen === 2) diff--;
      }
    }
    return diff;
  }
}

// Playout policy: capture or escape around the last move, else a random
// legal move that neither fills an own eye nor puts itself in atari.
const playoutMove = (b, c, last, rand) => {
  if (last >= 0 && b.stones[last] !== 0) {
    // Capture the stone just played if it is in atari
    if (b.libs2(last) === 1) {
      const lib = b.lastLib;
      if (b.legal(lib, c)) return lib;
    }
    // Escape own groups next to it that are now in atari
    for (let j = b.start[last]; j < b.start[last + 1]; j++) {
      const r = b.list[j];
      if (b.stones[r] !== c || b.libs2(r) !== 1) continue;
      const lib = b.lastLib;
      if (b.legal(lib, c) && b.libsAfter(lib, c) >= 2) return lib;
    }
  }

  let count = b.emptyCount;
  while (count > 0) {
    const i = Math.floor(rand() * count);
    const p = b.empty[i];
    if (!b.isOwnEye(p, c) && b.legal(p, c) && b.libsAfter(p, c) >= 2) return p;
    // Move the rejected tile out of the sampling window
    const q = b.empty[count - 1];
    b.empty[i] = q;
    b.emptyPos[q] = i;
    b.empty[count - 1] = p;
    b.emptyPos[p] = count - 1;
    count--;
  }
  return -1;
};

const PASS = -1;
const PRIOR_N = 10;
const RAVE_K = 600;
const UCT_C = 0.15;

class Node {
  move: number;
  player: number; // who played `move`
  children: Node[] | null = null;
  n: number;
  w: number;
  an: number;
  aw: number;

  constructor(move, player, priorWins) {
    this.move = move;
    this.player = player;
    this.n = PRIOR_N;
    this.w = priorWins;
    this.an = PRIOR_N;
    this.aw = priorWins;
  }
}

// Prior wins out of PRIOR_N for a candidate move, from simple tactics.
const priorFor = (b, p, c, last) => {
  const opp = 3 - c;
  let prior = 5;
  for (let j = b.start[p]; j < b.start[p + 1]; j++) {
    const r = b.list[j];
    if (b.stones[r] === opp && b.libs2(r) === 1) prior = Math.max(prior, 9);
    else if (b.stones[r] === c && b.libs2(r) === 1) prior = Math.max(prior, 7);
    if (r === last) prior = Math.max(prior, 6);
  }
  if (b.libsAfter(p, c) < 2) prior = 1;
  return prior;
};

const expand = (node, b, c, last, rootFilter) => {
  node.children = [];
  for (let k = 0; k < b.emptyCount; k++) {
    const p = b.empty[k];
    if (b.isOwnEye(p, c) || !b.legal(p, c)) continue;
    if (rootFilter && !rootFilter(p)) continue;
    node.children.push(new Node(p, c, priorFor(b, p, c, last)));
  }
  if (node.children.length === 0) node.children.push(new Node(PASS, c, 5));
};

const selectChild = (node) => {
  const logN = Math.log(node.n + 1);
  let best = null;
  let bestV = -Infinity;
  for (const ch of node.children) {
    const beta = Math.sqrt(RAVE_K / (3 * ch.n + RAVE_K));
    const v = (1 - beta) * (ch.w / ch.n) + beta * (ch.aw / ch.an) + UCT_C * Math.sqrt(logN / ch.n);
    if (v > bestV) { bestV = v; best = ch; }
  }
  return best;
};

// Returns { move: tile id or null to pass, playouts, winRate }.
export const chooseMctsMove = (tiles, stones, history, player, opponentPassed, options: { timeMs?: number, maxPlayouts?: number } = {}) => {
  const { timeMs = 1500, maxPlayouts = Infinity } = options;

  if (opponentPassed) {
    const { score } = scoreArea(tiles, stones);
    if (score[player] > score[opponentOf(player)]) return { move: null, playouts: 0, winRate: 1 };
  }

  // Neighbor lists as flat arrays
  const n = tiles.length;
  const start = new Int32Array(n + 1);
  tiles.forEach((t, i) => { start[i + 1] = start[i] + t.neighbors.length; });
  const list = new Int32Array(start[n]);
  tiles.forEach((t, i) => t.neighbors.forEach((q, k) => { list[start[i] + k] = q; }));

  const rootBoard = new FastBoard(start, list, n);
  rootBoard.load(stones);
  const b = new FastBoard(start, list, n);

  // At the root only, enforce the full rules (superko)
  const root = new Node(PASS, opponentOf(player), 5);
  expand(root, rootBoard, player, -1, (p) => playMove(tiles, stones, history, p, player).ok);

  const seqMove = new Int32Array(4 * n + 16);
  const seqColor = new Int8Array(4 * n + 16);
  const firstColor = new Int8Array(n);
  const path = [];
  const rand = Math.random;
  const t0 = performance.now();
  let playouts = 0;

  while (playouts < maxPlayouts && performance.now() - t0 < timeMs) {
    b.copyFrom(rootBoard);
    path.length = 0;
    path.push(root);
    let node = root;
    let c = player;
    let last = -1;
    let len = 0;
    let passes = 0;

    // Walk down the tree
    while (node.children) {
      node = selectChild(node);
      path.push(node);
      if (node.move === PASS) passes++;
      else {
        passes = 0;
        b.play(node.move, c);
      }
      seqMove[len] = node.move;
      seqColor[len++] = c;
      last = node.move;
      c = 3 - c;
      if (passes >= 2) break;
    }

    // Grow the tree by one node
    if (passes < 2 && node.n > PRIOR_N) {
      expand(node, b, c, last, null);
      node = selectChild(node);
      path.push(node);
      if (node.move !== PASS) b.play(node.move, c);
      seqMove[len] = node.move;
      seqColor[len++] = c;
      last = node.move;
      c = 3 - c;
    }

    // Finish the game with a playout
    const limit = seqMove.length - 1;
    while (passes < 2 && len < limit) {
      const p = playoutMove(b, c, last, rand);
      if (p < 0) passes++;
      else {
        passes = 0;
        b.play(p, c);
      }
      seqMove[len] = p;
      seqColor[len++] = c;
      last = p;
      c = 3 - c;
    }

    const diff = b.scoreDiff();
    const winner = diff > 0 ? 1 : diff < 0 ? 2 : 0;
    playouts++;

    // Update the path (UCT) and sibling moves played later (RAVE)
    firstColor.fill(0);
    for (let d = len - 1; d >= path.length - 1; d--) {
      if (seqMove[d] >= 0) firstColor[seqMove[d]] = seqColor[d];
    }
    for (let d = path.length - 1; d >= 0; d--) {
      const nd = path[d];
      nd.n++;
      if (winner === nd.player) nd.w++;
      else if (winner === 0) nd.w += 0.5;
      if (nd.children) {
        for (const ch of nd.children) {
          if (ch.move >= 0 && firstColor[ch.move] === ch.player) {
            ch.an++;
            if (winner === ch.player) ch.aw++;
            else if (winner === 0) ch.aw += 0.5;
          }
        }
      }
      if (d > 0 && seqMove[d - 1] >= 0) firstColor[seqMove[d - 1]] = seqColor[d - 1];
    }
  }

  let best = null;
  for (const ch of root.children) {
    if (!best || ch.n > best.n) best = ch;
  }
  return {
    move: best.move === PASS ? null : best.move,
    playouts,
    winRate: best.w / best.n
  };
};
