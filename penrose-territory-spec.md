# Penrogo (Penrose Go): Specification

Status: experimental branch `penrose-go`. Reflects the game as currently implemented (`PenroseTerritoryGame` in `penrose-territory.tsx`, board generation in `penrose-board.ts`).

## 1. Overview

Go, played on a Penrose tiling of kites and darts. The first move places a single tile anywhere on the board; a complete Penrose tiling is then generated around it. After that, players take turns claiming any empty tile. Groups are captured Go-style when they run out of liberties, and the game is scored by area.

This replaces the original free-placement game (on `main`), where players built the tiling themselves and could easily leave gaps that no tile could fill. Here every empty space is already a valid tile, so untileable gaps cannot occur.

## 2. Technology

| Item | Choice |
|---|---|
| Framework | React 19 (functional component, hooks) |
| Build | Vite, TypeScript (dev server on port 5174 in this worktree; `main` uses 5173) |
| Rendering | HTML5 Canvas 2D, 800 x 600 internal resolution, scaled to the largest 4:3 size that fits the window |
| Styling | Tailwind CSS v4 utility classes |
| Icons | lucide-react (`RotateCw`, `RotateCcw`, `Play`, `SkipForward`, `CircleHelp`, `X`) |
| Persistence | None (all state in memory) |

## 3. Tiles

Kite and dart, long edge `L = 60` px, short edge `L / phi`. Vertex order: kite [O (72 deg), B, C (144 deg), D], dart [M (72 deg), N, A' (216 deg), N']; vertex 0 to vertex 2 is the axis of symmetry. The opening tile is positioned by its centroid and rotated in 36 deg steps.

## 4. Board Generation (`penrose-board.ts`)

1. **Patch.** Start from a sun of five kites (ten Robinson half-kites) and subdivide 7 times. Each half-kite becomes two half-kites and a half-dart; each half-dart becomes a half-kite and a half-dart; every piece shrinks by phi. Mirror halves sharing an axis are joined into whole tiles (about 4,900 tiles). The orientation of each piece in the subdivision rules was found by exhaustive search as the only choice that keeps Penrose's vertex coloring consistent and pairs every half with its mirror.
2. **Alignment.** The patch is rotated and translated so the tile of the opening's type nearest the patch center coincides exactly with the opening tile.
3. **Clipping.** Only tiles lying entirely inside the 800 x 600 board are kept (about 220).
4. **Adjacency.** Two tiles are neighbors when they share a full edge. Interior tiles have exactly four neighbors, like points on a Go board.

Verified: every tile has exact kite or dart geometry, there are no vertex-coloring conflicts, the kite to dart ratio is about phi, and the opening tile matches the placement exactly.

## 5. Rules

- **Opening.** Player 1 places a kite or dart anywhere on the board (every vertex inside it), at any rotation. The board is generated around it and it becomes Player 1's first stone. **Skip Opening** hands the opening to the other player; if the computer opens, it places a kite at the board center.
- **Moves.** Players alternate claiming any empty tile, or pass.
- **Capture.** After a move, any opponent group (connected tiles of one color) with no liberties (empty neighboring tiles) is removed, and the tiles become empty.
- **Suicide** is illegal: a move may not leave its own group without liberties (after captures).
- **Ko** uses positional superko: a move may not recreate any earlier board position.
- **End.** Two consecutive passes end the game.
- **Score** (area scoring): tiles held plus empty regions bordered only by that player's tiles. No komi yet. During play the scoreboard shows tiles held and total captures; at the end it shows the area score and tints each player's surrounded empty regions.

## 6. Computer Opponent

Plays Player 2 in vs Computer mode, one move ahead:

- **Candidates.** Every legal move except filling its own eye (an empty tile whose neighbors are all its own stones).
- **Evaluation.** Stones held (+1 each, -1 per opponent stone), plus influence: each empty tile within 3 steps counts +1 or -1 for the player whose stones are nearer. Own groups left in atari (one liberty) cost twice their size; opponent groups in atari add half their size. A tiny random term varies play.
- **Passing.** It passes when no move improves on the current evaluation, or when the human has just passed and it is ahead by area score.
- **Timing.** Moves after a 0.4 s pause ("Computer is thinking...").

## 7. Visual Feedback

| Element | Behavior |
|---|---|
| Empty tile | Light gray fill, thin gray outline |
| Stones | Player 1 blue, Player 2 red, with a darker outline |
| Hover | The tile under the pointer is filled in the current player's color with a green outline if claiming it is legal, or a dashed red outline if not |
| Opening preview | The tile follows the pointer; a red border surrounds the board while it would stick out |
| Last move | Glowing gold outline and a gold star |
| Game end | Surrounded empty regions tinted in their owner's color |
| Status line | Captures, passes, illegal-move reasons, and the final result |

## 8. Controls and Layout

Same as `main`: mouse click to place; the scroll wheel, right-click (Shift for the other way) or Left/Right arrows rotate the opening tile on desktop; on touch devices the preview follows a finger drag (lifted 60 canvas units above it), rotate buttons are shown, and **Place** confirms. The page fills the visible window without scrolling, and the rules are on a **How to Play** overlay. Rotation controls appear only during the opening.

## 9. Known Limitations

- The computer looks only one move ahead and understands life and death only through atari; it can be tricked into losing groups.
- No komi, handicap, undo, or save/load.
- Clipping to the rectangular board leaves ragged edges with some tiles having only 1 to 3 neighbors.
- Not yet tested on a physical touch device.
