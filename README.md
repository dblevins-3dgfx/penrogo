# Penrogo

Penrose tiling meets Go: a two-player territory game played with Penrose kite and dart tiles. Place tiles edge-to-edge under Penrose's matching rules, surround areas to capture them, and outscore your opponent. Play against another person or the computer.

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
| `npm run typecheck` | Run the TypeScript checker (currently reports one error; the component is untyped) |

## Layout

- `penrose-territory.tsx`: the whole game, a single React component
- `src/main.tsx`, `src/index.css`, `index.html`: Vite entry point and Tailwind setup
