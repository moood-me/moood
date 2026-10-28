// What a figure of shapes may be — a look: its style (the shapes' language and proportions: a shadow — slender,
// small-headed, tapering to points, Gris, Limbo; soft — round, big-headed, mittens, tinted lines, Cartoon Saloon;
// graphic — wide shoulders over a narrow waist, square-ish, flat, UPA; toy — chunky figurines in matte clay; geometry —
// faceted, two tones, Kentucky Route Zero; flat geometry — straight-edged designed shapes, flat colours lit by the
// scene), who (proportions, clothes, hair, a hat, a scarf, colours), how painted and on what ground. What is put on the
// figure — hair, hats, faces, a garment's own pieces, parts — is drawn on F (shapes.js: the figure being made), as a
// world's cast draws its own (cast.shapes: the same tables, over ours by name; a style or a character may say `from`,
// one it is made from).
//   look(partial, cast?) → a whole look; tablesOf(cast) → ours with the cast's over them; bodyOf(look) → the skeleton's
//     lengths a look is drawn with; V — the figure's vectors, for a world's parts
// (while a figure is drawn each frame — what follows more than one joint of it — its vectors and lists come from the
// frame's arena, not new: the same arrays each frame; at other times, new arrays)
export const ARENA = { on: false, i: 0, pool: [], l: 0, lists: [] };
// a list of n (its places to be filled)
export const listOf = n => {
  if (!ARENA.on) return new Array(n);
  const a = ARENA.lists[ARENA.l++] ??= [];
  a.length = n;
  return a;
};
// a vector to be written: the arena's next, or a new one. Each of the vectors' own writes its answer there itself: a
// number handed to a function is made on the heap (5.16) — what a draw hands them (mul's k, mix's u), a number worked
// out, is the draw's to pay for; a number written in the code is not made
export const spot = () => (ARENA.on ? (ARENA.pool[ARENA.i++] ??= [0, 0, 0]) : [0, 0, 0]);
const vec = (x, y, z) => { const v = spot(); v[0] = x; v[1] = y; v[2] = z; return v; };
export const add = (a, b) => { const v = spot(); v[0] = a[0] + b[0]; v[1] = a[1] + b[1]; v[2] = a[2] + b[2]; return v; };
export const sub = (a, b) => { const v = spot(); v[0] = a[0] - b[0]; v[1] = a[1] - b[1]; v[2] = a[2] - b[2]; return v; };
export const mul = (a, k) => { const v = spot(); v[0] = a[0] * k; v[1] = a[1] * k; v[2] = a[2] * k; return v; };
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => { const v = spot(); v[0] = a[1] * b[2] - a[2] * b[1]; v[1] = a[2] * b[0] - a[0] * b[2]; v[2] = a[0] * b[1] - a[1] * b[0]; return v; };
export const mix = (a, b, u) => { const v = spot(); v[0] = a[0] + (b[0] - a[0]) * u; v[1] = a[1] + (b[1] - a[1]) * u; v[2] = a[2] + (b[2] - a[2]) * u; return v; };
export const unit = a => { const k = 1 / (Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) || 1), v = spot(); v[0] = a[0] * k; v[1] = a[1] * k; v[2] = a[2] * k; return v; };
export const level = a => { const k = 1 / (Math.sqrt(a[0] * a[0] + a[2] * a[2]) || 1), v = spot(); v[0] = a[0] * k; v[1] = 0 * k; v[2] = a[2] * k; return v; };
const mean = ring => {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < ring.length; i++) { x += ring[i][0]; y += ring[i][1]; z += ring[i][2]; }
  const v = spot();
  v[0] = x / ring.length; v[1] = y / ring.length; v[2] = z / ring.length;
  return v;
};
export const smooth = (e0, e1, v) => { const u = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return u * u * (3 - 2 * u); };
// a point round an axis: across it (e1, e2) at an angle, w and d its half-widths; square > 2: a squarer section
export const round = (c, e1, e2, w, d, a, square) => {
  const cs = Math.cos(a), sn = Math.sin(a), k = 2 / square, x = w * Math.sign(cs) * Math.abs(cs) ** k, y = d * Math.sign(sn) * Math.abs(sn) ** k, v = spot();
  v[0] = c[0] + (e1[0] * x + e2[0] * y); v[1] = c[1] + (e1[1] * x + e2[1] * y); v[2] = c[2] + (e1[2] * x + e2[2] * y);
  return v;
};
// the figure's vectors, for a world's parts: [x, y, z]
export const V = Object.freeze({ add, sub, mul, dot, cross, mix, unit, level, mean });

// ── what a look may be ────────────────────────────────────────────────

