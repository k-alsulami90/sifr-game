// Deterministic animation schedules shared by the Admin (which advances game
// phases on timers) and the Display (which plays the matching animation).
// Because both derive their timings from the same pure functions, the Display's
// animation finishes ~when the Admin writes the next phase, keeping them in sync.

// Category slot-machine spin.
// Returns the per-frame delays for the shuffle, the final landing delay, the
// "locked" hold, and the total wall-clock duration.
export function spinPlan() {
  const ticks = 20;
  const frames = [];
  let prev = 80; // initial delay before first shuffle
  for (let t = 1; t < ticks; t++) {
    frames.push({ delayBefore: prev });
    prev = 55 + Math.pow(t / ticks, 3) * 430;
  }
  const landDelay = prev; // delay before the real category snaps in
  const lockHold = 850; // pause on the locked category before the question
  const total =
    frames.reduce((a, f) => a + f.delayBefore, 0) + landDelay + lockHold;
  return { frames, landDelay, lockHold, total, ticks };
}

// 100 -> targetScore lightboard countdown.
// Fast at the start, decelerates as it approaches the target, with a brief
// pause (finishHold) before the result is revealed.
export function countdownPlan(target) {
  const t = Math.max(0, Math.min(100, target | 0));
  const span = Math.max(100 - t, 1);
  const startDelay = 460;
  const finishHold = 700;
  const frames = [];
  let delayBefore = startDelay;
  for (let c = 99; c >= t; c--) {
    const progress = (c - t) / span;
    frames.push({
      value: c,
      delayBefore,
      // distance from the target, drives the rising tick pitch
      fromTarget: c - t,
    });
    delayBefore = 26 + Math.pow(1 - progress, 2.4) * 540;
  }
  const trailing = delayBefore; // pause after hitting the target
  const total =
    frames.reduce((a, f) => a + f.delayBefore, 0) + trailing + finishHold;
  return { frames, trailing, finishHold, total };
}
