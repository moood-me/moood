// The pacer — ONE, in the loop (5.1): the standard governor of a frame rate. It steps down on what the display shows
// (frames the viewer lost), comes back on evidence (the measured costs of the two stages of a frame, each apart), with
// a back-off that doubles without a cap — so a device on the border settles. Never a rate between: the display's rate
// over a whole number, or half of that.
//   P      the display's period: the LOWER QUARTILE of the intervals between consecutive display callbacks among the
//          last 120 — not the median: a GPU slower than the rate makes the browser hold callbacks back, and when more
//          than half of them are held the median would take the held rate for the display's (and see no frame lost)
//   n      the least whole number with n · P ≥ PACE.PERIOD_LEAST      60, 75, 90, 100 Hz → 1; 120, 144, 165 Hz → 2; 240 Hz → 3
//   k      1 or 2; 1 when a scene is shown
//   run    a callback runs when its number is divisible by n · k; the others return at once — a `fresh` one always
//          runs (the count begins with it: its freshness is the tick's dt = 0, never lost to a skip)
//   miss   (counted at k = 1) a run callback that came PACE.LATE · n · P or more after the run before it (a frame the
//          viewer lost), or that found gpu.flying ≥ PACE.BEHIND (the GPU that many frames behind — a backstop: a GPU
//          slower than the rate shows first as lost intervals, the browser holding the callbacks back)
//   down   k 1 → 2 when more than PACE.MISSES of the last PACE.WINDOW run callbacks were misses
//   js     (measured at k = 2) a drawn frame's thread time: from its callback's start to its hand-over (pace.frame,
//          just after R.frame's submit)
//   gpu    (measured at k = 2) a drawn frame's GPU time: where the device has timestamps (gpu.stamps), its passes'
//          times summed (gpu.timeFrames, told by `timed`); else from its hand-over to its done — the GPU's work and the
//          done notice's delay (a few ms in Chromium), so held against the whole step
//   up     k 2 → 1 — a trial — when WINDOW · 2^fails run callbacks have passed at k = 2, at most MISSES of the last
//          WINDOW drawn frames had js > PACE.JS · n · P, and at most MISSES of the last WINDOW timed frames had
//          gpu > PACE.GPU · n · P (by timestamps) or > n · P (by the done) — the two stages overlap (the next
//          callback's JS runs while the GPU draws the frame before), so each must fit the step alone, not their sum
//   fails  0 when a scene is shown; + 1, with no cap, when a trial steps down again within WINDOW run callbacks;
//          back to 0 when a trial has held for WINDOW
//   not counted: a `fresh` callback (after a mount, a pause, a job apart), the callback after a whole frame (a
//          scene's first, a cut's — long by design), callbacks while the picture is held
//   lateBy (the stand's row): what made the last run callback a miss — bit 1 its interval, bit 2 the GPU behind
//   cost, submitted (the stand's rows, while it measures): ms from the frame's callback, and from its hand-over, to its
//          done
// The real clock is read only at k = 2 (and while the stand measures): at a run callback's start, at its hand-over,
// and when a frame's done is heard. Nothing is made a frame: the frames whose done is awaited wait in a small ring
// (their callback's timestamp, hand-over moment, submit number, whether counted, the step), told by the GPU layer's
// one listener (gpu.hear), set once. No pacer in a render.
import { PACE } from '../base.js';

const W = PACE.WINDOW;
// (the frames whose done is awaited at once, at the most: beyond it — the GPU that far behind — a frame is not taken)
const FLYING = 32;