// a style: its shapes and proportions — the head's size and shape (an egg's three half-widths; headSquare > 2:
// squarer), the neck's length, the legs', the limbs' thickness; the trunk's sections (hips to shoulders: their width
// and depth), how square; the arms' and the legs' profiles (ARMS, LEGS: hands and feet), fingers of their own; how
// round (a tube's sides; facets: flat faces); garments' folds (how many round, how deep at the hem) and a ragged
// hem (how much of the length its tatters hang); rigid: each bone of a limb a straight bar of its own (a bent knee
// the corner of two), the hands balls, the feet shoes; straight: garments' sides straight lines from their top to
// the hem (a coat a trapezoid); drape: cloth as long over bent knees as hanging (sitting, it
// goes over the thighs and falls from the knees by what is left); sleeves a shade of the garment (×); how it is
// painted, its lines (CSS pixels; tinted: each a darker shade of what it edges), the ground it is seen on first
export const STYLES = {
  shadow: { name: 'shadow', head: 0.94, egg: [0.84, 1.12, 0.96], neck: 1.35, legs: 1.1, limb: 0.66, sides: 20, square: 2,
    trunk: { w: [0.78, 0.84, 0.66, 0.8, 0.9], d: [0.8, 0.82, 0.7, 0.76, 0.68] }, arms: 'palm', fingers: true, feet: 'point', paint: 'rim', line: 1.4,
    folds: { n: 7, depth: 0.09 }, ragged: 0.07, ground: 'fog', drape: true },
  soft: { name: 'soft', head: 1.38, egg: [1.08, 1, 1.02], neck: 0.35, legs: 0.84, limb: 1.05, sides: 22, square: 2,
    trunk: { w: [0.98, 1.04, 0.98, 1.02, 0.92], d: [1.08, 1.1, 1.1, 1.08, 0.98] }, arms: 'mitten', feet: 'bean', paint: 'toned', line: 2.2, tinted: true,
    folds: { n: 5, depth: 0.04 }, face: 'simple', ground: 'paper', drape: true },
  graphic: { name: 'graphic', head: 1.06, egg: [0.9, 1.08, 0.94], headSquare: 2.6, neck: 0.8, legs: 1.06, limb: 0.74, sides: 16, square: 2.8,
    trunk: { w: [0.82, 0.88, 0.7, 1.06, 1.24], d: [0.78, 0.8, 0.7, 0.76, 0.62] }, arms: 'leaf', feet: 'point', paint: 'flat', line: 1.6, ground: 'day', drape: true },
  toy: { name: 'toys', head: 1.16, egg: [0.96, 1.06, 1], neck: 0.6, legs: 0.92, limb: 1.25, sides: 22, square: 2.2,
    trunk: { w: [1.05, 1.1, 1.08, 1.12, 1.06], d: [1.1, 1.1, 1.15, 1.15, 1.05] }, arms: 'mitten', feet: 'boot', paint: 'clay', line: 1.4,
    folds: { n: 4, depth: 0.03 }, face: 'simple', ground: 'studio', drape: true },
  geometry: { name: 'geometry', head: 1, egg: [0.9, 1.1, 0.98], neck: 0.9, legs: 1.02, limb: 0.9, sides: 6, facets: true, square: 2.4,
    trunk: { w: [0.9, 0.95, 0.82, 0.98, 1.04], d: [0.9, 0.9, 0.84, 0.9, 0.8] }, arms: 'leaf', feet: 'wedge', paint: 'toned', line: 1.2, ground: 'paper', drape: true },
  flat: { name: 'flat geometry', head: 1.1, egg: [0.94, 1.04, 0.98], neck: 0.55, legs: 1.06, limb: 0.9, sides: 20, square: 2.8,
    trunk: { w: [1, 1, 1.16, 1.03, 0.96], d: [0.82, 0.82, 0.88, 0.8, 0.9] }, arms: 'bar', feet: 'shoe', rigid: true, straight: true, drape: true, sleeves: 0.88,
    paint: 'lit', line: 1, face: 'dot', ground: 'sunset' },
};
// the arms' and the legs' profiles: along the joints (0 the shoulder or the hip, 1 the elbow or the knee, 2 the wrist or
// the ankle, 3 the fingertips or the toes; between, a share of the bone) their half-width, metres at thickness 1
// (a rigid style's bars take the joints' only: each bone from one to the next; at 3 the hand's ball, the shoe's half-width)
export const ARMS = {
  bar: [[0, 0.05], [1, 0.045], [2, 0.04], [3, 0.047]],
  palm: [[0, 0.046], [0.55, 0.04], [1, 0.03], [1.45, 0.029], [2, 0.017], [2.5, 0.02], [3, 0.012]],
  point: [[0, 0.046], [0.55, 0.04], [1, 0.03], [1.45, 0.029], [2, 0.017], [2.6, 0.013], [3, 0]],
  mitten: [[0, 0.048], [1, 0.036], [1.5, 0.034], [2, 0.028], [2.3, 0.044], [2.7, 0.044], [2.9, 0.03], [3, 0]],
  leaf: [[0, 0.045], [1, 0.031], [1.5, 0.029], [2, 0.02], [2.4, 0.03], [2.8, 0.018], [3, 0]],
};
export const LEGS = {
  boot: [[0, 0.09], [1, 0.072], [1.5, 0.068], [1.9, 0.064], [2, 0.058], [2.3, 0.062], [2.8, 0.052], [3, 0]],
  point: [[0, 0.08], [0.45, 0.066], [1, 0.042], [1.35, 0.05], [2, 0.024], [2.4, 0.026], [3, 0.004]],
  bean: [[0, 0.086], [0.5, 0.075], [1, 0.056], [1.4, 0.058], [2, 0.042], [2.3, 0.052], [2.75, 0.044], [3, 0]],
  wedge: [[0, 0.078], [1, 0.048], [1.4, 0.052], [2, 0.03], [2.5, 0.032], [3, 0.006]],
  shoe: [[0, 0.07], [1, 0.054], [2, 0.044], [3, 0.046]],
};
export const PAINTS = { silhouette: 'silhouette', rim: 'silhouette with a rim', flat: 'colours', toned: 'colours and shade', clay: 'clay', lit: 'colours in the light' };
// the background, its floor's lines, a silhouette's (and the lines') colour on it, the light round a silhouette's edge
// (and lit by: the colours under the scene's light, ×; how far they fade into the air, towards the background)
export const GROUNDS = {
  studio: { name: 'studio', bg: '#e4e0da', ink: '#2b2724', grid: '#d9d4cd', rim: '#ffffff' },
  fog: { name: 'fog', bg: '#dcd7cf', ink: '#2a231e', grid: '#cfc9c0', rim: '#f2c98e' },
  night: { name: 'night', bg: '#2a2f38', ink: '#0d0f13', grid: '#363c47', rim: '#c9a46a' },
  dusk: { name: 'dusk', bg: '#6b6470', ink: '#1a161c', grid: '#77707c', rim: '#e7b27a' },
  day: { name: 'day', bg: '#b7c2c8', ink: '#22272b', grid: '#a5b0b6', rim: '#fff1d6' },
  paper: { name: 'paper', bg: '#ece5d6', ink: '#1c1a17', grid: '#dcd4c4', rim: '#e9b97c' },
  sunset: { name: 'sunset', bg: '#d9a07e', ink: '#3a2622', grid: '#cd9473', rim: '#ffe3b8', light: '#fff2e4' },
  lamp: { name: 'lamp', bg: '#20252c', ink: '#0c0e11', grid: '#2a3039', rim: '#f4b56a', light: '#6f7384' },
  mist: { name: 'haze', bg: '#a59bb2', ink: '#2f2838', grid: '#9b91a8', rim: '#f6c48e', light: '#8d86a6', haze: 0.3 },
};
export const BODY = { height: 1, head: 1, neck: 1, shoulders: 1, arms: 1, hips: 1, legs: 1, thick: 1 };
const COLORS = { skin: '#d9ad8c', hair: '#3b2a20', top: '#a89a7e', bottom: '#4b4640', shoes: '#2e241d', garment: '#5d4b3d',
  hat: '#2b2724', accent: '#b23a33', socks: '#2a2730' };
