# Penrogo: Specification

Status: reflects the game as currently implemented (single React component, `PenroseTerritoryGame`).

## 1. Overview

A two-player, turn-based tile placement game played with Penrose kite and dart tiles. Players alternate adding tiles to a growing structure. Every placement must obey Penrose's matching rules, so the structure stays a valid (locally) Penrose arrangement. Penrogo (Penrose + Go) is played by two people or against a computer opponent. Surrounding an area captures it, Go-style, and the player with the most tiles plus enclosed territory scores highest.

## 2. Technology

| Item | Choice |
|---|---|
| Framework | React 19 (functional component, hooks) |
| Build | Vite, TypeScript (the component itself is untyped; `npm run typecheck` is separate from the build) |
| Rendering | HTML5 Canvas 2D, 800 x 600 internal resolution, scaled to container width |
| Styling | Tailwind CSS v4 utility classes |
| Icons | lucide-react (`RotateCw`, `RotateCcw`, `Play`, `SkipForward`) |
| Persistence | None (all state in memory) |

## 3. Tile Geometry

Edge lengths: long `L = 60` px (`TILE_SIZE`), short `S = L / phi` (about 37.1 px), where `phi = (1 + sqrt 5) / 2`.

Both tiles are quadrilaterals with vertices listed in perimeter order. Coordinates below are for rotation 0, before centering, with the symmetry axis along +x. Edge order for both tiles is **long, short, short, long**.

### Kite (convex)

| Vertex | Local position | Interior angle | Vertex color |
|---|---|---|---|
| O | (0, 0) | 72 deg | black |
| B | L(cos 36, sin 36) | 72 deg | white |
| C | (L, 0) | 144 deg | black |
| D | L(cos 36, -sin 36) | 72 deg | white |

Edges: O-B long, B-C short, C-D short, D-O long.

### Dart (concave)

| Vertex | Local position | Interior angle | Vertex color |
|---|---|---|---|
| M | (0, 0) | 72 deg | white |
| N | L(cos 36, sin 36) | 36 deg | black |
| A' | (L/phi, 0) | 216 deg (reflex) | white |
| N' | L(cos 36, -sin 36) | 36 deg | black |

Edges: M-N long, N-A' short, A'-N' short, N'-M long.

### Placement transform

- Vertices are rotated by the tile's rotation (multiples of 36 deg).
- The vertex set is then translated so its **centroid** (average of the four vertices) sits at the tile's `(x, y)` position. This keeps the tile centered under the cursor.
- Each tile is split into two triangles along the vertex 0 to vertex 2 diagonal (its symmetry axis) for overlap testing. This handles the dart's concavity.

Both shapes were verified by law-of-cosines closure and angle checks (angles sum to 360 deg; dart reflex angle 216 deg).

## 4. Matching Rules

A candidate placement is legal only if all of the following hold. Checks apply to every existing tile the candidate touches.

1. **Edge-to-edge contact.** The candidate must share at least one full edge (both endpoints coincide, within 4 px) with an existing tile. A single-vertex contact is not enough, and no candidate corner may land in the interior of an existing tile's edge (or vice versa), i.e. no T-junctions. (The very first tile is exempt.)
2. **Vertex color agreement.** Wherever a candidate vertex coincides with an existing vertex, the two colors must match. This is Penrose's vertex-coloring matching rule: any point shared by several tiles must be the same color on each.
3. **No overlap.** The candidate's triangles must not intersect any existing tile's triangles. Separating-axis test with a 1.5 px tolerance, so touching edges and vertices are allowed.

4. **Inside the playfield.** Every vertex of the candidate must lie within the 800 x 600 board (0.5 px tolerance). This applies to the computer's moves as well, and to the opening tile. While the previewed tile has a vertex outside the board, a red border is drawn around the playfield (the preview is also shown in the blocked red dashed style, and clicking does nothing).

