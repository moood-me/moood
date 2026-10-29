// Engine 3's kit — what a scene's code shares, and the tools for moving and shaping things well. A module: the scene's
// thread and the artist each import it and each run the scene's shared code once (LG3: nothing is shared between
// them but the state).
//   anim — the animator's toolkit, for every scene: easing curves (a movement starts and stops as a body does), angles
//     the short way round, smooth noise and steady random (life that doesn't repeat, the same every time), a two-bone
//     joint (an elbow, a knee: the hand or the foot set where it must be), poses mixed by weight.
//   the world's modules — code the world's scenes share (its people, its horses, its things): modules/<name>.js in
//     the world's repository, the body of function (anim, data) that returns what it offers (data:
//     modules/<name>.data.json, if there is one). A scene lists the ones it uses (spec.modules) and gets them as
//     kit.<name>, as they are at the commit it is shown at.
//   the forms' constructors — kit.bend, kit.revolve, kit.extrude, kit.loft, kit.lump (5.23): plain functions that
//     return a function (u, v) → [x, y, z] for e.form, spaced by length along the surface so paint is not stretched
//     one way. They stand in the same `kit` the modules do.
//   the scene's lib — code its own elements and scripts share: spec.lib, the body of function (anim, kit) that returns
//     what it offers.
// Where a spec's modules come from (the page says, with the spec):
//   {files, refs} — where the world's files are read by their content's sha (an address: <files><sha> — the host's,
//     docs/host.md) and the modules by those shas ({name: {code, data, strings}}, as the scene's payload has them); a
//     module the refs don't name is not in this world. A file is the same for good: fetched once.
//   {texts} — the modules themselves, {name: {code, data}} (a render is given them).
// and in which language the scene is shown (lang) with its texts' translations into it (strings — the scene's own:
// its lang/<lang>.json's entries); a module's are with it ({code, data, strings} — by sha, or themselves). The scene's
// code — its lib, its elements', its scripts, its showcase, its relief — has `tr` (../../../i18n/i18n.js), a module's has
// its own: each the translator of its own texts (words, bind).
import '../../../i18n/i18n.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mix = (a, b, u) => a + (b - a) * u;
// u (0…1) of the way between a and b that v is, clamped
const span = (v, a, b) => clamp((v - a) / (b - a));
// easing: how the 0…1 of a movement's time becomes the 0…1 of its way
const ease = {
  linear: u => u,
  smooth: u => (1 - Math.cos(Math.PI * u)) / 2,              // starts and stops gently (the default)
  in: u => u * u * u,                                         // gathers speed, ends at full speed
  out: u => 1 - Math.pow(1 - u, 3),                           // sets off at once, settles
  inOut: u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  back: u => { const c = 1.70158; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); }, // a little past, and back
  spring: u => (u >= 1 ? 1 : 1 - Math.exp(-6 * u) * Math.cos(9 * u)),               // overshoots, wobbles, rests
  anticipate: u => { const c = 1.4; return u * u * ((c + 1) * u - c); },              // back a little first, then go
};
const easeOf = e => (typeof e === 'function' ? e : ease[e] || ease.smooth);
// angles (radians): the short way round from a to b
const turnTo = (a, b, u) => { const d = ((b - a) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * u; };
// steady random: the same n gives the same 0…1, however many other calls came before
const hash = (n, seed = 0) => { let h = Math.imul((n * 374761393 + seed * 668265263) | 0, 1274126177); h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, 1103515245) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// smooth noise along x (−1…1): for breathing, swaying, drifting that never repeats
const noise = (x, seed = 0) => { const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f); return mix(hash(i, seed) * 2 - 1, hash(i + 1, seed) * 2 - 1, s); };
// a few octaves of it, slower ones stronger
const drift = (x, seed = 0) => noise(x, seed) * 0.6 + noise(x * 2.1 + 7, seed + 1) * 0.3 + noise(x * 4.3 + 13, seed + 2) * 0.1;
// a two-bone joint: from the root (x0, y0) to the end (x1, y1) with bones a and b; bend 1 or −1 — which side the joint
// goes. Returns the joint [x, y] (the end out of reach: the limb straight toward it)
const joint = (x0, y0, x1, y1, a, b, bend = 1) => {
  const dx = x1 - x0, dy = y1 - y0, d = Math.min(Math.hypot(dx, dy), a + b - 1e-6), ang = Math.atan2(dy, dx);
  const k = clamp((a * a + d * d - b * b) / (2 * a * d || 1), -1, 1), off = Math.acos(k) * bend;
  return [x0 + Math.cos(ang + off) * a, y0 + Math.sin(ang + off) * a];
};
// poses mixed: pose objects (numbers, or nested objects/arrays of them) weighted [[pose, weight], …]
const blend = list => {
  const total = list.reduce((s, [, w]) => s + w, 0) || 1, [first] = list[0];
  const go = sel => {
    const v0 = sel(first);
    if (typeof v0 === 'number') return list.reduce((s, [p, w]) => s + (sel(p) ?? v0) * w, 0) / total;
    if (Array.isArray(v0)) return v0.map((_, i) => go(p => sel(p)?.[i]));
    if (v0 && typeof v0 === 'object') return Object.fromEntries(Object.keys(v0).map(k => [k, go(p => sel(p)?.[k])]));
    return v0;
  };
  return go(p => p);
};
const anim = Object.freeze({ clamp, mix, span, ease, easeOf, turn: turnTo, hash, noise, drift, joint, blend });

