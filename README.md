# Penrogo

Go, played on a Penrose tiling. Place one kite or dart anywhere and a full Penrose tiling of kites and darts is laid out around it; then take turns claiming tiles, capture groups that run out of liberties, and score by area. Play against another person or the computer.

The original free-placement version, where players built the tiling themselves, is kept on the [`original-game`](https://github.com/dblevins-3dgfx/penrogo/tree/original-game) branch.

See [penrose-territory-spec.md](penrose-territory-spec.md) for the full rules and design.

## Running

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Then open http://localhost:5173. The dev server also listens on your local network, so you can play from a phone or tablet at the network address Vite prints.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Build for production into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Run the TypeScript checker |

## Layout

- `penrose-territory.tsx`: the game component (state, drawing, controls)
- `go-engine.ts`: Go rules on the tile graph and the computer players (Monte Carlo tree search, plus the older heuristic player as a baseline)
- `ai-worker.ts`: runs the computer's search in a Web Worker
- `penrose-board.ts`: Penrose tiling generation and the tile adjacency graph
- `skins/`: visual skins, one folder each, found automatically
  - `types.ts`: the `Skin` and `SkinEffects` interfaces every skin implements
  - `index.ts`: the registry (discovers `skins/*/index.ts`)
  - `canvas-utils.ts`: drawing helpers any skin may use
  - `plain-jane/`: flat colors on a white board
  - `dazzle/`: Bejeweled-inspired gems (`gems.ts`), with animations on an overlay canvas (`effects.ts`)
- `src/main.tsx`, `src/index.css`, `index.html`: Vite entry point and Tailwind setup

## Adding a skin

1. Create a folder `skins/<name>/` with an `index.ts` whose default export is a `Skin` (see `skins/types.ts`): an `id`, a `name` for the picker, an optional `order`, Tailwind classes for the page (`chrome`), and four canvas hooks: `drawBackground`, `drawTile`, `drawLastMove` and `drawTarget`.
2. Optionally add animations with `createEffects()`, returning an object that implements `SkinEffects`: it gets an overlay canvas plus events (stone placed, stones captured, board created) and can take over drawing the last move and the hover preview. `skins/dazzle/effects.ts` is a full example.

That's all: the skin appears in the picker automatically, and no other file needs to change. `skins/plain-jane/index.ts` is the simplest example to copy.

