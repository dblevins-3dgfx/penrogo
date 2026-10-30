// Stepping through a list of choices one at a time (the skin chooser in
// Preferences): by the previous and next buttons, the Left and Right keys,
// or a swipe across the preview on a touch screen.

// The choice `dir` steps from `current` (1 next, -1 previous), wrapping
// around at either end. An unknown `current` starts from the first choice.
export const stepChoice = <T>(choices: T[], current: T, dir: 1 | -1): T => {
  const i = Math.max(0, choices.indexOf(current));
  return choices[(i + dir + choices.length) % choices.length];
};

// How far a finger must move sideways, in CSS pixels, to count as a swipe
export const SWIPE_MIN_PX = 40;

// The step a finger movement makes: a swipe left (dx < 0) shows the next
// choice, a swipe right the previous one; 0 for a tap or a mostly vertical
// movement (scrolling the dialog).
export const swipeStep = (dx: number, dy: number): 1 | -1 | 0 => {
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
};
