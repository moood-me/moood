// The lit set, the grid and the panes (5.5, LG10): every light of the world is a row of WT4, any number; each frame
// RENDER chooses the LIT SET — at most LIGHT.LIT: the far lights and those through panes that shine (the
// LIGHT.FAR_MOST and LIGHT.THROUGH_MOST strongest: a scene with more is told once), in the spec's order, then the
// beams (a point light with a cone: the LIGHT.SPOT_MOST most worth to the view, in the spec's order; more lighting
// the view at once is told once), then the others by worth to the view (strength × the share of the frame its light
// fills: a lamp's and a window's reach about it, a beam's cone — the least sphere about it); a light whose reach
// covers less than LIGHT.SMALL px of the frame, or whose reach is nowhere in the view, lights nothing that can be seen
// and is not in it. Only the lit set is in the `lights` buffer and the grid: the grid's cells are laid over the lit set's own
// bounds, a cell keeps the LIGHT.CELL most worth at its middle. A window's light reaches from its rectangle, not from
// its middle: where it is culled, bounded and put into the grid its reach is its `reach` plus half its rectangle's
// diagonal (the shader measures from the rectangle itself). A beam is in none of the grid's cells: it is read at every
// lit point, as the far lights are; its row holds the way it points and its cone's cosines.
//   Every light's glow is drawn whether it lights or not — in the frame and in every mirror's image: the glows'
// rows (one buffer, the farthest from the frame's eye first: they are drawn among what blends — render/quads.js,
// render/wgsl/post.js `render.glow` — and, all of them at once, after what blends in a mirror's pass) hold every glow
// seen by the frame's view or by a mirror's of this frame. A glow: a painted light's sprite is
// GLOW.PAINTED of its strength; a lamp's own `glow` is two rows — a halo `glow` metres in radius at 0.6 · min(1,
// strength) in the light's colour, and a bright dot a quarter of that radius at 0.8 · min(1, strength) in a warm
// white. While the look has hazeGlow, a lamp's halo in the haze is a row of the halos' buffer, for every lamp that
// shines in the frame's view (render/air.js); a beam has no halo — its cone in the haze is its rows of the lit set's
// (render/air.js), and its glows — its own and a painted one's it took over (`of`) — shine toward the frame's eye as
// much as its cone does, never less than BEAM_GLOW of it.
//   What of the lights a mirror shows (L.seenBy): the lit set's that light within its view and the glows seen in it,
// by their stamps — a light that changes elsewhere draws no mirror again.
//   The panes (WT5): each pane of a light through panes is a plane's row after the lit rows — when a point is past it
// along the way to the light, where that way meets it in cells of its mask — and a mask in the `panes` texture: the
// pane's outline rastered here, its edge as soft as the light says. A daylight's window is its pane's rectangle.
//   Places on the GPU are the world's less the render origin: on a step of the origin every row is written again.
import { GLOW, LIGHT, linearOf } from '../base.js';
import { LIT, GRID } from './wgsl/frame.js';
import { HALO } from './wgsl/post.js';
import { sees, ahead, pxAt } from './views.js';

// (how far before a view's eye a point is: ahead's answer)
const far = new Float64Array(1);

const PANES = 512, PANE_CELL = 0.05, PANE_MOST = 128, GLOW_BYTES = 48;
// a lamp's own glow: how much its halo and its dot shine (of min(1, strength)), the dot's radius of the halo's, its colour
const HALO_SHINE = 0.6, DOT_SHINE = 0.8, DOT_RADIUS = 0.25, DOT = linearOf('#fff5dc');
// what a row of the glows is: a painted light's sprite, a lamp's halo, its dot
const SPRITE = 0, HALO_ROW = 1, DOT_ROW = 2;
// how much of its glow a beam's lamp keeps seen from outside its cone
const BEAM_GLOW = 0.15;