// gpu: GP8's (flying, submits, stamps, hear, timeFrames)
export function createPace(gpu) {
  // the callbacks' intervals (all of them, run or not): a ring, and its median found again every few callbacks
  const intervals = new Float64Array(W), sorted = new Float64Array(W);
  let intervalN = 0, intervalAt = 0, sinceMedian = 0, P = 1000 / 60, lastTs = -1;
  // the run callbacks at k = 1: whether each of the last WINDOW was a miss; at k = 2, the drawn frames: whether each
  // one's js, and each timed one's gpu, was over
  const missed = new Uint8Array(W), jsOver = new Uint8Array(W), gpuOver = new Uint8Array(W);
  let missAt = 0, misses = 0, jsAt = 0, jsOvers = 0, gpuAt = 0, gpuOvers = 0;
  let n = 1, k = 1, number = 0, lastRun = -1, uncounted = true, fails = 0, runsAtK = 0, trial = false, late = false, lateBy = 0;
  let measuring = false, began = 0, cost = -1, submitted = -1;
  // the frames in flight, the oldest first: each one's callback's timestamp, hand-over moment, submit number, whether
  // it is counted at k = 2 (drawn at k = 2, not a whole frame), the pacer's step then (ms)
  const flyTs = new Float64Array(FLYING), flySub = new Float64Array(FLYING), flyNo = new Float64Array(FLYING), flyCounted = new Uint8Array(FLYING), flyStep = new Float64Array(FLYING);
  let flyAt = 0, flyN = 0;
  const gpuSample = o => { gpuOvers += o - gpuOver[gpuAt]; gpuOver[gpuAt] = o; gpuAt = (gpuAt + 1) % W; };
  // the GPU layer's one listener: the no-th submit's done (in order — those of the ring before it were let go); a timed
  // frame's GPU time
  gpu.hear({
    done(no) {
      while (flyN && flyNo[flyAt] < no) { flyAt = (flyAt + 1) % FLYING; flyN--; }
      if (!flyN || flyNo[flyAt] !== no) return;
      const i = flyAt;
      flyAt = (flyAt + 1) % FLYING; flyN--;
      const at = performance.now();
      if (measuring) { cost = at - flyTs[i]; submitted = at - flySub[i]; }
      if (flyCounted[i] && k === 2 && !gpu.stamps) gpuSample(at - flySub[i] > flyStep[i] ? 1 : 0);
    },
    timed(ms) { if (k === 2) gpuSample(ms > PACE.GPU * n * P ? 1 : 0); },
  });
  function clear() { missed.fill(0); jsOver.fill(0); gpuOver.fill(0); missAt = 0; misses = 0; jsAt = 0; jsOvers = 0; gpuAt = 0; gpuOvers = 0; runsAtK = 0; }
  function setK(to) { k = to; gpu.timeFrames(k === 2); clear(); }
  // (the first m of `sorted`: a view made once a length — the window fills once, then stands)
  let part = sorted.subarray(0, 0);
  function median() {
    const m = Math.min(intervalN, W);
    for (let i = 0; i < m; i++) sorted[i] = intervals[i];
    if (part.length !== m) part = sorted.subarray(0, m);
    part.sort();
    P = part[(m - 1) >> 2];
    n = Math.max(1, Math.ceil(PACE.PERIOD_LEAST / P - 1e-6));
  }
  return {
    // n · k: the pacer's step now, in display refreshes
    get every() { return n * k; },
    // whether the callback that ran last was counted a miss, and by what (bit 1 its interval, bit 2 the GPU behind)
    get late() { return late; },
    get lateBy() { return lateBy; },
    // the display's period (ms) as it is known now
    get period() { return P; },
    // the stand's: ms from the callback, and from the hand-over, of the frame whose done was heard last to that
    // moment; −1: none heard since it was last taken
    takeCost() { const c = cost; cost = -1; return c; },
    takeSubmitted() { const c = submitted; submitted = -1; return c; },
    // the stand measures: every drawn frame's done is heard, whatever k
    measure(on) { measuring = !!on; },
    // a scene is shown: the full rate, no trial failed yet
    shown() { fails = 0; trial = false; uncounted = true; setK(1); },
    // A display callback at timestamp ts (ms). fresh: the first after a mount, a pause, a job apart — it always
    // runs. → whether it runs
    run(ts, fresh) {
      if (fresh) { lastTs = -1; lastRun = -1; uncounted = true; number = 0; }
      if (lastTs >= 0) {
        intervals[intervalAt] = ts - lastTs; intervalAt = (intervalAt + 1) % W; if (intervalN < W) intervalN++;
        if (++sinceMedian >= 8 || intervalN <= 8) { sinceMedian = 0; median(); }
      }
      lastTs = ts;
      late = false; lateBy = 0;
      if (number++ % (n * k) !== 0) return false;
      if (k === 2 || measuring) began = performance.now();
      const counted = !uncounted && lastRun >= 0;
      uncounted = false;
      if (counted) {
        runsAtK++;
        if (k === 1) {
          const gap = ts - lastRun >= PACE.LATE * n * P, behind = gpu.flying >= PACE.BEHIND;
          late = gap || behind;
          lateBy = (gap ? 1 : 0) | (behind ? 2 : 0);
          misses += (late ? 1 : 0) - missed[missAt]; missed[missAt] = late ? 1 : 0; missAt = (missAt + 1) % W;
          if (misses > PACE.MISSES) {
            // down — a trial that steps down again within WINDOW has failed: the next comes twice as late
            if (trial && runsAtK <= W) fails++;
            trial = false; setK(2);
          } else if (trial && runsAtK >= W) { trial = false; fails = 0; }
        } else if (runsAtK >= W * 2 ** fails && jsOvers <= PACE.MISSES && gpuOvers <= PACE.MISSES) {
          // up — a trial
          trial = true; setK(1);
        }
      }
      lastRun = ts;
      return true;
    },
    // what the run callback at ts did, just after R.frame: `outcome` — R.frame's (0 held, 1 idle, 2 drawn); whole —
    // the frame was a whole one (f.whole). A held callback and the one after a whole frame are not counted; a drawn
    // frame's js is taken at k = 2, and it waits in the ring for its done
    frame(ts, outcome, whole) {
      if (outcome === 0 || (outcome === 2 && whole)) uncounted = true;
      if (outcome !== 2 || !(k === 2 || measuring)) return;
      const at = performance.now(), counted = k === 2 && !whole;
      if (counted) { const o = at - began > PACE.JS * n * P ? 1 : 0; jsOvers += o - jsOver[jsAt]; jsOver[jsAt] = o; jsAt = (jsAt + 1) % W; }
      if (flyN === FLYING) return;
      const i = (flyAt + flyN++) % FLYING;
      flyTs[i] = ts; flySub[i] = at; flyNo[i] = gpu.submits; flyCounted[i] = counted ? 1 : 0; flyStep[i] = n * P;
    },
  };
}