Source for the coloring rule: arXiv 1104.3811 (kite: 144 deg vertex and its opposite black, other two white; dart: 216 deg vertex and its opposite white, other two black).

## 4b. Capture and Territory

Enclosure is detected Go-style by rasterizing the board onto a 3 px grid (each cell records which player's tile covers it, or empty) and flood-filling.

**Capture.** After each placement, for a player X: flood outward from beyond the structure through every cell not covered by X's tiles. Any opponent tile the flood never reaches is completely walled in by X and flips to X. Empty gaps count as part of the enclosed region, so a group whose only opening is an enclosed gap is captured as well. This repeats until nothing more flips, since a capture can complete another enclosure. Order: the mover is checked first, then the opponent, so a move that walls in the mover's own tiles works against the mover.

**Territory.** Empty space that cannot be reached from outside is a hole. If every tile bordering a hole belongs to one player, the hole is that player's territory. It is tinted in their color, and the opponent may not place a tile that overlaps it. Holes bordered by both players are neutral.

**Score.** One point per tile currently owned (a kite and a dart are worth the same, and captured tiles count for the new owner), plus each owned hole in tile-equivalents. A hole with n real corners (points where two boundary edges run in a straight line are not corners) triangulates into n - 2 triangles, and a tile is two triangles, so the hole is worth (n - 2) / 2. A hole shaped exactly like a kite or dart is worth 1, the same as filling it. Scores can therefore be whole numbers or halves.

Both checks are recomputed from the tile list after every placement (no stored territory state).

## 5. Snapping

While placing, the tile snaps so one of its edges lies exactly on an existing edge (no gaps).

- Consider every pairing of a candidate edge and an existing edge with the same length label, in both directions.
- A pairing is a candidate snap if translating the tile puts both endpoints on the target edge (tolerance 2 px).
- Reject if the translation exceeds the snap radius (45 px).
- Reject if the candidate would sit on the same side of the shared edge as the existing tile (centroid side test).
- Reject if the snapped position fails any rule in section 4.
- Choose the remaining candidate with the smallest translation.
- If none remain, the tile follows the cursor unsnapped and is (almost always) illegal.

## 6. Game Flow

Before starting, choose a mode: **2 Players** (two humans share the device) or **vs Computer** (default; the human is Player 1 in blue, the computer is Player 2 in red). The mode is fixed once the game starts; **New Game** returns to the mode screen.

1. Press **Start Game**. The board starts empty and Player 1 (the human in vs Computer mode) places the opening tile: kite or dart, any rotation, anywhere inside the board. Player 2 moves next. If Player 1 skips instead, the computer opens with a kite (rotation 0) at the board center.
2. On a turn the current player chooses **Kite** or **Dart**, rotates it, positions it, and places it.
3. After a successful placement, turns alternate and the rotation resets to 0.
4. **Skip Turn** passes to the other player.
5. Illegal placements are ignored silently (the preview shows why, see section 7).

After a placement, captures are resolved (section 4b) and a status message names any capture. Scoring counts tiles and territory (section 4b). There is no end-of-game detection yet.

## 6b. Computer Opponent

The computer plays Player 2 in vs Computer mode. It uses the same placement rules as the human (shared `isLegalPlacement`).

1. **Move generation.** For each tile type and each of the 10 rotations, lay one of the tile's edges exactly onto each open edge of the structure (an edge not shared with another tile), keeping only legal placements.
2. **Evaluation.** Simulate each move including captures and territory, and take the score difference (computer minus human). Small tie-breakers favor compact shapes (fewer open edges, weight 0.02 each) and moves that sit against the opponent's tiles (0.05 per touching edge), plus a tiny random term to vary play.
3. **Selection.** Play the best-scoring move. If there are more than 150 legal moves, a random sample of 150 is evaluated to keep each turn fast.
4. **Timing.** The computer waits 0.6 s (showing "Computer is thinking...") before moving. Human input is ignored during its turn. If it has no legal move it passes.

It looks one move ahead only, so it will not anticipate an opponent's capture on the following turn.

## 7. Visual Feedback

| Element | Behavior |
|---|---|
| Tile fill | Player 1 blue, Player 2 red, semi-transparent, with a dark outline in the player's shade |
| Edge ticks | Small tick marks at each edge midpoint (decorative only; not part of the rules) |
| Vertex colors | Each vertex is drawn as a 5 px dot: black dot with white ring, or white dot with black ring, showing the matching color. Shown on placed tiles and the preview |
| Preview tile | Drawn at 55% opacity at the snapped position |
| Preview outline | Solid green if placement is legal, dashed red if blocked |
| Connected edges | Edges shared by two placed tiles, with colors agreeing at both endpoints, are stroked green (4 px, round caps) |
| Grid | Light 40 px background grid |
| Last move | A glowing gold outline drawn on top of everything else, around the whole area the most recent move (by either player, including the computer) affected: the tile just placed, every tile it flipped, and any empty space it newly enclosed as territory. Interior edges between those parts are not outlined, so a capture reads as one gold region. A gold star marks the tile just placed. With no capture it is just that tile's outline |
| Safety view | Optional toggle. Colors each tile's cells by the capture test: yellow = connects to open space without crossing the opponent's tiles (safe), purple = walled in. A tile is captured only if none of it is yellow. Uses the same flood fill as capture, so it shows the exact escape route |

## 8. Controls

### Desktop

| Input | Action |
|---|---|
| Mouse move | Move the preview (snaps to legal edges) |
| Left click | Place the tile |
| Scroll wheel over the board | Rotate 36 deg: up = clockwise, down = counter-clockwise. One step per wheel notch, or one per trackpad swipe (a swipe ends after a 150 ms pause). The page does not scroll while the pointer is over the board |
| Right click | Rotate 36 deg clockwise (Shift + right click: counter-clockwise); the browser menu is suppressed on the board |
| Left / Right arrow | Rotate 36 deg counter-clockwise / clockwise |
| Rotation hint | Replaces the rotate buttons: lists the rotation controls and shows the current angle |
| Kite / Dart buttons | Choose tile type |

### Touch (iPhone and other touch devices)

| Input | Action |
|---|---|
| Touch and drag on board | Move the preview, lifted 60 canvas units above the fingertip |
| Lift finger | Preview stays in place (adjustable) |
| **Place** button | Confirm placement; disabled while the preview is illegal |
| Rotate buttons | Large tap targets, clockwise button also shows current angle. Shown only on touch devices (`navigator.maxTouchPoints > 0`); desktop gets the rotation hint instead |

Implementation notes: pointer events (`pointerdown/move/up/leave`), `touch-action: none` on the canvas, and pointer coordinates scaled from CSS pixels to the 800 x 600 canvas space. The page scrolls (`min-h-screen`) rather than locking to one screen height.

## 9. Known Limitations and Not Yet Implemented

- **Capture edge cases.** Enclosure uses 4-connected flood fill on a 3 px grid, so a region open to the outside only through a single touching corner counts as enclosed. There is no ko-style repetition rule, and territory is not required to be fillable by legal tiles.
- **End of game.** No detection of "no valid moves remain", no win condition.
- **Rule completeness.** The rules combine vertex coloring with an edge-direction/length check. They have not been proven to prevent every dead-end configuration, and vertex-only contacts are not snapped (only edge-to-edge snapping exists).
- **Performance.** Connected-edge detection and placement checks are O(n^2) over placed tiles per render; fine for dozens of tiles, not for hundreds.
- **No undo or save/load.** The computer opponent looks only one move ahead (section 6b).
- **Mobile.** Touch support has not been tested on a physical device; the 60-unit finger offset may need tuning.

## 10. Possible Next Steps

1. Move-availability detection and game end.
2. "Show valid placements" hint mode.
3. Undo, a stronger computer opponent, sound and animation.
