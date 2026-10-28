// Where things are, asked of the whole scene: a ray's first hit and the world's box.
//   The ray is main's model, kept (IN6): the first thing a ray meets among the quads as they stand — each a rectangle
// on its node, found through the inverse of place() for its kind —, the people (people.pick, PP5) and the land. It is
// a model apart from the picture, with its known limits: a moved layer is judged where it rests, an own shader's shape
// by its sheet, a form by its sphere. Two askers, and what stops a ray differs by who asks (SH4):
//   pick — the author's selection (with the sky and the inserts: skyHit, insertHit): a quad stops it where its sheet is
// truly painted, by the sheet's top mask (sheets.coverage — of the cache: nothing until the top is there);
//   ray — the camera's own questions (what the viewer's wheel walks toward, the operator's lines of sight, the
// ground's end): a quad stops it over its recording's extent — where its painting drew ink, known as the painting is
// taken, with no page: the camera reads nothing of the cache, so its framing is the same on every run —, and only
// where it is matter: a veil does not stop it (see through, below).
// A player's press uses neither (3.11: a press is a ring at a point).
//   Rays are rare (a click, a wheel's notch, a shot's beginning): every quad of what may be hit is tried, behind a
// sphere round its node — no tree is kept.
//   The box: world.bounds, from a sphere round every shown node (what its quads may reach), the people and the land's
// field — worked out again (world.js) when a node moved, was shown or a block was taken, in unseen steps too.
import { QUAD, FLAG, CAST } from '../base.js';
import { STAGE } from './spec.js';
import { skyAt, IRIS_ALL } from './place.js';
import * as m34 from './m34.js';

const TAU = 2 * Math.PI;

