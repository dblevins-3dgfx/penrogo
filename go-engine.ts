// Go rules on a tile graph, and the computer player.
//
// A board is a list of tiles, each with `neighbors` (the tiles sharing an
// edge with it). `stones[i]` is 0 for an empty tile, or the player (1 or 2)
// who holds it.

import type { GraphTile, Player, Score, Stone } from './types';

// The outcome of trying a move: the new position and how many stones it
// captured, or why it is illegal.
export type MoveResult =
  | { ok: true; stones: Stone[]; captured: number }
  | { ok: false; reason: string };

export const opponentOf = (p: Player): Player => (p === 1 ? 2 : 1);

// ---------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------

// The connected group of same-colored stones containing `start`, and its
// liberties (empty tiles adjacent to the group).
export const groupAt = (tiles: GraphTile[], stones: Stone[], start: number) => {
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

export const positionKey = (stones: Stone[]) => stones.join('');

// Plays `player` on tile `id`. Opponent groups left without liberties are
// removed; a move that leaves its own group without liberties (suicide) or
// repeats an earlier position (superko) is illegal.
export const playMove = (tiles: GraphTile[], stones: Stone[], history: Set<string>, id: number, player: Player): MoveResult => {
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

// The connected empty region containing empty tile `start`, and the
// players whose stones border it. Marks the region's tiles in `seen`.
const emptyRegion = (tiles: GraphTile[], stones: Stone[], start: number, seen: Set<number>) => {
  const region = [start];
  seen.add(start);
  const borders = new Set<Player>();
  for (let k = 0; k < region.length; k++) {
    for (const n of tiles[region[k]].neighbors) {
      const s = stones[n];
      if (s !== 0) borders.add(s);
      else if (!seen.has(n)) { seen.add(n); region.push(n); }
    }
  }
  return { region, borders };
};

// Area scoring: each player's stones plus the empty regions bordered only
// by that player's stones. Also returns the owner of every empty tile.
export const scoreArea = (tiles: GraphTile[], stones: Stone[]) => {
  const owner: Stone[] = Array.from({ length: tiles.length }, () => 0);
  const score: Score = { 1: 0, 2: 0 };
  stones.forEach(s => { if (s) score[s] += 1; });

  const seen = new Set<number>();
  for (let i = 0; i < tiles.length; i++) {
    if (stones[i] !== 0 || seen.has(i)) continue;
    const { region, borders } = emptyRegion(tiles, stones, i, seen);
    if (borders.size === 1) {
      const p = [...borders][0];
      score[p] += region.length;
      for (const r of region) owner[r] = p;
    }
  }
  return { score, owner };
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

  constructor(start: Int32Array, list: Int32Array, n: number) {
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

  load(stones: Stone[]) {
    this.emptyCount = 0;
    for (let p = 0; p < this.n; p++) {
      this.stones[p] = stones[p];
      if (stones[p] === 0) this.addEmpty(p);
    }
    this.ko = -1;
  }

  copyFrom(b: FastBoard) {
    this.stones.set(b.stones);
    this.empty.set(b.empty);
    this.emptyPos.set(b.emptyPos);
    this.emptyCount = b.emptyCount;
    this.ko = b.ko;
  }

  addEmpty(p: number) {
    this.emptyPos[p] = this.emptyCount;
    this.empty[this.emptyCount++] = p;
  }

  removeEmpty(p: number) {
    const i = this.emptyPos[p];
    const last = this.empty[--this.emptyCount];
    this.empty[i] = last;
    this.emptyPos[last] = i;
  }

  // Scans the group at p: returns its liberty count, leaves its members in
  // stack[0..groupSize) and one liberty in lastLib.
  group(p: number) {
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
  libs2(p: number) {
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
        if (c === 0 && libMark[r] !== s) {
          libMark[r] = s;
          this.lastLib = r;
          if (++libs >= 2) return 2;
        } else if (c === color && mark[r] !== s) {
          mark[r] = s;
          stack[size++] = r;
        }
      }
    }
    return libs;
  }

  isOwnEye(p: number, c: number) {
    for (let j = this.start[p]; j < this.start[p + 1]; j++) {
      if (this.stones[this.list[j]] !== c) return false;
    }
    return true;
  }

  // Legal under the playout rules (no suicide, simple ko).
  legal(p: number, c: number) {
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
  libsAfter(p: number, c: number) {
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
        if (tc === 0 && lib2[t] !== s) {
          lib2[t] = s;
          if (++libs >= 2) return 2;
        } else if (tc === c && mark[t] !== s) {
          mark[t] = s;
          stack[size++] = t;
        }
      }
    }
    return libs;
  }

  // Plays a legal move and returns the number of stones captured.
  play(p: number, c: number) {
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
const playoutMove = (b: FastBoard, c: number, last: number, rand: () => number) => {
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

  constructor(move: number, player: number, priorWins: number) {
    this.move = move;
    this.player = player;
    this.n = PRIOR_N;
    this.w = priorWins;
    this.an = PRIOR_N;
    this.aw = priorWins;
  }
}

// Prior wins out of PRIOR_N for a candidate move, from simple tactics.
const priorFor = (b: FastBoard, p: number, c: number, last: number) => {
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

// Candidate moves exclude own-eye fills. At the root (the move actually
// played) they also exclude self-atari (leaving its own group with one
// liberty) unless it captures: early in a game, random playouts barely
// notice losing a stone, so the search can't be trusted to reject these.
// Deeper in the tree self-atari stays allowed, so the search can still
// consider sacrifices by either side.
const expand = (node: Node, b: FastBoard, c: number, last: number, rootFilter: ((p: number) => boolean) | null) => {
  const children: Node[] = [];
  node.children = children;
  for (let k = 0; k < b.emptyCount; k++) {
    const p = b.empty[k];
    if (b.isOwnEye(p, c) || !b.legal(p, c)) continue;
    if (rootFilter && (b.libsAfter(p, c) < 2 || !rootFilter(p))) continue;
    children.push(new Node(p, c, priorFor(b, p, c, last)));
  }
  if (children.length === 0) children.push(new Node(PASS, c, 5));
};

// The child to walk into: the best by UCT + RAVE. Only called on an
// expanded node, which always has at least one child (a pass if nothing else).
const selectChild = (node: Node): Node => {
  const logN = Math.log(node.n + 1);
  const children = node.children as Node[];
  let best = children[0];
  let bestV = -Infinity;
  for (const ch of children) {
    const beta = Math.sqrt(RAVE_K / (3 * ch.n + RAVE_K));
    const v = (1 - beta) * (ch.w / ch.n) + beta * (ch.aw / ch.an) + UCT_C * Math.sqrt(logN / ch.n);
    if (v > bestV) { bestV = v; best = ch; }
  }
  return best;
};

// A playout's result for `player`: 1 for a win, 0.5 for a tie (winner 0).
const resultFor = (player: number, winner: number) => (winner === player ? 1 : winner === 0 ? 0.5 : 0);

// RAVE: credits each child move that its player went on to play later in
// the same playout (firstColor holds who played each tile first).
const creditRave = (children: Node[], firstColor: Int8Array, winner: number) => {
  for (const ch of children) {
    if (ch.move < 0 || firstColor[ch.move] !== ch.player) continue;
    ch.an++;
    ch.aw += resultFor(ch.player, winner);
  }
};

// Returns { move: tile id or null to pass, playouts, winRate }.
export const chooseMctsMove = (
  tiles: GraphTile[], stones: Stone[], history: Set<string>, player: Player, opponentPassed: boolean,
  options: { timeMs?: number, maxPlayouts?: number } = {}
): { move: number | null; playouts: number; winRate: number } => {
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
  const path: Node[] = [];
  const rand = Math.random;

  // One iteration's walk: the moves played so far (seqMove and seqColor up
  // to len), whose turn it is, the last move and the consecutive passes.
  const walk = { c: player as number, last: -1, len: 0, passes: 0 };

  // Adds a move (or a pass) to the sequence and hands over the turn
  const record = (move: number) => {
    seqMove[walk.len] = move;
    seqColor[walk.len++] = walk.c;
    walk.last = move;
    walk.c = 3 - walk.c;
  };

  // Plays a move (or passes), counting consecutive passes
  const step = (move: number) => {
    if (move < 0) walk.passes++;
    else {
      walk.passes = 0;
      b.play(move, walk.c);
    }
    record(move);
  };

  // Walks down the tree by UCT + RAVE to a leaf (or two passes)
  const descend = () => {
    let node = root;
    while (node.children) {
      node = selectChild(node);
      path.push(node);
      step(node.move);
      if (walk.passes >= 2) break;
    }
    return node;
  };

  // Grows the tree by one node below a leaf visited often enough. A pass
  // here is not counted toward ending the playout.
  const grow = (node: Node) => {
    if (walk.passes >= 2 || node.n <= PRIOR_N) return;
    expand(node, b, walk.c, walk.last, null);
    const child = selectChild(node);
    path.push(child);
    if (child.move !== PASS) b.play(child.move, walk.c);
    record(child.move);
  };

  // Finishes the game with a fast playout
  const playout = () => {
    const limit = seqMove.length - 1;
    while (walk.passes < 2 && walk.len < limit) step(playoutMove(b, walk.c, walk.last, rand));
  };

  // Updates the path (UCT) and sibling moves played later (RAVE)
  const backup = (winner: number) => {
    firstColor.fill(0);
    for (let d = walk.len - 1; d >= path.length - 1; d--) {
      if (seqMove[d] >= 0) firstColor[seqMove[d]] = seqColor[d];
    }
    for (let d = path.length - 1; d >= 0; d--) {
      const nd = path[d];
      nd.n++;
      nd.w += resultFor(nd.player, winner);
      if (nd.children) creditRave(nd.children, firstColor, winner);
      if (d > 0 && seqMove[d - 1] >= 0) firstColor[seqMove[d - 1]] = seqColor[d - 1];
    }
  };

  const t0 = performance.now();
  let playouts = 0;
  while (playouts < maxPlayouts && performance.now() - t0 < timeMs) {
    b.copyFrom(rootBoard);
    path.length = 0;
    path.push(root);
    walk.c = player;
    walk.last = -1;
    walk.len = 0;
    walk.passes = 0;

    grow(descend());
    playout();

    const diff = b.scoreDiff();
    backup(diff > 0 ? 1 : diff < 0 ? 2 : 0);
    playouts++;
  }

  const children = root.children as Node[];
  let best = children[0];
  for (const ch of children) {
    if (ch.n > best.n) best = ch;
  }
  return {
    move: best.move === PASS ? null : best.move,
    playouts,
    winRate: best.w / best.n
  };
};
