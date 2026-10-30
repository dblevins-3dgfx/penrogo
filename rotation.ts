// Turning the opening tile: rotation in 36 degree steps, by buttons, keys,
// right-click or the scroll wheel, and how a wheel or trackpad scroll
// becomes steps.

// Rotation of the opening tile, in degrees, turns in steps of 36.
export const ROTATION_STEP = 36;

// The rotation one step clockwise (dir 1) or counter-clockwise (dir -1),
// kept within 0 to 359.
export const rotateStep = (rotation: number, dir: 1 | -1): number =>
  (rotation + dir * ROTATION_STEP + 360) % 360;

// Scroll-wheel rotation of the opening tile: up turns it clockwise. A mouse
// wheel notch arrives as one large delta and turns one step. A trackpad
// swipe arrives as a stream of small deltas; it turns one step for every
// TRACKPAD_STEP pixels scrolled, so a longer swipe turns further. The page
// drops any leftover partial step after a short pause (SWIPE_END_MS).
export const WHEEL_NOTCH = 50;
export const TRACKPAD_STEP = 50; // lower = faster trackpad rotation
export const SWIPE_END_MS = 150;

// A wheel event's vertical scroll in pixels, whatever unit it came in
// (deltaMode 1 is lines, 2 is pages).
export const wheelPixels = (deltaY: number, deltaMode: number): number =>
  deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;

// The steps one wheel event turns (1 clockwise, -1 counter-clockwise), and
// the swipe's partial total carried to the next event.
export const wheelTurns = (total: number, dy: number): { turns: (1 | -1)[]; total: number } => {
  const dir = (d: number): 1 | -1 => (d < 0 ? 1 : -1);
  if (Math.abs(dy) >= WHEEL_NOTCH) return { turns: [dir(dy)], total };
  const turns: (1 | -1)[] = [];
  let t = total + dy;
  while (Math.abs(t) >= TRACKPAD_STEP) {
    turns.push(dir(t));
    t -= Math.sign(t) * TRACKPAD_STEP;
  }
  return { turns, total: t };
};
