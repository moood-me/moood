// What a scene's code shares, and the tools for moving things well.
//   anim — the animator's toolkit, for every scene: easing curves (a movement starts and stops as
//     a body does), angles the short way round, smooth noise and steady random (life that doesn't
//     repeat, the same every time), a two-bone joint (an elbow, a knee: the hand or the foot set
//     where it must be), poses mixed by weight.
//   the world's modules — code the world's scenes share (its people, its horses, its things):
//     modules/<name>.js in the world's repository, the body of function (anim, data) that returns
//     what it offers (data: modules/<name>.data.json, if there is one). A scene lists the ones it
//     uses (spec.modules) and gets them as kit.<name>, as they are at the commit it is shown at.
//   the scene's lib — code its own elements and scripts share: spec.lib, the body of
//     function (anim, kit) that returns what it offers.
//   the scene's land — spec.relief, the body of function (across, distance, anim, lib) that returns
//     the ground's height there (metres; across to the right of the start's line of sight, distance
//     ahead of it): what stands, walks, casts a shadow and looks on it, all on the one ground.
// Painting code sees them as e.anim, e.kit, e.lib, e.ground; scripts as scene.anim, scene.kit,
// scene.lib, scene.ground.
// Where a spec's modules come from (the page says, with the spec):
//   {files, refs} — where the world's files are read by their content's sha (an address: <files><sha> — the host's,
//     docs/host.md) and the modules by those shas ({name: {code, data, strings}}, as the scene's payload has them); a
//     module the refs don't name is not in this world. A file is the same for good: fetched once.
//   {texts} — the modules themselves, {name: {code, data}} (the renderer is given them).
// and in which language the scene is shown (lang) with its texts' translations into it (strings — the scene's own:
// its lang/<lang>.json's entries); a module's are with it ({code, data, strings} — by sha, or themselves). The scene's
// code — its lib, its elements', its scripts, its showcase, its relief — has `tr` (../../i18n/i18n.js, MooodI18n: loaded
// before this), a module's has its own: each the translator of its own texts (words, bind).
const MooodKit = (() => {
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
  const turn = (a, b, u) => { let d = ((b - a) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * u; };
  // steady random: the same n gives the same 0…1, however many other calls came before
  const hash = (n, seed = 0) => { let h = Math.imul((n * 374761393 + seed * 668265263) | 0, 1274126177); h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, 1103515245) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  // smooth noise along x (−1…1): for breathing, swaying, drifting that never repeats
  const noise = (x, seed = 0) => { const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f); return mix(hash(i, seed) * 2 - 1, hash(i + 1, seed) * 2 - 1, s); };
  // a few octaves of it, slower ones stronger
  const drift = (x, seed = 0) => noise(x, seed) * 0.6 + noise(x * 2.1 + 7, seed + 1) * 0.3 + noise(x * 4.3 + 13, seed + 2) * 0.1;
  // a two-bone joint: from the root (x0, y0) to the end (x1, y1) with bones a and b; bend 1 or −1 —
  // which side the joint goes. Returns the joint [x, y] (the end out of reach: the limb straight toward it)
  const joint = (x0, y0, x1, y1, a, b, bend = 1) => {
    const dx = x1 - x0, dy = y1 - y0, d = Math.min(Math.hypot(dx, dy), a + b - 1e-6), ang = Math.atan2(dy, dx);
    const k = clamp((a * a + d * d - b * b) / (2 * a * d || 1), -1, 1), off = Math.acos(k) * bend;
    return [x0 + Math.cos(ang + off) * a, y0 + Math.sin(ang + off) * a];
  };
  // poses mixed: pose objects (numbers, or nested objects/arrays of them) weighted [[pose, weight], …]
  const blend = list => {
    const total = list.reduce((s, [, w]) => s + w, 0) || 1, [first] = list[0];
    const go = (sel) => {
      const v0 = sel(first);
      if (typeof v0 === 'number') return list.reduce((s, [p, w]) => s + (sel(p) ?? v0) * w, 0) / total;
      if (Array.isArray(v0)) return v0.map((_, i) => go(p => sel(p)?.[i]));
      if (v0 && typeof v0 === 'object') return Object.fromEntries(Object.keys(v0).map(k => [k, go(p => sel(p)?.[k])]));
      return v0;
    };
    return go(p => p);
  };
  const anim = Object.freeze({ clamp, mix, span, ease, easeOf, turn, hash, noise, drift, joint, blend });

  const report = (who, err) => (globalThis.__mooodErrors ||= []).push(`${who}: ${err && err.message || err}`);
  // files by their content's sha (the same for good), modules made from them, libs made: once each
  const files = new Map(), made = new Map(), libs = new Map();
  const fileOf = (from, sha) => {
    if (!files.has(sha)) files.set(sha, fetch(`${from}${sha}`).then(r => (r.ok ? r.text() : Promise.reject(new Error(`${sha}: ${r.status}`)))));
    return files.get(sha);
  };
  const { bind } = MooodI18n;
  // the scene's translator: its texts in the language the page shows it in (source: what the page said with the spec)
  // (the same words, the same translator: code made with it is kept while the scene is shown again with them)
  const translators = new Map();
  const words = source => {
    const lang = source?.lang ?? MooodI18n.source, strings = source?.strings ?? [], key = `${lang}\n${JSON.stringify(strings)}`;
    if (!translators.has(key)) {
      if (translators.size > 8) translators.delete(translators.keys().next().value);
      translators.set(key, MooodI18n.translator(lang, strings, 'the scene'));
    }
    return translators.get(key);
  };
  function make(name, key, code, data, strings, lang) {
    if (!made.has(key)) {
      let value = {};
      try { value = bind(MooodI18n.translator(lang, strings ?? [], `module ${name}`), 'anim, data', String(code))(anim, data) || {}; } catch (err) { report(`module ${name}`, err); }
      made.set(key, value);
    }
    return made.get(key);
  }
  // a spec's modules, as `source` says: {mods: {name: what it offers}, key: which they are} — or a
  // promise of it
  function modulesOf(spec, source) {
    const names = [...new Set((Array.isArray(spec?.modules) ? spec.modules : []).filter(n => typeof n === 'string'))].sort();
    const out = (mods, keys) => ({ mods, key: keys.join('\n') });
    if (!names.length) return out({}, []);
    const lang = source?.lang ?? MooodI18n.source;
    if (source?.texts) {
      const mods = {}, keys = [];
      for (const n of names) {
        const m = source.texts[n];
        if (m?.code == null) { report(`module ${n}`, 'not in this world'); continue; }
        const key = `${n} ${lang} ${m.code} ${JSON.stringify(m.data ?? null)} ${JSON.stringify(m.strings ?? null)}`;
        mods[n] = make(n, key, m.code, m.data ?? null, m.strings, lang); keys.push(key);
      }
      return out(mods, keys);
    }
    const from = source?.files;
    if (from == null) { report('modules', 'the page did not say where they are'); return out({}, []); }
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
      if (!r?.code) { report(`module ${n}`, 'not in this world'); return; }
      if (made.has(keyOf(n, r))) return;
      try {
        const [code, data, strings] = await Promise.all([fileOf(from, r.code), r.data ? fileOf(from, r.data).then(JSON.parse) : null,
          r.strings ? fileOf(from, r.strings).then(t => JSON.parse(t).strings) : null]);
        make(n, keyOf(n, r), code, data, strings, lang);
      } catch (err) { report(`module ${n}`, err); }
    })).then(built);
  }
  // the ground's height (metres) at (across, distance) as `relief` says — said once if it throws or
  // returns no number (it is flat there then); null without a relief
  const grounds = new Map();
  function groundOf(relief, lib, key, tr) {
    if (!relief) return null;
    if (!grounds.has(key)) {
      let fn = null, said = false;
      try { fn = bind(tr, 'across, distance, anim, lib', relief); } catch (err) { report('relief', err); }
      const say = msg => { if (!said) { said = true; report('relief', msg); } };
      grounds.set(key, fn && ((across, distance) => {
        try {
          const h = fn(across, distance, anim, lib);
          if (Number.isFinite(h)) return h;
          say(`at across ${across}, distance ${distance} it returned ${h}, not a number of metres`);
        } catch (err) { say(err.message || err); }
        return 0;
      }));
    }
    return grounds.get(key);
  }
  // what a spec's code shares, once its modules are here: { kit, lib, ground, tr } — or a promise of it
  // (they are still on their way); `source`: where its modules come from (above). The same modules
  // are the same kit, and a lib on them in the same language is made once. tr: the scene's translator (words).
  const kits = new Map();
  function shared(spec, source) {
    const tr = words(source);
    const done = ({ mods, key }) => {
      if (!kits.has(key)) kits.set(key, Object.freeze(mods));
      const kit = kits.get(key), lib = typeof spec?.lib === 'string' && spec.lib.trim() ? spec.lib : null;
      const libKey = `${key}\n\n${tr.lang} ${JSON.stringify(source?.strings ?? null)}\n\n${lib}`;
      if (lib && !libs.has(libKey)) {
        let value = {};
        try { value = bind(tr, 'anim, kit', lib)(anim, kit) || {}; } catch (err) { report('lib', err); }
        libs.set(libKey, value);
      }
      const made = lib ? libs.get(libKey) : {}, relief = typeof spec?.relief === 'string' && spec.relief.trim() ? spec.relief : null;
      return { kit, lib: made, ground: groundOf(relief, made, `${libKey}\n\n${relief}`, tr), tr };
    };
    const m = modulesOf(spec, source);
    return m instanceof Promise ? m.then(done) : done(m);
  }
  // The state keys the engine itself reads for a spec — whatever the scene's own code does: the film's
  // camera and fade (every scene's), an insert's key, a place's, a redraw's, the light's looks, a
  // light's `on` and place — each with what it takes, as spec.states describes a key ({range} or
  // {type}; {} — anything). A key set from outside that neither these nor the scene knows, or one of
  // these set to what the engine can't take, is said (scenestate.js).
  const NUM = { type: 'number' }, UNIT = { range: [0, 1] };
  const CAMERA = { camera_target: {}, camera_on: {}, camera_shot: {}, camera_frame: {}, camera_glide: NUM, camera_x: NUM, camera_z: NUM, camera_look: NUM, camera_h: NUM, camera_pitch: { range: [-75, 75] }, camera_yaw: NUM, camera_roll: NUM, fade: UNIT, fade_color: { type: 'string' } };
  function keys(spec) {
    const out = new Map(Object.entries(CAMERA)), obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    const add = (d, ...ks) => { for (const k of ks) if (typeof k === 'string') out.set(k, d); };
    for (const o of Array.isArray(spec?.objects) ? spec.objects : []) {
      if (!o || typeof o !== 'object') continue;
      add(UNIT, o.insert); add(NUM, ...Object.values(obj(o.place)));
      // a person's (people.js): what they do, where they face, a body's face, talking
      if (o.person && o.id != null) { for (const k of ['do', 'look', 'reach', 'with', 'wear', 'gait', 'steps', 'on', 'here', 'still']) add({}, `${o.id}_${k}`); add(NUM, `${o.id}_turn`); add({ type: 'string' }, `${o.id}_mood`); add({ range: [0, 1] }, `${o.id}_talk`); }
      add({}, ...(Array.isArray(o.redraw) ? o.redraw : Object.keys(obj(o.redraw))));
    }
    for (const l of Array.isArray(spec?.lights) ? spec.lights : []) if (l && typeof l === 'object') { add(UNIT, l.on); add(NUM, ...Object.values(obj(l.place))); }
    add(UNIT, ...Object.keys(obj(obj(spec?.light).looks)));
    return out;
  }
  return { anim, shared, keys, words };
})();
