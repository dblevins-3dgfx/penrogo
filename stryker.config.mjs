// Mutation testing (StrykerJS): makes small deliberate changes ("mutants")
// to the plain modules and runs the unit tests against each. A mutant the
// tests catch is killed; one that survives points at behavior no test
// checks. Run with `npm run mutate`; the report is in reports/mutation/.
// Slow (a few minutes), so it's run by hand, not in CI.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  // The modules with unit tests; the React code and skins have none
  mutate: [
    'rules.ts', 'mcts.ts', 'game.ts', 'targeting.ts', 'board-geometry.ts', 'rotation.ts',
    'penrose-board.ts', 'prefs.ts', 'levels.ts', 'chooser.ts'
  ],
  // The tests use Node's built-in runner (node:test), which reports in TAP;
  // the tap runner runs each test file with node (TypeScript through tsx),
  // records which test files reach each mutant, and runs only those
  testRunner: 'tap',
  tap: {
    testFiles: ['*.test.ts'],
    nodeArgs: ['--import', 'tsx', '--test-reporter=tap', '-r', '{{hookFile}}', '{{testFile}}']
  },
  coverageAnalysis: 'perTest',
  // Stryker rewrites tsconfig.json's extends/references paths with the
  // TypeScript compiler's JS API, which TypeScript 7 (native) doesn't have.
  // Ours has neither, so name a file that doesn't exist to skip that step
  // (the real tsconfig.json is still copied into the sandbox for tsx).
  tsconfigFile: 'no-tsconfig-rewrite.json',
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  timeoutMS: 20000,
  concurrency: 4,
  tempDirName: '.stryker-tmp',
  cleanTempDir: 'always'
};