// who: proportions (factors of Kimodo's man: skeleton.js), clothes, hair, colours
export const CHARACTERS = {
  man: { name: 'man', body: { shoulders: 1.05 }, garment: 'tunic', hair: 'short' },
  woman: { name: 'woman', body: { height: 0.93, shoulders: 0.88, hips: 1.08, thick: 0.9 }, garment: 'dress', hair: 'long',
    colors: { garment: '#7b5d63', hair: '#5a3a26', top: '#7b5d63' } },
  teen: { name: 'teenager', body: { height: 0.9, head: 1.02, shoulders: 0.92, thick: 0.84 }, garment: 'none', hair: 'short', colors: { top: '#8c9a7c' } },
  child: { name: 'child', body: { height: 0.72, head: 1.16, legs: 0.94, arms: 0.95, shoulders: 0.88, thick: 0.82 }, garment: 'tunic', hair: 'short',
    colors: { hair: '#8a6a3c', top: '#b0a07e' } },
  toddler: { name: 'toddler', body: { height: 0.55, head: 1.34, legs: 0.86, arms: 0.9, shoulders: 0.86, neck: 0.6, thick: 0.95 }, garment: 'tunic', hair: 'short',
    colors: { hair: '#b08a52', top: '#c9b894' } },
  old: { name: 'old man', body: { height: 0.95, shoulders: 0.96 }, garment: 'coat', hair: 'short', colors: { hair: '#c9c4bb', garment: '#4f453c' } },
  smith: { name: 'smith', body: { height: 1.03, shoulders: 1.14, thick: 1.3 }, garment: 'apron', hair: 'short', colors: { garment: '#5e4330' } },
  death: { name: 'death', body: { height: 1.08, thick: 0.78 }, garment: 'robe', hood: true, hair: 'none', face: 'none',
    colors: { skin: '#141217', garment: '#1d1a21', shoes: '#141217' } },
  school: { name: 'schoolgirl', body: { height: 0.88, head: 1.04, shoulders: 0.84, hips: 0.98, thick: 0.8 }, garment: 'sailor', hair: 'ponytail', socks: true,
    colors: { skin: '#efcaa9', hair: '#2a1f22', top: '#ebe7e3', garment: '#2f3560', shoes: '#3a2a24', accent: '#c8333b', socks: '#25222c' } },
  youth: { name: 'young man', body: { height: 0.97, thick: 0.86 }, garment: 'tunic', hair: 'spiky',
    colors: { skin: '#e9be9a', hair: '#1c1a1d', top: '#ecebe7', bottom: '#2c3040', shoes: '#26232a' } },
  lady: { name: 'lady in a coat', body: { height: 0.95, shoulders: 0.9, hips: 1.02, thick: 0.84 }, garment: 'coat', hair: 'bob', hat: 'hat', scarf: true,
    colors: { skin: '#e3bf9c', hair: '#1e1b1c', garment: '#3d3f47', bottom: '#24252b', shoes: '#1b1b1f', hat: '#222226', accent: '#b02f2a' } },
  grandpa: { name: 'old man in a cap', body: { height: 0.93, shoulders: 1.02, thick: 1.05 }, garment: 'jacket', hair: 'none', hat: 'cap', scarf: true,
    colors: { skin: '#8a5f48', hair: '#b9b3aa', garment: '#4a3f37', bottom: '#3a302b', shoes: '#1f1a18', hat: '#2a2522', accent: '#a88d3a' } },
  janitor: { name: 'street sweeper', body: { height: 0.98, shoulders: 1.04, thick: 1.02 }, garment: 'jacket', hair: 'short', hat: 'cap',
    colors: { skin: '#e8c19c', hair: '#3b2f2a', garment: '#7d7484', bottom: '#2e2a33', shoes: '#211e24', hat: '#4b5466' } },
};

