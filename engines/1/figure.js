// The person a motion moves, as they are to be seen — a look: who (a person of NAVER's Anny body model — a man, a
// woman, children, old people… each of their own age and build: bodies/), their face (a
// minimal one, or none) and what it shows, what they wear (MakeHuman's clothes, fitted to their body: each vertex of a
// garment hangs from three of the body's; hair as one solid mass), the colours, and how drawn: sculpted clay, flat
// colour, a silhouette (inked by ink.js). A minimal face moves as Anny's face units (ARKit's) move it — an expression
// (going over to another in a moment), talking, blinking — before the body is skinned; its eyes, brows and mouth are
// drawn on it as the units have them (the eyes' lids, the brows' ends, the lips' edges where they meet). The body goes
// on its own bones as the motion turns them (skeleton.js: Kimodo's rotations, the joints placed again from them), each
// vertex with its four joints (on the GPU); the clothes go with it the same way, but where they hang loose (a skirt, a
// coat's tails, long hair) they are cloth: particles that fall, swing and lag — kept as long as the garment's edges, near
// where the body takes them, no further from where they hang from than at rest, and out of the body (rounded pieces of
// it, measured on its skin; the cloth sliding on them as cloth does). On the floor under them, their shadow.
//   MooodFigure.look(partial, cast?) → a whole look (the person's own, then what is given over it; a minimal face's
//     expression, intensity — how much of it, blink, talk). cast (or partial.cast): a world's — its own bodies, garments
//     and outfits, which `who`, `outfit` and `hair` may name over ours ({garments: {name:
//     {kind, bin}}, bodies: {name: {base, bin, height, parts}}, outfits: {name: {name, wear}}}, the bins base64 of
//     bake.py's formats); a body of its own wears nothing and has no minimal face. The look keeps it (look.cast)
//   MooodFigure.PEOPLE, FACES, EXPRESSIONS, OUTFITS, HAIR, STYLES, LIGHTS — what a look may be; names() — each by its name
//     in the engine's words (MooodI18n.part('engine1'): the page says their language first)
//   MooodFigure.load(look?) → a promise: what the look needs, fetched (its body, its clothes; a cast's, read from it)
//   MooodFigure.make(gl, B, motion) → {scale(look), ground(look), render([x, y, w, h], k, t, look, camera, world, scene?)} — B:
//     Kimodo's body (soma.bin: the motion's legs, to go as far on these); ground — the floor's colours ({bg, grid, path});
//     camera {V, eye, right, up, back}; world() — what to draw under the person, into the picture; k — device pixels per
//     CSS pixel; x, y, w, h — device pixels; scene — standing in a scene (people.js; as MooodShapes.make's). While a look
//     is being fetched, the last one is drawn.
(function () {
  const HERE = globalThis.document?.currentScript?.src ?? location.href;  // (a page's script, or the scene's thread's: thread.js)
  const tr = MooodI18n.part('engine1');  // (the names of what a look may be: names())
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (v, k) => [v[0] * k, v[1] * k, v[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = v => mul(v, 1 / (Math.hypot(...v) || 1));
  const lerp = (a, b, u) => a + (b - a) * u;
  // a 3×4 matrix (12 numbers, rows) at o: a point placed, a direction turned
  const place = (M, o, v) => [M[o] * v[0] + M[o + 1] * v[1] + M[o + 2] * v[2] + M[o + 3], M[o + 4] * v[0] + M[o + 5] * v[1] + M[o + 6] * v[2] + M[o + 7],
    M[o + 8] * v[0] + M[o + 9] * v[1] + M[o + 10] * v[2] + M[o + 11]];
  const turn = (M, o, v) => [M[o] * v[0] + M[o + 1] * v[1] + M[o + 2] * v[2], M[o + 4] * v[0] + M[o + 5] * v[1] + M[o + 6] * v[2],
    M[o + 8] * v[0] + M[o + 9] * v[1] + M[o + 10] * v[2]];
  const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16) / 255);
  const pct = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

  // ── what a look may be ────────────────────────────────────────────────

  // what is worn: garments of bodies/, from the inside out (each coloured as what it is: top, bottom, shoes, apron);
  // the hair over them all, or where 'hair' is among them (under a hood)
  const OUTFITS = {
    work: { wear: ['boots', 'pants', 'sweater'] },
    polo: { wear: ['boots', 'pants', 'polo'] },
    summer: { wear: ['boots', 'tshirt', 'shorts'] },
    dress: { wear: ['flats', 'dress'] },
    skirt: { wear: ['flats', 'skirt', 'sweater'] },
    loose: { wear: ['flats', 'pants', 'oversized'] },
    looseskirt: { wear: ['flats', 'skirt', 'oversized'] },
    tunic: { wear: ['boots', 'vikingpants', 'tunic'] },
    smith: { wear: ['boots', 'vikingpants', 'tunic', 'apron'] },
    robe: { wear: ['robe', 'hair', 'hood'] },
  };
  const HAIR = { none: {}, short: {}, fringe: {}, bob: {}, shoulder: {}, long: {}, bun: {}, braid: {} };
  const FACES = { minimal: {}, none: {} };
  // what a minimal face shows: the face units it moves (ARKit's names: bodies.json's units) and how far, at its full;
  // a talking one talks
  const both = (unit, v) => ({ [`${unit}Left`]: v, [`${unit}Right`]: v });
  const EXPRESSIONS = {
    neutral: { units: {} },
    smile: { units: { ...both('mouthSmile', 0.75), ...both('cheekSquint', 0.45), ...both('eyeSquint', 0.15) } },
    laugh: { units: { ...both('mouthSmile', 1), jawOpen: 0.32, ...both('cheekSquint', 0.85), ...both('eyeSquint', 0.6), browInnerUp: 0.25 } },
    sad: { units: { browInnerUp: 0.85, ...both('mouthFrown', 0.7), mouthShrugLower: 0.35, ...both('eyeLookDown', 0.35), ...both('eyeBlink', 0.2) } },
    angry: { units: { ...both('browDown', 0.9), ...both('eyeSquint', 0.45), ...both('noseSneer', 0.35), ...both('mouthPress', 0.55), ...both('mouthFrown', 0.35) } },
    surprised: { units: { browInnerUp: 0.9, ...both('browOuterUp', 0.85), ...both('eyeWide', 0.8), jawOpen: 0.38, mouthFunnel: 0.25 } },
    afraid: { units: { browInnerUp: 1, ...both('browOuterUp', 0.3), ...both('eyeWide', 0.9), ...both('mouthStretch', 0.65), jawOpen: 0.14 } },
    disgusted: { units: { ...both('noseSneer', 0.8), ...both('mouthUpperUp', 0.55), ...both('browDown', 0.55), ...both('eyeSquint', 0.4), ...both('cheekSquint', 0.3), ...both('mouthFrown', 0.3) } },
    thinking: { units: { browDownLeft: 0.45, browOuterUpRight: 0.5, browInnerUp: 0.2, ...both('eyeLookUp', 0.55), eyeLookOutRight: 0.45, eyeLookInLeft: 0.45, ...both('mouthPress', 0.35), mouthLeft: 0.3 } },
    tired: { units: { ...both('eyeBlink', 0.5), browInnerUp: 0.3, ...both('mouthFrown', 0.2), ...both('eyeLookDown', 0.2), jawOpen: 0.04 } },
    talking: { units: { browInnerUp: 0.15, ...both('browOuterUp', 0.1) }, talk: true },
  };
  // a mouth's shapes as speech makes them (visemes): the face units of each — what a voice will drive, its sounds and
  // how loud; till then a face talks through them by itself (talking)
  const VISEMES = {
    a: { jawOpen: 0.42, ...both('mouthLowerDown', 0.3) },
    e: { jawOpen: 0.16, ...both('mouthStretch', 0.45), ...both('mouthSmile', 0.15) },
    o: { jawOpen: 0.3, mouthFunnel: 0.6 },
    u: { jawOpen: 0.08, mouthPucker: 0.75, mouthFunnel: 0.2 },
    m: { ...both('mouthPress', 0.45), mouthRollLower: 0.15, mouthRollUpper: 0.1 },
    f: { jawOpen: 0.05, mouthRollLower: 0.5, ...both('mouthUpperUp', 0.15) },
  };
  const COLORS = { skin: '#e3bfa3', hair: '#5a4334', top: '#c9bfae', bottom: '#5c5953', shoes: '#4a3f38', apron: '#6b4a32' };
  // who: their body (bodies/<id>.bin), what they wear, their colours
  const PEOPLE = {
    man: { outfit: 'work', hair: 'short', colors: { top: '#3f4a6b', bottom: '#b58e62' } },
    woman: { outfit: 'dress', hair: 'long', colors: { hair: '#6b4a36', top: '#c66f4f', shoes: '#5a3f34' } },
    boy: { outfit: 'polo', hair: 'fringe', colors: { hair: '#5a3e2b', top: '#6f845f', bottom: '#5d5b57' } },
    girl: { outfit: 'looseskirt', hair: 'braid', colors: { hair: '#8a5a3a', top: '#a8b2c4', bottom: '#5f5370' } },
    child: { outfit: 'summer', hair: 'fringe', colors: { hair: '#7a5a3a', top: '#c4704f', bottom: '#4f6380' } },
    toddler: { outfit: 'summer', hair: 'bob', colors: { hair: '#a07a4e', top: '#e6dcc8', bottom: '#5f8a76' } },
    oldman: { outfit: 'work', hair: 'short', colors: { hair: '#d6d2cc', skin: '#ddb79c', top: '#3f4146', bottom: '#77716a' } },
    oldwoman: { outfit: 'skirt', hair: 'bun', colors: { hair: '#dedad4', skin: '#e2bea3', top: '#a8594a', bottom: '#5f6b62' } },
    smith: { outfit: 'smith', hair: 'short', colors: { hair: '#3a2c24', top: '#9a8462', bottom: '#4f4438', skin: '#cf9f7c' } },
    death: { outfit: 'robe', hair: 'none', face: 'none', colors: { skin: '#b5aea4', top: '#2a272c' } },
  };
  // how drawn: sculpted clay (soft light, matte), flat colour (and one shade), a silhouette (one dark colour, a thin
  // light line where one part is in front of another)
  const STYLES = { clay: {}, flat: {}, silhouette: {} };
  const STYLE = { clay: 0, flat: 1, silhouette: 2 };
  // the light: where the key light comes from (as the camera sees it: right, up, towards the camera), its colour, the
  // sky's and the ground's (the soft light from all round), the background and the floor's lines
  const LIGHTS = {
    studio: { key: [-0.45, 0.75, 0.5], color: '#fffaf2', sky: '#c9c6c2', ground: '#9a948d', bg: '#e7e4df', grid: '#dcd8d2' },
    day: { key: [0.4, 0.85, 0.35], color: '#fff8ea', sky: '#bfc8d2', ground: '#9c958a', bg: '#dfe4e8', grid: '#d2d8dd' },
    evening: { key: [0.85, 0.3, 0.4], color: '#ffd9b0', sky: '#8a8496', ground: '#6e5f58', bg: '#b9aeb0', grid: '#aca1a3' },
    night: { key: [-0.35, 0.6, -0.6], color: '#b9c8ee', sky: '#3a4052', ground: '#24262e', bg: '#1d2129', grid: '#272c36' },
  };
  // a silhouette's colours: its own, the background's
  const SILHOUETTE = { ink: '#3a3a3f', bg: '#f6efe4', grid: '#ebe3d7' };

  // what a look may be, each by its name in the page's words (ours: a cast's own are its to name)
  const names = () => ({
    people: { man: tr.c('a person', 'man'), woman: tr.c('a person', 'woman'), boy: tr.c('a person', 'teenager'), girl: tr.c('a person', 'teenage girl'),
      child: tr.c('a person', 'child'), toddler: tr.c('a person', 'toddler'), oldman: tr.c('a person', 'old man'), oldwoman: tr.c('a person', 'old woman'),
      smith: tr.c('a person', 'smith'), death: tr.c('a person', 'death') },
    outfits: { work: tr('sweater and trousers'), polo: tr('polo and trousers'), summer: tr('T-shirt and shorts'), dress: tr.c('worn', 'dress'),
      skirt: tr('skirt and sweater'), loose: tr('oversized sweater and trousers'), looseskirt: tr('skirt and oversized sweater'), tunic: tr.c('worn', 'tunic'),
      smith: tr('shirt and apron'), robe: tr('robe with a hood') },
    hair: { none: tr.c('hair', 'none'), short: tr.c('hair', 'short'), fringe: tr.c('hair', 'with a fringe'), bob: tr.c('hair', 'bob'),
      shoulder: tr.c('hair', 'shoulder-length'), long: tr.c('hair', 'long'), bun: tr.c('hair', 'bun'), braid: tr.c('hair', 'braid') },
    faces: { minimal: tr.c('a face', 'simple'), none: tr('no face') },
    expressions: { neutral: tr.c('an expression', 'calm'), smile: tr.c('an expression', 'smile'), laugh: tr.c('an expression', 'laughter'),
      sad: tr.c('an expression', 'sadness'), angry: tr.c('an expression', 'anger'), surprised: tr.c('an expression', 'surprise'), afraid: tr.c('an expression', 'fear'),
      disgusted: tr.c('an expression', 'disgust'), thinking: tr.c('an expression', 'thoughtful'), tired: tr.c('an expression', 'tiredness'),
      talking: tr.c('an expression', 'talking') },
    styles: { clay: tr.c('drawn as', 'clay'), flat: tr.c('drawn as', 'flat'), silhouette: tr.c('drawn as', 'silhouette') },
    lights: { studio: tr.c('a light', 'studio'), day: tr.c('a light', 'day'), evening: tr.c('a light', 'evening'), night: tr.c('a light', 'night') },
  });

  // a look (cast: a world's, whose bodies, garments and outfits it may name — over ours of the same names). A body of
  // the cast's is its own mesh: it wears nothing (garments hang from our bodies' skin) and has no minimal face
  function look(o = {}, cast = o.cast ?? null) {
    const own = !!cast?.bodies?.[o.who], who = own || PEOPLE[o.who] ? o.who : 'man', p = PEOPLE[who] ?? {};
    const outfit = name => !!(cast?.outfits?.[name] || OUTFITS[name]), hair = name => !!(HAIR[name] || cast?.garments?.[name]?.kind === 'hair');
    return {
      who, face: own ? 'none' : FACES[o.face] ? o.face : p.face ?? 'minimal', outfit: own ? null : outfit(o.outfit) ? o.outfit : p.outfit,
      hair: own ? 'none' : hair(o.hair) ? o.hair : p.hair, colors: { ...COLORS, ...p.colors, ...o.colors },
      style: STYLES[o.style] ? o.style : 'clay', light: LIGHTS[o.light] ? o.light : 'studio',
      expression: EXPRESSIONS[o.expression] ? o.expression : 'neutral', intensity: Number.isFinite(o.intensity) ? o.intensity : 1,
      blink: o.blink !== false, talk: !!o.talk, cast,
    };
  }
  // what a look wears, from the inside out (an outfit's own order, hair over it)
  const wornBy = L => {
    const outfit = L.cast?.outfits?.[L.outfit] ?? OUTFITS[L.outfit];
    if (!outfit) return [];
    const wear = outfit.wear, hair = L.hair === 'none' ? [] : [L.hair];
    return wear.includes('hair') ? wear.flatMap(g => (g === 'hair' ? hair : [g])) : [...wear, ...hair];
  };
  const ground = L => (L.style === 'silhouette' ? { bg: SILHOUETTE.bg, grid: SILHOUETTE.grid, path: SILHOUETTE.grid }
    : { bg: LIGHTS[L.light].bg, grid: LIGHTS[L.light].grid, path: LIGHTS[L.light].grid });

  // ── the bodies and garments, fetched (once a page) ─────────────────────

  // (a request, not fetch: the local render reads the engine from files, and fetch doesn't)
  const read = url => new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('GET', url); x.responseType = 'arraybuffer';
    x.onload = () => (x.response && (x.status === 200 || x.status === 0) ? resolve(x.response) : reject(new Error(`${url}: ${x.status}`)));
    x.onerror = () => reject(new Error(`${url}: not read`));
    x.send();
  });
  const fetched = {}, got = {};
  const fetchOnce = (name, parse) => (fetched[name] ??= read(new URL(`bodies/${name}`, HERE)).then(buf => (got[name] = parse(buf))));
  // little-endian arrays one after another (bake.py's formats)
  const reader = (buf, at = 0) => (Kind, n) => { const a = new Kind(buf.slice(at, at + n * Kind.BYTES_PER_ELEMENT)); at += n * Kind.BYTES_PER_ELEMENT; return a; };
  const index = () => fetchOnce('bodies.json', buf => JSON.parse(new TextDecoder().decode(buf)));
  // what all bodies of a mesh share (base.bin's: its triangles, each vertex's joints and weights, the face's parts)
  const parseBase = buf => {
    const take = reader(buf), [N, T] = take(Uint32Array, 2), tris = take(Uint16Array, T * 3), joint = take(Uint8Array, N * 4), weight = take(Uint8Array, N * 4);
    const [F] = take(Uint32Array, 1), face = take(Uint16Array, F), [U] = take(Uint32Array, 1);
    const units = Array.from({ length: U }, () => {
      const [n] = take(Uint32Array, 1), [step] = take(Float32Array, 1), at = take(Uint16Array, n);
      return { at, by: Float32Array.from(take(Int8Array, n * 3), v => v * step) };
    });
    return { N, tris, joint, weight, face, units };
  };
  // a body of a mesh (bs: its base): its vertices, its face's without features, its joints' inverse binds
  const parsePerson = (buf, bs) => {
    const take = reader(buf), m = v => v / 10000;
    return { bs, at: Float32Array.from(take(Int16Array, bs.N * 3), m), plain: Float32Array.from(take(Int16Array, bs.face.length * 3), m), inverse: take(Float32Array, 77 * 12) };
  };
  const parseGarment = buf => {
    const take = reader(buf), [V, T, H, S] = take(Uint32Array, 4);
    return { V, refs: take(Uint16Array, V * 3), bary: take(Float32Array, V * 3),
      offset: Float32Array.from(take(Int16Array, V * 3), v => v / 10000), measure: take(Uint16Array, 6), span: take(Float32Array, 3),
      joint: take(Uint8Array, V * 4), weight: take(Uint8Array, V * 4), loose: Float32Array.from(take(Uint8Array, V), v => v / 255),
      hangs: take(Uint16Array, V), far: Float32Array.from(take(Uint16Array, V), v => v / 1000), beneath: take(Uint16Array, V), tris: take(Uint16Array, T * 3), cover: take(Uint16Array, H), sewn: take(Uint16Array, S * 2) };
  };
  const base = () => fetchOnce('base.bin', parseBase);
  // a cast's own (its bins: base64), kept as ours are, under the cast's own name for it
  const castIds = new WeakMap();
  let casts = 0;
  const castKey = cast => castIds.get(cast) ?? (castIds.set(cast, `cast${++casts}`), castIds.get(cast));
  const bytes = b64 => Uint8Array.from(atob(b64), ch => ch.charCodeAt(0)).buffer;
  // where a look's body is kept (its key), and a garment of it (its key, what it is)
  const bodyKey = L => (L.cast?.bodies?.[L.who] ? `${castKey(L.cast)}/body/${L.who}` : `${L.who}.bin`);
  const wornKey = (L, g) => (L.cast?.garments?.[g] ? `${castKey(L.cast)}/garment/${g}` : `${g}.bin`);
  const kindOf = (L, g) => L.cast?.garments?.[g]?.kind ?? got['bodies.json'].garments[g].kind;
  // (a cast's: read from it, once; ours: fetched, once)
  const kept = (key, e, ofCast, parse) => (e ? (got[key] ??= ofCast(e)) : fetchOnce(key, parse));
  const load = (o = {}, cast = o.cast) => {
    const L = look(o, cast);
    return Promise.all([index(), base()]).then(() => Promise.all([
      kept(bodyKey(L), L.cast?.bodies?.[L.who], e => ({ ...parsePerson(bytes(e.bin), parseBase(bytes(e.base))), parts: e.parts }),
        buf => parsePerson(buf, got['base.bin'])),
      ...wornBy(L).map(g => kept(wornKey(L, g), L.cast?.garments?.[g], e => parseGarment(bytes(e.bin)), parseGarment))]));
  };
  const ready = L => got['base.bin'] && got['bodies.json'] && got[bodyKey(L)] && wornBy(L).every(g => got[wornKey(L, g)]);

  // ── the face ──────────────────────────────────────────────────────────

  // numbers as if at random, the same from the same seed (mulberry32)
  const random = seed => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const seedOf = s => [...s].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261);
  const smooth = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

  // what goes on by itself, the same at the same moment every time (seed: whose it is), made as far as asked: moments
  // (keys: [second, …]) each made after the one before (next(last, rnd) → the keys after it)
  const timeline = (seed, first, next) => {
    const rnd = random(seed), keys = [first];
    return s => {
      while (keys[keys.length - 1][0] <= s + 1) keys.push(...next(keys[keys.length - 1], rnd));
      let lo = 0, hi = keys.length - 1;  // (the last key at or before s)
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (keys[mid][0] <= s) lo = mid; else hi = mid; }
      return [keys[lo], keys[lo + 1]];
    };
  };

  // blinking: every two to six seconds (now and then twice), the lids down fast, up slower — how shut at second s
  const BLINK = { shut: 0.06, held: 0.1, open: 0.26 };
  const blinking = seed => {
    const at = timeline(seed, [-2], ([t], rnd) => [[t + (rnd() < 0.15 ? 0.32 : 1.8 + rnd() * 4.2)]]);
    return s => {
      const [[t]] = at(s), u = s - t;
      return u < BLINK.shut ? smooth(u / BLINK.shut) : u < BLINK.held ? 1 : 1 - smooth((u - BLINK.held) / (BLINK.open - BLINK.held));
    };
  };

  // talking by itself: phrases of three to eleven syllables, a pause between them; a syllable a consonant's shape (or
  // none) then a vowel's, as loud as it falls — how much of each viseme at second s
  const VOWELS = ['a', 'a', 'e', 'o', 'u'], CONSONANTS = ['m', 'f', null, null];
  const talking = seed => {
    const pick = (list, rnd) => list[Math.floor(rnd() * list.length)];
    const at = timeline(seed, [0, null, 0], ([t], rnd) => {
      let s = t + 0.25 + rnd() * 0.6;
      const out = [[s, null, 0]];
      for (let n = 3 + Math.floor(rnd() * 9); n--;) {
        const d = 0.13 + rnd() * 0.12, c = pick(CONSONANTS, rnd);
        if (c) out.push([s + 0.03, c, 0.8]);
        out.push([s + d * 0.55, pick(VOWELS, rnd), 0.45 + rnd() * 0.55]);
        s += d;
      }
      out.push([s + 0.05, null, 0]);
      return out;
    });
    return s => {
      const [[t0, v0, a0], [t1, v1, a1]] = at(s), u = smooth((s - t0) / (t1 - t0)), out = {};
      if (v0) out[v0] = a0 * (1 - u);
      if (v1) out[v1] = (out[v1] || 0) + a1 * u;
      return out;
    };
  };

  // the face's units' movements, on the skin: the vertices they move (`moved`) and their neighbours, whose normals
  // change with them (`ring`), the triangles round those, and what of the buffers that is (from, to: vertices)
  let reach = null;
  const reachOf = () => {
    if (reach) return reach;
    const bs = got['base.bin'], moved = new Uint8Array(bs.N), ring = new Uint8Array(bs.N);
    for (const u of bs.units) for (const i of u.at) moved[i] = 1;
    for (let f = 0; f < bs.tris.length; f += 3) if (moved[bs.tris[f]] || moved[bs.tris[f + 1]] || moved[bs.tris[f + 2]]) ring[bs.tris[f]] = ring[bs.tris[f + 1]] = ring[bs.tris[f + 2]] = 1;
    const tris = [];
    for (let f = 0; f < bs.tris.length; f += 3) if (ring[bs.tris[f]] || ring[bs.tris[f + 1]] || ring[bs.tris[f + 2]]) tris.push(bs.tris[f], bs.tris[f + 1], bs.tris[f + 2]);
    const list = [];
    for (let i = 0; i < bs.N; i++) if (ring[i]) list.push(i);
    return (reach = { ring: Uint32Array.from(list), on: ring, tris: Uint32Array.from(tris), from: list[0], to: list[list.length - 1] + 1 });
  };

  const SHIFT = 0.35;  // how long a face takes from one expression to another (seconds)

  // ── WebGL ─────────────────────────────────────────────────────────────

  // a surface: the body skinned here by its joints (bones: each joint's 3×4, a row a texel), or clothes placed already;
  // a minimal face's eyes, brows and mouth drawn on the skin where it is before it is skinned (as the face moved it);
  // the mark (ink.js) — which surface it is, and which way it faces
  const VS = `#version 300 es
in vec3 at; in vec3 normal; in vec3 even; in uvec4 joint; in vec4 weight;
uniform mat4 view; uniform bool skinned; uniform highp sampler2D bones;
out vec3 n; out vec3 ne; out vec3 wp; out vec3 rest;
void main() {
  vec3 p = at, m = normal, me = even;
  if (skinned) {
    p = vec3(0.0); m = vec3(0.0); me = vec3(0.0);
    for (int k = 0; k < 4; k++) {
      float w = weight[k];
      if (w == 0.0) continue;
      int j = int(joint[k]);
      vec4 r0 = texelFetch(bones, ivec2(0, j), 0), r1 = texelFetch(bones, ivec2(1, j), 0), r2 = texelFetch(bones, ivec2(2, j), 0);
      p += w * vec3(dot(r0, vec4(at, 1.0)), dot(r1, vec4(at, 1.0)), dot(r2, vec4(at, 1.0)));
      m += w * vec3(dot(r0.xyz, normal), dot(r1.xyz, normal), dot(r2.xyz, normal));
      me += w * vec3(dot(r0.xyz, even), dot(r1.xyz, even), dot(r2.xyz, even));
    }
  }
  n = m; ne = me; wp = p; rest = at;
  gl_Position = view * vec4(p, 1.0);
}`;
  const FS = `#version 300 es
precision highp float;
in vec3 n; in vec3 ne; in vec3 wp; in vec3 rest;
uniform int style, id; uniform bool face, sheet, scene, sourced; uniform vec3 tone, eye, key, keyCol, sky, earth, ink, amb, lit1, lit2, back; uniform mat3 world;
/*SHADED*/
uniform vec3 eyes[2]; uniform float eyeSize; uniform vec4 lids[2]; uniform vec2 brows[2]; uniform vec3 upper, lower, span;
layout(location = 0) out vec4 color; layout(location = 1) out vec4 mark; layout(location = 2) out vec4 facing;
// how far a point of the face (p: on the head at rest, as the face moves it) is out of an eye (c; < 0: in it), seen
// from the front: a dot the lids close over — the upper (lid.x: 0 open, 1 shut; below 0, wide), the lower (lid.y) —
// till it is a line, bent as the lid that closed it; looking (lid.zw) moves the dot between them
float eyeOf(vec3 p, vec3 c, vec4 lid) {
  if (p.z < c.z - 0.02) return 1.0;
  vec2 q = (p.xy - c.xy) / eyeSize;
  float up = max(lid.x, 0.0), r = 1.0 + 0.25 * max(-lid.x, 0.0), top = r - 2.0 * up, bot = 2.0 * lid.y - r;
  float open = max(length(q - lid.zw) - r, max(q.y - top, bot - q.y));
  float bend = 0.5 * (lid.y - up) / (lid.y + up + 0.01), mid = clamp(0.5 * (top + bot), -0.6, 0.6);
  float shut = length(vec2(max(abs(q.x) - 0.9, 0.0), q.y - mid + bend * q.x * q.x)) - 0.22 + 3.0 * max(top - bot - 0.35, 0.0);
  return min(open, shut) * eyeSize;
}
// how far a point of the face (as it moves) is out of the brow over an eye (c; side: which way is outwards): a short
// arched stroke, thinner outwards, its inner end and its outer one raised (brow: in the eye's sizes; below 0, lowered)
float browOf(vec3 p, vec3 c, float side, vec2 brow) {
  if (p.z < c.z - 0.02) return 1.0;
  vec2 q = vec2(side * (p.x - c.x), p.y - c.y) / eyeSize, a = vec2(-1.9, 3.4 + brow.x), ab = vec2(2.5, 3.4 + brow.y) - a;
  float h = clamp(dot(q - a, ab) / dot(ab, ab), 0.0, 1.0);
  return (length(q - a - ab * h - normalize(vec2(-ab.y, ab.x)) * 1.4 * h * (1.0 - h)) - 0.34 + 0.14 * h) * eyeSize;
}
// how far a point of the face (as it moves) is out of the mouth: between the lips' edges (each a curve through the
// corners and its middle — y = a x² + b x + c: upper, lower) where they part; where they meet, a thin line (line: how
// far out of that)
float mouthOf(vec3 p, out float line) {
  line = 1.0;
  if (p.z < span.z - 0.02) return 1.0;
  float x = p.x, y = p.y, up = dot(upper, vec3(x * x, x, 1.0)), down = dot(lower, vec3(x * x, x, 1.0));
  float half_ = 0.5 * (span.y - span.x), u = (x - 0.5 * (span.x + span.y)) / half_;
  line = abs(y - 0.5 * (up + down)) - 0.17 * eyeSize * sqrt(max(1.0 - u * u, 0.0)) + max(abs(u) - 1.0, 0.0) * half_;
  return max(max(y - up, down - y), (abs(u) - 1.0) * half_);
}
void main() {
  vec3 V = normalize(eye - wp), N = normalize(n);
  bool inner = sheet && dot(N, V) < 0.0;  // cloth's inside (a solid's surface only turns away at its edge)
  if (inner) N = -N;
  vec3 base = tone;
  if (face) {  // eyes, brows, the mouth
    float aa = length(fwidth(rest)) * 1.2, line, m = mouthOf(rest, line);
    float e = min(min(eyeOf(rest, eyes[0], lids[0]), eyeOf(rest, eyes[1], lids[1])), m);
    float b = min(min(browOf(rest, eyes[0], 1.0, brows[0]), browOf(rest, eyes[1], -1.0, brows[1])), line);
    vec3 dark = mix(base, ink, 0.8);
    base = mix(base, mix(base, ink, 0.45), 1.0 - smoothstep(-aa, aa, b));
    base = mix(base, dark, 1.0 - smoothstep(-aa, aa, e));
  }
  if (inner) base *= 0.62;
  float d = dot(N, key);
  vec3 c;
  if (style == 0) {  // clay: soft and light — the sky's light from above, less from the ground, the key light wrapped round the form
    vec3 hemi = mix(earth, sky, N.y * 0.5 + 0.5) / sky;
    float wrap = smoothstep(-0.6, 1.0, d);
    c = base * hemi * mix(vec3(0.8), keyCol * 1.08, wrap);
  } else if (style == 1) {  // flat: the colour, and one shade where the light doesn't reach (on the form without its small
    // relief — a face's as without features: no blots round its eyes, its nose)
    float lit = smoothstep(-0.12, -0.04, dot(inner ? -normalize(ne) : normalize(ne), key));
    c = mix(base * vec3(0.8, 0.79, 0.85), base, lit);
  } else c = ink;
  // lit by the scene's sources (people.js — a scene that lays no light itself): the strongest's (key, lit1) and the next's
  // (back, lit2) by how each point faces them, over the light all round (amb); a silhouette rimmed by each at its edge
  if (sourced) {
    float edge = smoothstep(0.62, 0.86, 1.0 - max(dot(N, V), 0.0));
    // (as much of each as comes through what stands between: ink.js, SHADED)
    float k1 = cleared(wp, 0), k2 = cleared(wp, 1);
    if (style == 2) c = ink + k1 * lit1 * edge * smoothstep(0.0, 0.3, d) + k2 * lit2 * edge * smoothstep(0.0, 0.3, dot(N, back));
    else if (style == 1) c = mix(base * vec3(0.8, 0.79, 0.85), base, k1 * smoothstep(-0.12, -0.04, dot(inner ? -normalize(ne) : normalize(ne), key))) * (amb + k1 * lit1 + 0.6 * k2 * lit2 * smoothstep(-0.25, 0.65, dot(N, back)));
    else c = base * (amb + k1 * lit1 * smoothstep(-0.6, 1.0, d) + 0.6 * k2 * lit2 * smoothstep(-0.6, 1.0, dot(N, back)));
  }
  // in a lit scene (people.js): the colours alone — the scene's light lays itself on them, by how they face
  if (scene) c = style == 2 ? ink : base;
  color = vec4(c, 1.0);
  facing = vec4(normalize(world * N) * 0.5 + 0.5, 1.0);
  mark = vec4(vec3(id & 1, (id >> 1) & 1, (id >> 2) & 1) * 0.5 + (N * 0.5 + 0.5) * 0.5, 1.0);
}`;
  // the floor under the person, darkened as much as their nearby parts (balls) hide it of the sky — a soft shadow, or
  // (flat) one shade where it is deep
  const FLOOR_VS = `#version 300 es
uniform mat4 view; uniform vec3 mid; uniform float size; out vec3 wp;
void main() { vec2 c = vec2(gl_VertexID % 2 == 1 ? 1.0 : -1.0, gl_VertexID >= 2 ? 1.0 : -1.0);
  wp = vec3(mid.x + c.x * size, 0.0015, mid.z + c.y * size); gl_Position = view * vec4(wp, 1.0); }`;
  const FLOOR_FS = `#version 300 es
precision highp float;
in vec3 wp; uniform vec4 balls[16]; uniform int count; uniform bool flat_; uniform float strength;
layout(location = 0) out vec4 color; layout(location = 1) out vec4 mark; layout(location = 2) out vec4 facing;
void main() {
  float hid = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i >= count) break;
    vec3 c = balls[i].xyz - wp; float r = balls[i].w, d = length(c);
    hid += r * r * max(c.y, 0.0) / (d * d * d) * (1.0 - smoothstep(3.0 * r, 6.0 * r, d));  // (each near its part only)
  }
  hid = clamp(hid, 0.0, 1.0);
  float k = flat_ ? 1.0 - strength * step(0.22, hid) : 1.0 - strength * hid;
  color = vec4(vec3(k), 1.0); mark = vec4(1.0); facing = vec4(1.0);
}`;

  function program(gl, vs, fs) {
    const p = gl.createProgram();
    for (const [kind, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(kind);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    for (let i = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i--;) { const nm = gl.getActiveUniform(p, i).name.replace('[0]', ''); u[nm] = gl.getUniformLocation(p, nm); }
    return { p, u, a: nm => gl.getAttribLocation(p, nm) };
  }

  // a surface's normals from its triangles (each vertex: the sum of its triangles', unscaled)
  function normalsOf(pos, idx, out) {
    out.fill(0);
    for (let f = 0; f < idx.length; f += 3) {
      const a = idx[f] * 3, b = idx[f + 1] * 3, c = idx[f + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      out[a] += nx; out[a + 1] += ny; out[a + 2] += nz; out[b] += nx; out[b + 1] += ny; out[b + 2] += nz; out[c] += nx; out[c + 1] += ny; out[c + 2] += nz;
    }
    return out;
  }
  // (each of length 1)
  function unitNormals(pos, idx) {
    const n = normalsOf(pos, idx, new Float32Array(pos.length));
    for (let o = 0; o < n.length; o += 3) { const l = Math.hypot(n[o], n[o + 1], n[o + 2]) || 1; n[o] /= l; n[o + 1] /= l; n[o + 2] /= l; }
    return n;
  }

  // ── the body's pieces: what cloth stays out of ────────────────────────

  // name, the joint it turns with, from and to (joints; the pelvis from between the hips), the joints whose skin it is
  // measured on
  const SIDES = ['Left', 'Right'];
  const PIECES = [
    ['pelvis', 'Hips', 'hips', 'Spine2', ['Hips', 'Spine1']],
    ['chest', 'Chest', 'Spine2', 'Neck1', ['Spine2', 'Chest', 'LeftShoulder', 'RightShoulder']],
    ['neck', 'Neck1', 'Neck1', 'Head', ['Neck1', 'Neck2']],
    ['head', 'Head', null, null, ['Head', 'HeadEnd', 'Jaw', 'LeftEye', 'RightEye']],
    ...SIDES.flatMap(s => [
      [`${s}upper`, `${s}Arm`, `${s}Arm`, `${s}ForeArm`, [`${s}Arm`]],
      [`${s}fore`, `${s}ForeArm`, `${s}ForeArm`, `${s}Hand`, [`${s}ForeArm`]],
      [`${s}thigh`, `${s}Leg`, `${s}Leg`, `${s}Shin`, [`${s}Leg`]],
      [`${s}shin`, `${s}Shin`, `${s}Shin`, `${s}Foot`, [`${s}Shin`]],
      [`${s}foot`, `${s}Foot`, `${s}Foot`, `${s}ToeEnd`, [`${s}Foot`, `${s}ToeBase`, `${s}ToeEnd`]],
    ]),
  ];

  // the pieces measured on a person's skin at rest (bs: its base; pos: its vertices): across each (side) and front to
  // back, at either end
  function piecesOf(bs, pos, at, tb) {
    const N = bs.N, v = i => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
    // each vertex of the skin (not a helper the clothes hang from): the joint it goes with most
    const dom = new Uint8Array(N).fill(255);
    for (const i of bs.tris) {
      let best = 0;
      for (let k = 1; k < 4; k++) if (bs.weight[i * 4 + k] > bs.weight[i * 4 + best]) best = k;
      dom[i] = bs.joint[i * 4 + best];
    }
    const skin = js => { const set = new Set(js.map(nm => at[nm])), out = []; for (let i = 0; i < N; i++) if (set.has(dom[i])) out.push(v(i)); return out; };
    const point = nm => (nm === 'hips' ? mul(add(tb[at.LeftLeg], tb[at.RightLeg]), 0.5) : tb[at[nm]]);
    return PIECES.map(([name, j, from, to, on]) => {
      const vs = skin(on), p = { name, j: at[j] };
      if (!from) {  // the head: an ellipsoid round its skin
        const lo = [0, 1, 2].map(k => Math.min(...vs.map(q => q[k]))), hi = [0, 1, 2].map(k => Math.max(...vs.map(q => q[k])));
        p.center = mul(add(lo, hi), 0.5); p.radii = mul(sub(hi, lo), 0.5);
        return p;
      }
      p.a = [at[from === 'hips' ? 'Hips' : from], point(from)]; p.b = [at[to], point(to)];
      const A = p.a[1], ax = sub(p.b[1], A), len = Math.hypot(...ax), u = mul(ax, 1 / len);
      const f0 = Math.abs(u[2]) > 0.8 ? [0, 1, 0] : [0, 0, 1], front = unit(sub(f0, mul(u, dot(f0, u)))), side = cross(u, front);
      const ends = [[], []];
      for (const q of vs) {
        const w = sub(q, A), t = dot(w, u) / len, r = sub(w, mul(u, t * len)), e = [dot(r, side), dot(r, front)];
        if (t < 0.45) ends[0].push(e); if (t > 0.55) ends[1].push(e);
      }
      [p.r0, p.r1] = (ends[0].length && ends[1].length ? ends : [ends[0].length ? ends[0] : ends[1], ends[1].length ? ends[1] : ends[0]]).map(es => {
        const s0 = pct(es.map(e => e[0]), 0), s1 = pct(es.map(e => e[0]), 1), f0 = pct(es.map(e => e[1]), 0), f1 = pct(es.map(e => e[1]), 1);
        return [(s1 - s0) / 2, (f1 - f0) / 2, (f1 + f0) / 2, (s1 + s0) / 2];
      });
      p.side = side; p.front = front;
      return p;
    });
  }

  const CLOTH = 0.02;  // how far cloth stays off the pieces (they are as wide as the skin at rest; it bulges as it bends)

  // the pieces now (M: each joint's 3×4, from rest to now), as numbers to push cloth out of: a limb (or the trunk) —
  // from A along u for len, across it s and f, the half-widths and how far its middle is off the line (to the front,
  // to the side) at either end; the head — its centre, axes and half-widths; for both, how far from their middle
  // anything of them is (reach)
  // (all of one make: the same fields, in the same order — read many times a step)
  const shapesNow = (pieces, M) => pieces.map(p => {
    const o = p.j * 12;
    if (p.center) {
      const ax = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(d => turn(M, o, d)), c = place(M, o, p.center);
      return { e: true, mx: c[0], my: c[1], mz: c[2], reach: Math.max(...p.radii) + 0.03, a: ax.flat(), r: p.radii.map(v => v + CLOTH),
        A: c, u: [0, 0, 0], len: 1, s: [0, 0, 0], f: [0, 0, 0], r0: [0, 0, 0, 0], r1: [0, 0, 0, 0] };
    }
    const A = place(M, p.a[0] * 12, p.a[1]), B = place(M, p.b[0] * 12, p.b[1]), d = sub(B, A), len = Math.hypot(...d) || 1e-6, u = mul(d, 1 / len);
    const r = Math.max(p.r0[0], p.r0[1], p.r1[0], p.r1[1]) + 0.03, sd = turn(M, o, p.side), f = turn(M, o, p.front);
    return { e: false, mx: A[0] + d[0] / 2, my: A[1] + d[1] / 2, mz: A[2] + d[2] / 2, reach: len / 2 + r, a: [], r: [],
      A, u, len, s: sd, f, r0: p.r0, r1: p.r1 };
  });

  // how far a point (w from the centre) is out, in a shape's measure (1: on its surface); rs, rf, cap — a limb's
  // half-widths there and its round end (0: none)
  const out = (S, wx, wy, wz, rs, rf, cap) => {
    if (S.e) {
      const a = S.a, r = S.r, p = (wx * a[0] + wy * a[1] + wz * a[2]) / r[0], q = (wx * a[3] + wy * a[4] + wz * a[5]) / r[1], t = (wx * a[6] + wy * a[7] + wz * a[8]) / r[2];
      return Math.sqrt(p * p + q * q + t * t);
    }
    const sd = S.s, f = S.f, u = S.u, p = (wx * sd[0] + wy * sd[1] + wz * sd[2]) / rs, q = (wx * f[0] + wy * f[1] + wz * f[2]) / rf;
    const t = cap ? (wx * u[0] + wy * u[1] + wz * u[2]) / cap : 0;
    return Math.sqrt(p * p + q * q + t * t);
  };

  // the centre a shape is measured from, near a point, and its half-widths there (a limb's: across it and front to back,
  // `extra` wider; at its ends, rounded) — into the numbers below, kept for the next measure
  let cx = 0, cy = 0, cz = 0, rs = 0, rf = 0, cap = 0;
  const centre = (S, px, py, pz, extra = 0) => {
    cx = S.mx; cy = S.my; cz = S.mz; rs = 0; rf = 0; cap = 0;
    if (S.e) return;
    const A = S.A, u = S.u, f = S.f, len = S.len;
    const t = Math.max(0, Math.min(1, ((px - A[0]) * u[0] + (py - A[1]) * u[1] + (pz - A[2]) * u[2]) / len));
    rs = lerp(S.r0[0], S.r1[0], t) + CLOTH + extra; rf = lerp(S.r0[1], S.r1[1], t) + CLOTH + extra;
    const off = lerp(S.r0[2], S.r1[2], t), aside = lerp(S.r0[3], S.r1[3], t), sd = S.s;
    cap = t <= 0 || t >= 1 ? Math.min(rs, rf) : 0;
    cx = A[0] + u[0] * t * len + f[0] * off + sd[0] * aside; cy = A[1] + u[1] * t * len + f[1] * off + sd[1] * aside;
    cz = A[2] + u[2] * t * len + f[2] * off + sd[2] * aside;
  };
  const near = (S, px, py, pz) => { const ox = px - S.mx, oy = py - S.my, oz = pz - S.mz; return ox * ox + oy * oy + oz * oz < S.reach * S.reach; };

  // a particle in a shape goes out of it again — the nearest way, or, if it went past the middle of the piece in
  // this step, on the side it was on: a knee coming forward carries the cloth in front of it, never through it (the
  // pieces it may touch: `cand` from c, `count` of them; extra: how much further out it keeps, over what is under it)
  function push(ss, x, xp, i, cand, c, count, extra) {
    let px = x[i], py = x[i + 1], pz = x[i + 2];
    const qx = xp[i], qy = xp[i + 1], qz = xp[i + 2];
    for (let m = c; m < c + count; m++) {
      const k = cand[m], S = ss[k];
      if (!near(S, px, py, pz)) continue;
      centre(S, px, py, pz, extra);
      const wx = px - cx, wy = py - cy, wz = pz - cz, e = out(S, wx, wy, wz, rs, rf, cap);
      if (!(e < 1)) continue;
      // (along a limb, the side it was on is across it: where along it, it is now)
      let vx = qx - cx, vy = qy - cy, vz = qz - cz;
      if (!S.e && !cap) { const u = S.u, a = vx * u[0] + vy * u[1] + vz * u[2]; vx -= u[0] * a; vy -= u[1] * a; vz -= u[2] * a; }
      const ev = out(S, vx, vy, vz, rs, rf, cap);
      if (ev > 1e-6 && vx * wx + vy * wy + vz * wz < 0) { px = cx + vx / ev; py = cy + vy / ev; pz = cz + vz / ev; } else if (e > 1e-6) { px = cx + wx / e; py = cy + wy / e; pz = cz + wz / e; }
    }
    x[i] = px; x[i + 1] = Math.max(0.005, py); x[i + 2] = pz;
  }

  // ── a garment on a person ─────────────────────────────────────────────

  // its vertices on the body at rest (pos: its vertices): the body vertices' weighted sum and the offset, scaled by the
  // body's measures
  function fitted(g, pos) {
    const s = [0, 1, 2].map(k => Math.abs(pos[g.measure[k * 2] * 3 + k] - pos[g.measure[k * 2 + 1] * 3 + k]) / g.span[k]);
    const out = new Float32Array(g.V * 3);
    for (let i = 0; i < g.V; i++) for (let c = 0; c < 3; c++) {
      let v = g.offset[i * 3 + c] * s[c];
      for (let k = 0; k < 3; k++) v += g.bary[i * 3 + k] * pos[g.refs[i * 3 + k] * 3 + c];
      out[i * 3 + c] = v;
    }
    return out;
  }

  const BEND = 0.25;  // how stiff cloth is against bending (of its edges' length across two triangles, kept each pass)

  // the garment as cloth (rest: its vertices at rest; inner: how far out of the skin what is under each of them is —
  // it keeps that much further out of the body): its edges, and across each pair of triangles the edge that would
  // bend, kept as long as they are at rest; its pieces sewn together; which vertices move (the loose ones) and which
  // are followed for them (they hold them); how far each loose one is from where it hangs from (along the cloth)
  function clothOf(g, rest, inner) {
    const V = g.V, loose = g.loose, free = i => loose[i] > 0.004;
    const pairs = new Map(), links = [], bends = [];
    const len = (a, b) => Math.hypot(rest[a * 3] - rest[b * 3], rest[a * 3 + 1] - rest[b * 3 + 1], rest[a * 3 + 2] - rest[b * 3 + 2]);
    for (let f = 0; f < g.tris.length; f += 3) for (let k = 0; k < 3; k++) {
      const a = g.tris[f + k], b = g.tris[f + (k + 1) % 3], c = g.tris[f + (k + 2) % 3], key = a < b ? a * V + b : b * V + a;
      const other = pairs.get(key);
      if (other === undefined) { pairs.set(key, c); if (free(a) || free(b)) links.push(a, b, len(a, b)); } else if (free(other) || free(c)) bends.push(other, c, len(other, c));
    }
    for (let k = 0; k < g.sewn.length; k += 2) { const a = g.sewn[k], b = g.sewn[k + 1]; if (free(a) || free(b)) links.push(a, b, len(a, b)); }
    const sim = [], near = new Uint8Array(V);
    for (let i = 0; i < V; i++) if (free(i)) { sim.push(i); near[i] = 1; }
    for (const list of [links, bends]) for (let l = 0; l < list.length; l += 3) { near[list[l]] = 1; near[list[l + 1]] = 1; }
    for (const i of sim) near[g.hangs[i]] = 1;
    const followed = [];
    for (let i = 0; i < V; i++) if (near[i]) followed.push(i);
    // (as numbers to go through fast: each a pair of vertices, three numbers a pair — their places' offsets — its
    // length at rest, how much of it each end moves)
    const pack = (list, k) => {
      const n = list.length / 3, ends = new Uint32Array(n * 2), rest = new Float32Array(n), wa = new Float32Array(n), wb = new Float32Array(n);
      let m = 0;
      for (let l = 0; l < list.length; l += 3) {
        const a = list[l], b = list[l + 1], sum = loose[a] + loose[b];
        if (sum <= 0) continue;
        ends[m * 2] = a * 3; ends[m * 2 + 1] = b * 3; rest[m] = list[l + 2]; wa[m] = loose[a] / sum * k; wb[m] = loose[b] / sum * k; m++;
      }
      return { n: m, ends, rest, wa, wb };
    };
    return { V, loose, edges: [pack(links, 1), pack(bends, BEND)], sim: Uint32Array.from(sim), followed: Uint32Array.from(followed),
      hang: Float32Array.from(sim, i => Math.max(g.far[i], len(i, g.hangs[i]))),
      cand: new Uint8Array(sim.length * PIECES.length), count: new Uint8Array(sim.length), extra: Float32Array.from(sim, i => inner[i]) };
  }

  // the cloth's measures: how fast it goes where the body takes it the less loose it is (per second; the loosest still
  // by LOOSEST of it), how fast its swinging dies down (per second), how much of the pelvis's going it goes along with
  // (the rest it lags: it swings); its steps a frame of the motion, its passes a step (out of the body every PUSHED of
  // them); how far a particle goes in a step at most (metres)
  const PULL = 30, LOOSEST = 0.05, DRAG = 1.4, CARRY = 0.85, SUB = 4, PASSES = 6, PUSHED = 3, CLOSE = 0.05;

  // the parts whose shadow is on the floor: the joints, how big a ball each is (metres, on a man)
  const SHADOWED = [['Hips', 0.13], ['Spine2', 0.14], ['Chest', 0.15], ['Head', 0.1], ...SIDES.flatMap(s => [[`${s}Leg`, 0.09], [`${s}Shin`, 0.07],
    [`${s}Foot`, 0.06], [`${s}ToeBase`, 0.05], [`${s}ForeArm`, 0.05], [`${s}Hand`, 0.05]])];

  function make(gl, B, motion) {
    const prog = program(gl, VS, FS.replace('/*SHADED*/', MooodInk.SHADED.glsl)), floor = program(gl, FLOOR_VS, FLOOR_FS), ink = MooodInk.make(gl), soma = MooodSkeleton.make(B, motion);
    gl.vertexAttribI4ui(prog.a('joint'), 0, 0, 0, 0);  // (the clothes, placed already, have no joints)
    const bones = gl.createTexture(), empty = gl.createVertexArray();
    gl.bindTexture(gl.TEXTURE_2D, bones);
    for (const q of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, q, gl.NEAREST);
    const buffer = (data, target = gl.ARRAY_BUFFER, use = gl.STATIC_DRAW) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, use); return b; };
    const attrib = (name, buf, size, kind, norm, int) => {
      const loc = prog.a(name);
      if (loc < 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc);
      if (int) gl.vertexAttribIPointer(loc, size, kind, 0, 0); else gl.vertexAttribPointer(loc, size, kind, norm, 0, 0);
    };
    const shared = new Map();  // each base's buffers (once)
    const people = {};  // a person (with a face, or without) as drawn here, the outfits drawn on them
    let shown = null;   // the last look drawn

    // a person as drawn here: their body (its vertices — with the face's features or without), its buffers, their
    // skeleton on the motion, their pieces
    const personOf = L => {
      const key = `${bodyKey(L)} ${L.face}`;
      if (people[key]) return people[key];
      const P = got[bodyKey(L)], bs = P.bs, pos = P.at.slice(), plain = P.at.slice();
      bs.face.forEach((i, k) => plain.set(P.plain.subarray(k * 3, k * 3 + 3), i * 3));
      if (L.face === 'none') pos.set(plain);
      if (!shared.has(bs)) shared.set(bs, { joint: buffer(bs.joint), weight: buffer(bs.weight) });
      const sk = MooodSkeleton.make({ J: 77, inverse: P.inverse, parent: B.parent }, motion);
      // the motion goes as far as these legs take it: the pelvis as high as theirs, against Kimodo's
      const kr = sk.tb[0][1] / soma.tb[0][1];
      const normals = unitNormals(pos, bs.tris);
      const shadowed = SHADOWED.map(([j, r]) => [sk.at[j], r * kr]);
      const face = P.parts ? null : got['bodies.json'].people[L.who].face, moving = L.face === 'minimal', use = moving ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;
      const at = buffer(pos, gl.ARRAY_BUFFER, use);
      return (people[key] = { P, pos, sk, fit: { h: 1, f: new Float32Array(77).fill(1), kr }, at, normals,
        normal: buffer(normals, gl.ARRAY_BUFFER, use), even: buffer(unitNormals(plain, bs.tris)), pieces: piecesOf(bs, pos, sk.at, sk.tb), shadowed, face, worn: {},
        moves: moving ? movesOf(L.who, pos, normals, face.scale) : null });
    };

    // a minimal face moving (pos, normals: the person's at rest): the units' weights it shows, the last shown, where it
    // goes from (and since when: a moment of the page's clock) and to; its blinking and talking; its vertices and
    // normals as they move; what is drawn on it (marks: express's)
    const movesOf = (who, pos, normals, scale) => {
      const U = got['bodies.json'].units.length, seed = seedOf(who);
      return { scale, now: new Float32Array(U), shown: new Float32Array(U).fill(NaN), from: null, to: null, since: 0, aim: '',
        blink: blinking(seed), talk: talking(seed ^ 0x9e3779b9), pos: pos.slice(), normals: normals.slice(),
        marks: { lids: new Float32Array(8), brows: new Float32Array(4), upper: new Float32Array(3), lower: new Float32Array(3), span: new Float32Array(3) } };
    };
    // the units' weights of a look's expression
    const unitsOf = (units, k) => {
      const names = got['bodies.json'].units, w = new Float32Array(names.length);
      for (const [u, v] of Object.entries(units)) w[names.indexOf(u)] += v * k;
      return w;
    };

    // (a curve y = a x² + b x + c through three points)
    const through = ([x0, y0], [x1, y1], [x2, y2]) => {
      const d0 = (x0 - x1) * (x0 - x2), d1 = (x1 - x0) * (x1 - x2), d2 = (x2 - x0) * (x2 - x1);
      const a = y0 / d0 + y1 / d1 + y2 / d2;
      return [a, -(y0 * (x1 + x2) / d0 + y1 * (x0 + x2) / d1 + y2 * (x0 + x1) / d2), y0 * x1 * x2 / d0 + y1 * x0 * x2 / d1 + y2 * x0 * x1 / d2];
    };
    // a minimal face at second s of the motion (H: the person, L: the look): its expression (going over to a new one in
    // SHIFT seconds of the page's clock), talking, blinking — into its vertices and normals, if they changed — and what
    // FS draws on it: the eyes' lids (each eye's four), the brows' ends (each brow's two), the lips' edges (upper, lower:
    // a x² + b x + c) and the mouth's span (from its right corner to its left, and how far forward)
    const express = (H, L, s) => {
      const F = H.moves, names = got['bodies.json'].units, E = EXPRESSIONS[L.expression], aim = `${L.expression} ${L.intensity}`;
      const clock = performance.now() / 1000, of = u => F.now[names.indexOf(u)], shown = F.marks;
      if (aim !== F.aim) {
        F.from = F.to ? F.now.slice() : unitsOf(E.units, L.intensity);
        F.to = unitsOf(E.units, L.intensity); F.since = clock; F.aim = aim;
      }
      const k = smooth((clock - F.since) / SHIFT), w = F.now;
      for (let u = 0; u < w.length; u++) w[u] = lerp(F.from[u], F.to[u], k);
      if (L.talk || E.talk) for (const [v, a] of Object.entries(F.talk(s))) for (const [u, x] of Object.entries(VISEMES[v])) w[names.indexOf(u)] += x * a;
      const b = L.blink ? F.blink(s) : 0;
      for (const side of ['Left', 'Right']) { const i = names.indexOf(`eyeBlink${side}`); w[i] = Math.max(w[i], b); }
      for (let u = 0; u < w.length; u++) w[u] = Math.min(1, Math.max(0, w[u]));
      // the lids: the upper as far down as the eye blinks (else lower as the brow comes down, up as the eye opens wide),
      // the lower up as it squints; looking moves the dot (out: towards that eye's side)
      ['Left', 'Right'].forEach((side, e) => {
        const shut = of(`eyeBlink${side}`), out = side === 'Left' ? 1 : -1, lid = shown.lids;
        lid[e * 4] = Math.max(-0.6, shut + (1 - shut) * (0.3 * of(`browDown${side}`) - 0.6 * of(`eyeWide${side}`)));
        lid[e * 4 + 1] = Math.min(1, 0.55 * of(`eyeSquint${side}`) + 0.6 * of(`cheekSquint${side}`));
        lid[e * 4 + 2] = 0.45 * out * (of(`eyeLookOut${side}`) - of(`eyeLookIn${side}`));
        lid[e * 4 + 3] = 0.45 * (of(`eyeLookUp${side}`) - of(`eyeLookDown${side}`));
        shown.brows[e * 2] = 1.6 * (of('browInnerUp') - of(`browDown${side}`));
        shown.brows[e * 2 + 1] = 1.3 * of(`browOuterUp${side}`) - 0.5 * of(`browDown${side}`);
      });
      let same = true;
      for (let u = 0; u < w.length; u++) if (!(Math.abs(w[u] - F.shown[u]) <= 1e-4)) { same = false; break; }
      if (!same) {
        F.shown.set(w);
        // the vertices: at rest, and each unit's movement as much as it is shown (and as big as this face is)
        const R = reachOf(), bs = got['base.bin'], pos = F.pos, nrm = F.normals;
        for (const i of R.ring) { pos[i * 3] = H.pos[i * 3]; pos[i * 3 + 1] = H.pos[i * 3 + 1]; pos[i * 3 + 2] = H.pos[i * 3 + 2]; }
        for (let u = 0; u < w.length; u++) {
          if (w[u] < 1e-4) continue;
          const { at, by } = bs.units[u], f = w[u] * F.scale;
          for (let m = 0; m < at.length; m++) { const o = at[m] * 3; pos[o] += by[m * 3] * f; pos[o + 1] += by[m * 3 + 1] * f; pos[o + 2] += by[m * 3 + 2] * f; }
        }
        for (const i of R.ring) nrm[i * 3] = nrm[i * 3 + 1] = nrm[i * 3 + 2] = 0;
        const t = R.tris;
        for (let f = 0; f < t.length; f += 3) {
          const a = t[f] * 3, b2 = t[f + 1] * 3, c = t[f + 2] * 3;
          const ux = pos[b2] - pos[a], uy = pos[b2 + 1] - pos[a + 1], uz = pos[b2 + 2] - pos[a + 2];
          const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
          const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
          for (const o of [a, b2, c]) if (R.on[o / 3]) { nrm[o] += nx; nrm[o + 1] += ny; nrm[o + 2] += nz; }
        }
        for (const i of R.ring) { const o = i * 3, l = Math.hypot(nrm[o], nrm[o + 1], nrm[o + 2]) || 1; nrm[o] /= l; nrm[o + 1] /= l; nrm[o + 2] /= l; }
        const from = R.from * 3, to = R.to * 3;
        gl.bindBuffer(gl.ARRAY_BUFFER, H.at); gl.bufferSubData(gl.ARRAY_BUFFER, from * 4, pos, from, to - from);
        gl.bindBuffer(gl.ARRAY_BUFFER, H.normal); gl.bufferSubData(gl.ARRAY_BUFFER, from * 4, nrm, from, to - from);
        // the lips where they meet now
        const [l, r, up, down] = got['bodies.json'].mouth.map(i => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]);
        shown.upper.set(through(r, up, l)); shown.lower.set(through(r, down, l)); shown.span.set([r[0], l[0], Math.max(l[2], r[2])]);
      }
      return shown;
    };

    // a garment as cloth lies over the body at rest (x: its vertices; P, n: the skin's and their normals): across its
    // hollows — a vertex goes to its neighbours' mean wherever that is further out from the skin under it, never in
    // (under a bust, between the shoulder blades, the small of the back) — its edges where they are
    const DRAPE = 120;
    const draped = (g, x, P, n) => {
      const V = g.V, near = Array.from({ length: V }, () => new Set()), edge = new Uint8Array(V), seen = new Map();
      for (let f = 0; f < g.tris.length; f += 3) for (let k = 0; k < 3; k++) {
        const a = g.tris[f + k], b = g.tris[f + (k + 1) % 3];
        near[a].add(b); near[b].add(a);
        const key = a < b ? a * V + b : b * V + a;
        seen.set(key, (seen.get(key) || 0) + 1);
      }
      for (const [key, c] of seen) if (c === 1) { edge[Math.floor(key / V)] = 1; edge[key % V] = 1; }
      const nb = near.map(s2 => Uint16Array.from(s2)), m = new Float32Array(3);
      for (let it = 0; it < DRAPE; it++) for (let i = 0; i < V; i++) {
        if (edge[i] || !nb[i].length) continue;
        m.fill(0);
        for (const j of nb[i]) { m[0] += x[j * 3]; m[1] += x[j * 3 + 1]; m[2] += x[j * 3 + 2]; }
        const q = g.beneath[i] * 3, o = i * 3, k = 1 / nb[i].length;
        const dx = m[0] * k - x[o], dy = m[1] * k - x[o + 1], dz = m[2] * k - x[o + 2];
        if (dx * n[q] + dy * n[q + 1] + dz * n[q + 2] > 0) { x[o] += dx; x[o + 1] += dy; x[o + 2] += dz; }
      }
    };

    // a top hangs from the chest (x: its vertices; H: the person): below the bust, round the trunk, it goes no nearer
    // the trunk's middle going down than HANG lets (metres a metre) — straight down over the belly, not in at the
    // waist; above, and on the arms, it is as it is
    const HANG = 0.1, BINS = 32;
    const hung = (g, x, H) => {
      const tb = H.sk.tb, at = H.sk.at, trunk = new Set([at.Hips, at.Spine1, at.Spine2, at.Chest]);
      const hips = tb[at.Hips], chest = tb[at.Chest], top = chest[1] - 0.04;
      const axis = y => { const u = Math.max(0, Math.min(1, (y - hips[1]) / (chest[1] - hips[1]))); return [hips[0] + (chest[0] - hips[0]) * u, hips[2] + (chest[2] - hips[2]) * u]; };
      const dom = i => { let best = 0; for (let k = 1; k < 4; k++) if (g.weight[i * 4 + k] > g.weight[i * 4 + best]) best = k; return g.joint[i * 4 + best]; };
      const order = [];  // (what of it goes with the trunk: not its sleeves)
      for (let i = 0; i < g.V; i++) if (trunk.has(dom(i)) && x[i * 3 + 1] < top + 0.03) order.push(i);
      order.sort((a, b) => x[b * 3 + 1] - x[a * 3 + 1]);
      const most = new Float32Array(BINS);  // (each way round, how far out the cloth is above: as at the bust)
      for (const i of order) {
        const o = i * 3, y = x[o + 1], [cx, cz] = axis(y), dx = x[o] - cx, dz = x[o + 2] - cz, r = Math.hypot(dx, dz) || 1e-9;
        const k = Math.floor((Math.atan2(dx, dz) / (2 * Math.PI) + 0.5) * BINS) % BINS, drop = Math.max(0, top - y);
        if (y < top) {
          const need = most[k] - HANG * drop;
          if (r < need) { x[o] = cx + dx / r * need; x[o + 2] = cz + dz / r * need; }
        }
        most[k] = Math.max(most[k], Math.max(r, most[k] - HANG * drop) + HANG * drop);
      }
    };

    // the garments worn one over another (from the inside out), at rest: each further from the skin, where it is
    // over another, than that one is, and none nearer than EASE (a vertex pushed out along the skin's normal: the cloth
    // over the body, not drawn on it) — how far out the inner ones are, at each vertex of the skin and two rings round it
    const EASE = 0.018, LAYER = 0.012;
    let neighbours = null;
    const layered = (H, garments) => {
      if (!neighbours) {
        const bs = got['base.bin'], sets = Array.from({ length: bs.N }, () => new Set());
        for (let f = 0; f < bs.tris.length; f += 3) for (let k = 0; k < 3; k++) sets[bs.tris[f + k]].add(bs.tris[f + (k + 1) % 3]).add(bs.tris[f + (k + 2) % 3]);
        neighbours = sets.map(n => Uint16Array.from(n));
      }
      const P = H.pos, n = H.normals, N = got['base.bin'].N;
      let far = new Float32Array(N).fill(-Infinity);
      const gap = (x, o, q) => (x[o] - P[q]) * n[q] + (x[o + 1] - P[q + 1]) * n[q + 1] + (x[o + 2] - P[q + 2]) * n[q + 2];
      for (const G of garments) {
        const cloth = G.kind !== 'hair', { beneath } = G.g, x = G.rest;  // (hair is a solid: as it is, over what is under it)
        if (G.kind === 'top') hung(G.g, x, H);
        G.inner = Float32Array.from(beneath, b => Math.max(0, far[b] + LAYER));  // (how far out what is under it is)
        const need = Float32Array.from(beneath, (b, i) => Math.max(far[b] + LAYER, cloth ? EASE : -Infinity) - gap(x, i * 3, b * 3));
        // (a solid goes out whole: as far as the most any of it over the skin round there needs — through its
        // thickness alike, not flattened onto what is under it)
        const most = cloth ? null : grown(need, beneath, N);
        const by = evened(G.g, cloth ? need : Float32Array.from(beneath, b => most[b]));
        for (let i = 0; i < G.g.V; i++) {
          const q = beneath[i] * 3, o = i * 3, d = by[i];
          if (d > 0) { x[o] += n[q] * d; x[o + 1] += n[q + 1] * d; x[o + 2] += n[q + 2] * d; }
        }
        if (cloth) draped(G.g, x, P, n);  // (across what it went out over)
        far = grown(Float32Array.from({ length: G.g.V }, (_, i) => gap(x, i * 3, beneath[i] * 3)), beneath, N, far);
      }
      return garments;
    };
    // how far each vertex of a garment goes out (d), evened along the garment: never less than it needs, nor than its
    // neighbours' mean — no steps
    const EVEN = 30;
    const evened = (g, need) => {
      const d = need.slice(), near = Array.from({ length: g.V }, () => []);
      for (let f = 0; f < g.tris.length; f += 3) for (let k = 0; k < 3; k++) near[g.tris[f + k]].push(g.tris[f + (k + 1) % 3], g.tris[f + (k + 2) % 3]);
      for (let it = 0; it < EVEN; it++) for (let i = 0; i < g.V; i++) {
        let sum = 0;
        for (const j of near[i]) sum += d[j];
        if (near[i].length && sum / near[i].length > d[i]) d[i] = sum / near[i].length;
      }
      return d;
    };
    // the most of `values` (a garment's, each at its vertex) over each vertex of the skin and two rings round it (as
    // well as `start`'s there)
    const grown = (values, beneath, N, start = new Float32Array(N).fill(-Infinity)) => {
      let most = start.slice();
      values.forEach((v, i) => { if (v > most[beneath[i]]) most[beneath[i]] = v; });
      for (let r = 0; r < 2; r++) {
        const next = most.slice();
        for (let b = 0; b < N; b++) for (const c of neighbours[b]) if (most[c] > next[b]) next[b] = most[c];
        most = next;
      }
      return most;
    };

    // what a person wears, drawn: the body (without what clothes cover) and each garment, as cloth
    const wornOf = (H, L) => {
      const ids = wornBy(L), keys = ids.map(id => wornKey(L, id)), key = keys.join(' ');
      if (H.worn[key]) return H.worn[key];
      const bs = H.P.bs, hidden = new Uint8Array(bs.N);
      const fits = layered(H, keys.map((k, n) => ({ g: got[k], rest: fitted(got[k], H.pos), kind: kindOf(L, ids[n]) })));
      // what an outer garment covers (where it lies close, not loose) of the skin is not drawn, nor what of an inner
      // garment lies there and goes with the body
      const under = ids.map((_, n) => { const u = new Uint8Array(bs.N); for (const m of ids.keys()) if (m > n) for (const i of fits[m].g.cover) u[i] = 1; return u; });
      const garments = ids.map((id, n) => {
        const { g, rest, kind } = fits[n];
        for (const i of g.cover) hidden[i] = 1;
        const shown = [];
        for (let f = 0; f < g.tris.length; f += 3) {
          const gone = k => { const i = g.tris[f + k]; return under[n][g.beneath[i]] && g.loose[i] < 0.2; };
          if (!(gone(0) && gone(1) && gone(2))) shown.push(g.tris[f], g.tris[f + 1], g.tris[f + 2]);
        }
        const vao = gl.createVertexArray(), at = buffer(rest, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW), normal = buffer(rest.byteLength, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW);
        gl.bindVertexArray(vao);
        attrib('at', at, 3, gl.FLOAT); attrib('normal', normal, 3, gl.FLOAT); attrib('even', normal, 3, gl.FLOAT);
        buffer(Uint16Array.from(shown), gl.ELEMENT_ARRAY_BUFFER);
        gl.bindVertexArray(null);
        return { id, n, kind, g, rest, vao, at, normal, count: shown.length, cloth: clothOf(g, rest, fits[n].inner),
          x: new Float32Array(g.V * 3), xp: new Float32Array(g.V * 3), target: new Float32Array(g.V * 3), nrm: new Float32Array(g.V * 3) };
      });
      const kept = [];
      for (let f = 0; f < bs.tris.length; f += 3) if (!hidden[bs.tris[f]] && !hidden[bs.tris[f + 1]] && !hidden[bs.tris[f + 2]]) kept.push(bs.tris[f], bs.tris[f + 1], bs.tris[f + 2]);
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      attrib('at', H.at, 3, gl.FLOAT); attrib('normal', H.normal, 3, gl.FLOAT); attrib('even', H.even, 3, gl.FLOAT);
      attrib('joint', shared.get(bs).joint, 4, gl.UNSIGNED_BYTE, false, true); attrib('weight', shared.get(bs).weight, 4, gl.UNSIGNED_BYTE, true);
      buffer(Uint16Array.from(kept), gl.ELEMENT_ARRAY_BUFFER);
      gl.bindVertexArray(null);
      // (its parts, each coloured as a look colours it: a cast's body's, as it says — it wears nothing, all of it is
      // kept; ours, all skin)
      const parts = H.P.parts ?? [['skin', 0, kept.length / 3]];
      return (H.worn[key] = { body: { vao, parts }, garments, simT: -1, hips: null });
    };

    // each joint's 3×4 now (from the body at rest), into M
    const M = new Float32Array(77 * 12);
    const pose = (H, t, still = 0) => {
      H.sk.pose(t, H.fit, still);
      const { R, T } = H.sk, K = H.P.inverse;
      for (let j = 0; j < 77; j++) for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
        const o = j * 12;
        M[o + r * 4 + c] = R[j * 9 + r * 3] * K[o + c] + R[j * 9 + r * 3 + 1] * K[o + 4 + c] + R[j * 9 + r * 3 + 2] * K[o + 8 + c] + (c === 3 ? T[j * 3 + r] : 0);
      }
    };

    // a garment's vertices (these of them; all: none given) where the body takes them now
    const skin = (G, list, to) => {
      const { joint, weight } = G.g, rest = G.rest;
      const each = i => {
        const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
        let sx = 0, sy = 0, sz = 0;
        for (let k = 0; k < 4; k++) {
          const w = weight[i * 4 + k];
          if (!w) continue;
          const o = joint[i * 4 + k] * 12, f = w / 255;
          sx += f * (M[o] * x + M[o + 1] * y + M[o + 2] * z + M[o + 3]);
          sy += f * (M[o + 4] * x + M[o + 5] * y + M[o + 6] * z + M[o + 7]);
          sz += f * (M[o + 8] * x + M[o + 9] * y + M[o + 10] * z + M[o + 11]);
        }
        to[i * 3] = sx; to[i * 3 + 1] = sy; to[i * 3 + 2] = sz;
      };
      if (list) for (const i of list) each(i); else for (let i = 0; i < G.g.V; i++) each(i);
    };

    // a step of the cloth (dt seconds): what is loose falls and swings on (carried by the pelvis most of the way), the
    // rest goes where the body takes it; then, in passes: kept as long as it was, near where the body takes it, no
    // further from where it hangs from than at rest, out of the body
    const step = (W, ss, dt) => {
      const g = -9.8 * dt * dt, keep = Math.exp(-DRAG * dt), was = W.hips, now = M.slice(0, 12);
      W.hips = now;
      for (const G of W.garments) {
        const C = G.cloth, { x, xp, target } = G, loose = C.loose, hangs = G.g.hangs;
        skin(G, C.followed, target);
        for (const i of C.followed) if (loose[i] <= 0.004) { x[i * 3] = target[i * 3]; x[i * 3 + 1] = target[i * 3 + 1]; x[i * 3 + 2] = target[i * 3 + 2]; }
        for (const i of C.sim) {
          const o = i * 3;
          let mx = 0, my = 0, mz = 0;
          if (was) {  // where the pelvis would have taken it: from the pelvis's frame then to its frame now
            const dx = x[o] - was[3], dy = x[o + 1] - was[7], dz = x[o + 2] - was[11];
            const lx = was[0] * dx + was[4] * dy + was[8] * dz, ly = was[1] * dx + was[5] * dy + was[9] * dz, lz = was[2] * dx + was[6] * dy + was[10] * dz;
            mx = (now[0] * lx + now[1] * ly + now[2] * lz + now[3] - x[o]) * CARRY;
            my = (now[4] * lx + now[5] * ly + now[6] * lz + now[7] - x[o + 1]) * CARRY;
            mz = (now[8] * lx + now[9] * ly + now[10] * lz + now[11] - x[o + 2]) * CARRY;
          }
          const vx = (x[o] - xp[o]) * keep, vy = (x[o + 1] - xp[o + 1]) * keep, vz = (x[o + 2] - xp[o + 2]) * keep;
          xp[o] = x[o] + mx; xp[o + 1] = x[o + 1] + my; xp[o + 2] = x[o + 2] + mz;
          x[o] += vx + mx; x[o + 1] += vy + g + my; x[o + 2] += vz + mz;
        }
        // the pieces each particle may touch in this step (it goes no further than CLOSE in it)
        const cand = C.cand, count = C.count;
        for (let n = 0; n < C.sim.length; n++) {
          const o = C.sim[n] * 3;
          let m = 0;
          for (let k = 0; k < ss.length; k++) {
            const S = ss[k], dx = x[o] - S.mx, dy = x[o + 1] - S.my, dz = x[o + 2] - S.mz, r = S.reach + CLOSE;
            if (dx * dx + dy * dy + dz * dz < r * r) cand[n * PIECES.length + m++] = k;
          }
          count[n] = m;
        }
        for (let pass = 0; pass < PASSES; pass++) {
          for (let e = 0; e < 2; e++) {
            const { n, ends, rest, wa, wb } = C.edges[e];
            for (let l = 0; l < n; l++) {
              const a3 = ends[l * 2], b3 = ends[l * 2 + 1];
              const dx = x[b3] - x[a3], dy = x[b3 + 1] - x[a3 + 1], dz = x[b3 + 2] - x[a3 + 2], l2 = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
              const m = (l2 - rest[l]) / l2, ma = m * wa[l], mb = m * wb[l];
              x[a3] += dx * ma; x[a3 + 1] += dy * ma; x[a3 + 2] += dz * ma;
              x[b3] -= dx * mb; x[b3 + 1] -= dy * mb; x[b3 + 2] -= dz * mb;
            }
          }
          for (let n = 0; n < C.sim.length; n++) {
            const i = C.sim[n], o = i * 3, pull = 1 - Math.exp(-PULL * (1 - (1 - LOOSEST) * loose[i]) * dt / PASSES);
            x[o] += (target[o] - x[o]) * pull; x[o + 1] += (target[o + 1] - x[o + 1]) * pull; x[o + 2] += (target[o + 2] - x[o + 2]) * pull;
            const a = hangs[i] * 3, hx = x[o] - x[a], hy = x[o + 1] - x[a + 1], hz = x[o + 2] - x[a + 2], h = Math.sqrt(hx * hx + hy * hy + hz * hz);
            if (h > C.hang[n]) { const k = C.hang[n] / h; x[o] = x[a] + hx * k; x[o + 1] = x[a + 1] + hy * k; x[o + 2] = x[a + 2] + hz * k; }
          }
          if (pass % PUSHED === PUSHED - 1) for (let n = 0; n < C.sim.length; n++) push(ss, x, xp, C.sim[n] * 3, cand, n * PIECES.length, count[n], C.extra[n]);
        }
      }
    };

    // the clothes at frame t: from a little before it, or on from where they were
    const clothe = (H, W, t) => {
      const fps = motion.fps;
      if (W.simT < 0 || t < W.simT - 1e-6 || t - W.simT > 60) {
        // put on at rest (as the clothes were made), then the body moves into the motion in half a second — from a
        // second before t
        W.simT = Math.max(0, t - fps); W.hips = null;
        pose(H, W.simT, 1);
        for (const G of W.garments) { skin(G, null, G.x); G.xp.set(G.x); }
        const n = Math.round(fps * SUB / 2);
        for (let k = 1; k <= n; k++) {
          pose(H, W.simT, 1 - k / n);
          step(W, shapesNow(H.pieces, M), 1 / (fps * SUB));
        }
      }
      while (W.simT < t - 1e-6) {
        const next = Math.min(t, W.simT + 1 / SUB);
        pose(H, next);
        step(W, shapesNow(H.pieces, M), (next - W.simT) / fps);
        W.simT = next;
      }
      pose(H, t);
      for (const G of W.garments) {
        skin(G, null, G.target);
        const loose = G.cloth.loose, { x, target } = G;
        for (let i = 0; i < G.g.V; i++) if (loose[i] <= 0.004) { x[i * 3] = target[i * 3]; x[i * 3 + 1] = target[i * 3 + 1]; x[i * 3 + 2] = target[i * 3 + 2]; }
        normalsOf(x, G.g.tris, G.nrm);
        gl.bindBuffer(gl.ARRAY_BUFFER, G.at); gl.bufferSubData(gl.ARRAY_BUFFER, 0, x);
        gl.bindBuffer(gl.ARRAY_BUFFER, G.normal); gl.bufferSubData(gl.ARRAY_BUFFER, 0, G.nrm);
      }
    };

    const current = L => {
      if (ready(L)) shown = L; else load(L);
      return shown;
    };

    // the floor's shadow: under the pelvis, of the parts' balls where they are now
    const shadow = (H, cam, flat) => {
      const T = H.sk.T, balls = new Float32Array(16 * 4);
      H.shadowed.forEach(([j, r], i) => balls.set([T[j * 3], T[j * 3 + 1], T[j * 3 + 2], r], i * 4));
      gl.useProgram(floor.p);
      const u = floor.u;
      gl.uniformMatrix4fv(u.view, false, cam.V);
      gl.uniform3fv(u.mid, [T[0], 0, T[2]]); gl.uniform1f(u.size, 2 * H.fit.kr);
      gl.uniform4fv(u.balls, balls); gl.uniform1i(u.count, H.shadowed.length);
      gl.uniform1i(u.flat_, flat ? 1 : 0); gl.uniform1f(u.strength, flat ? 0.1 : 0.42);
      gl.enable(gl.BLEND); gl.blendFunc(gl.DST_COLOR, gl.ZERO); gl.depthMask(false);
      gl.bindVertexArray(empty); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.bindVertexArray(null);
      gl.depthMask(true); gl.disable(gl.BLEND);
    };

    return {
      // how high the pelvis goes on this look's legs, against Kimodo's (1 until a person is drawn)
      scale: L => { const S = current(L); return S ? personOf(S).fit.kr : 1; },
      ground,
      render([x, y, w, h], k, t, L0, cam, world, scene = null) {
        const L = current(L0), light = LIGHTS[L0.light], sil = L0.style === 'silhouette', ss = k >= 2 ? 1 : 2;
        ink.begin([x, y, w, h], ss, scene ? null : hex(ground(L0).bg));
        world();
        if (L) {
          const H = personOf(L), W = wornOf(H, L);
          clothe(H, W, t);
          if (!sil && !scene) shadow(H, cam, L0.style === 'flat');
          gl.useProgram(prog.p);
          gl.uniform1i(prog.u.scene, scene?.lit ? 1 : 0); gl.uniformMatrix3fv(prog.u.world, false, scene ? scene.world : [1, 0, 0, 0, 1, 0, 0, 0, 1]);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, bones);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 3, 77, 0, gl.RGBA, gl.FLOAT, M);
          const u = prog.u, col = Object.fromEntries(Object.entries(L0.colors).map(([kk, v]) => [kk, hex(v)]));
          const kd = unit(add(add(mul(cam.right, light.key[0]), mul(cam.up, light.key[1])), mul(cam.back, light.key[2])));
          gl.uniformMatrix4fv(u.view, false, cam.V);
          gl.uniform1i(u.style, STYLE[L0.style]); gl.uniform1i(u.bones, 0);
          const sources = scene?.light;
          gl.uniform1i(u.sourced, sources ? 1 : 0);
          if (sources) { gl.uniform3fv(u.amb, sources.amb); gl.uniform3fv(u.lit1, sources.keyCol); gl.uniform3fv(u.lit2, sources.backCol); gl.uniform3fv(u.back, sources.back); }
          MooodInk.SHADED.set(gl, prog.p, sources);
          gl.uniform3fv(u.eye, cam.eye); gl.uniform3fv(u.key, sources ? sources.key : kd);
          gl.uniform3fv(u.keyCol, hex(light.color)); gl.uniform3fv(u.sky, hex(light.sky)); gl.uniform3fv(u.earth, hex(light.ground));
          gl.uniform3fv(u.ink, sil ? hex(SILHOUETTE.ink) : [0.17, 0.14, 0.13]);
          // the body, its face
          const F = H.face, face = L.face === 'minimal';
          gl.uniform1i(u.face, face ? 1 : 0);
          if (face) {
            gl.uniform3fv(u.eyes, F.eyes.flat()); gl.uniform1f(u.eyeSize, F.size);
            const m = express(H, L, t / motion.fps);
            gl.uniform4fv(u.lids, m.lids); gl.uniform2fv(u.brows, m.brows); gl.uniform3fv(u.upper, m.upper); gl.uniform3fv(u.lower, m.lower); gl.uniform3fv(u.span, m.span);
          }
          gl.uniform1i(u.skinned, 1); gl.uniform1i(u.id, 0); gl.uniform1i(u.sheet, 0);
          gl.bindVertexArray(W.body.vao);
          for (const [role, first, count] of W.body.parts) {
            gl.uniform3fv(u.tone, col[role]);
            gl.drawElements(gl.TRIANGLES, count * 3, gl.UNSIGNED_SHORT, first * 6);
          }
          gl.uniform1i(u.skinned, 0); gl.uniform1i(u.face, 0);
          for (const G of W.garments) {
            gl.uniform1i(u.id, 1 + G.n); gl.uniform3fv(u.tone, col[G.kind]); gl.uniform1i(u.sheet, G.kind === 'hair' ? 0 : 1);
            gl.bindVertexArray(G.vao);
            gl.drawElements(gl.TRIANGLES, G.count, gl.UNSIGNED_SHORT, 0);
          }
          gl.bindVertexArray(null);
        }
        // a silhouette: a thin line of the background where one part is well in front of another (not round it, not
        // where marks differ)
        ink.end([x, y, w, h], { ...(sil ? { width: 1.2 * k, color: hex(SILHOUETTE.bg), differ: 9 } : {}), ...scene });
      },
    };
  }

  globalThis.MooodFigure = { look, load, make, names, PEOPLE, FACES, EXPRESSIONS, OUTFITS, HAIR, STYLES, LIGHTS };
})();
