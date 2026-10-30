# Penrogo (Penrose Go): Specification

Status: reflects the game as currently implemented (`PenroseTerritoryGame` in `penrose-territory.tsx` with its hooks and components in `ui/`, game state and turns in `game.ts`, saved settings in `prefs.ts`, board generation in `penrose-board.ts`, the board's geometry and the opening tile in `board-geometry.ts`, turning it in `rotation.ts`, the computer's levels in `levels.ts`, the rules in `rules.ts`, the computer player in `mcts.ts`).

## 1. Overview

Go, played on a Penrose tiling of kites and darts. The first move places a single tile anywhere on the board; a complete Penrose tiling is then generated around it. After that, players take turns claiming any empty tile. Groups are captured Go-style when they run out of liberties, and the game is scored by area.

This replaces the original free-placement game (kept on the `original-game` branch), where players built the tiling themselves and could easily leave gaps that no tile could fill. Here every empty space is already a valid tile, so untileable gaps cannot occur.

## 2. Technology

| Item | Choice |
|---|---|
| Framework | React 19 (functional component, hooks) |
| Build | Vite, TypeScript |
| Rendering | HTML5 Canvas 2D, 800 x 600 internal resolution, scaled to the largest 4:3 size that fits the window; a smaller board (section 4) is drawn scaled up to fill the canvas, skin, animations and all |
| Styling | Tailwind CSS v4 utility classes |
| Icons | lucide-react (`RotateCw`, `RotateCcw`, `Play`, `SkipForward`, `Lightbulb`, `Undo2`, `Settings`, `CircleHelp`, `Check`, `X`) |
| Persistence | The chosen skin, the board size, the computer's level, whether hints, atari warnings and undo are on are kept in the browser's localStorage; the game itself is in memory only |
| Home screen | Installable as a home-screen web app (on an iPhone: Safari, Share, Add to Home Screen). `public/manifest.webmanifest` names it Penrogo and has it open full screen (`standalone`), with the icons `icon-192.png` and `icon-512.png` (the 192 also serves as the browser tab icon); `index.html` adds Apple's tags (`apple-touch-icon.png` at 180 x 180, full-screen capable, the title, a translucent status bar with white text over the dark page) and a dark slate theme color. The icon is drawn in the Go Classic skin, with its own drawing code: a sun of five kites on the kaya board, holding two slate (black) and two clamshell (white) stones and one empty point, with Go's ring marker on a black stone as the last move. Opened from the home screen, it keeps its own storage, separate from Safari's, so its settings start at their defaults. It still needs the network to start (no offline play yet) |
| Touch | The page reaches under the notch, rounded corners and home bar (`viewport-fit=cover`), and the page and the How to Play overlay pad themselves back in by the safe-area insets (`.safe-area`), so nothing sits under them. Double-tap zoom, text selection, the long-press callout and the tap highlight are turned off (`src/index.css`) |

## 3. Tiles

Kite and dart, long edge `L = 60` px, short edge `L / phi`. Vertex order: kite [O (72 deg), B, C (144 deg), D], dart [M (72 deg), N, A' (216 deg), N']; vertex 0 to vertex 2 is the axis of symmetry. The opening tile is positioned by its centroid and rotated in 36 deg steps.

## 4. Board Generation (`penrose-board.ts`)

1. **Patch.** Start from a sun of five kites (ten Robinson half-kites) and subdivide 7 times. Each half-kite becomes two half-kites and a half-dart; each half-dart becomes a half-kite and a half-dart; every piece shrinks by phi. Mirror halves sharing an axis are joined into whole tiles (about 4,900 tiles). The orientation of each piece in the subdivision rules was found by exhaustive search as the only choice that keeps Penrose's vertex coloring consistent and pairs every half with its mirror.
2. **Alignment.** The patch is rotated and translated so the tile of the opening's type nearest the patch center coincides exactly with the opening tile.
3. **Clipping.** Only tiles lying entirely inside the board are kept. The board is a 4:3 region whose size is chosen on the start screen (**Board**, for both modes): Small 448 x 336 (about 60 tiles), Medium 560 x 420 (about 100), Large 680 x 510 (about 155) or Full 800 x 600 (about 220, the default), in the same units as the tiles, so a smaller board is a smaller piece of the same tiling, for shorter games (as beginners play 9 x 9 Go before 19 x 19). It is drawn scaled up to fill the canvas, so its tiles look larger. The opening tile must lie inside the chosen board, and the computer opens at its center. The choice is remembered in the browser and applies from the next game; New Game keeps it.
4. **Adjacency.** Two tiles are neighbors when they share a full edge. Interior tiles have exactly four neighbors, like points on a Go board.