// a look: the character's (and the style's), then what is given over it — of ours and of a world's cast (tablesOf)
export function look(o = {}, cast = o.cast) {
  const T = tablesOf(cast), style = T.styles[o.style] ? o.style : 'shadow', who = T.characters[o.who] ? o.who : 'man', c = T.characters[who], s = T.styles[style];
  const garment = T.garments[o.garment ?? c.garment] ? (o.garment ?? c.garment) : 'none';
  const L = {
    kind: 'shapes', style, who, garment, hood: o.hood ?? !!c.hood, hair: T.hair[o.hair ?? c.hair] ? (o.hair ?? c.hair) : 'none',
    hat: T.hats[o.hat ?? c.hat] ? (o.hat ?? c.hat) : 'none', scarf: o.scarf ?? !!c.scarf, socks: o.socks ?? !!c.socks,
    barefoot: ['left', 'right', 'both'].includes(o.barefoot ?? c.barefoot) ? (o.barefoot ?? c.barefoot) : null,
    parts: (o.parts ?? c.parts ?? []).filter(n => T.parts[n]),
    body: { ...BODY, ...c.body, ...o.body }, colors: { ...COLORS, ...c.colors, ...o.colors },
    paint: T.paints[o.paint ?? s.paint] ? (o.paint ?? s.paint) : 'flat', line: o.line ?? (s.paint !== 'clay' && s.paint !== 'lit'),
    face: T.faces[o.face] ? o.face : T.faces[c.face] ? c.face : s.face ?? 'none', ground: T.grounds[o.ground] ? o.ground : s.ground,
  };
  // (its cast kept with it, out of sight: the same look again from it)
  if (cast) Object.defineProperty(L, 'cast', { value: cast });
  return L;
}

// half-widths of a man's parts (metres, at thickness 1)
export const R = { head: 0.105, neck: 0.04, hip: 0.16, hipD: 0.11, waist: 0.14, waistD: 0.1, chest: 0.16, chestD: 0.115, shoulder: 0.175, shoulderD: 0.09 };

// ── what is put on the figure ─────────────────────────────────────────
// Each a part drawn on the figure — F (shapes.js): the look and the style, its colours, the joints (P, fwd, side, up),
// the head (its centre, axes, egg, sizes, a point on it), the trunk's sections, what hangs keeping clear of what is
// worn (clear), springs (swing), and the solids (ball, cap, tube, bar, shell, rings). A world's cast adds its own the
// same way (tablesOf) — and ours are made only so.

