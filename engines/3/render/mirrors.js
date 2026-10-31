// Mirrors (5.7): a plane with `reflect`, a pane with `glass`. One image a mirroring plane — the elements that mirror
// in one plane, with one `fade` and one `rough`, of one kind (planes, or panes) share it: its `members` —, a texture
// with an alpha, made when the mirror first comes into view. Its view is the mirrored eye's picture (views.js
// mirrorCamera) cut to the rect the mirror covers of the frame — its mirroring quads as the view sees them
// (render/quads.js seen), not a sphere round them —, widened each way by what its overlay reads aside — 0.3 · rough
// + 0.05 · ripple (a ripple that is a state key: its most, 1) of a frame's height, kept within the frame —, at a
// density of the
// frame's own px of MIRROR.DENSITY / (1 + 3 · rough), at least a quarter (a pane: MIRROR.GLASS), and no more than
// keeps it within MIRROR.SHARE of the frame's px (imageDensity); drawn into the texture's corner. The world's mirror
// textures are all of one size: the most any of its images has needed, grown by 64 px when one needs more (its
// images then drawn anew). ITS ALPHA IS HOW MUCH OF A MIRROR IMAGE THERE IS: cleared to
// nothing, drawn in ONE pass by the mirror's own pipelines (render/library.js: what is solid, the people, the sky,
// what blends, the lights' glows — its ids and depth discarded); particles are not drawn in it.
//   `fade` — mirrored things are THERE less with their height above the mirror (the mirror pass's vertex stages: a
// factor of how much of them there is, written as the image's alpha — a fog toward the mirror's own paint, which the
// overlay lays the image over; what is solid stays opaque, hiding what is behind it, the sky too; the sky is all
// there). `rough` — made once on the image,
// after its pass: two small passes smear it along the way the plane's face goes across it (render/wgsl/post.js
// `render.mirror.ready`: the image → `mirror step`, one for all → that image's `mirror ready`), and the overlay
// reads the ready image. `ripple` is the overlay's arithmetic; `blur` — accepted, no effect.
//   A pane of glass: its image holds the room alone (render/quads.js: no sky, nothing draped on the land, no pane),
// and it shows where it is dark beyond the glass: its strength comes times `show` = 1 − min(1, ambient ·
// mean(ambientColor) + Σ far lights' strength · mean(colour) — the sun or the moon in through panes too: beyond the
// glass it lights as any far light; one from beyond the gaze counted at 0.3, as the lighting counts it), worked out
// each frame. A mirroring element that faces the eye is mirrored about the plane it is drawn in — across the view's
// gaze, by the view's yaw, through its node's origin —, not about its node's face.
//   Redrawn when its own view changed (always, that frame), else only when something in it changed — a row's stamp
// (3.4's test: at or after the tick of the call that drew it), the stamp of a light it shows (of the lit set, one
// whose light reaches its view; a glow seen in it — render/lights.js L.seenBy: a light that changes elsewhere, a beam
// turning away from it, draws it not again), the look's or the panes' stamp, a person's version, a sheet's stamp, an
// own shader's values — or moves by itself (render/quads.js movesItself; a light it shows that flickers) —, one a
// frame, longest waiting first. A mirror in which a clipped thing is seen has a mask of its own,
// drawn for its view before its pass.
//   The overlay (render/wgsl/post.js `render.mirror`) reads the image by the matrix it was drawn with, less the
// render origin as it is now: a uniform a mirroring element (its own strength, ripple and rough), written when its
// image was drawn again, the origin stepped, its keys moved those three (a plane's may be state keys: the world's
// el.mirror, taken each frame — a rough another draws its image again: its density, its margin, its smear; a strength
// or a ripple, the uniform alone) or — a pane's — `show` is another.
//   The frame's swaps (SH2) ride in its mirrors' views as in its own; a shot's in its mirrors'.
//   A shot ahead has its own mirrors' views (SH10): the same planes as its values place and show them, seen by its
// camera — placed and asked, never drawn.
import { FLAG, LIGHT, MIRROR, QUAD, VIEW, empty } from '../base.js';
import { FORMATS } from './library.js';
import { MIRROR as OVERLAY, READY } from './wgsl/post.js';
import { createView, newCamera, copyCamera, sameCamera, mirrorCamera, cropCamera, viewProj, sees } from './views.js';
import { since, stampedAt } from '../world/tables.js';
import { movesItself } from './quads.js';