export function createSpace(world, sheets) {
  const T = world.tables, hit = { el: null, copy: 0, t: 0, point: new Float64Array(3) }, L = new Float64Array(3), at = [0, 0];
  // whether the sheet of a quad is painted at (px, py) of its units, by its top's mask (the author's selection)
  function painted(quad, px, py) {
    const Q = T.quads, R = Q.rect, r = 4 * quad, h = Q.sheet[quad];
    if (h < 0 || px < R[r] || px > R[r + 2] || py < R[r + 1] || py > R[r + 3]) return false;
    return sheets.coverage(h, (px - R[r]) / (R[r + 2] - R[r]), (py - R[r + 1]) / (R[r + 3] - R[r + 1])) === 1;
  }
  // whether the painting on el's slot s drew ink at (px, py) of its units, as far as the painting itself says: inside
  // its quad's rect and its recording's extent (el.extents — none: no painting taken, or an empty one). The camera's
  function inked(el, s, quad, px, py) {
    const R = T.quads.rect, r = 4 * quad, x = el.extents[s];
    return !!x && px >= Math.max(R[r], x[0]) && px <= Math.min(R[r + 2], x[2]) && py >= Math.max(R[r + 1], x[1]) && py <= Math.min(R[r + 3], x[3]);
  }
  // whether a camera's ray goes through el's slot s as through a veil: a layer that adds or multiplies (light, a
  // stain — not matter: it casts nothing either, WT2), or a painting whose densest draw (its recording's dense), times
  // its layer's alpha now, covers less than CAST.ALPHA — the line below which a cast program drops a fragment: what
  // casts no shadow hides nothing. Approximate: veils laid over one another (two layers, a painting's faint draws
  // piled up) are each taken by itself
  function seeThrough(el, s, flags) {
    if (flags & (FLAG.ADD | FLAG.MULTIPLY)) return true;
    const slot = el.slots[s], k = slot.kind === 'layer' && slot.layer >= 0 ? Math.min(1, T.layers.pose[8 * slot.layer + 5]) : 1;
    return (el.denses[s] ?? 1) * k < CAST.ALPHA;
  }
  // The first thing a ray (origin o, unit direction d — the world's, three numbers each) meets within `far` metres,
  // but the elements of `skip` (a Set): { el, copy, t, point } — el null: the land; or null. yaw: how what faces the
  // eye is turned for it (the camera the ray is from); land, people: whether they are met; masked: a quad stops it by
  // its sheet's mask (pick), else by its painting's extent, a veil not at all (ray). The hit is reused.
  function cast(o, d, far, skip, yaw, land, people, masked) {
    const Q = T.quads, M = T.nodes.m;
    let best = far, bestEl = null, bestCopy = 0;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    for (let e = 0; e < world.elements.length; e++) {
      const el = world.elements[e], k = el.kind;
      if (!el.count || !el.visible || k === 'sky' || k === 'insert' || el.flags.glass || (el.flags.seen && !el.flags.seen.main) || (skip && skip.has(el))) continue;
      const S = el.slots.length;
      for (let c = 0; c < el.nodes.length; c++) {
        // (a sphere round the copy's node: what its quads may reach)
        const n = 12 * el.nodes[c], ox = M[n + 9] - o[0], oy = M[n + 10] - o[1], oz = M[n + 11] - o[2];
        const along = ox * d[0] + oy * d[1] + oz * d[2], off2 = ox * ox + oy * oy + oz * oz - along * along, rr = el.radius * (el.copies ? el.copies[c].scale : 1);
        if (off2 > rr * rr || along + rr < 0 || along - rr > best) continue;
        for (let s = 0; s < S; s++) {
          const quad = el.first + c * S + s, kind = Q.kind[quad], flags = Q.flags[quad];
          if (!(flags & FLAG.SHOWN) || (flags & (FLAG.READ | FLAG.CUT_ONLY)) || (!masked && seeThrough(el, s, flags))) continue;
          if (kind === QUAD.FORM) {
            // (a form: its sphere, where the ray enters it)
            const F = world.forms.list[Q.form[quad]];
            if (!F) continue;
            m34.point(M, 12 * Q.node[quad], F.sphere[0], F.sphere[1], F.sphere[2], L);
            const fx = L[0] - o[0], fy = L[1] - o[1], fz = L[2] - o[2], fa = fx * d[0] + fy * d[1] + fz * d[2], f2 = fx * fx + fy * fy + fz * fz - fa * fa, fr = F.sphere[3] * m34.scaleOf(M, 12 * Q.node[quad]);
            if (f2 > fr * fr) continue;
            const t = fa - Math.sqrt(fr * fr - f2);
            if (t > 0 && t < best) { best = t; bestEl = el; bestCopy = c; }
            continue;
          }
          const m = 12 * Q.node[quad];
          let px, py, t;
          if (kind === QUAD.FACING) {
            const dn = -d[0] * sy + d[2] * cy;
            if (Math.abs(dn) < 1e-9) continue;
            t = (-(M[m + 9] - o[0]) * sy + (M[m + 11] - o[2]) * cy) / dn;
            if (!(t > 0 && t < best)) continue;
            const sc = m34.scaleOf(M, m), vx = o[0] + d[0] * t - M[m + 9], vy = o[1] + d[1] * t - M[m + 10], vz = o[2] + d[2] * t - M[m + 11];
            px = (vx * cy + vz * sy) / sc; py = -vy / sc;
          } else {
            const nx = M[m + 6], ny = M[m + 7], nz = M[m + 8], dn = d[0] * nx + d[1] * ny + d[2] * nz;
            if (Math.abs(dn) < 1e-9) continue;
            t = ((M[m + 9] - o[0]) * nx + (M[m + 10] - o[1]) * ny + (M[m + 11] - o[2]) * nz) / dn;
            if (!(t > 0 && t < best)) continue;
            m34.inversePoint(M, m, o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t, L);
            px = L[0]; py = -L[1];
          }
          if (flags & FLAG.FLIP) px = -px;
          if (!(masked ? painted(quad, px, py) : inked(el, s, quad, px, py))) continue;
          best = t; bestEl = el; bestCopy = c;
        }
      }
    }
    if (people && world.people) {
      const ph = world.people.pick(o, d), who = ph ? world.byId.get(ph.id) : null;
      if (who && !(skip && skip.has(who))) {
        const t = (ph.at[0] - o[0]) * d[0] + (ph.at[1] - o[1]) * d[1] + (ph.at[2] - o[2]) * d[2];
        if (t > 0 && t < best) { best = t; bestEl = who; bestCopy = 0; }
      }
    }
    if (land) {
      const t = world.relief ? world.relief.rayHit(o, d, best) : d[1] < -1e-9 ? -o[1] / d[1] : -1;
      if (t > 0 && t < best) { best = t; bestEl = null; bestCopy = 0; }
      else if (best >= far) return null;
    } else if (best >= far) return null;
    hit.el = bestEl; hit.copy = bestCopy; hit.t = best;
    hit.point[0] = o[0] + d[0] * best; hit.point[1] = o[1] + d[1] * best; hit.point[2] = o[2] + d[2] * best;
    return hit;
  }
  // the sky element painted where a way (dx, dy, dz) looks, for a view of that yaw — the last painted of them (it is
  // over the others) — or null
  function skyHit(dx, dy, dz, yaw, skip = null) {
    skyAt(dx, dy, dz, world.sky.yh, world.sky.round, yaw, at);
    let found = null;
    for (const el of world.elements) {
      if (el.kind !== 'sky' || !el.count || !el.visible || (skip && skip.has(el))) continue;
      // (its painting goes on round the circle: x from its left, 2π round)
      const l = el.box[0], x = l + (((at[0] - l) % TAU) + TAU) % TAU;
      for (let s = 0; s < el.slots.length; s++) if (!(T.quads.flags[el.first + s] & FLAG.READ) && painted(el.first + s, x, at[1])) { found = el; break; }
    }
    return found;
  }
  // the insert painted at a point of the frame (fx: frame heights to the right of its middle, fy: down from its top),
  // inside its iris as far as it is open — the last of them — or null
  function insertHit(fx, fy, skip = null) {
    let found = null;
    for (const el of world.elements) {
      if (el.kind !== 'insert' || !el.count || !el.visible || (skip && skip.has(el))) continue;
      const I = world.inserts[el.insertRow], iris = I.iris || IRIS_ALL, x = fx + STAGE / 2;
      const ix = (x - iris[0]) / (iris[2] * I.open), iy = (fy - iris[1]) / (iris[3] * I.open);
      if (!(I.open > 0) || ix * ix + iy * iy >= 1) continue;
      for (let s = 0; s < el.slots.length; s++) if (!(T.quads.flags[el.first + s] & FLAG.READ) && painted(el.first + s, x, fy)) { found = el; break; }
    }
    return found;
  }
  // world.bounds as the world stands
  // (a sphere taken into world.bounds — its two arrays are the same ones for as long as the world is)
  const lo = world.bounds.min, hi = world.bounds.max;
  const take = (x, y, z, r) => {
    if (x - r < lo[0]) lo[0] = x - r; if (y - r < lo[1]) lo[1] = y - r; if (z - r < lo[2]) lo[2] = z - r;
    if (x + r > hi[0]) hi[0] = x + r; if (y + r > hi[1]) hi[1] = y + r; if (z + r > hi[2]) hi[2] = z + r;
  };
  function bounds() {
    const M = T.nodes.m;
    lo[0] = lo[1] = lo[2] = Infinity; hi[0] = hi[1] = hi[2] = -Infinity;
    for (let e = 0; e < world.elements.length; e++) {
      const el = world.elements[e];
      if (el.kind === 'sky' || el.kind === 'insert' || el.kind === 'particles' || (!el.count && el.kind !== 'person')) continue;
      for (let c = 0; c < el.nodes.length; c++) { const n = 12 * el.nodes[c]; take(M[n + 9], M[n + 10], M[n + 11], el.kind === 'person' ? 2.5 : el.radius * (el.copies ? el.copies[c].scale : 1)); }
    }
    const R = world.relief;
    if (R) { const F = R.field; take(F.x0, R.low, -F.z0, 0); take(F.x0 + (F.nx - 1) * F.step, R.high, -(F.z0 + (F.nz - 1) * F.step), 0); }
    if (lo[0] === Infinity) { lo[0] = lo[1] = lo[2] = -1; hi[0] = hi[1] = hi[2] = 1; }
  }
  return {
    ray: (o, d, far, skip = null, yaw = world.yaw, land = true, people = true) => cast(o, d, far, skip, yaw, land, people, false),
    pick: (o, d, far, skip = null, yaw = world.yaw, land = true) => cast(o, d, far, skip, yaw, land, true, true),
    skyHit, insertHit, bounds,
  };
}