// hair: a cap on the head round the crown, tipped back — its edge the brow before, the nape behind (out of the head's
// faces however few: its own flat faces cut no deeper than a cos of their half-angle, twice); a cut — a shell down to
// its edge (edge(a): how low it comes round the head — a: 0 before, ±π behind; the height on it, 1 its top, -1 its
// bottom — a fringe at the brow, the sides and the back lower), spreading below the head's middle (flare), standing
// off the head (swell, ×)
// (what a draw keeps from one frame to the next — F.keep: made once a figure, by its maker: its sizes, its lists)
const CROWN = F => ({ radii: F.head.egg.map(e => e * F.head.r * F.head.out), d: [0, 0.62, -0.78] });
const crown = F => { const h = F.head, K = F.keep(CROWN); F.cap(h.at, h.axes, K.radii, K.d, -0.12, F.colors.hair, h.sides, h.square); };
const shellOf = (edge, flare, swell = 1) => {
  const RADII = F => F.head.egg.map(e => e * F.head.r * F.head.out * swell);
  return F => { const h = F.head; F.shell(h.at, h.axes, F.keep(RADII), edge, flare, F.colors.hair, h.sides, h.square); };
};
// (hanging hair: a tube through three points — from, mid, end — its profile and colour)
const lockOf = profile => F => ({ pts: [null, null, null], profile: profile.map(([w, r]) => [w, r * F.head.r]), colors: [[0, F.colors.hair]] });
const LONG = lockOf([[0, 0.82], [1, 0.66], [1.7, 0.42], [2, 0]]), STRAIGHT = lockOf([[0, 0.78], [1, 0.95], [2, 0.92]]), TAIL = lockOf([[0, 0.26], [0.4, 0.42], [1.3, 0.36], [2, 0]]);
const STRAIGHT_SHELL = shellOf(a => 0.36 - 0.86 * smooth(0.7, 1.2, Math.abs(a)), 0.06);
const TAIL_SHELL = shellOf(a => 0.42 - 0.52 * smooth(0.6, 1.3, Math.abs(a)) - 0.35 * smooth(2, 2.8, Math.abs(a)), 0);
const SPIKY_SHELL = shellOf(a => 0.5 - 0.45 * smooth(0.6, 1.3, Math.abs(a)) - 0.35 * smooth(2, 2.8, Math.abs(a)), 0, 1.1);
const TUFTS = [[0, 0.7, 0.7], [-0.55, 0.8, 0.2], [0.5, 0.85, 0.15], [-0.2, 1, -0.3], [0.35, 0.85, -0.5]];
export const HAIR = {
  none: { name: 'none' },
  short: { name: 'short', draw: crown },
  long: { name: 'long', draw: F => {
    crown(F);
    const h = F.head, a = h.axes, rh = h.r, k = F.k, K = F.keep(LONG), p = K.pts;
    p[0] = add(h.at, add(mul(a[2], -rh * 0.55), mul(a[1], -rh * 0.1)));
    p[1] = F.swing('locks1', add(p[0], add(vec(0, -0.16 * F.fit.h, 0), mul(F.fwd('Chest'), -0.05 * k))), 160);
    p[2] = F.swing('locks2', add(p[1], add(vec(0, -0.14 * F.fit.h, 0), mul(F.fwd('Chest'), -0.02 * k))), 90);
    F.tube(p, K.profile, K.colors, F.sides, a[0], 0.65);
  } },
  bun: { name: 'bun', draw: F => {
    crown(F);
    const { at: head, axes: [hs, hu, hf], r: rh } = F.head;
    F.ball(add(head, add(mul(hu, rh * 0.7), mul(hf, -rh * 0.75))), [hs, hu, hf], [rh * 0.42, rh * 0.42, rh * 0.42], F.colors.hair, F.sides);
  } },
  bob: { name: 'bob', draw: shellOf(a => 0.36 - smooth(0.7, 1.2, Math.abs(a)), 0.14) },
  straight: { name: 'long straight', draw: F => {
    STRAIGHT_SHELL(F);
    // long straight hair: a flat mass down the back from behind the head, cut straight across
    const h = F.head, a = h.axes, rh = h.r, fc = F.fwd('Chest'), K = F.keep(STRAIGHT), p = K.pts;
    p[0] = add(h.at, add(mul(a[2], -rh * 0.45), mul(a[1], rh * 0.05)));
    p[1] = F.clear(F.swing('locks1', add(p[0], add(vec(0, -0.14 * F.fit.h, 0), mul(fc, -0.03 * F.k))), 160), -1, rh * 0.2);
    p[2] = F.clear(F.swing('locks2', add(p[1], vec(0, -0.12 * F.fit.h, 0)), 90), -1, rh * 0.2);
    F.tube(p, K.profile, K.colors, F.sides, a[0], 0.3, 4, true);
  } },
  ponytail: { name: 'ponytail', draw: F => {
    TAIL_SHELL(F);
    // a ponytail: tied high behind the head, swinging
    const h = F.head, a = h.axes, rh = h.r, fc = F.fwd('Chest'), K = F.keep(TAIL), p = K.pts;
    p[0] = add(h.at, add(mul(a[1], rh * 0.5), mul(a[2], -rh * 0.85)));
    p[1] = F.clear(F.swing('tail1', add(p[0], add(vec(0, -0.1 * F.fit.h, 0), mul(fc, -0.06 * F.k))), 140), -1, rh * 0.3);
    p[2] = F.clear(F.swing('tail2', add(p[1], vec(0, -0.17 * F.fit.h, 0)), 70), -1, rh * 0.2);
    F.tube(p, K.profile, K.colors, F.sides, a[0], 0.75);
  } },
  spiky: { name: 'crew cut', draw: F => {
    SPIKY_SHELL(F);
    // a few tufts out of the mass, broad and flat, their tips bent back (pressed down under a hat)
    if (F.look.hat !== 'none') return;
    const { at: head, axes: [hs, hu, hf], r: rh } = F.head;
    for (const d of TUFTS) {
      const v = unit(add(add(mul(hs, d[0]), mul(hu, d[1])), mul(hf, d[2]))), base = add(head, mul(v, rh * 0.8));
      F.tube([base, add(base, mul(v, rh * 0.45)), add(add(base, mul(v, rh * 0.75)), mul(hf, -rh * 0.25))], [[0, rh * 0.42], [1, rh * 0.28], [2, rh * 0.04]], [[0, F.colors.hair]], 10, unit(cross(v, hf)), 0.5);
    }
  } },
};
export const HATS = {
  none: { name: 'none' },
  // a cap: a dome over the crown down to the brow, a brim before tipped down
  cap: { name: 'cap', draw: F => {
    const { at: head, axes: [hs, hu, hf], egg, r: rh, out, sides, square } = F.head;
    F.cap(head, [hs, hu, hf], egg.map(e => e * rh * out * 1.06), [0, 0.98, -0.2], 0.3, F.colors.hat, sides, square);
    const tilt = unit(add(hu, mul(hf, 0.25)));
    F.ball(add(head, add(mul(hu, rh * 0.38), mul(hf, rh * 0.92))), [hs, tilt, cross(hs, tilt)], [rh * 0.74, rh * 0.06, rh * 0.52], F.colors.hat, F.sides);
  } },
  // a hat: a wide brim at the brow, a crown flat on top
  hat: { name: 'hat', draw: F => {
    const { at: head, axes: [hs, hu, hf], r: rh } = F.head, tilt = unit(add(hu, mul(hf, 0.08))), axes = [hs, tilt, cross(hs, tilt)];
    F.ball(add(head, mul(hu, rh * 0.38)), axes, [rh * 1.75, rh * 0.06, rh * 1.65], F.colors.hat, F.sides * 2);
    F.ball(add(head, mul(hu, rh * 0.62)), axes, [rh * 0.9, rh * 0.55, rh * 0.88], F.colors.hat, F.sides, 3);
  } },
};
// a face's expressions (a figure of shapes' <id>_mood — the names a body's face has: figure.js): its brows' inner and
// outer ends up (+) or down, its eyes opened (1 at rest) or narrowed (eyes_closed: to a dark line — shut), its mouth's half-width, its corners up (+) or
// down, how open it is (0: closed)
// how far a faceted head's rounded face stands out (of the ball's radius: over its corners, which stand at 1)
export const FACE_ROUND = 1.015;
export const EXPRESSIONS = {
  neutral: { inner: 0, outer: 0, eye: 1, wide: 0.13, corners: 0, open: 0 },
  smile: { inner: 0.01, outer: 0.01, eye: 0.85, wide: 0.15, corners: 0.045, open: 0 },
  laugh: { inner: 0.03, outer: 0.02, eye: 0.45, wide: 0.16, corners: 0.05, open: 0.07 },
  sad: { inner: 0.07, outer: -0.05, eye: 0.85, wide: 0.12, corners: -0.04, open: 0 },
  angry: { inner: -0.08, outer: 0.03, eye: 0.8, wide: 0.11, corners: -0.025, open: 0 },
  surprised: { inner: 0.08, outer: 0.08, eye: 1.35, wide: 0.07, corners: 0, open: 0.08 },
  afraid: { inner: 0.09, outer: 0.01, eye: 1.3, wide: 0.12, corners: -0.025, open: 0.04 },
  disgusted: { inner: -0.05, outer: -0.01, eye: 0.75, wide: 0.12, corners: -0.035, open: 0 },
  thinking: { inner: -0.03, outer: 0.03, eye: 0.85, wide: 0.08, corners: -0.01, open: 0 },
  tired: { inner: 0.02, outer: -0.05, eye: 0.5, wide: 0.12, corners: -0.015, open: 0 },
  eyes_closed: { inner: 0, outer: -0.01, eye: 0.12, wide: 0.12, corners: 0, open: 0 },
};
export const FACES = {
  none: { name: 'no face' },
  // eyes, brows, a nose, a mouth on the head's surface — at rest, or as the person's <id>_mood has it (EXPRESSIONS)
  simple: { name: 'simple', draw: F => {
    const { axes, r: rh, on } = F.head, [, hu] = axes, dark = [0.17, 0.14, 0.13], brow = F.colors.hair.map(v => v * 0.75);
    const x = EXPRESSIONS[F.look.expression] ?? EXPRESSIONS.neutral, lips = F.colors.skin.map(v => v * 0.72);
    for (const sx of [-1, 1]) {
      F.ball(on([sx * 0.33, 0.08, 0.94], 0.985), axes, [rh * 0.07, rh * 0.085 * x.eye, rh * 0.04], dark, 10);
      F.tube([on([sx * 0.16, 0.34 + x.inner, 0.93], 0.995), on([sx * 0.3, 0.36 + (x.inner + x.outer) / 2, 0.9], 1.0), on([sx * 0.45, 0.31 + x.outer, 0.84], 0.995)],
        [[0, rh * 0.026], [1, rh * 0.03], [2, rh * 0.02]], [[0, brow]], 6, hu);
    }
    F.ball(on([0, -0.1, 1], 0.97), axes, [rh * 0.085, rh * 0.12, rh * 0.11], F.colors.skin.map(v => v * 0.97), 10);
    // (the mouth: its corners up or down, open — a dark oval within it — or closed)
    // (a closed mouth is an open one no wider than nothing: the same solids for every expression — the face goes
    // from one to another on the GPU)
    const w = x.wide, y = -0.37;
    F.ball(on([0, y - x.open / 2, 0.95], 0.975), axes, [rh * w * 0.75, rh * x.open, rh * 0.03], dark, 10);
    F.tube([on([-w, y + x.corners, 0.93], 0.995), on([0, y, 0.94], 1.0), on([w, y + x.corners, 0.93], 0.995)], [[0, rh * 0.016], [2, rh * 0.016]], [[0, lips]], 6, hu);
  } },
  // a dot of an eye on either side: two seen from before, one in profile
  dot: { name: 'dot eyes', draw: F => {
    const { axes, r: rh, on } = F.head;
    for (const sx of [-1, 1]) F.ball(on([sx * 0.42, 0.04, 0.9], 0.99), axes, [rh * 0.06, rh * 0.07, rh * 0.03], [0.13, 0.11, 0.11], 8);
  } },
};
// a garment: its layers hanging (one or more, the outer last: how far each hangs below the hips — a share of the
// thigh, then of the shin —, from where, how much wider its hem, in which colour — the garment's, or the top's —, how
// far off the trunk — ×; under 1, from inside it: a dress's skirt out of its own bodice, with no edge —, folded or not,
// a ragged hem or not, pleats — how many); what it draws besides (draw: a collar, a panel); how it dresses the rest —
// the sleeves of its colour (sleeves: 'garment'), short (the forearms bare), widening down the forearm (wide: how
// much), the legs bare under it (bare), the trunk in its colour (bodice)
// (the collar's: its rings' lists, its bows' sizes and lists)
const COLLAR = F => {
  const n = F.worn[0].length, k = F.k, bw = 0.034 * k;
  return { rows: [null, new Array(n), new Array(n)], axes: [null, null, null], neck: [null, null, null, R.neck * k * 1.8, R.neck * k * 1.7], mids: [null, null, null],
    off: 0.008 * k, low: Float64Array.from({ length: n }, (_, q) => collarLow(q, n)), bow: [bw, bw * 0.6, bw * 0.4], knot: [bw * 0.4, bw * 0.4, bw * 0.35],
    tail: [null, null], tailProfile: [[0, bw * 0.35], [1, bw * 0.3]], accent: [[0, F.colors.accent]] };
};
// (on the blouse's rings, a little off them — 8 mm of a man's — s2: 0 its shoulders' section, 1 the chest's, 2 the
// waist's; between, mixed — at q of them round; their middles: K.mids)
const collarAt = (on, K, s2, q) => {
  const i0 = Math.min(1, Math.floor(s2)), u2 = s2 - i0, p = mix(on[i0][q], on[i0 + 1][q], u2);
  return add(p, mul(unit(sub(p, mix(K.mids[i0], K.mids[i0 + 1], u2))), K.off));
};
// (how low the collar comes at q of n round: to a point before, a square flap behind)
const collarLow = (q, n) => { const g = Math.abs(((q / n * Math.PI * 2 - Math.PI / 2) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI); return g < 0.6 ? 1.35 - g / 0.6 * 1.23 : g < 2.3 ? 0.12 : 1; };
const sailorCollar = F => {
  // a sailor's collar: from round the neck over the shoulders — before, down to a point on the chest; behind, a square
  // flap to the shoulder blades — and a bow at its point
  const on = F.worn, k = F.k, q2 = on[0].length, sd = F.side('Chest'), fw = F.fwd('Chest'), uc = F.up('Chest'), K = F.keep(COLLAR), rows = K.rows;
  const S = K.neck;
  S[0] = add(F.P('Neck1'), mul(uc, 0.005 * F.fit.h)); S[1] = sd; S[2] = fw;
  rows[0] = F.ringOf(S, q2, 2);
  for (let i = 0; i < 3; i++) K.mids[i] = mean(on[i]);
  for (let q = 0; q < q2; q++) { rows[1][q] = collarAt(on, K, 0, q); rows[2][q] = collarAt(on, K, K.low[q], q); }
  F.rings(rows, F.colors.garment, null, null);
  const bw = K.bow[0], tip = add(collarAt(on, K, 1.35, q2 / 4), mul(fw, 0.012 * k)), axes = K.axes;
  axes[0] = sd; axes[1] = uc; axes[2] = fw;
  for (let sx = -1; sx <= 1; sx += 2) {
    F.ball(add(tip, mul(sd, sx * bw * 0.85)), axes, K.bow, F.colors.accent, 12);
    K.tail[0] = tip; K.tail[1] = add(tip, add(mul(sd, sx * bw * 0.5), mul(uc, -bw * 1.8)));
    F.tube(K.tail, K.tailProfile, K.accent, 8, fw, 0.4, 2, true);
  }
  F.ball(add(tip, mul(fw, bw * 0.15)), axes, K.knot, F.colors.accent, 10);
};
const apron = F => {
  // an apron: a bib before the chest down to the waist, held on it, and from the waist a sheet to the knees hanging as
  // cloth (F.cloth: over the thighs sitting, swinging as they go) — as wide as the hips, a little wider down, round
  // the body a little at its sides; at rest clear of whatever is before it, the thighs too
  const P = F.P, k = F.k, f = level(F.fwd('Hips')), s2 = level(F.side('Hips')), rows = [], n = 9, held = 3, hanging = 6;
  const from = add(P('Chest'), mul(F.fwd('Chest'), R.chestD * k * F.style.trunk.d[3] * 1.05)), waist = P('Spine1')[1], knees = mix(P('LeftShin'), P('RightShin'), 0.5);
  const thigh = 0.085 * k * F.style.limb + 0.012, tr = F.trunk(1);
  // (the trunk's front at a height: its sections', between them)
  const trunkFront = y => {
    for (let i = 0; i + 1 < tr.length; i++) {
      const [a, , , , da] = tr[i], [b, , , , db] = tr[i + 1];
      if (y < a[1] || y > b[1]) continue;
      const u = (y - a[1]) / (b[1] - a[1] || 1);
      return dot(sub(mix(a, b, u), P('Hips')), f) + da + (db - da) * u;
    }
    return -Infinity;
  };
  for (let r = 0; r < held + hanging; r++) {
    const y = r < held ? from[1] + (waist - from[1]) * r / (held - 1) : waist + (knees[1] - waist) * (r - held + 1) / hanging, u = (from[1] - y) / (from[1] - knees[1]);
    let front = Math.max(dot(sub(mix(from, knees, u), P('Hips')), f), trunkFront(y) + 0.015 * k);
    for (const j of ['LeftLeg', 'RightLeg', 'LeftShin', 'RightShin', 'Spine1', 'Chest']) if (Math.abs(P(j)[1] - y) < 0.12) front = Math.max(front, dot(sub(P(j), P('Hips')), f) + 0.09 * k);
    for (const s of ['Left', 'Right']) for (let w = 0; w <= 1; w += 0.25) {
      const p = mix(P(`${s}Leg`), P(`${s}Shin`), w);
      if (Math.abs(p[1] - y) < 0.08) front = Math.max(front, dot(sub(p, P('Hips')), f) + thigh);
    }
    const c = add(P('Hips'), add(mul(f, front), [0, y - P('Hips')[1], 0])), half = 0.17 * k * F.look.body.hips * (1 + 0.15 * u);
    rows.push(Array.from({ length: n }, (_, q) => { const x = (q / (n - 1)) * 2 - 1; return add(c, add(mul(s2, x * half), mul(f, -0.25 * half * x * x))); }));
  }
  F.cloth(rows, F.colors.garment, held);
};
export const GARMENTS = {
  none: { name: 'shirt and trousers' },
  tunic: { name: 'loose shirt', hang: [{ to: 0.3, from: 'shoulders', flare: 0.06, color: 'top', folds: false }] },
  coat: { name: 'coat', hang: [{ to: 1.15, from: 'shoulders', flare: 0.18, ragged: true }], sleeves: 'garment' },
  dress: { name: 'dress', hang: [{ to: 1.9, from: 'waist', flare: 0.45, off: 0.94 }], short: true, bare: true, bodice: true },
  robe: { name: 'robe', hang: [{ to: 2.3, from: 'shoulders', flare: 0.5, ragged: true }], sleeves: 'garment', wide: 0.6 },
  apron: { name: 'apron', draw: apron },
  jacket: { name: 'jacket', hang: [{ to: 0.5, from: 'shoulders', flare: 0.1, folds: false }], sleeves: 'garment' },
  skirt: { name: 'pleated skirt', hang: [{ to: 0.8, from: 'waist', flare: 0.3, pleats: 12, off: 1.04 }], bare: true },
  sailor: { name: 'sailor suit', hang: [{ to: 0.8, from: 'waist', flare: 0.3, pleats: 12, off: 1.06 }, { to: 0.12, from: 'shoulders', flare: 0.16, color: 'top', folds: false }],
    bare: true, draw: sailorCollar },
};
// (the hood's: its egg, its tube's points, profile and colour)
const HOOD = F => ({ radii: [F.head.r * 1.3, F.head.r * 1.32, F.head.r * 1.3], pts: [null, null, null], profile: [[0, F.head.r * 1.2], [2, R.shoulder * F.k * 0.9]], colors: [[0, F.colors.garment]] });
// (the scarf's: its band's four rings and the first again; its end's points along it, profile, colour)
const SCARF_ALONG = [0, 0.1, 0.2, 0.35, 0.65, 1];
const SCARF = F => ({ rings: [null, null, null, null, null], pts: SCARF_ALONG.map(() => null), profile: [[0, 0.028 * F.fit.h], [5, 0.03 * F.fit.h]], colors: [[0, F.colors.accent]] });
// more: a hood, a scarf — as the look says (hood, scarf), or any a world adds, by their names in the look's parts
export const PARTS = {
  hood: { name: 'hood', draw: F => {
    const h = F.head, a = h.axes, rh = h.r, K = F.keep(HOOD), c = add(h.at, add(mul(a[2], -rh * 0.38), mul(a[1], rh * 0.08)));
    F.ball(c, a, K.radii, F.colors.garment, F.sides);
    const back = add(F.P('Chest'), mul(F.fwd('Chest'), -0.03 * F.k));
    K.pts[0] = c; K.pts[1] = mix(c, back, 0.5); K.pts[2] = back;
    F.tube(K.pts, K.profile, K.colors, F.sides, a[2]);
  } },
  scarf: { name: 'scarf', draw: F => {
    // a band round the neck where it meets the shoulders, its end hanging before the chest
    const k = F.k, uc = F.up('Chest'), fc = F.fwd('Chest'), sd = F.side('Chest'), c = add(F.P('Neck1'), mul(uc, 0.005 * F.fit.h)), n = Math.max(12, F.sides * 2);
    const ro = R.neck * k * 2.3, ri = R.neck * k * 1.1, hh = 0.028 * F.fit.h, K = F.keep(SCARF), rs = K.rings;
    // (its band: four rings round the neck — below, inside and out; above, out and in — and the first again; each a
    // squarish ring of n round)
    for (let r = 0; r < 4; r++) {
      const dy = r < 2 ? -hh : hh, w = r === 0 ? ri : r === 1 ? ro : r === 2 ? ro * 0.9 : ri * 1.1, ring = rs[r] = listOf(n);
      for (let q = 0; q < n; q++) {
        const a = q / n * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a), x = w * Math.sign(cs) * Math.abs(cs) ** (2 / 2.4), z = w * 0.92 * Math.sign(sn) * Math.abs(sn) ** (2 / 2.4);
        ring[q] = vec(c[0] + uc[0] * dy + sd[0] * x + fc[0] * z, c[1] + uc[1] * dy + sd[1] * x + fc[1] * z, c[2] + uc[2] * dy + sd[2] * x + fc[2] * z);
      }
    }
    rs[4] = rs[0];
    F.rings(rs, F.colors.accent, null, null);
    // (over the shoulders' slope and down the chest, on it; bent over, hanging)
    const from = add(c, add(add(mul(fc, ro * 0.7), mul(sd, ro * 0.35)), mul(uc, -hh))), off = 0.015 * F.fit.h;
    const end = F.clear(F.swing('scarf', add(from, vec(0, -0.2 * F.fit.h, 0)), 120), 1, off);
    for (let i = 0; i < SCARF_ALONG.length; i++) K.pts[i] = F.clear(mix(from, end, SCARF_ALONG[i]), 1, off);
    F.tube(K.pts, K.profile, K.colors, 8, sd, 0.3, 4, true);
  } },
};

