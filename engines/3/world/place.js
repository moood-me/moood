// WT7 — where a point of a sheet is: the one mapping of every kind of quad, in JS. SHEETS' ask, RENDER's culling, the
// points the page follows and the rays all call it; world.wgsl.js is the same arithmetic for the vertex stage, by the
// same author — so the pages an ask names and the pages a shader reads cannot differ.
//   place(world, quad, p[, view]) → boolean — p: three numbers (a Float64Array), given as the point (x, y) of that
// quad's sheet (the sheet's units: metres in the node's plane, y down; stage heights for the sky and an insert) and
// the yaw of the view it is placed for; taken back as where the point is; false: the point is not there (an
// insert's outside its iris as far as it is open). The numbers go in and come out in the one array — and so do
// those of the helpers here: a number handed to a function, or handed back by one, is made on the heap at every
// call, and this is called for every corner of every page a view is asked (5.16: nothing allocated in a tick). Only
// the land's own function is called with numbers: it is the author's (LG).
//   What `p` is then, by the quad's kind:
//     CARD, PLANE   the world point m · (x, −y, depth) — the layer's pose first, its depth off the node's face
//     FACING        the node's origin + Ry(yaw) · (x, −y, depth) · the node's scale: upright, turned to the eye
//     DRAPE         m · (x, −y, 0), then lifted by the land function itself there: y += height(x, −z) (WT5: nothing
//                   is placed from the field)
//     FORM          m · the grid's point at (u, v) of the quad's rect, bilinear between its 33 × 33 points
//     SKY           the unit direction toward that point of the sky (skyWay) — a point at infinity. A sky that does
//                   not go round is a BACKDROP: a plane a unit before the gaze's yaw — the way toward its point, not
//                   made a unit, is affine in the point (backdropWay), so a piece of it is a flat piece
//     INSERT        (x − STAGE / 2, y, 0): frame heights to the right of the frame's middle and down from its top
//   A layer's pose comes first for every kind — the sky's and an insert's too. But a sheet an own shader reads where
// its quad stands (a READ row not read WHOLE: WT2) lies as that quad's painting does: the shader reads it at the
// painting's own point, whatever pose its layer has — so its pages are asked there.
//   view: what a view has other than the world as it is — { nodes, nodeOf, nodesN, over, overN } (a shot's entry of
// f.ahead, or SHEETS' View: both have these fields) or nothing. nodes: (node row → its 3 × 4 matrix) for the nodes a
// shot's values place elsewhere; over: the swaps (quad, handle, form) — a swapped FORM's grid is read from the swap's
// row (a swap that ENDS a row — (quad, −1, −1), SH2 — names no grid: the row's own is read).
import { QUAD, FLAG, FORM } from '../base.js';
import { STAGE, WIDEST } from './spec.js';

const TAU = 2 * Math.PI, SIDE = FORM.SIDE, CELLS = SIDE - 1;
// an insert's iris when it names none: from the middle of the frame to all of it (the widest frame's corners)
export const IRIS_ALL = Object.freeze([STAGE / 2, 0.5, Math.hypot(WIDEST / 2, 0.5) + 0.05, Math.hypot(WIDEST / 2, 0.5) + 0.05]);
// past half the circle either way the backdrop shows the point opposite the gaze
const BEHIND = Math.atan(Math.PI);

// The direction toward a point of the sky as a sky element paints it — p: (x, y) stage heights from the stage's
// top-left, and the view's yaw (radians); taken back as the way, in the world: looking round (sky.round) a cylinder,
// x radians round from behind (x = π straight ahead); looking ahead a backdrop the view's yaw carries round with it:
// its point x − STAGE / 2 − yaw aside of the gaze and yh − y up, of the points a whole turn apart the one nearest
// the gaze (the TURN it is in: turnOf). sky: { yh — the horizon on the stage —, round }.
export function skyWay(p, sky) {
  const up = sky.yh - p[1];
  if (sky.round) { const b = p[0] - Math.PI; p[0] = Math.sin(b); p[1] = up; p[2] = -Math.cos(b); }
  else { p[0] -= STAGE / 2 + p[2]; p[1] = up; backdropWay(p, turnOf(p[0])); }
  const l = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
  p[0] /= l; p[1] /= l; p[2] /= l;
  return p;
}
// the turn of the circle a point of a backdrop that far aside of the gaze is in (a whole number; 0: the turn about
// the gaze)
export const turnOf = aside => Math.floor(aside / TAU + 0.5);
// The way toward a point of a backdrop — p: how far aside of the gaze it is as the sheet has it, how far up above
// the horizon, the view's yaw; turn: the turn of the circle it is seen in (it is o = aside − TAU · turn aside there)
// — taken back NOT made a unit: (the gaze) + o · (its right) + up · (up), a plane a unit before the gaze. It is
// affine in (aside, up): between the corners of a piece of a backdrop its points lie as on any flat piece (SH10
// asks it so). (The vertex stage's e_skyWay writes the same way as the sine and the cosine of yaw + atan(o), up ·
// cos(atan(o)): this one less the cosine.)
export function backdropWay(p, turn) {
  const o = p[0] - TAU * turn, c = Math.cos(p[2]), s = Math.sin(p[2]);
  p[0] = s + o * c; p[2] = o * s - c;
  return p;
}
// … and back: the stage point a way (dx, dy, dz) looks at, into out (x, y) — unwrapped (x goes on round the circle)
export function skyAt(dx, dy, dz, yh, round, yaw, out) {
  const flat = Math.max(Math.sqrt(dx * dx + dz * dz), 1e-9), b = Math.atan2(dx, -dz), up = dy / flat;
  const r = b - yaw - TAU * Math.floor((b - yaw + Math.PI) / TAU);
  if (round) { out[0] = yaw + r + Math.PI; out[1] = yh - up; return out; }
  const rc = Math.min(Math.abs(r), BEHIND);
  out[0] = STAGE / 2 + Math.sign(r) * Math.tan(rc) + yaw; out[1] = yh - up / Math.cos(rc);
  return out;
}

