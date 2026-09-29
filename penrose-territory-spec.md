# Penrogo (Penrose Go): Specification

Status: reflects the game as currently implemented (`PenroseTerritoryGame` in `penrose-territory.tsx`, board generation in `penrose-board.ts`, rules and computer players in `go-engine.ts`).

## 1. Overview

Go, played on a Penrose tiling of kites and darts. The first move places a single tile anywhere on the board; a complete Penrose tiling is then generated around it. After that, players take turns claiming any empty tile. Groups are captured Go-style when they run out of liberties, and the game is scored by area.

This replaces the original free-placement game (kept on the `original-game` branch), where players built the tiling themselves and could easily leave gaps that no tile could fill. Here every empty space is already a valid tile, so untileable gaps cannot occur.

## 2. Technology

| Item | Choice |
|---|---|
| Framework | React 19 (functional component, hooks) |
| Build | Vite, TypeScript |
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

Plays Player 2 in vs Computer mode, using Monte Carlo tree search (`go-engine.ts`), run in a Web Worker (`ai-worker.ts`) so the page stays responsive. It thinks for a chosen time per move, on the device running the browser: 1, 3 (default), 5 or 10 seconds, picked on the start screen when vs Computer is selected ("Computer thinks"). Longer thinking means more playouts and stronger play. The choice is remembered in the browser's localStorage and applies from the next game.

- **Search.** Each iteration walks down a tree of candidate moves, adds one new node, then finishes the game with a fast random playout, and records who won by area. Moves are chosen in the tree by UCT combined with RAVE (a move also gets credit when it is played later in the same playout), which learns quickly from few playouts. The most-visited root move is played.
- **Playouts** use a light policy: capture the stone just played if it is in atari, save its own groups put in atari by that move, otherwise play a random legal move that neither fills its own eye nor puts itself in atari. Playouts use simple ko and no superko; the root moves are checked against the full rules (superko).
- **Candidates.** Moves that fill its own eye are never considered. The move it actually plays is also never a self-atari (leaving its own group with one liberty) unless it captures; deeper in the search self-atari is allowed so sacrifices can be read, while playouts avoid it.
- **Priors.** New moves start with virtual results from the same tactics: capturing is favored, saving a group in atari next, playing next to the last move slightly, and self-atari is discouraged.
- **Speed.** A board of typed arrays with liberty scans that stop as soon as the answer is known: about 1,000 playouts per second on a Raspberry Pi 5.
- **Passing.** It passes when it has no move that is not an own-eye fill, or when the human has just passed and it is ahead by area score.

The original one-move-lookahead heuristic player is kept in `go-engine.ts` (`chooseHeuristicMove`) as a baseline for testing.

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

## 7b. Skins (`skins.ts`)

The look is chosen from a picker in the header, at any time (even mid-game); it never affects play. The choice is remembered in the browser's localStorage. Each skin supplies Tailwind classes for the page chrome and canvas hooks for the background, each tile (stone, empty, or territory at the end), the last move, and the hover/preview target.

| Skin | Look |
|---|---|
| Plain Jane (default) | The table above: flat blue and red on a white board with a light grid |
| Dazzle | Bejeweled-inspired. Stones are cut gems, sapphire for Player 1 and ruby for Player 2: a table facet plus one side facet per edge, each shaded by how it faces a light at the upper left, with a white glint. Empty tiles are dark sockets with gold rims on a velvet background with fixed gold sparkles. The last move gets a glow and twinkles; the hover preview is a translucent gem with a glowing outline. Page panels are purple with gold rings, and the title is a gold-pink-blue gradient. Animated (see below) |

**Dazzle animations** (`dazzle-effects.ts`) are drawn on a transparent overlay canvas above the board, so the board itself is never redrawn per frame. The overlay's animation loop runs while an effect is in progress or a persistent effect (last move, preview) is shown; with only persistent effects it redraws at 30 frames per second. An idle timer (every 1.2 to 2.8 s) schedules the next glint and twinkle. Animations are off when the device requests reduced motion, and in Plain Jane.

| Effect | When | Look |
|---|---|---|
| Board cascade | The opening creates the board | Sockets appear in a wave spreading from the opening tile (900 px/s, about a second), each flashing gold as it appears |
| Gem pop | A stone is placed | White flash over the gem, a glow ring in the gem's color expanding outward, sparks at its corners (0.32 s) |
| Capture shatter | Stones are captured | Each captured gem breaks into 8 shards that fly outward, spin and fall, with gold sparkles; a "+N" in the capturer's color floats up (about 1 s) |
| Glints | Idle | A random gem catches the light: a bright band sweeps across it; a background speck not covered by the board twinkles |
| Pulsing last move | While there is a last move | The gold glow around the last stone breathes (1.6 s cycle), its sparkle twinkles, and a small sparkle circles the gem |
| Floating preview | Hovering a legal tile, or placing the opening | The translucent gem floats above its socket with a soft shadow, bobs gently (1.4 s cycle), and a shimmer sweeps across it every 1.8 s |

## 8. Controls and Layout

Same as `main`: mouse click to place; the scroll wheel, right-click (Shift for the other way) or Left/Right arrows rotate the opening tile on desktop; on touch devices the preview follows a finger drag (lifted 60 canvas units above it), rotate buttons are shown, and **Place** confirms. The page fills the visible window without scrolling, and the rules are on a **How to Play** overlay. Rotation controls appear only during the opening.

## 9. Known Limitations

- The computer's strength depends on the device: slower devices get fewer playouts in the same thinking time.
- Area scoring counts every stone on the board, so dead stones must be captured before passing.
- No komi, handicap, undo, or save/load.
- Clipping to the rectangular board leaves ragged edges with some tiles having only 1 to 3 neighbors.
- Not yet tested on a physical touch device.
