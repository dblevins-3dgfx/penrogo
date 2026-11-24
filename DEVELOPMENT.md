# Development notes

What a newcomer can't learn from the code. The basics are elsewhere: [README.md](README.md) (running, scripts, layout, publishing, adding a skin), [CLAUDE.md](CLAUDE.md) (the spec and test rules), [penrose-territory-spec.md](penrose-territory-spec.md) (the game as built) and [untested-requirements.md](untested-requirements.md).

## How changes are made

- **One issue per change.** Log a GitHub issue first, even for refactors, and reference it in the commit subject, e.g. `Undo: take back a move (#18)`. Commit bodies say what changed and why, and name the spec sections touched.
- **Pull requests** start with `Closes #N`. Then come short sections (*What changes*, *Code*, *Spec*, *Tests and checks*), where *Spec* names the changed spec sections or says why none changed (required by CLAUDE.md). Describe what was checked in a browser, and how.
- **Branches:** work has been done on one long-lived branch per Claude Code session (e.g. `claude/adoring-turing-4rmjg5`). After each merge it is reset to `main` and reused for the next PR. Any branch name works; there is no convention beyond that.
- **Review and merge:** the owner (`dblevins-3dgfx`) merges PRs on GitHub. There are no other reviewers, no required approvals and no review bots. The owner usually tries the PR preview first.
- **Releases:** none as such. Every merge to `main` deploys the site (see README, *Publishing*).

## Checks