Verified: every tile has exact kite or dart geometry, there are no vertex-coloring conflicts, the kite to dart ratio is about phi, and the opening tile matches the placement exactly.

## 5. Rules

- **Opening.** Player 1 places a kite or dart anywhere on the board (every vertex inside it), at any rotation. The board is generated around it and it becomes Player 1's first stone. **Skip Opening** hands the opening to the other player; if the computer opens, it places a kite at the board center.
- **Moves.** Players alternate claiming any empty tile, or pass.
- **Capture.** After a move, any opponent group (connected tiles of one color) with no liberties (empty neighboring tiles) is removed, and the tiles become empty.
- **Suicide** is illegal: a move may not leave its own group without liberties (after captures).
- **Ko** uses positional superko: a move may not recreate any earlier board position.
- **End.** Two consecutive passes end the game.
- **Undo.** **Undo** (in the controls, once the game has started, when undo is on) takes moves back. With 2 players it takes back the last move, whoever played it. Against the computer it goes back to the last time it was the person's turn: their move and the computer's reply, or, while the computer is still thinking (or about to open), just their move, and the computer's search is dropped. Everything returns to how it was: the board, the captures, whose turn it is, the passes, the positions seen for superko, and, after the move that ended the game, the game itself, which goes on. The opening and Skip Opening can be taken back too, back to the start of the game. Moves can be taken back one after another to the start; Undo is disabled when there is nothing to take back. The status line says "Move taken back."; any hint goes. New Game forgets the moves. Undo is on by default and can be turned off in **Preferences** (section 8) for a game without take-backs; the choice is remembered in the browser.
- **Score** (area scoring): tiles held plus empty regions bordered only by that player's tiles. No komi yet. During play the scoreboard shows tiles held and total captures; at the end it shows the area score and tints each player's surrounded empty regions.

## 6. Computer Opponent

Plays Player 2 in vs Computer mode, using Monte Carlo tree search (`mcts.ts`), run in a Web Worker (`ai-worker.ts`) so the page stays responsive. Its strength is a level picked on the start screen when vs Computer is selected (**Computer**):

| Level | Search |
|---|---|
| Beginner | Stops after 300 playouts (or 1 second), and 30% of the time plays one of the next three most-visited moves at random instead of the best (a pass is never swapped for a move). Weaker on purpose |
| Easy | 1 second per move |
| Medium (default) | 3 seconds per move |
| Strong | 10 seconds per move |

It thinks on the device running the browser; longer thinking means more playouts and stronger play. The choice is remembered in the browser's localStorage and applies from the next game. A thinking time saved before levels existed picks the matching level once (1 s Easy, 3 or 5 s Medium, 10 s Strong).

- **Search.** Each iteration walks down a tree of candidate moves, adds one new node, then finishes the game with a fast random playout, and records who won by area. Moves are chosen in the tree by UCT combined with RAVE (a move also gets credit when it is played later in the same playout), which learns quickly from few playouts. The most-visited root move is played.
- **Playouts** use a light policy: capture the stone just played if it is in atari, save its own groups put in atari by that move, otherwise play a random legal move that neither fills its own eye nor puts itself in atari. Playouts use simple ko and no superko; the root moves are checked against the full rules (superko).
- **Candidates.** Moves that fill its own eye are never considered. The move it actually plays is also never a self-atari (leaving its own group with one liberty) unless it captures; deeper in the search self-atari is allowed so sacrifices can be read, while playouts avoid it.
- **Priors.** New moves start with virtual results from the same tactics: capturing is favored, saving a group in atari next, playing next to the last move slightly, and self-atari is discouraged.
- **Speed.** A board of typed arrays with liberty scans that stop as soon as the answer is known: about 1,000 playouts per second on a Raspberry Pi 5.
- **Passing.** It passes when it has no move that is not an own-eye fill, or when the human has just passed and it is ahead by area score.

