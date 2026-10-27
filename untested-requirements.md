# Spec rules without unit tests

Every rule in `penrose-territory-spec.md` should have a unit test (`*.test.ts` beside the module, run with `npm test`) that fails if the rule breaks. This file lists the rules that don't, and why. Keep it current: a pull request that adds or changes a spec rule either tests it or adds a row here, and one that adds a test for a rule listed here removes its row.

The tests only reach plain modules without React: `go-engine.ts`, `penrose-board.ts` and `opening.ts`. Code inside `penrose-territory.tsx` (a React component) or a skin needs a browser to run, so a rule that lives there is untested. The fix is usually to move the decision into a plain function and have the component call it.

## Untested rules

| Spec section | Rule | Where it lives | Why it isn't tested |
| --- | --- | --- | --- |
| 4. Board Generation | No vertex-coloring conflicts | `deflate` in `penrose-board.ts` | Testable, but the half-tiles don't keep vertex colors, so the test would have to recompute them. Not written yet. |
| 5. Rules | Opening: the tile becomes the opener's first stone and the other player moves next | `placeOpening` in `penrose-territory.tsx` | Component state. The tile's shape and the inside check are tested (`opening.test.ts`). |
| 5. Rules | Skip Opening hands the opening to the other player; the computer opens after a short pause | `pass` and the computer-turn effect in `penrose-territory.tsx` | Component state and a timer. Where the computer opens (`COMPUTER_OPENING`) is tested. |
| 5. Rules | Players alternate; two consecutive passes end the game, and the result names the winner or a tie | `claimTile` and `pass` in `penrose-territory.tsx` | Component state. The pass count and result wording could move to `go-engine.ts`. The area score itself is tested. |
| 5. Rules | During play the scoreboard shows tiles held and total captures; at the end the area score, with surrounded regions tinted | `stoneCount`, `shownScore` and drawing in `penrose-territory.tsx` | Component state and rendering. Who owns each region (`scoreArea`) is tested. |
| 6. Computer Opponent | Search runs in a Web Worker; thinking time 1, 3 (default), 5 or 10 s, remembered in localStorage and applied from the next game | `ai-worker.ts`; `loadThinkSeconds`, `saveThinkSeconds` and the computer-turn effect in `penrose-territory.tsx` | Web Worker, storage and timers. |
| 6. Computer Opponent | Search: UCT with RAVE, light playout policy, priors, simple ko in playouts, most-visited root move played | `chooseMctsMove` and its helpers in `go-engine.ts` | Internal to the search and random; only its observable choices (passing, no own-eye fills, no self-atari unless capturing) are tested. |
| 6. Computer Opponent | About 1,000 playouts per second on a Raspberry Pi 5; longer thinking plays stronger | `go-engine.ts` | Performance and playing strength, not a pass/fail rule. |
| 7. Visual Feedback | Tile, stone, hover, opening preview, last move, territory and status line looks | drawing in `penrose-territory.tsx`, `skins/plain-jane` | Canvas drawing. |
| 7b. Skins | The picker, its choice remembered in localStorage, skins found automatically, the `Skin` hooks and effects, and every skin's look and animations | `skins/`, the skin picker in `penrose-territory.tsx` | Drawing, animation timers, storage and Vite's `import.meta.glob`. |
| 8. Controls and Layout | Click, wheel, right-click and arrow rotation; touch drag, rotate buttons and Place; the page fits the window; How to Play overlay | `penrose-territory.tsx` | Page events and layout. |
| 2. Technology | Installable as a home-screen web app: the manifest, icons and Apple tags; the safe-area padding and touch settings | `public/manifest.webmanifest`, `public/*.png`, `index.html`, `.safe-area` and the touch rules in `src/index.css`, the `safe-area` classes in `penrose-territory.tsx` | Static files, browser and device behavior, and layout. |
