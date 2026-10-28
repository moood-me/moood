// What is painted on the stage rather than in the world — the sky's sheets, the inserts (5.16, RN4). Where each
// point of them is, is SCENE's (place.js, chunk `world`: skyWay, the insert's rect and iris); they are drawn by the
// quads' machinery with two pipelines of their own — `sky`: after the solids of `main-solid`, tested against that
// depth, only where nothing covers it; `insert`: last in `main-blend`, over everything, laid over the safe rect (the
// view's e_stage), seen through its iris as far as it is open. Here: what RENDER works out of the inserts each frame.
//   The sky past what it paints (decisions S7). A sky element paints its box (the language: by default the stage and
// its margins; an author may paint up to a whole turn across and far up and down) — drawn as any sheet, at its level.
// Past it the first SHOWN sky element's painting goes on by itself — its top on up, its bottom on down, its right end
// round behind into its left (looking round, round the circle; looking ahead, the backdrop's turn) —, softly. One
// triangle over the view, before the sky's sheets, at the far plane under the same test (`sky-base`,
// render/wgsl/sky.js): each pixel's way through the view's lens back to its point of the sky (skyAt), and where that
// point is past the painting's rect, the painting's edge there — at the pixel's own level at the edge, ever coarser
// away from it, from what the cache has (nothing asked, nothing waited for) —, between its two ends across the gap of
// the turn they leave. Inside the rect the sky's own sheets are drawn as they are. `past` says whether a view shows
// anything past the rect at all: the frame's view draws the triangle only then (at 16:9, looking ahead, it does not).
//   Every insert's iris and opening go into the Frame uniform, by its row (WT5) — an insert that names no iris opens
// from the middle of the frame to all of it (place.js IRIS_ALL).
//   A solid insert that covers the whole canvas hides the world (RN4): its opening is 1, it has no iris, its painting's
// rect covers all the screen shows (world.view.seen: on a screen wider than the widest frame, or taller than the
// stage, the world goes on round it), and its base sheet is wholly opaque — R then draws nothing of the world for the
// frame, only the inserts.
//   The opening told is SCENE's (WT5 `open`): an insert opens only once it is finished — its painting on it, its pages
// there — and its key's move is run from then (RN4: world/world.js). RENDER draws it as SCENE says.
import { INSERTS } from '../base.js';
import { IRIS_ALL, skyAt } from '../world/place.js';
import { FRAME } from './wgsl/frame.js';

// (a hair of a stage height — far under a pixel — that a rect may fall short of the screen's edge and still cover it)
const EDGE = 1e-4;
// past: the points of a view's border looked at (a side's, from corner to corner) — its extremes lie on its border —
// and how far inside the rect they must be (stage heights: what a sample between them may reach past them, and the
// pixels the triangle leaves under the sheets)
const BORDER = 6, INSIDE = 0.06, TAU = 2 * Math.PI;

export function createStage(sheets) {
  const S = { covered: false, stamp: 0 };
  // The frame's inserts: their irises and openings into the Frame's data; → S.covered
  S.place = (world, into) => {
    const I = world.inserts, Q = world.quads, iris = FRAME.IRIS / 4, open = FRAME.OPEN / 4, V = world.view.seen, R = Q.rect;
    S.covered = false; S.stamp = 0;
    for (let row = 0; row < INSERTS.MOST; row++) {
      const insert = I[row], shape = insert ? insert.iris || IRIS_ALL : IRIS_ALL, much = insert ? insert.open : 0;
      if (insert && much >= 1 && !insert.iris) {
        const el = world.elements[insert.el];
        const r = 4 * el.first;
        if (el.count > 0 && R[r] <= V[0] + EDGE && R[r + 1] <= V[1] + EDGE && R[r + 2] >= V[2] - EDGE && R[r + 3] >= V[3] - EDGE && sheets.solid(Q.sheet[el.first]) === 2) S.covered = true;
      }
      if (insert && insert.stamp > S.stamp) S.stamp = insert.stamp;
      for (let k = 0; k < 4; k++) into[iris + 4 * row + k] = shape[k];
      into[open + row] = much;
    }
  };
  // whether a view (camera: RN5) shows any of the sky past the painting of `quad` (the base's) — its border's points
  // brought back to the sky and looked for inside the rect
  const at = new Float64Array(2);
  S.past = (world, camera, quad) => {
    const R = camera.rot, P = camera.proj, Q = world.quads, r = 4 * quad, l = Q.rect[r], t = Q.rect[r + 1], rr = Q.rect[r + 2], b = Q.rect[r + 3];
    for (let k = 0; k < 4 * BORDER; k++) {
      const side = k / BORDER | 0, u = (k % BORDER) / BORDER * 2 - 1;
      const nx = side === 0 ? u : side === 1 ? 1 : side === 2 ? -u : -1, ny = side === 0 ? 1 : side === 1 ? u : side === 2 ? -1 : -u;
      const ex = (nx + P[8]) / P[0], ey = (ny + P[9]) / P[5];
      skyAt(R[0] * ex + R[1] * ey - R[2], R[3] * ex + R[4] * ey - R[5], R[6] * ex + R[7] * ey - R[8], world.sky.yh, world.sky.round, camera.yaw, at);
      // (round into the turn that begins at its left — and a turn on, where the painting reaches past a whole one)
      const x = l + (((at[0] - l) % TAU) + TAU) % TAU, across = (x > l + INSIDE && x < rr - INSIDE) || (x + TAU > l + INSIDE && x + TAU < rr - INSIDE);
      if (!across || at[1] < t + INSIDE || at[1] > b - INSIDE) return true;
    }
    return false;
  };
  return S;
}