// px of a mirror's image a px of the view (5.7): MIRROR.DENSITY / (1 + 3 · rough), at least a quarter (a pane:
// MIRROR.GLASS) — and no more than keeps the image, w × h px of the view, within MIRROR.SHARE of the view's sw × sh
export function imageDensity(rough, glass, w, h, sw, sh) {
  const d = glass ? MIRROR.GLASS : Math.max(0.25, MIRROR.DENSITY / (1 + 3 * rough));
  return Math.min(d, Math.sqrt(MIRROR.SHARE * sw * sh / Math.max(1, w * h)));
}

export function createMirrors(gpu, sheets, lib, quads) {
  const B = GPUBufferUsage, T = GPUTextureUsage, linear = gpu.sampler('linear');
  // the size of every mirror texture of the world, px (0 × 0: none made yet)
  const side = new Int32Array(2);
  const target = (name, format) => gpu.texture(name, { size: [side[0], side[1]], format, usage: T.RENDER_ATTACHMENT | T.TEXTURE_BINDING });
  // a world's mirroring elements; the pass's own ids and depth; the smear's step (one for all) and its two pipelines
  let world = null, planes = [], byEl = new Map(), ids = null, depth = null, step = null, stepView = null, stepPipe = null, readyPipe = null;
  const S4 = new Float64Array(4), R4 = new Float64Array(4), Q4 = new Float64Array(4), data = new Float32Array(OVERLAY.BYTES / 4), A2 = new Float64Array(2), smear = new Float32Array(READY.BYTES / 4);
  // list: the images in view this frame; show: how much a pane shows now (how dark it is beyond the glass)
  const M = { list: [], ids: null, depth: null, show: 1 };
  const cleared = () => ({ colorAttachments: [{ view: null, loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }] });
  const stepPass = cleared(), readyPass = cleared();

  // what a group of mirrors in one plane has: its plane, its fade and rough, whether it is panes', the greatest reach
  // of its members' ripples (elements: reach), what it covers of the view (clip: x0, y0, x1, y1), its view with its camera; size: its
  // image's px (the used part of the texture); height: how many px of the image a frame's height is. … and an image
  // (image: true): what is kept of it as drawn — its camera, its plane, its size, the tick of the call that drew it —
  // and what its overlays read it by (data: worked out for `version` at the origin's `origin`th step); a rough one's
  // ready image, with the smear's uniform and its two steps' groups. A group (a shot's) has those at none: one shape
  // for both, which pass the same places (5.16)
  const groupOf = (drawn, image = false) => ({ plane: new Float64Array(4), fade: 0, rough: 0, glass: false, reach: 0, members: new Int32Array(8), membersN: 0, covers: new Float64Array(4),
    size: new Int32Array(2), height: 0, view: createView(gpu, 'mirror', drawn), camera: newCamera(),
    drawn: image ? newCamera() : null, drawnPlane: image ? new Float64Array(4) : null, drawnSize: image ? new Int32Array(2) : null, drawnHeight: 0, drawnRough: 0,
    image: null, masks: null, ready: null, imageView: null, masksView: null, readyView: null, readyU: null, stepGroup: null, readyGroup: null,
    data: image ? new Float32Array(OVERLAY.BYTES / 4) : null, dataOf: -1, origin: -1, version: 0,
    has: false, due: false, moved: false, waited: 0, drawnTick: 0, sig: 0, nextSig: 0, clipped: false, asked: 0 });
  const imageOf = () => groupOf(true, true);
  // an image's textures let go — made again when it is next in view, and it drawn anew —; … and its view
  const textures = I => {
    if (I.image) gpu.drop(I.image);
    if (I.masks) gpu.drop(I.masks);
    if (I.ready) { gpu.drop(I.ready); gpu.drop(I.readyU); }
    I.image = I.masks = I.ready = I.readyU = null;
    I.has = false;
  };
  const letGo = I => { I.view.e.drop(); textures(I); };

  // a world's mirrors: its elements that reflect. What the world before had is let go
  M.build = world_ => {
    for (const p of planes) { gpu.drop(p.uniform); if (p.own) letGo(p.own); }
    for (const t of [ids, depth, step]) if (t) gpu.drop(t);
    planes = []; byEl = new Map(); ids = depth = step = stepView = M.ids = M.depth = null; side[0] = side[1] = 0; empty(M.list);
    world = world_;
    for (const el of world.elements) {
      const E = el.spec, r = E.reflect || E.glass;
      if (!r || el.kind === 'person') continue;
      // (a plane's strength, rough and ripple as its keys have them now — the world's el.mirror, taken as its mirrors
      // are gathered —; a pane's as said. reach: the most its ripple may be — a key's 1 —, what its image's margin
      // keeps, so a ripple that moves draws no image again)
      const keyed = E.reflect && typeof E.reflect.ripple === 'string';
      const p = { el: el.index, node: el.node, glass: !E.reflect, now: el.mirror, strength: E.reflect ? 0 : r.strength, fade: r.fade || 0, rough: 0, ripple: 0,
        reach: E.reflect ? (keyed ? 1 : E.reflect.ripple) : 0,
        uniform: gpu.buffer('mirror', OVERLAY.BYTES, B.UNIFORM | B.COPY_DST), overlay: null, overlayOf: null, own: null, image: null, group: 0, wrote: null, wroteVersion: -1, wroteOrigin: -1, wroteShow: -1, wroteNow: -1 };
      planes.push(p); byEl.set(el.index, p);
    }
    if (!planes.length) return;
    stepPipe = lib.get('mirror-step'); readyPipe = lib.get('mirror-ready');
  };
  // the world's mirror textures at least w × h px: grown by 64 px — every image's let go, the pass's own ids and depth
  // made again at that size
  function fit(w, h) {
    if (w <= side[0] && h <= side[1]) return;
    side[0] = Math.max(side[0], 64 * Math.ceil(w / 64)); side[1] = Math.max(side[1], 64 * Math.ceil(h / 64));
    for (const p of planes) if (p.own) textures(p.own);
    for (const t of [ids, depth, step]) if (t) gpu.drop(t);
    step = stepView = null;
    ids = gpu.texture('mirror ids', { size: [side[0], side[1]], format: FORMATS.IDS, usage: T.RENDER_ATTACHMENT });
    depth = gpu.texture('mirror depth', { size: [side[0], side[1]], format: FORMATS.DEPTH, usage: T.RENDER_ATTACHMENT });
    M.ids = ids.createView(); M.depth = depth.createView();
  }
  // the mirror a quad is (its element's): its `group` is its overlay's this frame, 0 when it is not placed
  M.of = q => byEl.get(world.quads.el[q]);

  const shownIn = (node, over) => {
    if (over) {
      for (let k = 0; k < over.hiddenN; k++) if (over.hidden[k] === node) return false;
      for (let k = 0; k < over.shownN; k++) if (over.shown[k] === node) return true;
    }
    return world.nodes.shown[node] !== 0;
  };
  // what a mirroring element covers of a view → out (x0, y0, x1, y1: clip): the rect round what its mirroring quads
  // that are shown cover (render/quads.js seen: the quads themselves, not a sphere round them); false: nothing
  function coversOf(view, el, out) {
    const Q = world.quads;
    let any = false;
    for (let q = el.first; q < el.first + el.count; q++) {
      if (!(Q.flags[q] & FLAG.SHOWN) || !(Q.flags[q] & (FLAG.REFLECTS | FLAG.GLASS)) || !quads.seen(view, q, Q4)) continue;
      if (!any) out.set(Q4);
      else { out[0] = Math.min(out[0], Q4[0]); out[1] = Math.min(out[1], Q4[1]); out[2] = Math.max(out[2], Q4[2]); out[3] = Math.max(out[3], Q4[3]); }
      any = true;
    }
    return any;
  }
  // The mirrors a view shows, by plane → `list` (emptied first): for each mirroring element in the view — as a shot's
  // overrides place and show it (over: its entry of f.ahead, or null: the frame's, where an element that is not
  // visible now mirrors nothing) — its plane as it stands, toward the eye; its group: one of the list in that plane
  // with that fade and rough, of its kind, or a new one (taken: its record)
  function gather(view, over, list, taken) {
    const eye = view.e.eye, Q = world.quads;
    empty(list);
    for (let i = 0; i < planes.length; i++) {
      const p = planes[i], el = world.elements[p.el];
      // (a plane's three as its keys have them now)
      if (p.now) { p.strength = p.now.strength; p.rough = p.now.rough; p.ripple = p.now.ripple; }
      let Nm = world.nodes.m, o = 12 * p.node;
      if (over) for (let k = 0; k < over.nodesN; k++) if (over.nodeOf[k] === p.node) { Nm = over.nodes; o = 12 * k; break; }
      S4[0] = Nm[o + 9]; S4[1] = Nm[o + 10]; S4[2] = Nm[o + 11];
      if (!(p.strength > 0) || !shownIn(p.node, over) || (!over && el.visible === false) || !coversOf(view, el, R4)) continue;
      // (its plane, through its node's origin: its node's face — or, what faces the eye, the plane it is drawn in,
      // across the view's gaze by the view's yaw —, toward the eye)
      let nx = Nm[o + 6], ny = Nm[o + 7], nz = Nm[o + 8];
      if (el.count > 0 && Q.kind[el.first] === QUAD.FACING) { nx = -Math.sin(view.camera.yaw); ny = 0; nz = Math.cos(view.camera.yaw); }
      const l = Math.sqrt(nx ** 2 + ny ** 2 + nz ** 2) || 1;
      nx /= l; ny /= l; nz /= l;
      let d = -(nx * S4[0] + ny * S4[1] + nz * S4[2]);
      if (nx * eye[0] + ny * eye[1] + nz * eye[2] + d < 0) { nx = -nx; ny = -ny; nz = -nz; d = -d; }
      let G = null;
      for (let k = 0; k < list.length && !G; k++) {
        const X = list[k];
        if (X.fade === p.fade && X.rough === p.rough && X.glass === p.glass && Math.abs(X.plane[3] - d) < 1e-3 && X.plane[0] * nx + X.plane[1] * ny + X.plane[2] * nz > 1 - 1e-6) G = X;
      }
      if (!G) {
        G = taken(p, list.length);
        G.plane[0] = nx; G.plane[1] = ny; G.plane[2] = nz; G.plane[3] = d; G.fade = p.fade; G.rough = p.rough; G.glass = p.glass; G.reach = p.reach; G.membersN = 0;
        G.covers.set(R4);
        list.push(G);
      } else {
        G.covers[0] = Math.min(G.covers[0], R4[0]); G.covers[1] = Math.min(G.covers[1], R4[1]); G.covers[2] = Math.max(G.covers[2], R4[2]); G.covers[3] = Math.max(G.covers[3], R4[3]);
        if (p.reach > G.reach) G.reach = p.reach;
      }
      if (G.membersN === G.members.length) { const more = new Int32Array(2 * G.membersN); more.set(G.members); G.members = more; }
      G.members[G.membersN++] = p.el;
      if (!over) p.image = G;
    }
  }
  // A group's view: the eye mirrored about its plane, its picture cut to what the mirror covers and its margin — whole
  // px of its image, on the lattice of that density over the view's rect (sw × sh px: the stage's) —; the swaps and
  // the overrides of the view it is of (the frame's, a shot's)
  function settle(G, view, sw, sh) {
    // (the margin: what the overlay reads aside, of a frame's height each way — in clip units of each axis)
    const m = 0.3 * G.rough + 0.05 * G.reach, mx = 2 * m * sh / sw, my = 2 * m;
    const fx0 = (0.5 + 0.5 * Math.max(-1, G.covers[0] - mx)) * sw, fx1 = (0.5 + 0.5 * Math.min(1, G.covers[2] + mx)) * sw;
    const fy0 = (0.5 - 0.5 * Math.min(1, G.covers[3] + my)) * sh, fy1 = (0.5 - 0.5 * Math.max(-1, G.covers[1] - my)) * sh;
    // (px of the image a px of the view)
    const d = imageDensity(G.rough, G.glass, fx1 - fx0, fy1 - fy0, sw, sh);
    const x0 = Math.floor(fx0 * d), x1 = Math.max(x0 + 1, Math.ceil(fx1 * d)), y0 = Math.floor(fy0 * d), y1 = Math.max(y0 + 1, Math.ceil(fy1 * d));
    G.size[0] = x1 - x0; G.size[1] = y1 - y0; G.height = sh * d;
    mirrorCamera(view.camera, G.plane, G.camera);
    cropCamera(G.camera, 2 * x0 / (sw * d) - 1, 1 - 2 * y1 / (sh * d), 2 * x1 / (sw * d) - 1, 1 - 2 * y0 / (sh * d));
    const V = G.view;
    V.e.place(world, G.camera, G.size[0], G.size[1]);
    V.weight = 0.5; V.coarser = 0; V.inserts = false;
    V.ahead = view.ahead; V.over = view.over; V.overN = view.overN;
    V.nodes = view.nodes; V.nodeOf = view.nodeOf; V.nodesN = view.nodesN;
  }
  const ownOf = p => p.own || (p.own = imageOf());

  // The frame's part: how much a pane shows now; the mirrors in view placed — M.list, each an image —, the world's
  // mirror textures fitted to them. frame: the frame's view; sw, sh: the stage's px
  M.place = (frame, sw, sh) => {
    if (!planes.length) return;
    const look = world.look, Lt = world.lights, R = frame.camera.rot, gx = -R[2], gy = -R[5], gz = -R[8];
    let lit = look.ambient * (look.ambientColor[0] + look.ambientColor[1] + look.ambientColor[2]) / 3;
    for (let i = 0; i < Lt.n; i++) {
      if ((Lt.kind[i] !== LIGHT.FAR && Lt.kind[i] !== LIGHT.THROUGH) || !(Lt.strength[i] > 0)) continue;
      // (one through panes lights what is before them as a far light — e_through: all of it; one from beyond what is
      // seen — along the gaze — less, as the lighting has it: e_evenly)
      const ahead = Lt.way[3 * i] * gx + Lt.way[3 * i + 1] * gy + Lt.way[3 * i + 2] * gz;
      lit += Lt.strength[i] * (Lt.colour[3 * i] + Lt.colour[3 * i + 1] + Lt.colour[3 * i + 2]) / 3 * (1 - 0.7 * Math.min(1, Math.max(0, ahead / 0.3)));
    }
    M.show = 1 - Math.min(1, lit);
    for (let i = 0; i < planes.length; i++) { planes[i].image = null; planes[i].group = 0; }
    gather(frame, null, M.list, ownOf);
    let w = 0, h = 0;
    for (let k = 0; k < M.list.length; k++) { const I = M.list[k]; settle(I, frame, sw, sh); w = Math.max(w, I.size[0]); h = Math.max(h, I.size[1]); }
    fit(w, h);
  };
  // each mirroring element's overlay of this frame: what it reads — its image's texture (made when the image first
  // comes into view), a rough one's ready image — and its own uniform: a group of the quads' (render/quads.js)
  M.groups = () => {
    for (let i = 0; i < planes.length; i++) {
      const p = planes[i], I = p.image;
      if (!I) continue;
      if (!I.image) { I.image = target('mirror', FORMATS.MIRROR); I.imageView = I.image.createView(); }
      if (I.rough > 0 && !I.ready) {
        if (!step) { step = target('mirror step', FORMATS.MIRROR); stepView = step.createView(); }
        I.ready = target('mirror ready', FORMATS.MIRROR); I.readyView = I.ready.createView();
        I.readyU = gpu.buffer('mirror ready', READY.BYTES, B.UNIFORM | B.COPY_DST);
        I.stepGroup = gpu.bind('ready', [{ binding: 0, resource: { buffer: I.readyU } }, { binding: 1, resource: I.imageView }, { binding: 2, resource: linear }]);
        I.readyGroup = gpu.bind('ready', [{ binding: 0, resource: { buffer: I.readyU } }, { binding: 1, resource: stepView }, { binding: 2, resource: linear }]);
      }
      const read = I.rough > 0 ? I.readyView : I.imageView;
      if (p.overlayOf !== read) { p.overlayOf = read; p.overlay = gpu.bind('mirror', [{ binding: 0, resource: { buffer: p.uniform } }, { binding: 1, resource: read }]); p.wrote = null; }
      p.group = quads.group(p.overlay);
    }
  };
  // an image's own clip masks (a mirror in which a clipped thing is seen): made when first needed
  M.masksOf = I => {
    if (!I.masks) { I.masks = target('mirror masks', FORMATS.MASK); I.masksView = I.masks.createView(); I.view.e.group = null; }
    return I.masksView;
  };
  // a mirror's view's uniform (after its ask: SHEETS' bias is in it)
  M.writeView = (I, O) => I.view.e.write(O, VIEW.MIRROR, I.plane, I.fade, null, I.view.drawn);
  // after a mirror's cull: whether its image is to be drawn again — its view another, or something in it changed: a
  // row of what it shows, a sheet, an own shader's values, a person, a light it shows (lights: RENDER's lit set —
  // L.seenBy), the look, the panes — or something in it moves by itself (own: render/own.js — its shaders that read
  // the time; a light it shows that flickers)
  M.stale = (I, people, lights, own) => {
    const Q = world.quads, view = I.view;
    let sig = (view.n * 31 + I.membersN) | 0, moved = false;
    sig = (((((sig * 31 + lights.seenBy(view.e)) | 0) * 31 + world.look.stamp) | 0) * 31 + (world.panes ? world.panes.stamp : 0)) | 0;
    let moves = lights.moves;
    I.clipped = false;
    for (let k = 0; k < view.n; k++) {
      const q = view.list[k];
      sig = (((sig * 31 + q) | 0) * 31 + (Q.sheet[q] >= 0 ? sheets.stamp(Q.sheet[q]) : 0)) | 0;
      if (Q.own[q]) sig = (sig * 31 + world.own[Q.own[q] - 1].stamp) | 0;
      if (since(stampedAt(world, q), I.drawnTick)) moved = true;
      if (movesItself(world, own, q)) moves = true;
      if (Q.flags[q] & FLAG.CLIPPED) I.clipped = true;
    }
    if (people) for (let k = 0; k < people.list.length; k++) { const p = people.list[k]; if (people.reflected(p.id) && people.sphere(p.id, S4) && sees(view.e, S4)) sig = (((sig * 31 + p.index) | 0) * 31 + people.version(p.id)) | 0; }
    I.moved = !I.has || I.size[0] !== I.drawnSize[0] || I.size[1] !== I.drawnSize[1] || I.rough !== I.drawnRough || !sameCamera(I.camera, I.drawn);
    I.due = I.moved || moved || moves || sig !== I.sig;
    I.nextSig = sig;
    if (I.due) I.waited++;
    return I.due;
  };
  // where a point of the world less the origin falls in an image, by the matrix in `data` → A2 (x right, y down)
  const across = (x, y, z) => {
    const cw = data[3] * x + data[7] * y + data[11] * z + data[15];
    A2[0] = (data[0] * x + data[4] * y + data[8] * z + data[12]) / cw; A2[1] = -(data[1] * x + data[5] * y + data[9] * z + data[13]) / cw;
  };
  // what an image's overlays read it by, less the origin O → I.data: its matrix, its plane, the way its face goes
  // across it, the used part of its texture
  function reads(I, O) {
    const P = I.drawnPlane, w = I.drawnSize[0], h = I.drawnSize[1];
    viewProj(I.drawn, O, data, OVERLAY.VP / 4);
    const pl = OVERLAY.PLANE / 4, ax = OVERLAY.AXIS / 4, at = OVERLAY.AT / 4;
    for (let k = 0; k < 3; k++) data[pl + k] = P[k];
    data[pl + 3] = P[3] + P[0] * O[0] + P[1] * O[1] + P[2] * O[2];
    // (the way the plane's face goes across the image, a unit of its px: its normal through the matrix, from a point
    // of it before the eye)
    const px = I.drawn.eye[0] - O[0], py = I.drawn.eye[1] - O[1], pz = I.drawn.eye[2] - O[2];
    const fx = -I.drawn.rot[2], fy = -I.drawn.rot[5], fz = -I.drawn.rot[8];
    across(px + 4 * fx, py + 4 * fy, pz + 4 * fz);
    const x0 = A2[0], y0 = A2[1];
    across(px + 4 * fx + P[0], py + 4 * fy + P[1], pz + 4 * fz + P[2]);
    const dx = 0.5 * w * (A2[0] - x0), dy = 0.5 * h * (A2[1] - y0), dl = Math.sqrt(dx ** 2 + dy ** 2) || 1;
    // (… and how far a frame's height is across its rect, each way)
    data[ax] = dx / dl; data[ax + 1] = dy / dl; data[ax + 2] = I.drawnHeight / w; data[ax + 3] = I.drawnHeight / h;
    data[at] = 0; data[at + 1] = 0; data[at + 2] = w / side[0]; data[at + 3] = h / side[1];
    I.data.set(data);
    I.dataOf = I.version; I.origin = world.originStamp;
  }
  // a mirror's image drawn: kept as drawn — the camera, the plane and the size its overlays read it by; a rough
  // one's smear told how (the way across the image, S = 0.6 · rough of a frame's height in its px, its used part)
  M.drew = (I, O) => {
    I.has = true; I.due = false; I.waited = 0; I.sig = I.nextSig; I.drawnTick = world.tick; I.version++;
    copyCamera(I.camera, I.drawn); I.drawnPlane.set(I.plane); I.drawnSize.set(I.size); I.drawnHeight = I.height; I.drawnRough = I.rough;
    reads(I, O);
    if (!(I.rough > 0)) return;
    smear[0] = I.data[OVERLAY.AXIS / 4]; smear[1] = I.data[OVERLAY.AXIS / 4 + 1]; smear[2] = 0.6 * I.rough * I.drawnHeight; smear[3] = 0;
    smear[4] = I.drawnSize[0]; smear[5] = I.drawnSize[1]; smear[6] = 1 / side[0]; smear[7] = 1 / side[1];
    gpu.write(I.readyU, 0, smear);
  };
  // a rough mirror's image smeared, after its pass (4.4 pass 6: two small passes, timed with `mirror`): the image →
  // the step → its ready image, over the used part
  M.smear = I => {
    const w = I.size[0], h = I.size[1];
    stepPass.colorAttachments[0].view = stepView;
    let pass = gpu.pass('mirror', stepPass);
    pass.setViewport(0, 0, w, h, 0, 1); pass.setScissorRect(0, 0, w, h);
    pass.setPipeline(stepPipe); pass.setBindGroup(0, I.stepGroup); pass.draw(3);
    pass.end();
    readyPass.colorAttachments[0].view = I.readyView;
    pass = gpu.pass('mirror', readyPass);
    pass.setViewport(0, 0, w, h, 0, 1); pass.setScissorRect(0, 0, w, h);
    pass.setPipeline(readyPipe); pass.setBindGroup(0, I.readyGroup); pass.draw(3);
    pass.end();
  };
  // the overlays' uniforms, where their image was drawn again or is another, the origin stepped (an image not drawn
  // again in that call is read where it is), its keys moved its strength, ripple or rough, or — a pane's — it shows
  // another much — in a call that draws. O: the
  // render origin
  M.write = O => {
    const step_ = world.originStamp;
    for (let i = 0; i < planes.length; i++) {
      const p = planes[i], I = p.image, show = p.glass ? M.show : 1, now = p.now ? p.now.stamp : 0;
      if (!I || (p.wrote === I && p.wroteVersion === I.version && p.wroteOrigin === step_ && p.wroteShow === show && p.wroteNow === now)) continue;
      p.wrote = I; p.wroteVersion = I.version; p.wroteOrigin = step_; p.wroteShow = show; p.wroteNow = now;
      if (I.has && (I.dataOf !== I.version || I.origin !== step_)) reads(I, O);
      data.set(I.data);
      const pr = OVERLAY.PARAMS / 4;
      data[pr] = p.strength * show; data[pr + 1] = p.ripple; data[pr + 2] = p.rough; data[pr + 3] = I.has ? 1 : 0;
      gpu.write(p.uniform, 0, data);
    }
  };

  // A shot's mirrors' views (SH10, 2.3 step 4). state: what R keeps of the shot ({ mirrors }: made here); view: the
  // shot's own; ahead: its entry of f.ahead; sw, sh: the stage's px. → state.mirrors.list, each { view }
  let making = null;
  const aheadOf = (p, k) => making.made[k] || (making.made[k] = groupOf(false));
  M.ahead = (state, view, ahead, sw, sh) => {
    const S = state.mirrors || (state.mirrors = { list: [], made: [] });
    if (!planes.length) return S.list;
    making = S;
    gather(view, ahead, S.list, aheadOf);
    for (let k = 0; k < S.list.length; k++) settle(S.list[k], view, sw, sh);
    return S.list;
  };
  return M;
}
