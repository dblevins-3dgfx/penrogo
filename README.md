# Penrogo

Go, played on a Penrose tiling. Place one kite or dart anywhere and a full Penrose tiling of kites and darts is laid out around it; then take turns claiming tiles, capture groups that run out of liberties, and score by area. Play against another person or the computer.

This is the experimental `penrose-go` branch. The original free-placement game is on `main`.

See [penrose-territory-spec.md](penrose-territory-spec.md) for the full rules and design.

## Running

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Then open http://localhost:5174 (this branch uses port 5174 so it can run next to `main` on 5173). The dev server also listens on your local network, so you can play from a phone or tablet at the network address Vite prints.

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
- `src/main.tsx`, `src/index.css`, `index.html`: Vite entry point and Tailwind setup