// ── forms (5.23): each returns a function (u, v) → [x, y, z] in the element's own metres — x across, y up, z toward
// its front; u runs 0…1 across the painting, v 0…1 down it ──
// a line of points measured: at(t, out) — the point a share t (0…1) of its length along it
function measured(points, closed = false) {
  const pts = closed ? [...points, points[0]] : points, n = pts.length, dim = pts[0].length, ends = [0];
  for (let i = 1; i < n; i++) { let s = 0; for (let k = 0; k < dim; k++) s += (pts[i][k] - pts[i - 1][k]) ** 2; ends.push(ends[i - 1] + Math.sqrt(s)); }
  const length = ends[n - 1];
  return {
    length,
    at(t, out) {
      const d = clamp(t) * length;
      let i = 1;
      while (i < n - 1 && ends[i] < d) i++;
      const f = (d - ends[i - 1]) / ((ends[i] - ends[i - 1]) || 1);
      for (let k = 0; k < dim; k++) out[k] = pts[i - 1][k] + (pts[i][k] - pts[i - 1][k]) * f;
      return out;
    },
  };
}
const line = (v, n, what) => {
  if (!Array.isArray(v) || v.length < 2 || !v.every(p => Array.isArray(p) && p.length === n && p.every(Number.isFinite))) throw new Error(what);
  return v;
};
// A sheet `width` wide and `height` tall bent into an arc of `degrees` (above 0: its middle toward the front; below:
// away) — about the vertical (a curved wall, a sail: u goes round the arc, v down it), or with about = 'across' about
// the level line (a vault, an awning: v goes round the arc, u along it). The painting lies on it unstretched. Its
// foot's middle (a vault's: the middle of its lower edge) is the element's anchor.
function bend(width, height, degrees = 90, about = 'vertical') {
  if (![width, height, degrees].every(Number.isFinite) || !(width > 0) || !(height > 0)) throw new Error('kit.bend(width, height, degrees, about?): metres, metres, degrees');
  const a = degrees * Math.PI / 180, flat = Math.abs(a) < 1e-6;
  if (about === 'across') {
    const R = flat ? 0 : height / a;
    return (u, v) => { const t = (0.5 - v) * a; return [(u - 0.5) * width, flat ? (1 - v) * height : R * Math.sin(t) + R * Math.sin(a / 2), flat ? 0 : R * (Math.cos(t) - Math.cos(a / 2))]; };
  }
  const R = flat ? 0 : width / a;
  return (u, v) => { const t = (u - 0.5) * a; return [flat ? (u - 0.5) * width : R * Math.sin(t), (1 - v) * height, flat ? 0 : R * (Math.cos(t) - 1)]; };
}
// A thing turned on a lathe: profile — [[radius, height], …] from its top down, metres. u goes once round it (the
// painting's middle on its front, its two edges meeting at the back: closed "u"), v down the profile by its length.
function revolve(profile) {
  const P = measured(line(profile, 2, 'kit.revolve(profile): [[radius, height], …] from the top down')), p = [0, 0];
  return (u, v) => { P.at(v, p); const a = 2 * Math.PI * (u - 0.5); return [p[0] * Math.sin(a), p[1], p[0] * Math.cos(a)]; };
}
// A cross-section carried along a way: profile — [[x, y], …] in the section's own plane (x to its right, y up, as one
// looks along the way), path — [[x, y, z], …] metres. u goes along the profile by its length, v along the path by its
// length. The section keeps its turn along the way (no twist but the path's own).
function extrude(profile, path) {
  const S = measured(line(profile, 2, 'kit.extrude(profile, path): profile [[x, y], …]')), W = line(path, 3, 'kit.extrude(profile, path): path [[x, y, z], …]'), P = measured(W);
  // the way's frames at its points: the tangent, and a side and an up carried along it
  const n = W.length, frames = [];
  let side = null;
  for (let i = 0; i < n; i++) {
    const a = W[Math.max(0, i - 1)], b = W[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;
    // (the side: level and to the right of the way as it starts — the tangent × the world's up; a way straight up:
    // the world's across —; then the side before, laid into the plane across the new tangent. The up: the side × the
    // tangent)
    let sx, sy, sz;
    if (!side) { sx = -tz; sy = 0; sz = tx; if (Math.hypot(sx, sz) < 1e-6) { sx = 1; sz = 0; } } else { const d = side[0] * tx + side[1] * ty + side[2] * tz; sx = side[0] - d * tx; sy = side[1] - d * ty; sz = side[2] - d * tz; }
    const sl = Math.hypot(sx, sy, sz) || 1;
    side = [sx / sl, sy / sl, sz / sl];
    frames.push({ side, up: [side[1] * tz - side[2] * ty, side[2] * tx - side[0] * tz, side[0] * ty - side[1] * tx] });
  }
  const ends = [0];
  for (let i = 1; i < n; i++) ends.push(ends[i - 1] + Math.hypot(W[i][0] - W[i - 1][0], W[i][1] - W[i - 1][1], W[i][2] - W[i - 1][2]));
  const s = [0, 0], c = [0, 0, 0];
  return (u, v) => {
    S.at(u, s); P.at(v, c);
    const d = clamp(v) * P.length;
    let i = 1;
    while (i < n - 1 && ends[i] < d) i++;
    const f = (d - ends[i - 1]) / ((ends[i] - ends[i - 1]) || 1), A = frames[i - 1], B = frames[i], out = [0, 0, 0];
    for (let k = 0; k < 3; k++) out[k] = c[k] + s[0] * mix(A.side[k], B.side[k], f) + s[1] * mix(A.up[k], B.up[k], f);
    return out;
  };
}
// A skin over ribs: ribs — [[[x, y, z], …], …], each a line of points in the element's metres (a hull's frames, a
// tent's poles). u goes along each rib by its length, v from the first rib to the last by the way between them.
function loft(ribs) {
  if (!Array.isArray(ribs) || ribs.length < 2) throw new Error('kit.loft(ribs): two ribs or more, each [[x, y, z], …]');
  const R = ribs.map(r => measured(line(r, 3, 'kit.loft(ribs): each rib [[x, y, z], …]')));
  // (the way between two ribs: between their middles)
  const mids = R.map(r => r.at(0.5, [0, 0, 0])), V = measured(mids), ends = [0];
  for (let i = 1; i < mids.length; i++) ends.push(ends[i - 1] + Math.hypot(mids[i][0] - mids[i - 1][0], mids[i][1] - mids[i - 1][1], mids[i][2] - mids[i - 1][2]));
  const a = [0, 0, 0], b = [0, 0, 0];
  return (u, v) => {
    const d = clamp(v) * V.length;
    let i = 1;
    while (i < ends.length - 1 && ends[i] < d) i++;
    const f = (d - ends[i - 1]) / ((ends[i] - ends[i - 1]) || 1);
    R[i - 1].at(u, a); R[i].at(u, b);
    return [mix(a[0], b[0], f), mix(a[1], b[1], f), mix(a[2], b[2], f)];
  };
}
// A mound: outline — [[x, z], …] its rim on the level, metres (z toward the front); `height` — its top over the rim;
// `seed` — which of the uneven mounds of that outline it is (0: smooth). u goes once round the rim by its length
// (closed "u"), v from its top (0) down to the rim (1). The outline given counter-clockwise as seen from above (x to
// the right, z toward the viewer) lays the painting on the mound's outside, unmirrored.
function lump(outline, height, seed = 0) {
  const O = line(outline, 2, 'kit.lump(outline, height, seed?): outline [[x, z], …]');
  if (!Number.isFinite(height)) throw new Error('kit.lump(outline, height, seed?): height in metres');
  const rim = measured(O, true), p = [0, 0];
  let cx = 0, cz = 0;
  for (const q of O) { cx += q[0] / O.length; cz += q[1] / O.length; }
  return (u, v) => {
    rim.at(u - Math.floor(u), p);
    // (uneven: slow waves round the rim, the same at u = 0 and u = 1 — it meets itself there; none at its top)
    const r = 2 * Math.PI * (u - Math.floor(u));
    const w = seed ? Math.sin(Math.PI * clamp(v) / 2) * (0.12 * Math.sin(2 * r + 6.28 * hash(1, seed)) + 0.07 * Math.sin(3 * r + 6.28 * hash(2, seed)) + 0.04 * Math.sin(5 * r + 6.28 * hash(3, seed))) : 0;
    const t = clamp(v) * Math.PI / 2, out = Math.sin(t) * (1 + w);
    return [cx + (p[0] - cx) * out, height * Math.cos(t) * (1 + w), cz + (p[1] - cz) * out];
  };
}
const FORMS = Object.freeze({ bend, revolve, extrude, loft, lump });

// ── what a spec's code shares ──
const { bind } = globalThis.MooodI18n;
// the scene's translator: its texts in the language the page shows it in (modules: what the page said with the spec)
const words = modules => globalThis.MooodI18n.translator(modules?.lang ?? globalThis.MooodI18n.source, modules?.strings ?? [], 'the scene');
// files by their content's sha (the same for good), modules made from them, libs made: once each a thread
const files = new Map(), made = new Map(), libs = new Map(), kits = new Map();
const fileOf = (from, sha) => {
  if (!files.has(sha)) files.set(sha, fetch(`${from}${sha}`).then(r => (r.ok ? r.text() : Promise.reject(new Error(`${sha}: ${r.status}`)))));
  return files.get(sha);
};
function make(name, key, code, data, strings, lang, errors) {
  if (!made.has(key)) {
    let value = {};
    try {
      const tr = globalThis.MooodI18n.translator(lang, strings ?? [], `module ${name}`);
      value = bind(tr, 'anim, data', String(code))(anim, data) || {};
    } catch (err) { errors.push(`module ${name}: ${err?.message || err}`); }
    made.set(key, value);
  }
  return made.get(key);
}
// a spec's modules, as `source` says: {mods: {name: what it offers}, key: which they are} — or a promise of it
function modulesOf(spec, source, errors) {
  const names = [...new Set((Array.isArray(spec?.modules) ? spec.modules : []).filter(n => typeof n === 'string'))].sort();
  const out = (mods, keys) => ({ mods, key: keys.join('\n') });
  if (!names.length) return out({}, []);
  const lang = source?.lang ?? globalThis.MooodI18n.source;
  for (const n of names) if (n in FORMS) errors.push(`module ${n}: the kit has a form's constructor of that name (kit.${n}) — the module is not seen under it`);
  if (source?.texts) {
    const mods = {}, keys = [];
    for (const n of names) {
      const m = source.texts[n];
      if (m?.code == null) { errors.push(`module ${n}: not in this world`); continue; }
      const key = `${n} ${lang} ${m.code} ${JSON.stringify(m.data ?? null)} ${JSON.stringify(m.strings ?? null)}`;
      mods[n] = make(n, key, m.code, m.data ?? null, m.strings, lang, errors); keys.push(key);
    }
    return out(mods, keys);
  }
  const from = source?.files;
  if (from == null) { errors.push('modules: the page did not say where they are'); return out({}, []); }
  const keyOf = (n, r) => `${n} ${lang} ${r.code} ${r.data} ${r.strings}`;
  const refs = source.refs || {};
  const built = () => {
    const mods = {}, keys = [];
    for (const n of names) if (refs[n]?.code && made.has(keyOf(n, refs[n]))) { mods[n] = made.get(keyOf(n, refs[n])); keys.push(keyOf(n, refs[n])); }
    return out(mods, keys);
  };
  if (names.every(n => refs[n]?.code && made.has(keyOf(n, refs[n])))) return built();
  return Promise.all(names.map(async n => {
    const r = refs[n];
    if (!r?.code) { errors.push(`module ${n}: not in this world`); return; }
    if (made.has(keyOf(n, r))) return;
    try {
      const [code, data, strings] = await Promise.all([fileOf(from, r.code), r.data ? fileOf(from, r.data).then(JSON.parse) : null,
        r.strings ? fileOf(from, r.strings).then(t => JSON.parse(t).strings) : null]);
      make(n, keyOf(n, r), code, data, strings, lang, errors);
    } catch (err) { errors.push(`module ${n}: ${err?.message || err}`); }
  })).then(built);
}
// What a spec's code shares, once its modules are here: { anim, lib, kits, tr, errors } — or a promise of it (they are
// still on their way). modules: where its modules come from (above). kits: the world's modules by name, with the
// forms' constructors (what code sees as `kit`). The same modules are the same kits, and a lib on them in the same
// language is made once. tr: the scene's translator (words). errors: what went wrong making them, as words (each
// caller says them its own way).
function shared(spec, modules) {
  const errors = [], tr = words(modules);
  const done = ({ mods, key }) => {
    if (!kits.has(key)) kits.set(key, Object.freeze({ ...mods, ...FORMS }));
    const kitsOf = kits.get(key), lib = typeof spec?.lib === 'string' && spec.lib.trim() ? spec.lib : null;
    const libKey = `${key}\n\n${tr.lang} ${JSON.stringify(modules?.strings ?? null)}\n\n${lib}`;
    if (lib && !libs.has(libKey)) {
      let value = {};
      try { value = bind(tr, 'anim, kit', lib)(anim, kitsOf) || {}; } catch (err) { errors.push(`lib: ${err?.message || err}`); }
      libs.set(libKey, value);
    }
    return { anim, lib: lib ? libs.get(libKey) : {}, kits: kitsOf, tr, errors };
  };
  const m = modulesOf(spec, modules, errors);
  return m instanceof Promise ? m.then(done) : done(m);
}

// The state keys the engine itself reads for a spec — whatever the scene's own code does: the film's camera
// (every scene's), an insert's key, a place's, a redraw's, the light's looks, a light's `on` and place, a person's —
// each with what it takes, as spec.states describes a key ({range} or {type}; {} — anything). A key set from outside
// that neither these nor the scene knows, or one of these set to what the engine can't take, is said (world/state.js).
const NUM = { type: 'number' }, UNIT = { range: [0, 1] };
const CAMERA = { camera_target: {}, camera_on: {}, camera_shot: {}, camera_frame: {}, camera_glide: NUM, camera_x: NUM, camera_z: NUM, camera_look: NUM, camera_h: NUM, camera_pitch: { range: [-75, 75] }, camera_yaw: NUM, camera_roll: NUM };
function keys(spec) {
  const out = new Map(Object.entries(CAMERA)), obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const add = (d, ...ks) => { for (const k of ks) if (typeof k === 'string') out.set(k, d); };
  for (const o of Array.isArray(spec?.objects) ? spec.objects : []) {
    if (!o || typeof o !== 'object') continue;
    add(UNIT, o.insert); add(NUM, ...Object.values(obj(o.place)));
    if (o.person && o.id != null) { for (const k of ['do', 'look', 'reach', 'with', 'wear', 'gait', 'steps', 'on', 'here', 'still', 'reflected']) add({}, `${o.id}_${k}`); add(NUM, `${o.id}_turn`); add({ type: 'string' }, `${o.id}_mood`); add({ range: [0, 1] }, `${o.id}_talk`); }
    add({}, ...(Array.isArray(o.redraw) ? o.redraw : Object.keys(obj(o.redraw))));
  }
  for (const l of Array.isArray(spec?.lights) ? spec.lights : []) if (l && typeof l === 'object') { add(UNIT, l.on); add(NUM, ...Object.values(obj(l.place))); }
  add(UNIT, ...Object.keys(obj(obj(spec?.light).looks)));
  return out;
}

export const kit = Object.freeze({ anim, shared, keys, words });