- Before a PR: `npm run typecheck`, `npm run lint`, `npm test` (what CI's `test.yml` runs), **plus `npm run build`**. CI's test job doesn't build, so a broken build only shows up when `deploy.yml` or `preview.yml` fails.
- `npm run mutate` (StrykerJS) isn't in CI; it takes about 15 minutes. Baseline after #38: 79.9% overall (`targeting.ts` and `levels.ts` 100%, `rules.ts` 98%, `mcts.ts` 57%). Run it after changing rules or tests, and compare file by file.
- Lint limits (`.oxlintrc.json`): complexity 20, depth 4, 150 lines per function. `gameReducer` in `game.ts` sits at 16, since every action adds a `case`. Split before it reaches 20.
- For a refactor with no visible change, prove it: build `main` and the branch into separate folders, serve both, and compare canvas screenshots byte for byte (done in #30, #42, #45).

## Running and testing locally

- `.claude/launch.json` starts the dev server for Claude Code's preview.
- `vite.config.ts` lets the dev server be opened as `raspberrypi.local`, and the spec's "about 1,000 playouts per second" figure is from a Raspberry Pi 5. A Pi is apparently the owner's dev machine (unverified).
- Browser checks use Playwright with Chromium. Tips:
  - The canvas is 800 × 600. A smaller board is scaled by `800 / board width` (Small: 448 × 336), so convert board units to canvas pixels before clicking.
  - To aim at real tiles, compute centroids with a small `tsx` script using `buildBoard` and `computerOpening` (`penrose-board.ts`, `board-geometry.ts`).
  - **Portrait phones:** the board moves up the page once the opening is placed, because the Kite/Dart and rotate controls disappear. Re-measure the canvas's position after the opening; a stale position was a false alarm in #47.
  - **Touch:** `page.touchscreen.tap` only taps. For drags and swipes, send `Input.dispatchTouchEvent` through a Chrome DevTools Protocol session (#46, #47).
  - **Deterministic drawing checks:** under `npm run dev`, a page can `await import('/skins/<name>/effects.ts')` and call a skin's functions on an offscreen canvas. Random timers made the animations hard to check otherwise (#41, #49).
  - **Hint location** is random (Monte Carlo search), so check hints by counting outline pixels rather than comparing screenshots.
- Don't `pkill -f "vite preview"` from a script: the pattern also matches the shell running it. Use `pgrep -f '[v]ite preview'`.
- Claude Code cloud containers can't reach `github.io` (proxy 403). Check deploys and previews through the Actions runs ("pages build and deployment") instead.

## Gotchas

- **TypeScript 7** (the native compiler) has no JavaScript API. Tools that need one break:
  - typescript-eslint, which is why the repo uses oxlint (#4);
  - Stryker's tsconfig rewrite, which `stryker.config.mjs` skips by naming a file that doesn't exist (`tsconfigFile`, #38);
  - Stryker's optional TypeScript checker.
- **Stryker runner:** use the tap runner, which runs each test file with `node --import tsx` and only the files that reach a mutant. The generic command runner (`npm test` per mutant) estimated 80 minutes against 14.
- **Board units vs canvas pixels (#20, #34):** skins draw in board units, and `ui/board-drawing.ts` and the effects overlay set a scale transform. Anything that should span or match the board must use the size passed to `setBoardSize`, never `canvas.width`. That mistake caused #29 (sweeps) and #44 (capture patches).
- **`isKite` compares the axis with the long edge** (a ratio), not a fixed length, so it works at any scale (#34).
- **Two copies of the Go rules:** `mcts.ts` has `FastBoard`, a typed-array copy of `rules.ts` with simple ko instead of superko, for speed. `mcts.test.ts` plays seeded random games to check the two agree (#32). Change both together.
- **Arrow keys:** `penrose-territory.tsx` listens for Left/Right on `window` to turn the opening tile. Anything in a dialog that uses arrow keys must `stopPropagation()`, as the skin chooser does (#40).
- **Phone held sideways:** the Tailwind `short` variant (`src/index.css`) makes layouts compact there. Check new UI at 844 × 390; Preferences needed a two-column layout (#46).
- **`gh-pages` is shared** by the main deploy and PR previews. `deploy.yml` uses `clean-exclude: pr-preview` and `force: false` so it doesn't wipe previews (#24).
- **Saved settings** live in `localStorage` under fixed keys (`prefs.ts`, `SWITCHES`); tests pin the keys and values. A saved thinking time from before levels existed migrates once (`parseLevel`).

## Decisions

- **Game setup stays on the start screen, not in Preferences.** Board size and level apply to the next game, and the level only matters against the computer. Preferences holds things that apply at once. Thinking time became a level (Beginner to Strong) for that reason (#20).
- **Learning aids are on by default** (Hints, Atari warnings, Undo), each with a Preferences switch, because the owner is a Go novice and the game is meant to help learning.
- **Overlay styles are distinct on purpose.** The hint is a dashed amber outline, atari is solid red with a ring on the last liberty, and both have a white halo to show on any skin. Neither should be mistaken for a skin's last-move marker.
- **Undo** against the computer takes back the computer's reply too, and can reopen a finished game (#18).
- **Beginner** caps the search at 300 playouts and sometimes plays a runner-up move. A short time limit alone didn't weaken it enough (#20).
- **Touch:** the preview sits under the finger; an earlier 60-unit lift was dropped as confusing. Double-tap is a shortcut for Place (#43).
- **The skin chooser** shows one preview with ‹ › and wraps around, instead of a grid of cards (#40).
- **The heuristic baseline player was removed** at the owner's request; Monte Carlo tree search is the only computer player.
- **About the owner:** an experienced C++ developer, new to web tooling. Explain web and TypeScript ideas in C++ terms (modules as translation units, structural interfaces as concepts). Keep wording plain in the spec, comments and UI text.

## Setup outside the repository

- **GitHub Pages:** source is the `gh-pages` branch, root folder; the README covers it. There's no custom domain, analytics or search console.
- **Origin of the rules:** the spec and test rules in CLAUDE.md were adopted from the owner's `dblevins-3dgfx/sudoku4david`, which follows the same workflow.

## Things to watch

- **`npm audit`:** vite and source-map-js have high-severity advisories (dev server and build only). Stryker brings moderate ones (qs via `typed-rest-client`, its unused dashboard reporter). None ship in the game.
- **Dependency upgrades:** regenerate `public/THIRD_PARTY_LICENSES.txt` with `npm run licenses`, and re-run `npm run mutate`.
- **Physical devices:** touch has only been tested on an emulated iPhone, including whether double-tap triggers browser zoom (spec section 9).
- **Pinned versions:** Stryker is pinned to exactly 10.0.0. Core and tap-runner must stay on the same version.

## Open work

- **No open issues.**
- **Learning aids closed for now** (the owner may revisit):
  - #13 liberties on hover
  - #14 move preview
  - #15 live territory estimate
  - #17 win-chance meter
  - #19 game review
  - #21 tactics puzzles
- **If they return:** a new switch is one row in `SWITCHES` (`prefs.ts`). If several aids add board overlays, consider a list of overlay drawers in `ui/board-drawing.ts` instead of more branches in `drawOverlays`.
- **Possible cleanup:** `undoDepth`'s two-player branch gives the same answer as the general case (a surviving equivalent mutant in #38).
