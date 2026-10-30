# Penrogo

Go, played on a Penrose tiling. Place one kite or dart anywhere and a full Penrose tiling of kites and darts is laid out around it; then take turns claiming tiles, capture groups that run out of liberties, and score by area. Play against another person or the computer.

The original free-placement version, where players built the tiling themselves, is kept on the [`original-game`](https://github.com/dblevins-3dgfx/penrogo/tree/original-game) branch.

See [penrose-territory-spec.md](penrose-territory-spec.md) for the full rules and design.

## On a phone

On an iPhone, open the game in Safari and use **Share → Add to Home Screen**: it then opens full screen from its own icon, like an app. (Its settings are kept apart from Safari's.)

## Running

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Then open http://localhost:5173. The dev server also listens on your local network, so you can play from a phone or tablet at the network address Vite prints.

## Publishing

Every push to `main` publishes the game to GitHub Pages at **https://dblevins-3dgfx.github.io/penrogo/** (see `.github/workflows/deploy.yml`; progress shows under the repository's Actions tab). The game is a static site (the computer opponent runs in the player's browser), so there is no server to run. The build is told where it lives with `BASE_PATH=/penrogo/`; without it, everything is served from the root as usual.

Every pull request also gets a preview at `https://dblevins-3dgfx.github.io/penrogo/pr-preview/pr-<number>/` (see `.github/workflows/preview.yml`). A comment on the pull request links to it; each push updates it, and closing or merging the pull request removes it. Pull requests from forks don't get one.

Both deploy to the `gh-pages` branch: the main site at its root, previews under `pr-preview/`. Don't edit that branch by hand.

One-time setup: repository **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch **gh-pages**, folder **/ (root)**. The `gh-pages` branch appears after the first deploy from `main`.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Build for production into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Run the TypeScript checker |
| `npm run lint` | Run the linter (oxlint, configured in `.oxlintrc.json`) |
| `npm test` | Run the unit tests (`*.test.ts`) |

## Layout

- `penrose-territory.tsx`: the game screen, wiring the hooks to the components; it also holds the opening tile's type and rotation, the pointer position and the How to Play switch
- `ui/`: the React hooks and components
  - `useGame.ts`: the game reducer as React state, plus the Web Worker searches: the computer's turn (and its opening pause) and hints
  - `useSettings.ts`: the skin, board size, computer level, and the hints, atari warning and undo settings, saved in the browser
  - `Header.tsx`, `Scoreboard.tsx`, `Controls.tsx`: the pieces of the page
  - `Dialog.tsx`, `HowToPlay.tsx`, `Preferences.tsx`: the dialogs (a shared overlay, the rules, and the settings: skin, Hints, Atari warnings and Undo)
  - `SkinPreview.tsx`: a skin's preview card picture, drawn with its own hooks
  - `BoardCanvas.tsx`: the board canvas and the skin's effects overlay, drawing and pointer, wheel and right-click input
- `prefs.ts`: the saved settings' keys, choices and how a saved value is read back, including `SWITCHES`, the table of Preferences on/off switches (a new switch is a row there plus the code that uses it, which reads `switches[id]` in `penrose-territory.tsx`)
- `game.ts`: the game's state and moves as a pure reducer (opening, claiming, passing, the end), plus the status line, the scoreboard and what the pointer is over
- `go-engine.ts`: Go rules on the tile graph and the computer player (Monte Carlo tree search)
- `ai-worker.ts`: runs the computer's search in a Web Worker
- `penrose-board.ts`: Penrose tiling generation and the tile adjacency graph
- `types.ts`: types shared by the board, the rules, the game and the skins (players, stones, points, tiles)
- `opening.ts`: the playfield and the opening tile (its shape, rotation, whether it fits), and which tile a point is over
- `*.test.ts`: unit tests for the spec's rules; `untested-requirements.md` lists the rules they don't cover yet
- `skins/`: visual skins, one folder each, found automatically
  - `types.ts`: the `Skin` and `SkinEffects` interfaces every skin implements
  - `index.ts`: the registry (discovers `skins/*/index.ts`)
  - `canvas-utils.ts`: drawing helpers any skin may use
  - `plain-jane/`: flat colors on a white board
  - `dazzle/`: Bejeweled-inspired gems (`gems.ts`), with animations on an overlay canvas (`effects.ts`)
  - `stained-glass/`: a leaded window of cobalt and ruby glass (`glass.ts`), with a sweeping sunbeam and shattering captures (`effects.ts`)
  - `neon-arcade/`: neon tubes on an arcade screen (`neon.ts`), with flicker-on, blink-out, a breathing last move and a CRT roll bar (`effects.ts`)
  - `blueprint/`: a drafting sheet with hatched, dimensioned stones (`drafting.ts`), with pencil draw-in and erasing (`effects.ts`)
  - `go-classic/`: slate and shell stones on a kaya board (`stones.ts`), set down with a drop and taken as prisoners (`effects.ts`)
  - `kites-and-darts/`: silk kites and metal darts in a sky (`pieces.ts`), with wind, fluttering ribbon and fletching, and glint animations (`effects.ts`)
- `src/main.tsx`, `src/index.css`, `index.html`: Vite entry point, Tailwind setup, and the touch and home-screen settings
- `public/`: the web app manifest and icons, and the third-party notices

## Adding a skin

1. Create a folder `skins/<name>/` with an `index.ts` whose default export is a `Skin` (see `skins/types.ts`): an `id`, a `name` for its card in Preferences, an optional `order`, Tailwind classes for the page (`chrome`), optional `players` colors for the page text (default blue and red), and four canvas hooks: `drawBackground`, `drawTile`, `drawLastMove` and `drawTarget`.
2. Optionally add animations with `createEffects()`, returning an object that implements `SkinEffects`: it gets an overlay canvas plus events (stone placed, stones captured, board created) and can take over drawing the last move and the hover preview. `skins/dazzle/effects.ts` is a full example.

That's all: the skin appears in Preferences automatically, with a preview drawn by its own hooks, and no other file needs to change. `skins/plain-jane/index.ts` is the simplest example to copy.

If the dev server was already running when you created the folder, Tailwind may not have picked up the new skin's classes yet (the page colors look missing): restart the dev server or re-save `src/index.css`. Production builds are unaffected.

## License

Penrogo is released under the [MIT License](LICENSE).

It includes third-party software (React, Lucide icons, Tailwind's generated CSS) under their own permissive licenses; their notices are in [public/THIRD_PARTY_LICENSES.txt](public/THIRD_PARTY_LICENSES.txt), which every build copies next to the game and the How to Play screen links to. After upgrading dependencies, regenerate it with `npm run licenses`.