### Hints

The same search can suggest a move to a person. **Hint** (in the controls, shown once the board exists, when hints are on) asks it for the best move for the player to move, searching for 2 seconds in the Web Worker. While it looks, the status line says "Looking for a good move…" and Hint is disabled; it is also disabled on the computer's turn. The suggestion is then highlighted on the board ("Hint: the highlighted tile is a good move."), or, if the search would pass (it has no good move, or the other player just passed and the player to move is ahead), the status line says "Hint: passing is a good choice here." The next move, a pass, the end of the game or New Game clears the hint; an illegal click does not. If a move is played while a hint is still being looked for, the answer is dropped. Hints are unlimited and cost nothing.

Hints are on by default, and can be turned off in **Preferences** (see section 8); the choice is remembered in the browser. Turning them off hides the button and clears any hint shown or being looked for.

## 7. Visual Feedback

| Element | Behavior |
|---|---|
| Empty tile | Light gray fill, thin gray outline |
| Stones | Player 1 blue, Player 2 red, with a darker outline |
| Hover | The tile under the pointer is filled in the current player's color with a green outline if claiming it is legal, or a dashed red outline if not |
| Opening preview | The tile follows the pointer; a red border surrounds the board while it would stick out |
| Last move | Glowing gold outline and a gold star |
| Game end | Surrounded empty regions tinted in their owner's color |
| Atari warning | Each tile of a group in atari has a solid red outline on a white halo, and its last liberty a red ring, drawn over the board the same way in every skin (see below) |
| Hint | The suggested tile has an amber tint and a dashed amber outline on a white halo, drawn over the board the same way in every skin (dashed, so it is not mistaken for a skin's last-move marker) |
| Status line | Captures, passes, illegal-move reasons, hints, and the final result; below it, the atari warning |

### Atari warnings

A group is in **atari** when it is down to one liberty: the other player can capture it with the next move. While the game is played (once the board exists, until it ends), every group in atari, of either player, is outlined on the board (each of its tiles in solid red on a white halo; solid, so it is not mistaken for the dashed hint or an illegal preview), and its one liberty is marked with a red ring: where its owner can extend it, or the other player can capture it. A line under the status says whose tiles are in atari and how many, adding up each player's groups: "Your 3 tiles are in atari; the computer's tile is in atari." vs Computer, "Player 1's 2 tiles are in atari." with 2 players, a single tile saying "tile is". The warnings follow the board, so they appear and go away as moves are played. They are on by default and can be turned off in **Preferences** (section 8); the choice is remembered in the browser. How to Play explains atari and the warnings.

## 7b. Skins (`skins/`)

The look is chosen in the **Preferences** dialog (see section 8), at any time (even mid-game); it never affects play. There it shows the current skin's preview (a corner of a board around the computer's opening, with three stones for each player and the last move marked, drawn with the skin's own hooks, without its animations), with **‹** and **›** buttons either side and its name and place in the list underneath ("Dazzle · 2 of 7"). The buttons step to the previous or next skin, wrapping around at either end; so do the Left and Right arrow keys while the chooser has focus (they don't also turn the opening tile behind the dialog), and, on a touch screen, a swipe across the preview (left for the next skin, right for the previous; at least 40 px and more sideways than up or down, so taps and scrolling don't count). Each step switches the page at once. The choice is remembered in the browser's localStorage. Each skin lives in its own folder, `skins/<name>/index.ts`, and is discovered automatically (Vite `import.meta.glob`), so adding one touches no other file. A skin implements the `Skin` interface (`skins/types.ts`): Tailwind classes for the page chrome and canvas hooks for the background, each tile (stone, empty, or territory at the end), the last move, and the hover/preview target. The hooks draw in board units: the board's own w x h (section 4), scaled up to fill the canvas, with tiles always 60 long, and the background hook is given the board's w and h. It may also provide `createEffects()`, returning a `SkinEffects` object that animates on an overlay canvas; the game tells it the board's size (`setBoardSize`, so sweeps across the board span the board on every size) and calls its optional event methods (board created, stone placed, stones captured) and lets it take over drawing the last move and the legal preview if it implements `setLastMove` / `setTarget`. A skin may also set `players`: each player's text color class and color name, used by the scoreboard, turn indicator and How to Play text (default blue and red). `drawLastMove` receives the owner of the last move's tile.

| Skin | Look |
|---|---|
| Plain Jane (default) | The table above: flat blue and red on a white board with a light grid |
| Dazzle | Bejeweled-inspired. Stones are cut gems, sapphire for Player 1 and ruby for Player 2: a table facet plus one side facet per edge, each shaded by how it faces a light at the upper left, with a white glint. Empty tiles are dark sockets with gold rims on a velvet background with fixed gold sparkles. The last move gets a glow and twinkles; the hover preview is a translucent gem with a glowing outline. Page panels are purple with gold rings, and the title is a gold-pink-blue gradient. Animated (see below) |
| Kites & Darts | The pieces as their namesakes in a pale sky with a sun glow and clouds. Kites are silk: four two-tone panels split by wooden spars, with sheen, weave and stitching. Darts are brushed-metal arrowheads (blue steel, red anodized): two halves shaded by the light meeting at a raised ridge, with a glint and a rivet. Empty tiles are faint kite-string lines. The last move gets a white outline plus a tail: a kite trails a gold ribbon with bows; a dart becomes an arrowhead, with a wooden shaft, a nock, and fletching (two swept-back golden vanes and a red cock-feather stripe). The skin tells kites from darts by shape (the axis against the long edge, so at any board size). Sky-blue page chrome. Animated (`skins/kites-and-darts/effects.ts`): every 4 to 7 s a wind gust crosses the board and the silk kites it passes ripple with sliding bands of light and shade; every 1.5 to 3 s a metal dart catches the sun, a bright streak running along its blade; the last move's ribbon or fletching flutters continuously (30 frames per second) |
| Stained Glass | The board as a leaded window. Stones are cobalt and ruby glass, brighter in the middle where light comes through, with per-pane tint variation, air bubbles and faint streaks; empty tiles are frosted glass; every edge is a dark lead line with a metallic highlight. The last move is lit from within with a gold rim. Dark stone page chrome. Animated (`skins/stained-glass/effects.ts`): light is drawn as a lighter version of each pane's own color (light blue on cobalt, pink on ruby, warm white on frosted), so glass looks backlit rather than painted over. Every 6 to 10 s a sunbeam sweeps diagonally across the window, brightening the glass it passes while the lead stays dark; the last move's glow pulses (2.4 s cycle); captured panes crack from an impact point (crack lines flash), then break into wedge shards that drop out of the frame under gravity, tumbling, glinting and fading (about 1.5 s) |
| Neon Arcade | Synthwave. Stones are neon tubes (cyan and hot pink) tracing their tiles, inset so neighboring tubes stay separate, with a bright core, colored glow and faint gas fill, on a near-black arcade screen with a faint magenta grid and scanlines. Empty tiles are crisp dim-violet outlines, so the tile geometry stays easy to read. Black-to-magenta page chrome with a glowing cyan title. Animated (`skins/neon-arcade/effects.ts`): new stones flicker on like a neon sign warming up (the overlay covers the tube while it is "off"); captured stones flash, stutter and fade dark, slightly staggered; the last move's tube glow breathes with a spark (1.8 s cycle); every 7 to 11 s a faint CRT roll bar drifts down the screen |
| Blueprint | A drafting sheet: blueprint paper with a fine grid and heavier major lines. Empty tiles are thin construction lines. Stones are outlined and hatched: Player 1 white with diagonal hatching, Player 2 red-line pencil with cross-hatching, so the players differ by pattern as well as color. The last move is dimensioned: a measured line with arrowheads along its long edge (labeled 60.0) and its 72° tip angle marked. Empty territory is stippled. Blueprint-blue page chrome with a spaced monospace title. Animated (`skins/blueprint/effects.ts`): a new stone is drafted in pencil, its outline traced edge by edge with a glowing pencil tip, then its hatching swept in (about 0.6 s); captured stones are erased line by line, the outline fading and eraser crumbs falling away (about 0.5 s) |
| Go Classic | A traditional Go set. A kaya-wood board with seeded grain and ink lines along the tile edges; stones are polished slate (black, Player 1) and clamshell (white with faint stripes, Player 2), shaped to their tiles with rounded corners, soft shading and a shadow. The last move gets Go's ring marker in the opposite color; territory at the end gets Go's small square markers. Dark wood page chrome with a serif title; the scoreboard shows the players as black and white (`players`). Animated (`skins/go-classic/effects.ts`): new stones are set down with a drop, starting slightly large with a long shadow and settling (0.19 s); captured stones are lifted and slide away toward the capturer's side of the scoreboard, one after another, fading |

**Dazzle animations** (`skins/dazzle/effects.ts`) are drawn on a transparent overlay canvas above the board, so the board itself is never redrawn per frame. The overlay's animation loop runs while an effect is in progress or a persistent effect (last move, preview) is shown; with only persistent effects it redraws at 30 frames per second. An idle timer (every 1.2 to 2.8 s) schedules the next glint and twinkle. Animations are off when the device requests reduced motion, and in Plain Jane.

| Effect | When | Look |
|---|---|---|
| Board cascade | The opening creates the board | Sockets appear in a wave spreading from the opening tile (900 px/s, about a second), each flashing gold as it appears |
| Gem pop | A stone is placed | White flash over the gem, a glow ring in the gem's color expanding outward, sparks at its corners (0.32 s) |
| Capture shatter | Stones are captured | Each captured gem breaks into 8 shards that fly outward, spin and fall, with gold sparkles; a "+N" in the capturer's color floats up (about 1 s) |
| Glints | Idle | A random gem catches the light: a bright band sweeps across it; a background speck not covered by the board twinkles |
| Pulsing last move | While there is a last move | The gold glow around the last stone breathes (1.6 s cycle), its sparkle twinkles, and a small sparkle circles the gem |
| Floating preview | Hovering a legal tile, or placing the opening | The translucent gem floats above its socket with a soft shadow, bobs gently (1.4 s cycle), and a shimmer sweeps across it every 1.8 s |

## 8. Controls and Layout

Same as `main`: mouse click to place; the scroll wheel, right-click (Shift for the other way) or Left/Right arrows rotate the opening tile on desktop; on touch devices the preview follows a finger drag (lifted 60 canvas units above it), rotate buttons are shown, and **Place** confirms. The page fills the visible window without scrolling. The header has the title, a gear button for the **Preferences** dialog (the skin, see section 7b, and the Hints, Atari warnings and Undo switches) and **How to Play** (the rules); both are dialogs over the page that Escape, the X or a click outside closes. In portrait the header, scoreboard and controls are stacked above the board, which scales to the largest 4:3 size that fits below them. In landscape (the window wider than tall) the board is on the left at the full height, narrowed if that would leave less than 18rem beside it, and the header, scoreboard and controls are in a panel on the right that takes the remaining width up to 28rem; the scoreboard puts whose turn it is on top, with the two scores below. On a phone held sideways (landscape and under 30rem tall) the panel is compact: the title, scores and buttons are smaller, so the panel fits without scrolling. There the dialogs are tighter too, and Preferences puts the skin chooser beside the switches, so it all fits without scrolling. Rotation controls appear only during the opening. Before a game the controls offer the mode (2 Players or vs Computer), the **Board** size (section 4), the **Computer** level (section 6, vs Computer only) and Start. **New Game** returns to the start screen, clearing the board, the scores and the capture counts; the chosen mode is kept.

## 9. Known Limitations

- The computer's strength depends on the device: slower devices get fewer playouts in the same thinking time (except Beginner, whose 300 playouts fit in its second on most devices).
- Area scoring counts every stone on the board, so dead stones must be captured before passing.
- No komi, handicap, or save/load.
- Clipping to the rectangular board leaves ragged edges with some tiles having only 1 to 3 neighbors.
- Not yet tested on a physical touch device (only in a browser emulating an iPhone).
- No offline play: the home-screen app needs the network to start.