// ── a world's own ────────────────────────────────────────────────────
// A world's cast (people.js: its module) may bring its own (cast.shapes): styles, characters, garments, hair, hats,
// faces, parts (each as ours are — a style or a character may say `from`: one it is made from, ours or the world's,
// with its own over it), the arms' and the legs' profiles, paints' and grounds' — over ours, by name.
const made = new WeakMap(), OURS = { styles: STYLES, characters: CHARACTERS, garments: GARMENTS, hair: HAIR, hats: HATS, faces: FACES, parts: PARTS,
  arms: ARMS, legs: LEGS, paints: PAINTS, grounds: GROUNDS };
// the skeleton's lengths a look is drawn with (its body's, the legs and the neck as long as its style makes them) —
// what its points are worked out on too (people.js)
// (the shoulders as broad as the trunk is: a thicker figure's arms hang from where its trunk's shoulders end)
export const bodyOf = L => { const st = tablesOf(L.cast).styles[L.style]; return { ...L.body, legs: L.body.legs * st.legs, neck: L.body.neck * st.neck, shoulders: L.body.shoulders * L.body.thick }; };
export function tablesOf(cast) {
  const own = cast?.shapes;
  if (!own) return OURS;
  if (!made.has(own)) {
    const T = Object.fromEntries(Object.entries(OURS).map(([n, t]) => [n, { ...t, ...own[n] }]));
    // (made from another: that one's, then its own — through as many as it takes; from its own name, ours of it)
    for (const n of ['styles', 'characters']) {
      const whole = (key, seen) => {
        const e = own[n]?.[key];
        if (!e) return OURS[n][key];
        if (!e.from || seen.has(key)) return e;
        seen.add(key);
        const base = e.from === key ? OURS[n][key] : whole(e.from, seen);
        return base ? { ...base, ...e } : e;
      };
      for (const key of Object.keys(own[n] || {})) T[n][key] = whole(key, new Set());
    }
    made.set(own, T);
  }
  return made.get(own);
}