export function createLights(gpu) {
  const B = GPUBufferUsage, T = GPUTextureUsage;
  const rowsN = LIGHT.LIT + LIT.PLANES, data = new Float32Array(rowsN * LIT.BYTES / 4);
  const buffer = gpu.buffer('lights', rowsN * LIT.BYTES, B.STORAGE | B.COPY_DST);
  const cells = GRID.SIDE * GRID.SIDE, words = new Uint32Array(cells * GRID.WORDS), worthIn = new Float32Array(cells * LIGHT.CELL);
  const grid = gpu.buffer('light grid', words.byteLength, B.STORAGE | B.COPY_DST);
  const panes = gpu.texture('panes', { size: [PANES, PANES], format: 'r8unorm', usage: T.TEXTURE_BINDING | T.COPY_DST });
  let glowCap = 256, glowData = new Float32Array(glowCap * GLOW_BYTES / 4), glows = gpu.buffer('glows', glowCap * GLOW_BYTES, B.VERTEX | B.COPY_DST);
  let glowOf = new Int32Array(glowCap), glowPart = new Uint8Array(glowCap), glowKey = new Float64Array(glowCap), glowAhead = new Float64Array(glowCap);
  let haloCap = 256, haloData = new Float32Array(haloCap * HALO.BYTES / 4), halos = gpu.buffer('halos', haloCap * HALO.BYTES, B.VERTEX | B.COPY_DST);
  let world = null, cand = new Int32Array(0), worth = new Float64Array(0), rowOf = new Int32Array(0), sky = new Uint8Array(0), masks = [], panesStamp = -1, planes = 0, O = null;
  // how far a light reaches beyond its `reach` (a window: half its rectangle's diagonal), by its row of the world;
  // how far a row of the lit set reaches in all
  let spread = new Float32Array(0);
  const reachOf = new Float32Array(LIGHT.LIT);
  // the light of the world each row of the lit set holds
  const lightOf = new Int32Array(LIGHT.LIT);
  const said = { far: false, through: false, spot: false, planes: false };
  // which lights are of a kind: far, through panes, a beam (WT4: a point with a cone)
  const isFar = i => world.lights.kind[i] === LIGHT.FAR, isThrough = i => world.lights.kind[i] === LIGHT.THROUGH;
  const isBeam = i => world.lights.kind[i] === LIGHT.POINT && world.lights.cone[2 * i + 1] > 0;
  const WHAT = { far: 'far lights', through: 'lights through panes' };
  const S = new Float64Array(4), sent = new Float32Array(data.length), sentWords = new Uint32Array(words.length);
  const L = { buffer, grid, panes: panes.createView(), glows: null, glowN: 0, glowAhead: null, halos: null, haloN: 0, farN: 0, throughN: 0, spotN: 0, lightN: 0, gridAt: new Float32Array(4), flickers: false, points: false, rowOf: null, moves: false };

  // a pane's mask: its outline (the node's plane, x right, y down) rastered into a tile of the texture, its edge soft
  function rasterPanes() {
    const Pn = world.panes;
    masks = []; panesStamp = Pn ? Pn.stamp : -1;
    if (!Pn) return;
    const all = new Uint8Array(PANES * PANES);
    let x0 = 0, y0 = 0, shelf = 0;
    for (let i = 0; i < Pn.n; i++) {
      const l = Pn.rect[4 * i], t = Pn.rect[4 * i + 1], r = Pn.rect[4 * i + 2], b = Pn.rect[4 * i + 3];
      const soft = Math.max(world.lights.soft[Pn.light[i]] || 0, 0), cell = Math.max(PANE_CELL, Math.max(r - l, b - t) / (PANE_MOST - 8)), pad = soft + 2 * cell;
      const w = Math.min(PANE_MOST, Math.ceil((r - l + 2 * pad) / cell)), h = Math.min(PANE_MOST, Math.ceil((b - t + 2 * pad) / cell));
      if (x0 + w > PANES) { x0 = 0; y0 += shelf; shelf = 0; }
      if (y0 + h > PANES) { world.warn(`lights: more panes than their masks' texture holds — pane ${i} and those after it let no light through`); break; }
      // (its outline: even-odd, four samples a cell each way; then blurred as wide as its edge is soft)
      const o = Pn.polyOf[2 * i], n = Pn.polyOf[2 * i + 1], m = new Float32Array(w * h);
      for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) {
        let hits = 0;
        for (let s = 0; s < 16; s++) {
          const x = l - pad + (k + ((s & 3) + 0.5) / 4) * cell, y = t - pad + (j + ((s >> 2) + 0.5) / 4) * cell;
          let inside = false;
          for (let a = 0, c = n - 1; a < n; c = a++) {
            const ax = Pn.poly[2 * (o + a)], ay = Pn.poly[2 * (o + a) + 1], cx = Pn.poly[2 * (o + c)], cy = Pn.poly[2 * (o + c) + 1];
            if ((ay > y) !== (cy > y) && x < (cx - ax) * (y - ay) / (cy - ay) + ax) inside = !inside;
          }
          if (inside) hits++;
        }
        m[j * w + k] = hits / 16;
      }
      const R = Math.round(soft / cell / 2);
      if (R > 0) for (let pass = 0; pass < 2; pass++) for (const across of [true, false]) {
        const from = m.slice();
        for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) {
          let sum = 0;
          for (let d = -R; d <= R; d++) { const x = across ? Math.min(w - 1, Math.max(0, k + d)) : k, y = across ? j : Math.min(h - 1, Math.max(0, j + d)); sum += from[y * w + x]; }
          m[j * w + k] = sum / (2 * R + 1);
        }
      }
      for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) all[(y0 + j) * PANES + x0 + k] = Math.round(255 * m[j * w + k]);
      masks[i] = { x: x0, y: y0, w, h, l: l - pad, t: t - pad, cell };
      x0 += w; shelf = Math.max(shelf, h);
    }
    gpu.queue.writeTexture({ texture: panes }, all, { bytesPerRow: PANES }, [PANES, PANES]);
  }

  // a plane of panes' row for a light whose way is (wx, wy, wz): pane i → row k
  function planeRow(k, i, wx, wy, wz) {
    const Pn = world.panes, M = world.nodes.m, o = 12 * Pn.node[i], m = masks[i], w = (LIGHT.LIT + k) * 20;
    const nx = M[o + 6], ny = M[o + 7], nz = M[o + 8], cx = M[o + 9] - O[0], cy = M[o + 10] - O[1], cz = M[o + 11] - O[2];
    const wn = wx * nx + wy * ny + wz * nz, sign = wn < 0 ? -1 : 1, cn = cx * nx + cy * ny + cz * nz;
    data[w] = -nx * sign; data[w + 1] = -ny * sign; data[w + 2] = -nz * sign; data[w + 3] = cn * sign;
    // (where the way from P meets the plane, in cells of the mask: affine in P — along the node's x, then down it)
    for (let axis = 0; axis < 2; axis++) {
      const a = o + 3 * axis, len2 = M[a] * M[a] + M[a + 1] * M[a + 1] + M[a + 2] * M[a + 2] || 1, s = (axis ? -1 : 1) / (len2 * m.cell);
      const gx = M[a] * s, gy = M[a + 1] * s, gz = M[a + 2] * s, gw = (gx * wx + gy * wy + gz * wz) / (Math.abs(wn) < 1e-6 ? 1e-6 : wn);
      const g0 = -(gx * cx + gy * cy + gz * cz) - (axis ? m.t : m.l) / m.cell, q = w + 4 + 4 * axis;
      data[q] = gx - nx * gw; data[q + 1] = gy - ny * gw; data[q + 2] = gz - nz * gw; data[q + 3] = gw * cn + g0;
    }
    data[w + 12] = m.x; data[w + 13] = m.y; data[w + 14] = m.w; data[w + 15] = m.h;
  }
  // light i into row `row` of the lit set
  function put(row, i) {
    const Lt = world.lights, w = 20 * row, k = Lt.kind[i], far = k < LIGHT.POINT;
    rowOf[i] = row; lightOf[row] = i;
    data[w] = far ? Lt.way[3 * i] : Lt.at[3 * i] - O[0]; data[w + 1] = far ? Lt.way[3 * i + 1] : Lt.at[3 * i + 1] - O[1]; data[w + 2] = far ? Lt.way[3 * i + 2] : Lt.at[3 * i + 2] - O[2]; data[w + 3] = k;
    data[w + 4] = Lt.colour[3 * i]; data[w + 5] = Lt.colour[3 * i + 1]; data[w + 6] = Lt.colour[3 * i + 2]; data[w + 7] = Lt.strength[i];
    data[w + 8] = Lt.reach[i]; data[w + 9] = Lt.flicker[i]; data[w + 10] = Lt.seed[i]; data[w + 11] = Lt.flags[i] & LIGHT.INSIDE ? 1 : 0;
    for (let q = 12; q < 20; q++) data[w + q] = 0;
    if (!far && Lt.flicker[i] > 0) L.flickers = true;
    const Pn = world.panes;
    if (k === LIGHT.THROUGH && Pn) {
      // (its panes: the planes' rows that follow one another)
      data[w + 12] = planes;
      for (let p = 0; p < Pn.n; p++) {
        if (Pn.light[p] !== i || !masks[p]) continue;
        if (planes === LIT.PLANES) { if (!said.planes) { said.planes = true; world.warn(`lights: more than ${LIT.PLANES} panes let light through at once — the rest let none`); } break; }
        planeRow(planes++, p, Lt.way[3 * i], Lt.way[3 * i + 1], Lt.way[3 * i + 2]);
      }
      data[w + 13] = planes - data[w + 12];
    } else if (isBeam(i)) {
      // (where it points, the cosines of its edge and of where its edge begins)
      data[w + 12] = Lt.way[3 * i]; data[w + 13] = Lt.way[3 * i + 1]; data[w + 14] = Lt.way[3 * i + 2];
      data[w + 15] = Lt.cone[2 * i]; data[w + 16] = Lt.cone[2 * i + 1];
    } else if (k === LIGHT.WINDOW && Pn) {
      // (its rectangle: its pane's, half each way; before its face)
      for (let p = 0; p < Pn.n; p++) if (Pn.light[p] === i) {
        const M = world.nodes.m, o = 12 * Pn.node[p], hw = 0.5 * (Pn.rect[4 * p + 2] - Pn.rect[4 * p]), hh = 0.5 * (Pn.rect[4 * p + 3] - Pn.rect[4 * p + 1]);
        for (let a = 0; a < 3; a++) { data[w + 12 + a] = M[o + a] * hw; data[w + 16 + a] = M[o + 3 + a] * hh; }
        const fx = data[w + 13] * data[w + 18] - data[w + 14] * data[w + 17], fy = data[w + 14] * data[w + 16] - data[w + 12] * data[w + 18], fz = data[w + 12] * data[w + 17] - data[w + 13] * data[w + 16];
        data[w + 15] = fx * Lt.way[3 * i] + fy * Lt.way[3 * i + 1] + fz * Lt.way[3 * i + 2] < 0 ? -1 : 1;
        break;
      }
    }
  }
  // the lights of one kind (is: its test) that shine, the `most` strongest of them: sky[i] = 1 for each kept. → how many
  function kept(is, most, name) {
    const Lt = world.lights;
    let n = 0;
    for (let i = 0; i < Lt.n; i++) if (is(i) && Lt.strength[i] > 0) { sky[i] = 1; n++; }
    if (n <= most) return n;
    if (!said[name]) { said[name] = true; world.warn(`lights: ${n} ${WHAT[name]} shine at once — the ${most} strongest light the scene`); }
    for (; n > most; n--) {
      let least = -1;
      for (let i = 0; i < Lt.n; i++) if (is(i) && sky[i] && (least < 0 || Lt.strength[i] < Lt.strength[least])) least = i;
      sky[least] = 0;
    }
    return most;
  }
  // the sphere light i (a lamp, a window, a beam) lights within → S: its reach about it (a window's plus half its
  // rectangle's diagonal); a beam's under 60° each side of its way, the least one about its cone — on its way, r / (2 ·
  // cos) from it, as wide (it holds the cone's tip and its rim; for a wider beam that is wider than the reach)
  function bound(i) {
    const Lt = world.lights, r = Lt.reach[i] + spread[i], c = Lt.cone[2 * i];
    S[0] = Lt.at[3 * i]; S[1] = Lt.at[3 * i + 1]; S[2] = Lt.at[3 * i + 2]; S[3] = r;
    if (isBeam(i) && c > 0.5) {
      const m = r / (2 * c);
      S[0] += Lt.way[3 * i] * m; S[1] += Lt.way[3 * i + 1] * m; S[2] += Lt.way[3 * i + 2] * m; S[3] = m;
    }
  }
  // what light i (a lamp, a window, a beam) is worth to a view: its strength × the share of the frame its light fills;
  // 0 where it lights nothing that can be seen — its sphere nowhere in the view, or less than LIGHT.SMALL px of it
  function weigh(i, view) {
    const e = view.e;
    bound(i);
    if (!sees(e, S)) return 0;
    ahead(e, S, far, 0);
    far[0] -= S[3];
    pxAt(e, far, 0);
    const px = S[3] * far[0];
    return px < LIGHT.SMALL ? 0 : world.lights.strength[i] * Math.min(1, (px / view.height) * (px / view.height));
  }
  // The beams that shine and light a view, the LIGHT.SPOT_MOST most worth to it (a scene with more lighting a view at
  // once is told once): into[i] = 1 for each. → how many
  function spots(view, into) {
    const Lt = world.lights;
    let n = 0;
    for (let i = 0; i < Lt.n; i++) {
      if (!isBeam(i) || !(Lt.strength[i] > 0) || !(Lt.reach[i] > 0)) continue;
      const w = weigh(i, view);
      if (w > 0) { cand[n++] = i; worth[i] = w; }
    }
    if (n > LIGHT.SPOT_MOST && !said.spot) { said.spot = true; world.warn(`lights: ${n} beams light the view at once — the ${LIGHT.SPOT_MOST} that light it most light the scene`); }
    // (the most worth first: as many passes as are taken, nothing allocated)
    const taken = Math.min(n, LIGHT.SPOT_MOST);
    for (let k = 0; k < taken; k++) {
      let best = k;
      for (let a = k + 1; a < n; a++) if (worth[cand[a]] > worth[cand[best]]) best = a;
      const c = cand[best]; cand[best] = cand[k]; cand[k] = c;
      into[c] = 1;
    }
    return taken;
  }
  // The lamps and windows a view may be lit by — those whose reach meets it and shows at least LIGHT.SMALL px —, the
  // `room` most worth of them first in `cand`. → how many of `cand` are taken
  function others(view, room) {
    const Lt = world.lights;
    let n = 0;
    for (let i = 0; i < Lt.n; i++) {
      if (Lt.kind[i] < LIGHT.POINT || !(Lt.strength[i] > 0) || !(Lt.reach[i] > 0) || isBeam(i)) continue;
      const w = weigh(i, view);
      if (w > 0) { cand[n++] = i; worth[i] = w; }
    }
    // (the most worth first: a shell sort of the candidates, nothing allocated)
    if (n > room) for (let gap = n >> 1; gap > 0; gap >>= 1) for (let a = gap; a < n; a++) {
      const c = cand[a];
      let b = a;
      while (b >= gap && worth[cand[b - gap]] < worth[c]) { cand[b] = cand[b - gap]; b -= gap; }
      cand[b] = c;
    }
    return Math.min(n, room);
  }

  L.build = w => { world = w; panesStamp = -1; said.far = said.through = said.spot = said.planes = false; L.glowN = 0; L.haloN = 0; };
  // The frame's lights chosen for its view (view.e: its frustum), written where they changed. origin: the render
  // origin; hazeGlow: the look's. → nothing; L's fields say what there is
  L.choose = (view, origin, hazeGlow) => {
    const Lt = world.lights, Pn = world.panes, e = view.e, n = Lt.n;
    O = origin;
    if (Pn && Pn.stamp !== panesStamp) rasterPanes();
    if (cand.length < n) { cand = new Int32Array(Lt.cap); worth = new Float64Array(Lt.cap); rowOf = new Int32Array(Lt.cap); sky = new Uint8Array(Lt.cap); spread = new Float32Array(Lt.cap); }
    L.rowOf = rowOf;
    rowOf.fill(-1, 0, n); sky.fill(0, 0, n); spread.fill(0, 0, n);
    // (a window's rectangle is its pane's: half its diagonal, as its node scales it)
    if (Pn) for (let p = 0; p < Pn.n; p++) {
      const i = Pn.light[p];
      if (Lt.kind[i] !== LIGHT.WINDOW) continue;
      const M = world.nodes.m, o = 12 * Pn.node[p], hw = 0.5 * (Pn.rect[4 * p + 2] - Pn.rect[4 * p]), hh = 0.5 * (Pn.rect[4 * p + 3] - Pn.rect[4 * p + 1]);
      spread[i] = Math.sqrt((hw * Math.sqrt(M[o] ** 2 + M[o + 1] ** 2 + M[o + 2] ** 2)) ** 2 + (hh * Math.sqrt(M[o + 3] ** 2 + M[o + 4] ** 2 + M[o + 5] ** 2)) ** 2);
    }
    let lit = 0, haloN = 0;
    planes = 0;
    L.flickers = false;
    // the far lights and those through panes that shine, then the beams that light the view: the first rows, in the
    // spec's order
    const far = kept(isFar, LIGHT.FAR_MOST, 'far'), through = kept(isThrough, LIGHT.THROUGH_MOST, 'through'), spot = spots(view, sky);
    for (let i = 0; i < n; i++) if (sky[i] && isFar(i)) put(lit++, i);
    for (let i = 0; i < n; i++) if (sky[i] && isThrough(i)) put(lit++, i);
    for (let i = 0; i < n; i++) if (sky[i] && isBeam(i)) put(lit++, i);
    // the others, by worth
    const first = lit, taken = others(view, LIGHT.LIT - lit);
    // (their bounds, kept in an array as the loop widens them: 5.16)
    S[0] = Infinity; S[1] = Infinity; S[2] = -Infinity; S[3] = -Infinity;
    for (let k = 0; k < taken; k++) {
      const i = cand[k], r = Lt.reach[i] + spread[i], x = Lt.at[3 * i] - O[0], z = Lt.at[3 * i + 2] - O[2];
      reachOf[lit] = r;
      put(lit++, i);
      S[0] = Math.min(S[0], x - r); S[2] = Math.max(S[2], x + r); S[1] = Math.min(S[1], z - r); S[3] = Math.max(S[3], z + r);
    }
    const x0 = S[0], z0 = S[1], x1 = S[2], z1 = S[3];
    // (light varies across what is drawn: a lamp or a beam lights the view)
    L.points = lit > far + through;
    // in a haze that glows: the halo of every lamp that shines in the view (a beam's light in the air is its cone's)
    for (let i = 0; i < n; i++) {
      if (Lt.kind[i] < LIGHT.POINT || !(Lt.strength[i] > 0)) continue;
      S[0] = Lt.at[3 * i]; S[1] = Lt.at[3 * i + 1]; S[2] = Lt.at[3 * i + 2];
      if (hazeGlow > 0 && Lt.kind[i] === LIGHT.POINT && Lt.reach[i] > 0 && !isBeam(i)) {
        S[3] = Lt.reach[i];
        if (sees(e, S)) {
          if (haloN === haloCap) {
            haloCap *= 2;
            const more = new Float32Array(haloCap * HALO.BYTES / 4); more.set(haloData); haloData = more;
            gpu.drop(halos); halos = gpu.buffer('halos', haloCap * HALO.BYTES, B.VERTEX | B.COPY_DST);
          }
          const h = 12 * haloN++;
          haloData[h] = S[0] - O[0]; haloData[h + 1] = S[1] - O[1]; haloData[h + 2] = S[2] - O[2]; haloData[h + 3] = S[3];
          haloData[h + 4] = Lt.colour[3 * i]; haloData[h + 5] = Lt.colour[3 * i + 1]; haloData[h + 6] = Lt.colour[3 * i + 2]; haloData[h + 7] = Lt.strength[i];
          haloData[h + 8] = Lt.flicker[i]; haloData[h + 9] = Lt.seed[i]; haloData[h + 10] = 0; haloData[h + 11] = 0;
          if (Lt.flicker[i] > 0) L.flickers = true;
        }
      }
    }
    // the grid over their bounds: each cell the LIGHT.CELL most worth at its middle
    words.fill(0);
    const side = Math.max(x1 - x0, z1 - z0, 1e-3), cell = side / GRID.SIDE;
    if (lit > first) {
      for (let row = first; row < lit; row++) {
        const w = 20 * row, x = data[w], y = data[w + 1], z = data[w + 2], r = reachOf[row], s = data[w + 7];
        const i0 = Math.max(0, Math.floor((x - r - x0) / cell)), i1 = Math.min(GRID.SIDE - 1, Math.floor((x + r - x0) / cell)), j0 = Math.max(0, Math.floor((z - r - z0) / cell)), j1 = Math.min(GRID.SIDE - 1, Math.floor((z + r - z0) / cell));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const mx = x0 + (i + 0.5) * cell, mz = z0 + (j + 0.5) * cell, d = Math.max(0, Math.sqrt((mx - x) ** 2 + (mz - z) ** 2) - 0.71 * cell), t = d / r;
          if (t >= 1) continue;
          const c = j * GRID.SIDE + i, o = c * GRID.WORDS, wv = s * (1 - t * t) * (1 - t * t) + 1e-6 / (1 + Math.abs(y));
          const count = words[o];
          if (count < LIGHT.CELL) { words[o + 1 + count] = row; worthIn[c * LIGHT.CELL + count] = wv; words[o] = count + 1; continue; }
          // (full: it takes the place of the least worth there, if it is worth more)
          let least = 0;
          for (let q = 1; q < LIGHT.CELL; q++) if (worthIn[c * LIGHT.CELL + q] < worthIn[c * LIGHT.CELL + least]) least = q;
          if (worthIn[c * LIGHT.CELL + least] < wv) { words[o + 1 + least] = row; worthIn[c * LIGHT.CELL + least] = wv; }
        }
      }
      L.gridAt[0] = x0; L.gridAt[1] = z0; L.gridAt[2] = 1 / cell; L.gridAt[3] = GRID.SIDE;
    } else L.gridAt.fill(0);
    L.farN = far; L.throughN = through; L.spotN = spot; L.lightN = lit;
    // (written where they changed: a standing scene writes nothing)
    const upTo = lit * 20, planesAt = LIGHT.LIT * 20, planesTo = planesAt + planes * 20;
    let lo = -1, hi = -1;
    for (let k = 0; k < upTo; k++) if (data[k] !== sent[k]) { if (lo < 0) lo = k; hi = k; sent[k] = data[k]; }
    if (lo >= 0) gpu.write(buffer, 4 * (lo - lo % 20), data, lo - lo % 20, Math.min(upTo, hi + 20 - hi % 20) - (lo - lo % 20));
    lo = -1;
    for (let k = planesAt; k < planesTo; k++) if (data[k] !== sent[k]) { if (lo < 0) lo = k; hi = k; sent[k] = data[k]; }
    if (lo >= 0) gpu.write(buffer, 4 * planesAt, data, planesAt, planesTo - planesAt);
    lo = -1;
    for (let k = 0; k < words.length; k++) if (words[k] !== sentWords[k]) { if (lo < 0) lo = k; hi = k; sentWords[k] = words[k]; }
    if (lo >= 0) gpu.write(grid, 4 * lo, words, lo, hi - lo + 1);
    L.halos = halos; L.haloN = haloN;
  };
  // The glows' rows of this frame (after L.choose, the mirrors placed): every glow whose sphere — a painted light's
  // sprite, a lamp's halo — is seen by the frame's view or by a view of `mirrors` (the images in view: each { view }),
  // the farthest before the frame's eye first. → L.glows, L.glowN, L.glowAhead
  L.glowsIn = (view, mirrors) => {
    const Lt = world.lights, e = view.e, n = Lt.n;
    let glowN = 0;
    for (let i = 0; i < n; i++) {
      if (Lt.kind[i] < LIGHT.POINT || !(Lt.flags[i] & LIGHT.GLOW)) continue;
      const painted = Lt.sprite[i] > 0, shine = painted ? GLOW.PAINTED * Lt.strength[i] : HALO_SHINE * Math.min(1, Lt.strength[i]);
      S[0] = Lt.at[3 * i]; S[1] = Lt.at[3 * i + 1]; S[2] = Lt.at[3 * i + 2]; S[3] = painted ? Lt.sprite[i] : Lt.glow[i];
      if (!(shine > 0.002) || !(S[3] > 0)) continue;
      let seen = sees(e, S);
      for (let k = 0; !seen && k < mirrors.length; k++) seen = sees(mirrors[k].view.e, S);
      if (!seen) continue;
      if (glowN + 2 > glowCap) {
        glowCap *= 2;
        const of = new Int32Array(glowCap), parts = new Uint8Array(glowCap), keys = new Float64Array(glowCap);
        of.set(glowOf); parts.set(glowPart); keys.set(glowKey);
        glowOf = of; glowPart = parts; glowKey = keys; glowData = new Float32Array(glowCap * GLOW_BYTES / 4); glowAhead = new Float64Array(glowCap);
        gpu.drop(glows); glows = gpu.buffer('glows', glowCap * GLOW_BYTES, B.VERTEX | B.COPY_DST);
      }
      ahead(e, S, glowKey, glowN);
      glowPart[glowN] = painted ? SPRITE : HALO_ROW; glowOf[glowN++] = i;
      if (!painted) { glowKey[glowN] = glowKey[glowN - 1]; glowPart[glowN] = DOT_ROW; glowOf[glowN++] = i; }
    }
    // (the farthest first: an insertion sort — they come nearly sorted from the frame before; a lamp's halo before its dot)
    for (let a = 1; a < glowN; a++) {
      const i = glowOf[a], part = glowPart[a], key = glowKey[a];
      let b = a;
      while (b > 0 && glowKey[b - 1] < key) { glowOf[b] = glowOf[b - 1]; glowPart[b] = glowPart[b - 1]; glowKey[b] = glowKey[b - 1]; b--; }
      glowOf[b] = i; glowPart[b] = part; glowKey[b] = key;
    }
    for (let k = 0; k < glowN; k++) {
      const i = glowOf[k], g = 12 * k, part = glowPart[k], dot = part === DOT_ROW, cone = isBeam(i) ? toward(i, e.eye) : 1, s = Math.min(1, Lt.strength[i]) * cone;
      glowData[g] = Lt.at[3 * i] - O[0]; glowData[g + 1] = Lt.at[3 * i + 1] - O[1]; glowData[g + 2] = Lt.at[3 * i + 2] - O[2];
      glowData[g + 3] = part === SPRITE ? Lt.sprite[i] : dot ? DOT_RADIUS * Lt.glow[i] : Lt.glow[i];
      glowData[g + 4] = dot ? DOT[0] : Lt.colour[3 * i]; glowData[g + 5] = dot ? DOT[1] : Lt.colour[3 * i + 1]; glowData[g + 6] = dot ? DOT[2] : Lt.colour[3 * i + 2];
      // (how much it shines; below 0: with a bright middle — the dot)
      glowData[g + 7] = part === SPRITE ? GLOW.PAINTED * Lt.strength[i] * cone : dot ? -DOT_SHINE * s : HALO_SHINE * s;
      glowData[g + 8] = Lt.flicker[i]; glowData[g + 9] = Lt.seed[i]; glowData[g + 10] = 0; glowData[g + 11] = 0;
      glowAhead[k] = glowKey[k];
      if (Lt.flicker[i] > 0) L.flickers = true;
    }
    L.glows = glows; L.glowN = glowN; L.glowAhead = glowAhead;
  };
  // how much of a beam's light goes toward the eye — its cone's edge, as the light's shader has it —, at least BEAM_GLOW
  function toward(i, eye) {
    const Lt = world.lights, x = eye[0] - Lt.at[3 * i], y = eye[1] - Lt.at[3 * i + 1], z = eye[2] - Lt.at[3 * i + 2], l = Math.sqrt(x * x + y * y + z * z) || 1;
    const c = (x * Lt.way[3 * i] + y * Lt.way[3 * i + 1] + z * Lt.way[3 * i + 2]) / l, lo = Lt.cone[2 * i], hi = Lt.cone[2 * i + 1], t = Math.min(1, Math.max(0, (c - lo) / (hi - lo)));
    return Math.max(BEAM_GLOW, t * t * (3 - 2 * t));
  }
  // the sprites' rows to the GPU — in a call that draws
  L.write = () => {
    if (L.glowN) gpu.write(glows, 0, glowData, 0, 12 * L.glowN);
    if (L.haloN) gpu.write(halos, 0, haloData, 0, 12 * L.haloN);
  };
  // The lights a view would be lit by, were it the frame's (a shot's view ahead: which of them cast there —
  // render/shadows.js) → into[i] = 1 for each. After L.choose of this frame: the far and through lights are the frame's
  L.litIn = (view, into) => {
    const n = world.lights.n;
    for (let i = 0; i < n; i++) into[i] = sky[i] && !isBeam(i) ? 1 : 0;
    const spot = spots(view, into), taken = others(view, LIGHT.LIT - L.farN - L.throughN - spot);
    for (let k = 0; k < taken; k++) into[cand[k]] = 1;
  };
  // What of the lights a view other than the frame's shows (a mirror's: render/mirrors.js), after L.glowsIn — the lit
  // set's that light within it (every far and through light; a lamp, a window, a beam whose sphere it sees) and the
  // glows seen in it —, as a number: each by its light and that light's stamp (so a light that leaves it changes the
  // number too). → the number; L.moves: one of those lamps or glows flickers
  L.seenBy = e => {
    const Lt = world.lights;
    let sig = L.lightN;
    L.moves = false;
    for (let row = 0; row < L.lightN; row++) {
      const i = lightOf[row];
      if (Lt.kind[i] >= LIGHT.POINT) {
        bound(i);
        if (!sees(e, S)) continue;
        if (Lt.flicker[i] > 0) L.moves = true;
      }
      sig = (((sig * 31 + i) | 0) * 31 + Lt.stamp[i]) | 0;
    }
    for (let k = 0; k < L.glowN; k++) {
      // (a lamp's dot goes with its halo)
      if (glowPart[k] === DOT_ROW) continue;
      const i = glowOf[k];
      S[0] = Lt.at[3 * i]; S[1] = Lt.at[3 * i + 1]; S[2] = Lt.at[3 * i + 2]; S[3] = glowPart[k] === SPRITE ? Lt.sprite[i] : Lt.glow[i];
      if (!sees(e, S)) continue;
      if (Lt.flicker[i] > 0) L.moves = true;
      sig = (((sig * 31 + i) | 0) * 31 + Lt.stamp[i]) | 0;
    }
    return sig;
  };
  return L;
}