// a layer's pose on a point of its sheet — p: (x, y), taken back posed: scaled and turned about its pivot (Canvas's
// sense), moved
export function posed(layers, row, p) {
  const P = layers.pose, O = layers.opts, q = 8 * row, o = 12 * row;
  const px = O[o], py = O[o + 1], c = Math.cos(P[q + 2]), s = Math.sin(P[q + 2]), dx = (p[0] - px) * P[q + 3], dy = (p[1] - py) * P[q + 4];
  p[0] = px + c * dx - s * dy + P[q]; p[1] = py + s * dx + c * dy + P[q + 1];
  return p;
}

// a form's grid at (u, v) 0…1 — p: (u, v), taken back as the point there, bilinear (three numbers: the node's metres)
function formAt(points, p) {
  const fu = Math.max(0, Math.min(CELLS, p[0] * CELLS)), fv = Math.max(0, Math.min(CELLS, p[1] * CELLS));
  const i = Math.min(CELLS - 1, Math.floor(fu)), j = Math.min(CELLS - 1, Math.floor(fv)), a = fu - i, b = fv - j;
  const o = 3 * (j * SIDE + i), w00 = (1 - a) * (1 - b), w10 = a * (1 - b), w01 = (1 - a) * b, w11 = a * b;
  for (let k = 0; k < 3; k++) p[k] = points[o + k] * w00 + points[o + 3 + k] * w10 + points[o + 3 * SIDE + k] * w01 + points[o + 3 * SIDE + 3 + k] * w11;
  return p;
}

// a point of a quad's sheet as its layer's pose lays it — the first step of every kind — p: (x, y), taken back laid →
// whether a layer laid it (its depth off the node's face is then the layer's: no number is handed back)
function laid(world, quad, p) {
  const Q = world.quads, layer = Q.layer[quad];
  if (layer < 0 || (Q.flags[quad] & (FLAG.READ | FLAG.WHOLE)) === FLAG.READ) return false;
  posed(world.layers, layer, p);
  return true;
}
// Where a point of a BACKDROP's sheet is on its plane — p: (x, y) of a sky quad's sheet and the view's yaw; taken
// back as (how far aside of the gaze, not brought round to the turn nearest it; how far up above the horizon)
export function backdropAt(world, quad, p) {
  laid(world, quad, p);
  p[0] -= STAGE / 2 + p[2]; p[1] = world.sky.yh - p[1];
  return p;
}

const local = new Float64Array(3);
export function place(world, quad, p, view = null) {
  const Q = world.quads, kind = Q.kind[quad], flags = Q.flags[quad], yaw = p[2];
  const depth = laid(world, quad, p) ? world.layers.opts[12 * Q.layer[quad] + 7] : 0;
  if (kind === QUAD.SKY) { skyWay(p, world.sky); return true; }
  let x = p[0];
  const y = p[1];
  if (kind === QUAD.INSERT) {
    const I = world.inserts[Q.aux[quad]], iris = I.iris || IRIS_ALL, open = I.open;
    p[0] = x - STAGE / 2; p[1] = y; p[2] = 0;
    if (!(open > 0)) return false;
    const ix = (x - iris[0]) / (iris[2] * open), iy = (y - iris[1]) / (iris[3] * open);
    return ix * ix + iy * iy < 1;
  }
  if ((flags & FLAG.FLIP) && kind !== QUAD.FORM) x = -x;
  // the node's matrix: the world's, or the view's own for a node its values place elsewhere
  let M = world.nodes.m, o = 12 * Q.node[quad];
  if (view && view.nodesN) { const node = Q.node[quad]; for (let k = 0; k < view.nodesN; k++) if (view.nodeOf[k] === node) { M = view.nodes; o = 12 * k; break; } }
  if (kind === QUAD.FACING) {
    const s = Math.sqrt(M[o] * M[o] + M[o + 1] * M[o + 1] + M[o + 2] * M[o + 2]), c = Math.cos(yaw), sn = Math.sin(yaw);
    p[0] = M[o + 9] + s * (x * c - depth * sn); p[1] = M[o + 10] - s * y; p[2] = M[o + 11] + s * (x * sn + depth * c);
    return true;
  }
  let lx = x, ly = -y, lz = depth;
  if (kind === QUAD.FORM) {
    let form = Q.form[quad];
    if (view && view.overN) for (let k = 0; k < view.overN; k++) if (view.over[3 * k] === quad) { if (view.over[3 * k + 2] >= 0) form = view.over[3 * k + 2]; break; }
    const R = Q.rect, r = 4 * quad, F = world.forms.list[form];
    if (!F) return false;
    local[0] = (x - R[r]) / (R[r + 2] - R[r]); local[1] = (y - R[r + 1]) / (R[r + 3] - R[r + 1]);
    formAt(F.points, local);
    lx = flags & FLAG.FLIP ? -local[0] : local[0]; ly = local[1]; lz = local[2];
  }
  p[0] = M[o] * lx + M[o + 3] * ly + M[o + 6] * lz + M[o + 9];
  p[1] = M[o + 1] * lx + M[o + 4] * ly + M[o + 7] * lz + M[o + 10];
  p[2] = M[o + 2] * lx + M[o + 5] * ly + M[o + 8] * lz + M[o + 11];
  if (kind === QUAD.DRAPE) world.lift(p);
  return true;
}
