// A person drawn as a figure of designed shapes — not a body's likeness but a stylised one, as in an animated film
// or an indie game: a head, a trunk of a style's silhouette, each limb one tube along a smooth line through its
// joints, thick as the style's profile has it (a full thigh, a slim knee and ankle; hands as points, leaves or
// mittens, feet as points, beans or wedges), a coat, a dress or a robe as one volume hanging from the body, hair as
// a shell, a bun or locks — moved by a motion (skeleton.js: its joints placed again on the figure's own bone
// lengths). The shapes are solids in space (eggs, tubes, lofts of rings), drawn in depth (ink.js: what is in front
// is so at each point of the picture) and flat: one colour a part, or two tones by the light; lines round the
// figure, between parts of other colours and where one is well before another. A style is the shapes' language and
// proportions (a shadow: slender, small-headed, tapering to points — Gris, Limbo; soft: round, big-headed, mittens,
// tinted lines — Cartoon Saloon; graphic: wide shoulders over a narrow waist, square-ish, flat — UPA; geometry:
// faceted, two tones — Kentucky Route Zero; flat geometry: straight-edged designed shapes, flat colours lit by the
// scene — a coat a trapezoid, legs and arms straight bars, a knee or an elbow the corner of two, as drawn); a
// character is who (proportions, clothes, hair, a hat, a scarf, colours).
// Garments hang: from the shoulders or the waist round the trunk, then from the hips straight down, wide enough
// for all of the legs above each height (a knee coming forward carries the cloth, sitting it falls from the
// knees); their hem, long hair, a ponytail and a scarf's end lag on springs.
//   MooodShapes.look(partial) → a whole look (the character's and the style's, then what is given over it)
//   MooodShapes.STYLES, CHARACTERS, GARMENTS, HAIR, HATS, FACES, PAINTS, GROUNDS — what a look may be; names() — each by its
//     name in the engine's words (MooodI18n.part('engine1'): the page says their language first)
//   MooodShapes.figure(skeleton) → {sk, fit(), scale(look), mesh(t, look, token?), reach(), marks()}: the figure on it as a
//     mesh, made once for a token; reach — how far the parts it has with it reach in the mesh made last (null with none);
//     marks — the points they mark there (F.point)
//   MooodShapes.make(gl, skeleton, figure?) → {scale(look), ground(look), render([x, y, w, h], k, t, look, cam, world, scene?)}
//     cam {V, eye, right, up, back}; world — what to draw under the figure (lines), into the same picture; scene — a
//     person standing in a scene (people.js): drawn on nothing, into scene.into (ink.js), its facing turned into the
//     world by scene.world (a 3×3, column by column), the scene's light laying itself on it if scene.lit — else, with
//     scene.light {key, keyCol, back, backCol, amb} (the scene's sources: directions in its own space, colours × how
//     strong), lit by them; no floor; scene.token — the figure's mesh made once for it (figure: mesh)
(function () {
  const tr = MooodI18n.part('engine1');  // (the names of what a look may be: names())
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (v, k) => [v[0] * k, v[1] * k, v[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const mix = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
  const unit = v => mul(v, 1 / (Math.hypot(...v) || 1));
  const level = v => unit([v[0], 0, v[2]]);
  // a turn about unit axis a by angle t (radians) as a 3×3 matrix, rows; a vector turned by it
  const rotation = (a, t) => {
    const c = Math.cos(t), s = Math.sin(t), k = 1 - c, [x, y, z] = a;
    return [[c + x * x * k, x * y * k - z * s, x * z * k + y * s], [y * x * k + z * s, c + y * y * k, y * z * k - x * s], [z * x * k - y * s, z * y * k + x * s, c + z * z * k]];
  };
  const mat3 = (Q, v) => Q.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
  const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16) / 255);

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
  const STYLES = {
    shadow: { head: 0.94, egg: [0.84, 1.12, 0.96], neck: 1.35, legs: 1.1, limb: 0.66, sides: 20, square: 2,
      trunk: { w: [0.78, 0.84, 0.66, 0.8, 0.9], d: [0.8, 0.82, 0.7, 0.76, 0.68] }, arms: 'palm', fingers: true, feet: 'point', paint: 'rim', line: 1.4,
      folds: { n: 7, depth: 0.09 }, ragged: 0.07, ground: 'fog', drape: true },
    soft: { head: 1.38, egg: [1.08, 1, 1.02], neck: 0.35, legs: 0.84, limb: 1.05, sides: 22, square: 2,
      trunk: { w: [0.98, 1.04, 0.98, 1.02, 0.92], d: [1.08, 1.1, 1.1, 1.08, 0.98] }, arms: 'mitten', feet: 'bean', paint: 'toned', line: 2.2, tinted: true,
      folds: { n: 5, depth: 0.04 }, face: 'simple', ground: 'paper', drape: true },
    graphic: { head: 1.06, egg: [0.9, 1.08, 0.94], headSquare: 2.6, neck: 0.8, legs: 1.06, limb: 0.74, sides: 16, square: 2.8,
      trunk: { w: [0.82, 0.88, 0.7, 1.06, 1.24], d: [0.78, 0.8, 0.7, 0.76, 0.62] }, arms: 'leaf', feet: 'point', paint: 'flat', line: 1.6, ground: 'day', drape: true },
    toy: { head: 1.16, egg: [0.96, 1.06, 1], neck: 0.6, legs: 0.92, limb: 1.25, sides: 22, square: 2.2,
      trunk: { w: [1.05, 1.1, 1.08, 1.12, 1.06], d: [1.1, 1.1, 1.15, 1.15, 1.05] }, arms: 'mitten', feet: 'boot', paint: 'clay', line: 1.4,
      folds: { n: 4, depth: 0.03 }, face: 'simple', ground: 'studio', drape: true },
    geometry: { head: 1, egg: [0.9, 1.1, 0.98], neck: 0.9, legs: 1.02, limb: 0.9, sides: 6, facets: true, square: 2.4,
      trunk: { w: [0.9, 0.95, 0.82, 0.98, 1.04], d: [0.9, 0.9, 0.84, 0.9, 0.8] }, arms: 'leaf', feet: 'wedge', paint: 'toned', line: 1.2, ground: 'paper', drape: true },
    flat: { head: 1.1, egg: [0.94, 1.04, 0.98], neck: 0.55, legs: 1.06, limb: 0.9, sides: 20, square: 2.8,
      trunk: { w: [1, 1, 1.16, 1.03, 0.96], d: [0.82, 0.82, 0.88, 0.8, 0.9] }, arms: 'bar', feet: 'shoe', rigid: true, straight: true, drape: true, sleeves: 0.88,
      paint: 'lit', line: 1, face: 'dot', ground: 'sunset' },
  };
  // the arms' and the legs' profiles: along the joints (0 the shoulder or the hip, 1 the elbow or the knee, 2 the wrist or
  // the ankle, 3 the fingertips or the toes; between, a share of the bone) their half-width, metres at thickness 1
  // (a rigid style's bars take the joints' only: each bone from one to the next; at 3 the hand's ball, the shoe's half-width)
  const ARMS = {
    bar: [[0, 0.05], [1, 0.045], [2, 0.04], [3, 0.047]],
    palm: [[0, 0.046], [0.55, 0.04], [1, 0.03], [1.45, 0.029], [2, 0.017], [2.5, 0.02], [3, 0.012]],
    point: [[0, 0.046], [0.55, 0.04], [1, 0.03], [1.45, 0.029], [2, 0.017], [2.6, 0.013], [3, 0]],
    mitten: [[0, 0.048], [1, 0.036], [1.5, 0.034], [2, 0.028], [2.3, 0.044], [2.7, 0.044], [2.9, 0.03], [3, 0]],
    leaf: [[0, 0.045], [1, 0.031], [1.5, 0.029], [2, 0.02], [2.4, 0.03], [2.8, 0.018], [3, 0]],
  };
  const LEGS = {
    boot: [[0, 0.09], [1, 0.072], [1.5, 0.068], [1.9, 0.064], [2, 0.058], [2.3, 0.062], [2.8, 0.052], [3, 0]],
    point: [[0, 0.08], [0.45, 0.066], [1, 0.042], [1.35, 0.05], [2, 0.024], [2.4, 0.026], [3, 0.004]],
    bean: [[0, 0.086], [0.5, 0.075], [1, 0.056], [1.4, 0.058], [2, 0.042], [2.3, 0.052], [2.75, 0.044], [3, 0]],
    wedge: [[0, 0.078], [1, 0.048], [1.4, 0.052], [2, 0.03], [2.5, 0.032], [3, 0.006]],
    shoe: [[0, 0.07], [1, 0.054], [2, 0.044], [3, 0.046]],
  };
  const PAINTS = { silhouette: {}, rim: {}, flat: {}, toned: {}, clay: {}, lit: {} };
  // the background, its floor's lines, a silhouette's (and the lines') colour on it, the light round a silhouette's edge
  // (and lit by: the colours under the scene's light, ×; how far they fade into the air, towards the background)
  const GROUNDS = {
    studio: { bg: '#e4e0da', ink: '#2b2724', grid: '#d9d4cd', rim: '#ffffff' },
    fog: { bg: '#dcd7cf', ink: '#2a231e', grid: '#cfc9c0', rim: '#f2c98e' },
    night: { bg: '#2a2f38', ink: '#0d0f13', grid: '#363c47', rim: '#c9a46a' },
    dusk: { bg: '#6b6470', ink: '#1a161c', grid: '#77707c', rim: '#e7b27a' },
    day: { bg: '#b7c2c8', ink: '#22272b', grid: '#a5b0b6', rim: '#fff1d6' },
    paper: { bg: '#ece5d6', ink: '#1c1a17', grid: '#dcd4c4', rim: '#e9b97c' },
    sunset: { bg: '#d9a07e', ink: '#3a2622', grid: '#cd9473', rim: '#ffe3b8', light: '#fff2e4' },
    lamp: { bg: '#20252c', ink: '#0c0e11', grid: '#2a3039', rim: '#f4b56a', light: '#6f7384' },
    mist: { bg: '#a59bb2', ink: '#2f2838', grid: '#9b91a8', rim: '#f6c48e', light: '#8d86a6', haze: 0.3 },
  };
  const BODY = { height: 1, head: 1, neck: 1, shoulders: 1, arms: 1, hips: 1, legs: 1, thick: 1 };
  const COLORS = { skin: '#d9ad8c', hair: '#3b2a20', top: '#a89a7e', bottom: '#4b4640', shoes: '#2e241d', garment: '#5d4b3d',
    hat: '#2b2724', accent: '#b23a33', socks: '#2a2730' };
  // who: proportions (factors of Kimodo's man: skeleton.js), clothes, hair, colours
  const CHARACTERS = {
    man: { body: { shoulders: 1.05 }, garment: 'tunic', hair: 'short' },
    woman: { body: { height: 0.93, shoulders: 0.88, hips: 1.08, thick: 0.9 }, garment: 'dress', hair: 'long',
      colors: { garment: '#7b5d63', hair: '#5a3a26', top: '#7b5d63' } },
    teen: { body: { height: 0.9, head: 1.02, shoulders: 0.92, thick: 0.84 }, garment: 'none', hair: 'short', colors: { top: '#8c9a7c' } },
    child: { body: { height: 0.72, head: 1.16, legs: 0.94, arms: 0.95, shoulders: 0.88, thick: 0.82 }, garment: 'tunic', hair: 'short',
      colors: { hair: '#8a6a3c', top: '#b0a07e' } },
    toddler: { body: { height: 0.55, head: 1.34, legs: 0.86, arms: 0.9, shoulders: 0.86, neck: 0.6, thick: 0.95 }, garment: 'tunic', hair: 'short',
      colors: { hair: '#b08a52', top: '#c9b894' } },
    old: { body: { height: 0.95, shoulders: 0.96 }, garment: 'coat', hair: 'short', colors: { hair: '#c9c4bb', garment: '#4f453c' } },
    smith: { body: { height: 1.03, shoulders: 1.14, thick: 1.3 }, garment: 'apron', hair: 'short', colors: { garment: '#5e4330' } },
    death: { body: { height: 1.08, thick: 0.78 }, garment: 'robe', hood: true, hair: 'none', face: 'none',
      colors: { skin: '#141217', garment: '#1d1a21', shoes: '#141217' } },
    school: { body: { height: 0.88, head: 1.04, shoulders: 0.84, hips: 0.98, thick: 0.8 }, garment: 'sailor', hair: 'ponytail', socks: true,
      colors: { skin: '#efcaa9', hair: '#2a1f22', top: '#ebe7e3', garment: '#2f3560', shoes: '#3a2a24', accent: '#c8333b', socks: '#25222c' } },
    youth: { body: { height: 0.97, thick: 0.86 }, garment: 'tunic', hair: 'spiky',
      colors: { skin: '#e9be9a', hair: '#1c1a1d', top: '#ecebe7', bottom: '#2c3040', shoes: '#26232a' } },
    lady: { body: { height: 0.95, shoulders: 0.9, hips: 1.02, thick: 0.84 }, garment: 'coat', hair: 'bob', hat: 'hat', scarf: true,
      colors: { skin: '#e3bf9c', hair: '#1e1b1c', garment: '#3d3f47', bottom: '#24252b', shoes: '#1b1b1f', hat: '#222226', accent: '#b02f2a' } },
    grandpa: { body: { height: 0.93, shoulders: 1.02, thick: 1.05 }, garment: 'jacket', hair: 'none', hat: 'cap', scarf: true,
      colors: { skin: '#8a5f48', hair: '#b9b3aa', garment: '#4a3f37', bottom: '#3a302b', shoes: '#1f1a18', hat: '#2a2522', accent: '#a88d3a' } },
    janitor: { body: { height: 0.98, shoulders: 1.04, thick: 1.02 }, garment: 'jacket', hair: 'short', hat: 'cap',
      colors: { skin: '#e8c19c', hair: '#3b2f2a', garment: '#7d7484', bottom: '#2e2a33', shoes: '#211e24', hat: '#4b5466' } },
  };

  // a look: the character's (and the style's), then what is given over it — of ours and of a world's cast (tablesOf)
  function look(o = {}, cast = o.cast) {
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

  // ── solids, as triangles (a part's vertices its own: its normals from its triangles) ──

  // a mesh being made for a frame: positions, colours (and whether the light's shadow tone falls on it: 1, as on
  // cloth; 0, flat — skin, as drawn), whether each point is lit smoothly in a faceted style (1, while `smooth` is set:
  // a faceted head's face), triangles
  const rgba = v => (v.length > 3 ? v : [...v, 1]);
  const meshes = () => {
    const p = [], c = [], s = [], i = [];
    return {
      p, c, s, i, smooth: 0,
      // rings of points (each the same count, round), joined in order; closed at either end by a point, if given;
      // colour: one, or one a point (rings of them, then the ends')
      rings(rs, color, first, last) {
        const n = rs[0].length, base = p.length / 3, at = (r, q) => (typeof color[0] === 'number' ? color : color[r][q]);
        rs.forEach((r, a) => r.forEach((q, b) => { p.push(...q); c.push(...rgba(at(a, b))); s.push(this.smooth); }));
        for (let a = 0; a + 1 < rs.length; a++) for (let b = 0; b < n; b++) {
          const v0 = base + a * n + b, v1 = base + a * n + (b + 1) % n;
          i.push(v0, v1, v0 + n, v1, v1 + n, v0 + n);
        }
        for (const [end, ring, flip] of [[first, 0, true], [last, rs.length - 1, false]]) {
          if (!end) continue;
          const tip = p.length / 3;
          p.push(...end); c.push(...rgba(typeof color[0] === 'number' ? color : color[flip ? rs.length : rs.length + 1][0])); s.push(this.smooth);
          for (let b = 0; b < n; b++) { const v0 = base + ring * n + b, v1 = base + ring * n + (b + 1) % n; i.push(...(flip ? [v1, v0, tip] : [v0, v1, tip])); }
        }
      },
    };
  };
  // a point round an axis: across it (e1, e2) at an angle, w and d its half-widths; square > 2: a squarer section
  const round = (c, e1, e2, w, d, a, square) => {
    const cs = Math.cos(a), sn = Math.sin(a), k = 2 / square;
    return add(c, add(mul(e1, w * Math.sign(cs) * Math.abs(cs) ** k), mul(e2, d * Math.sign(sn) * Math.abs(sn) ** k)));
  };
  const across = (u, hint) => {
    let h = sub(hint, mul(u, dot(hint, u)));
    if (Math.hypot(...h) < 1e-3) h = Math.abs(u[1]) < 0.9 ? cross(u, [0, 1, 0]) : cross(u, [1, 0, 0]);
    const e1 = unit(h);
    return [e1, cross(u, e1)];
  };
  // a ball (or an egg: its three half-widths along its axes), made of rings from its bottom to its top
  const ball = (M, c, axes, radii, color, sides, square = 2) => cap(M, c, axes, radii, [0, -1, 0], -1, color, sides, square);
  // the part of a ball (an egg) round a direction (x across, y up, z forwards), as far as a cone of that cosine:
  // rings from its middle out to its edge (all of it: -1)
  const cap = (M, c, axes, radii, dir, edge, color, sides, square = 2) => {
    const [x, y, z] = axes, n = unit(dir), [e1, e2] = across(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1]);
    // (a squarer one: each direction's share bent towards its largest, as a superellipse's)
    const bend = d => (square === 2 ? d : unit(d.map(v => Math.sign(v) * Math.abs(v) ** (2 / square))));
    const on = d => { d = bend(d); return add(c, add(add(mul(x, radii[0] * d[0]), mul(y, radii[1] * d[1])), mul(z, radii[2] * d[2]))); };
    const reach = Math.acos(Math.max(-1, Math.min(1, edge))), rows = Math.max(3, Math.round(sides / 2 * reach / Math.PI)), rs = [];
    for (let r = 1; r <= rows; r++) {
      const th = reach * r / rows;
      if (th >= Math.PI - 1e-6) break;
      rs.push(Array.from({ length: sides }, (_, b) => { const a = b / sides * Math.PI * 2; return on(add(mul(n, Math.cos(th)), mul(add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a))), Math.sin(th)))); }));
    }
    M.rings(rs, color, on(n), edge <= -1 ? on(mul(n, -1)) : null);
  };
  // a limb: one tube along its bones — straight, each joint's corner rounded (a curve from a third of the shorter
  // bone before it to as far after) — as thick along it as its profile
  // says ([where, half-width]…: where — a joint's number, between two a share of the bone; eased between the points),
  // coloured from where on (colours: [[where, colour]…] — an edge between two, not a blend); flat: its section's depth,
  // a share of its width (across the hint); square > 2: a squarer section; cut: its ends flat (a lock cut straight)
  const tube = (M, joints, profile, colors, sides, hint, flat = 1, square = 2, cut = false) => {
    const end = joints.length - 1, len = joints.slice(1).map((p, i) => Math.hypot(...sub(p, joints[i])) || 1e-6);
    const dirs = joints.slice(1).map((p, i) => mul(sub(p, joints[i]), 1 / len[i]));
    const round_ = joints.map((_, j) => (j === 0 || j === end ? 0 : Math.min(len[j - 1], len[j]) / 3));
    // the corner at joint j: a curve from before it to after it, through near it (t from 0 to 1)
    const corner = (j, t) => {
      const a = sub(joints[j], mul(dirs[j - 1], round_[j])), b = add(joints[j], mul(dirs[j], round_[j]));
      return add(add(mul(a, (1 - t) ** 2), mul(joints[j], 2 * (1 - t) * t)), mul(b, t * t));
    };
    const at = w => {
      const s = Math.min(end - 1, Math.floor(w)), d = (w - s) * len[s];
      if (d < round_[s]) return corner(s, 0.5 + 0.5 * d / round_[s]);
      if (len[s] - d < round_[s + 1]) return corner(s + 1, 0.5 - 0.5 * (len[s] - d) / round_[s + 1]);
      return add(joints[s], mul(dirs[s], d));
    };
    const r = w => thick(profile, w);
    const colour = w => colors.reduce((c, [from, cc]) => (w >= from ? cc : c), colors[0][1]);
    // where the rings are: evenly along each bone, at the profile's points; twice at a colour's edge
    const wheres = new Set();
    for (let q = 0; q <= end * 6; q++) wheres.add(+(q / 6).toFixed(4));
    for (const [w] of profile) if (w <= end) wheres.add(w);
    const rings = [], cols = [];
    let frame = null, prev = null;
    for (const w of [...wheres].sort((x, y) => x - y)) {
      const p = at(w), t = unit(sub(at(Math.min(end, w + 0.01)), at(Math.max(0, w - 0.01))));
      // the section turns with the line (parallel transport): the tube doesn't twist
      frame = across(t, frame ? frame[0] : hint);
      const rad = r(w), ring = Array.from({ length: sides }, (_, q) => round(p, frame[0], frame[1], rad, rad * flat, q / sides * Math.PI * 2, square));
      for (const [from] of colors) if (prev !== null && prev < from && w >= from) { rings.push(ring); cols.push(Array(sides).fill(colour(prev))); }
      rings.push(ring); cols.push(Array(sides).fill(colour(w)));
      prev = w;
    }
    const t0 = unit(sub(at(0.01), at(0))), t1 = unit(sub(at(end), at(end - 0.01)));
    M.rings(rings, [...cols, [colour(0)], [colour(end)]], cut ? joints[0] : sub(joints[0], mul(t0, r(0) * 0.6)), cut ? joints[end] : add(joints[end], mul(t1, r(end))));
  };
  // a profile's half-width at where (eased between its points)
  const thick = (profile, w) => {
    let i = 0;
    while (i + 2 < profile.length && profile[i + 1][0] < w) i++;
    const [[w0, r0], [w1, r1]] = [profile[i], profile[i + 1]], u = Math.max(0, Math.min(1, (w - w0) / (w1 - w0 || 1)));
    return r0 + (r1 - r0) * u * u * (3 - 2 * u);
  };
  // a bar: straight from a to b, ra to rb thick, each end half an egg — two bars at a joint make its corner, as drawn;
  // its depth a share of its width (flat, across the hint), square > 2 squarer; coloured from where on along it (0 at a,
  // 1 at b)
  const bar = (M, a, b, ra, rb, colors, sides, hint, flat = 1, square = 2) => {
    const len = Math.hypot(...sub(b, a)) || 1e-6, t = mul(sub(b, a), 1 / len), [e1, e2] = across(t, hint);
    const ring = (c, r) => Array.from({ length: sides }, (_, q) => round(c, e1, e2, r, r * flat, q / sides * Math.PI * 2, square));
    const colour = w => colors.reduce((c, [from, cc]) => (w >= from ? cc : c), colors[0][1]);
    const rings = [], cols = [], rows = 4, put = (r, w) => { rings.push(r); cols.push(Array(sides).fill(colour(w))); };
    for (let i = 1; i <= rows; i++) { const a2 = Math.PI / 2 * i / rows; put(ring(add(a, mul(t, -ra * Math.cos(a2))), ra * Math.sin(a2)), 0); }
    // (twice at a colour's edge)
    for (const [from] of colors) if (from > 0 && from < 1) { const c = add(a, mul(t, len * from)), r = ra + (rb - ra) * from; put(ring(c, r), from - 1e-6); put(ring(c, r), from); }
    for (let i = rows; i >= 1; i--) { const a2 = Math.PI / 2 * i / rows; put(ring(add(b, mul(t, rb * Math.cos(a2))), rb * Math.sin(a2)), 1); }
    M.rings(rings, [...cols, [colour(0)], [colour(1)]], add(a, mul(t, -ra)), add(b, mul(t, rb)));
  };
  // hair on the head: the head's egg a little out, from the crown down to an edge round it — at each way round (a: 0
  // before, ±π behind) as low as edge(a) says (the height on the head: 1 its top, -1 its bottom); below the head's
  // middle spreading out by flare
  const shell = (M, c, [x, y, z], radii, edge, flare, color, sides, square = 2) => {
    const bend = d => (square === 2 ? d : unit(d.map(v => Math.sign(v) * Math.abs(v) ** (2 / square))));
    const around = sides * 2, rows = Math.max(6, sides >> 1), rs = [];
    const on = d => { const s = 1 + flare * Math.max(0, -d[1]); d = bend(d); return add(c, add(add(mul(x, radii[0] * d[0] * s), mul(y, radii[1] * d[1])), mul(z, radii[2] * d[2] * s))); };
    for (let r = 1; r <= rows; r++) rs.push(Array.from({ length: around }, (_, q) => {
      const a = q / around * Math.PI * 2 - Math.PI, th = Math.acos(Math.max(-1, Math.min(1, edge(a)))) * r / rows;
      return on([Math.sin(th) * Math.sin(a), Math.cos(th), Math.sin(th) * Math.cos(a)]);
    }));
    M.rings(rs, color, on([0, 1, 0]), null);
  };
  const mean = ring => mul(ring.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / ring.length);
  const smooth = (e0, e1, v) => { const u = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return u * u * (3 - 2 * u); };

  // ── a garment's section on its level: the hull of all it hangs round ──

  const hull2 = pts => {
    pts = [...pts].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const cr = (o, a, c) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]), lo = [], hi = [];
    for (const p of pts) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (const p of pts.reverse()) { while (hi.length > 1 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
    return lo.slice(0, -1).concat(hi.slice(0, -1));
  };
  // n points along a convex polygon round (0, 0), as far apart along it as each other, from where it crosses +x
  // (so a long reach — a knee forward — keeps its tip, and the sections of a loft go round alike)
  const along = (poly, n) => {
    const start = [reach(poly, 0), 0], pts = [start];
    let i0 = 0;
    for (let i = 0; i < poly.length; i++) {  // the edge the start is on
      const [, y1] = poly[i], [, y2] = poly[(i + 1) % poly.length];
      if (y1 <= 0 && y2 > 0 || y1 < 0 && y2 >= 0) { i0 = (i + 1) % poly.length; break; }
    }
    for (let i = 0; i < poly.length; i++) pts.push(poly[(i0 + i) % poly.length]);
    pts.push(start);
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const out = [];
    for (let q = 0, i = 1; q < n; q++) {
      const at = len[len.length - 1] * q / n;
      while (len[i] < at) i++;
      const u = (at - len[i - 1]) / (len[i] - len[i - 1] || 1);
      out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u]);
    }
    return out;
  };
  // where a ray from (0, 0) at angle a leaves a convex polygon round it
  const reach = (poly, a) => {
    const dx = Math.cos(a), dy = Math.sin(a);
    let best = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length], ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      const t = (x1 * ey - y1 * ex) / den, s = (x1 * dy - y1 * dx) / den;
      if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9) best = Math.max(best, t);
    }
    return best;
  };

  // ── the figure ────────────────────────────────────────────────────────

  // half-widths of a man's parts (metres, at thickness 1)
  const R = { head: 0.105, neck: 0.04, hip: 0.16, hipD: 0.11, waist: 0.14, waistD: 0.1, chest: 0.16, chestD: 0.115, shoulder: 0.175, shoulderD: 0.09 };
  // ── what is put on the figure ─────────────────────────────────────────
  // Each a part drawn on the figure being made — F (make: build): the look and the style, its colours, the joints (P,
  // fwd, side, up), the head (its centre, axes, egg, sizes, a point on it), the trunk's sections, what hangs keeping
  // clear of what is worn (clear), springs (swing), and the primitives drawing into its mesh (ball, cap, tube, bar,
  // shell, rings). A world's cast adds its own the same way (tablesOf) — and ours are made only so.

  // hair: a cap on the head round the crown, tipped back — its edge the brow before, the nape behind (out of the head's
  // faces however few: its own flat faces cut no deeper than a cos of their half-angle, twice); a cut — a shell down to
  // its edge (edge(a): how low it comes round the head — a: 0 before, ±π behind; the height on it, 1 its top, -1 its
  // bottom — a fringe at the brow, the sides and the back lower), spreading below the head's middle (flare), standing
  // off the head (swell, ×)
  const crown = F => { const h = F.head; F.cap(h.at, h.axes, h.egg.map(e => e * h.r * h.out), [0, 0.62, -0.78], -0.12, F.colors.hair, h.sides, h.square); };
  const shellOf = (edge, flare, swell = 1) => F => { const h = F.head; F.shell(h.at, h.axes, h.egg.map(e => e * h.r * h.out * swell), edge, flare, F.colors.hair, h.sides, h.square); };
  const TUFTS = [[0, 0.7, 0.7], [-0.55, 0.8, 0.2], [0.5, 0.85, 0.15], [-0.2, 1, -0.3], [0.35, 0.85, -0.5]];
  const HAIR = {
    none: {},
    short: { draw: crown },
    long: { draw: F => {
      crown(F);
      const { at: head, axes: [hs, hu, hf], r: rh } = F.head, k = F.k;
      const from = add(head, add(mul(hf, -rh * 0.55), mul(hu, -rh * 0.1)));
      const mid = F.swing('locks1', add(from, add([0, -0.16 * F.fit.h, 0], mul(F.fwd('Chest'), -0.05 * k))), 160);
      const end = F.swing('locks2', add(mid, add([0, -0.14 * F.fit.h, 0], mul(F.fwd('Chest'), -0.02 * k))), 90);
      F.tube([from, mid, end], [[0, rh * 0.82], [1, rh * 0.66], [1.7, rh * 0.42], [2, 0]], [[0, F.colors.hair]], F.sides, hs, 0.65);
    } },
    bun: { draw: F => {
      crown(F);
      const { at: head, axes: [hs, hu, hf], r: rh } = F.head;
      F.ball(add(head, add(mul(hu, rh * 0.7), mul(hf, -rh * 0.75))), [hs, hu, hf], [rh * 0.42, rh * 0.42, rh * 0.42], F.colors.hair, F.sides);
    } },
    bob: { draw: shellOf(a => 0.36 - smooth(0.7, 1.2, Math.abs(a)), 0.14) },
    straight: { draw: F => {
      shellOf(a => 0.36 - 0.86 * smooth(0.7, 1.2, Math.abs(a)), 0.06)(F);
      // long straight hair: a flat mass down the back from behind the head, cut straight across
      const { at: head, axes: [hs, hu, hf], r: rh } = F.head, fc = F.fwd('Chest');
      const from = add(head, add(mul(hf, -rh * 0.45), mul(hu, rh * 0.05)));
      const mid = F.clear(F.swing('locks1', add(from, add([0, -0.14 * F.fit.h, 0], mul(fc, -0.03 * F.k))), 160), -1, rh * 0.2);
      const end = F.clear(F.swing('locks2', add(mid, [0, -0.12 * F.fit.h, 0]), 90), -1, rh * 0.2);
      F.tube([from, mid, end], [[0, rh * 0.78], [1, rh * 0.95], [2, rh * 0.92]], [[0, F.colors.hair]], F.sides, hs, 0.3, 4, true);
    } },
    ponytail: { draw: F => {
      shellOf(a => 0.42 - 0.52 * smooth(0.6, 1.3, Math.abs(a)) - 0.35 * smooth(2, 2.8, Math.abs(a)), 0)(F);
      // a ponytail: tied high behind the head, swinging
      const { at: head, axes: [hs, hu, hf], r: rh } = F.head, fc = F.fwd('Chest');
      const tie = add(head, add(mul(hu, rh * 0.5), mul(hf, -rh * 0.85)));
      const mid = F.clear(F.swing('tail1', add(tie, add([0, -0.1 * F.fit.h, 0], mul(fc, -0.06 * F.k))), 140), -1, rh * 0.3);
      const end = F.clear(F.swing('tail2', add(mid, [0, -0.17 * F.fit.h, 0]), 70), -1, rh * 0.2);
      F.tube([tie, mid, end], [[0, rh * 0.26], [0.4, rh * 0.42], [1.3, rh * 0.36], [2, 0]], [[0, F.colors.hair]], F.sides, hs, 0.75);
    } },
    spiky: { draw: F => {
      shellOf(a => 0.5 - 0.45 * smooth(0.6, 1.3, Math.abs(a)) - 0.35 * smooth(2, 2.8, Math.abs(a)), 0, 1.1)(F);
      // a few tufts out of the mass, broad and flat, their tips bent back (pressed down under a hat)
      if (F.look.hat !== 'none') return;
      const { at: head, axes: [hs, hu, hf], r: rh } = F.head;
      for (const d of TUFTS) {
        const v = unit(add(add(mul(hs, d[0]), mul(hu, d[1])), mul(hf, d[2]))), base = add(head, mul(v, rh * 0.8));
        F.tube([base, add(base, mul(v, rh * 0.45)), add(add(base, mul(v, rh * 0.75)), mul(hf, -rh * 0.25))], [[0, rh * 0.42], [1, rh * 0.28], [2, rh * 0.04]], [[0, F.colors.hair]], 10, unit(cross(v, hf)), 0.5);
      }
    } },
  };
  const HATS = {
    none: {},
    // a cap: a dome over the crown down to the brow, a brim before tipped down
    cap: { draw: F => {
      const { at: head, axes: [hs, hu, hf], egg, r: rh, out, sides, square } = F.head;
      F.cap(head, [hs, hu, hf], egg.map(e => e * rh * out * 1.06), [0, 0.98, -0.2], 0.3, F.colors.hat, sides, square);
      const tilt = unit(add(hu, mul(hf, 0.25)));
      F.ball(add(head, add(mul(hu, rh * 0.38), mul(hf, rh * 0.92))), [hs, tilt, cross(hs, tilt)], [rh * 0.74, rh * 0.06, rh * 0.52], F.colors.hat, F.sides);
    } },
    // a hat: a wide brim at the brow, a crown flat on top
    hat: { draw: F => {
      const { at: head, axes: [hs, hu, hf], r: rh } = F.head, tilt = unit(add(hu, mul(hf, 0.08))), axes = [hs, tilt, cross(hs, tilt)];
      F.ball(add(head, mul(hu, rh * 0.38)), axes, [rh * 1.75, rh * 0.06, rh * 1.65], F.colors.hat, F.sides * 2);
      F.ball(add(head, mul(hu, rh * 0.62)), axes, [rh * 0.9, rh * 0.55, rh * 0.88], F.colors.hat, F.sides, 3);
    } },
  };
  // a face's expressions (a figure of shapes' <id>_mood — the names a body's face has: figure.js): its brows' inner and
  // outer ends up (+) or down, its eyes opened (1 at rest) or narrowed, its mouth's half-width, its corners up (+) or
  // down, how open it is (0: closed)
  // how far a faceted head's rounded face stands out (of the ball's radius: over its corners, which stand at 1)
  const FACE_ROUND = 1.015;
  const EXPRESSIONS = {
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
  };
  const FACES = {
    none: {},
    // eyes, brows, a nose, a mouth on the head's surface — at rest, or as the person's <id>_mood has it (EXPRESSIONS)
    simple: { draw: F => {
      const { axes, r: rh, on } = F.head, [, hu] = axes, dark = [0.17, 0.14, 0.13], brow = F.colors.hair.map(v => v * 0.75);
      const x = EXPRESSIONS[F.look.expression] ?? EXPRESSIONS.neutral, lips = F.colors.skin.map(v => v * 0.72);
      for (const sx of [-1, 1]) {
        F.ball(on([sx * 0.33, 0.08, 0.94], 0.985), axes, [rh * 0.07, rh * 0.085 * x.eye, rh * 0.04], dark, 10);
        F.tube([on([sx * 0.16, 0.34 + x.inner, 0.93], 0.995), on([sx * 0.3, 0.36 + (x.inner + x.outer) / 2, 0.9], 1.0), on([sx * 0.45, 0.31 + x.outer, 0.84], 0.995)],
          [[0, rh * 0.026], [1, rh * 0.03], [2, rh * 0.02]], [[0, brow]], 6, hu);
      }
      F.ball(on([0, -0.1, 1], 0.97), axes, [rh * 0.085, rh * 0.12, rh * 0.11], F.colors.skin.map(v => v * 0.97), 10);
      // (the mouth: its corners up or down, open — a dark oval within it — or closed)
      const w = x.wide, y = -0.37;
      if (x.open) F.ball(on([0, y - x.open / 2, 0.95], 0.975), axes, [rh * w * 0.75, rh * x.open, rh * 0.03], dark, 10);
      F.tube([on([-w, y + x.corners, 0.93], 0.995), on([0, y, 0.94], 1.0), on([w, y + x.corners, 0.93], 0.995)], [[0, rh * 0.016], [2, rh * 0.016]], [[0, lips]], 6, hu);
    } },
    // a dot of an eye on either side: two seen from before, one in profile
    dot: { draw: F => {
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
  const sailorCollar = F => {
    // a sailor's collar: from round the neck over the shoulders — before, down to a point on the chest; behind, a square
    // flap to the shoulder blades — and a bow at its point (on the blouse's rings, a little off them: 0 its shoulders'
    // section, 1 the chest's, 2 the waist's — between, mixed)
    const on = F.worn, k = F.k, q2 = on[0].length, sd = F.side('Chest'), fw = F.fwd('Chest'), uc = F.up('Chest');
    const at2 = (s2, q) => {
      const i0 = Math.min(1, Math.floor(s2)), u2 = s2 - i0, p = mix(on[i0][q], on[i0 + 1][q], u2);
      return add(p, mul(unit(sub(p, mix(mean(on[i0]), mean(on[i0 + 1]), u2))), 0.008 * k));
    };
    const low = q => { const g = Math.abs(((q / q2 * Math.PI * 2 - Math.PI / 2) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI); return g < 0.6 ? 1.35 - g / 0.6 * 1.23 : g < 2.3 ? 0.12 : 1; };
    const qs = Array.from({ length: q2 }, (_, q) => q), neck = add(F.P('Neck1'), mul(uc, 0.005 * F.fit.h));
    F.rings([qs.map(q => round(neck, sd, fw, R.neck * k * 1.8, R.neck * k * 1.7, q / q2 * Math.PI * 2, 2)), qs.map(q => at2(0, q)), qs.map(q => at2(low(q), q))], F.colors.garment, null, null);
    const tip = add(at2(1.35, q2 / 4), mul(fw, 0.012 * k)), bw = 0.034 * k;
    for (const sx of [-1, 1]) {
      F.ball(add(tip, mul(sd, sx * bw * 0.85)), [sd, uc, fw], [bw, bw * 0.6, bw * 0.4], F.colors.accent, 12);
      F.tube([tip, add(tip, add(mul(sd, sx * bw * 0.5), mul(uc, -bw * 1.8)))], [[0, bw * 0.35], [1, bw * 0.3]], [[0, F.colors.accent]], 8, fw, 0.4, 2, true);
    }
    F.ball(add(tip, mul(fw, bw * 0.15)), [sd, uc, fw], [bw * 0.4, bw * 0.4, bw * 0.35], F.colors.accent, 10);
  };
  const apronPanel = F => {
    // a panel before the trunk and the thighs, from the chest to the knees, clear of whatever is in front
    const P = F.P, k = F.k, f = level(F.fwd('Hips')), s2 = level(F.side('Hips')), rows = [];
    const from = add(P('Chest'), mul(F.fwd('Chest'), R.chestD * k * F.style.trunk.d[3] * 1.05)), knees = mix(P('LeftShin'), P('RightShin'), 0.5);
    for (let r = 0; r <= 6; r++) {
      const y = from[1] + (knees[1] - from[1]) * r / 6;
      let front = dot(sub(mix(from, knees, r / 6), P('Hips')), f);
      for (const j of ['LeftLeg', 'RightLeg', 'LeftShin', 'RightShin', 'Spine1', 'Chest']) if (Math.abs(P(j)[1] - y) < 0.12) front = Math.max(front, dot(sub(P(j), P('Hips')), f) + 0.09 * k);
      const c = add(P('Hips'), add(mul(f, front), [0, y - P('Hips')[1], 0])), half = 0.17 * k * F.look.body.hips * (1 + 0.15 * r / 6);
      rows.push([add(c, mul(s2, half)), add(c, mul(s2, -half)), add(add(c, mul(s2, -half)), mul(f, -0.012)), add(add(c, mul(s2, half)), mul(f, -0.012))]);
    }
    F.rings(rows, F.colors.garment, null, null);
  };
  const GARMENTS = {
    none: {},
    tunic: { hang: [{ to: 0.3, from: 'shoulders', flare: 0.06, color: 'top', folds: false }] },
    coat: { hang: [{ to: 1.15, from: 'shoulders', flare: 0.18, ragged: true }], sleeves: 'garment' },
    dress: { hang: [{ to: 1.9, from: 'waist', flare: 0.45, off: 0.94 }], short: true, bare: true, bodice: true },
    robe: { hang: [{ to: 2.3, from: 'shoulders', flare: 0.5, ragged: true }], sleeves: 'garment', wide: 0.6 },
    apron: { draw: apronPanel },
    jacket: { hang: [{ to: 0.5, from: 'shoulders', flare: 0.1, folds: false }], sleeves: 'garment' },
    skirt: { hang: [{ to: 0.8, from: 'waist', flare: 0.3, pleats: 12, off: 1.04 }], bare: true },
    sailor: { hang: [{ to: 0.8, from: 'waist', flare: 0.3, pleats: 12, off: 1.06 }, { to: 0.12, from: 'shoulders', flare: 0.16, color: 'top', folds: false }],
      bare: true, draw: sailorCollar },
  };
  // more: a hood, a scarf — as the look says (hood, scarf), or any a world adds, by their names in the look's parts
  const PARTS = {
    hood: { draw: F => {
      const { at: head, axes: [hs, hu, hf], r: rh } = F.head, c = add(head, add(mul(hf, -rh * 0.38), mul(hu, rh * 0.08)));
      F.ball(c, [hs, hu, hf], [rh * 1.3, rh * 1.32, rh * 1.3], F.colors.garment, F.sides);
      const back = add(F.P('Chest'), mul(F.fwd('Chest'), -0.03 * F.k));
      F.tube([c, mix(c, back, 0.5), back], [[0, rh * 1.2], [2, R.shoulder * F.k * 0.9]], [[0, F.colors.garment]], F.sides, hf);
    } },
    scarf: { draw: F => {
      // a band round the neck where it meets the shoulders, its end hanging before the chest
      const k = F.k, uc = F.up('Chest'), fc = F.fwd('Chest'), sd = F.side('Chest'), c = add(F.P('Neck1'), mul(uc, 0.005 * F.fit.h)), n = Math.max(12, F.sides * 2);
      const ro = R.neck * k * 2.3, ri = R.neck * k * 1.1, hh = 0.028 * F.fit.h, ring = (dy, w) => F.ringOf([add(c, mul(uc, dy)), sd, fc, w, w * 0.92], n, 2.4);
      const rs = [ring(-hh, ri), ring(-hh, ro), ring(hh, ro * 0.9), ring(hh, ri * 1.1)];
      F.rings([...rs, rs[0]], F.colors.accent, null, null);
      // (over the shoulders' slope and down the chest, on it; bent over, hanging)
      const from = add(c, add(add(mul(fc, ro * 0.7), mul(sd, ro * 0.35)), mul(uc, -hh))), off = 0.015 * F.fit.h;
      const end = F.clear(F.swing('scarf', add(from, [0, -0.2 * F.fit.h, 0]), 120), 1, off), along2 = [0, 0.1, 0.2, 0.35, 0.65, 1];
      F.tube(along2.map(u => F.clear(mix(from, end, u), 1, off)), [[0, 0.028 * F.fit.h], [5, 0.03 * F.fit.h]], [[0, F.colors.accent]], 8, sd, 0.3, 4, true);
    } },
  };

  // what a look may be, each by its name in the page's words (ours: a world's own are its to name)
  const names = () => ({
    styles: { shadow: tr.c('a style', 'shadow'), soft: tr.c('a style', 'soft'), graphic: tr.c('a style', 'graphic'), toy: tr.c('a style', 'toys'),
      geometry: tr.c('a style', 'geometry'), flat: tr.c('a style', 'flat geometry') },
    characters: { man: tr.c('a person', 'man'), woman: tr.c('a person', 'woman'), teen: tr.c('a person', 'teenager'), child: tr.c('a person', 'child'),
      toddler: tr.c('a person', 'toddler'), old: tr.c('a person', 'old man'), smith: tr.c('a person', 'smith'), death: tr.c('a person', 'death'),
      school: tr.c('a person', 'schoolgirl'), youth: tr.c('a person', 'young man'), lady: tr.c('a person', 'lady in a coat'),
      grandpa: tr.c('a person', 'old man in a cap'), janitor: tr.c('a person', 'street sweeper') },
    garments: { none: tr('shirt and trousers'), tunic: tr.c('worn', 'loose shirt'), coat: tr.c('worn', 'coat'), dress: tr.c('worn', 'dress'),
      robe: tr.c('worn', 'robe'), apron: tr.c('worn', 'apron'), jacket: tr.c('worn', 'jacket'), skirt: tr.c('worn', 'pleated skirt'), sailor: tr.c('worn', 'sailor suit') },
    hair: { none: tr.c('hair', 'none'), short: tr.c('hair', 'short'), long: tr.c('hair', 'long'), bun: tr.c('hair', 'bun'), bob: tr.c('hair', 'bob'),
      straight: tr.c('hair', 'long straight'), ponytail: tr.c('hair', 'ponytail'), spiky: tr.c('hair', 'crew cut') },
    hats: { none: tr.c('a hat', 'none'), cap: tr.c('a hat', 'cap'), hat: tr.c('a hat', 'hat') },
    faces: { none: tr('no face'), simple: tr.c('a face', 'simple'), dot: tr.c('a face', 'dot eyes') },
    parts: { hood: tr.c('worn', 'hood'), scarf: tr.c('worn', 'scarf') },
    paints: { silhouette: tr.c('painted as', 'silhouette'), rim: tr.c('painted as', 'silhouette with a rim'), flat: tr.c('painted as', 'colours'),
      toned: tr.c('painted as', 'colours and shade'), clay: tr.c('painted as', 'clay'), lit: tr.c('painted as', 'colours in the light') },
    grounds: { studio: tr.c('a light', 'studio'), fog: tr.c('a light', 'fog'), night: tr.c('a light', 'night'), dusk: tr.c('a light', 'dusk'),
      day: tr.c('a light', 'day'), paper: tr.c('a light', 'paper'), sunset: tr.c('a light', 'sunset'), lamp: tr.c('a light', 'lamp'), mist: tr.c('a light', 'haze') },
  });

  // ── a world's own ────────────────────────────────────────────────────
  // A world's cast (people.js: its module) may bring its own (cast.shapes): styles, characters, garments, hair, hats,
  // faces, parts (each as ours are — a style or a character may say `from`: one it is made from, ours or the world's,
  // with its own over it), the arms' and the legs' profiles, paints' and grounds' — over ours, by name.
  const made = new WeakMap(), OURS = { styles: STYLES, characters: CHARACTERS, garments: GARMENTS, hair: HAIR, hats: HATS, faces: FACES, parts: PARTS,
    arms: ARMS, legs: LEGS, paints: PAINTS, grounds: GROUNDS };
  // the skeleton's lengths a look is drawn with (its body's, the legs and the neck as long as its style makes them) —
  // what its points are worked out on too (people.js)
  // (the shoulders as broad as the trunk is: a thicker figure's arms hang from where its trunk's shoulders end)
  const bodyOf = L => { const st = tablesOf(L.cast).styles[L.style]; return { ...L.body, legs: L.body.legs * st.legs, neck: L.body.neck * st.neck, shoulders: L.body.shoulders * L.body.thick }; };
  function tablesOf(cast) {
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

  const VS = `#version 300 es
in vec3 at; in vec3 normal; in vec4 tint; in float soft; uniform mat4 view; out vec3 n; out vec3 wp; out vec3 col; out float toned; out float smoothed;
void main() { n = normal; wp = at; col = tint.rgb; toned = tint.a; smoothed = soft; gl_Position = view * vec4(at, 1.0); }`;
  // a part's colour (or the silhouette's), in two tones by the light if asked; its mark: the colour (lines where it changes)
  const FS = `#version 300 es
precision highp float;
in vec3 n; in vec3 wp; in vec3 col; in float toned; in float smoothed;
uniform int paint; uniform bool facets, ground, scene, sourced; uniform vec3 key, back, eye, ink, rim, light, bg, amb, lit1, lit2; uniform float haze, tall; uniform mat3 world;
/*SHADED*/
// (how bright the light all round is where a silhouette begins to show its colours, and where it is all colours)
const float DUSKY = 0.12, DAYLIGHT = 0.42;
layout(location = 0) out vec4 color; layout(location = 1) out vec4 mark; layout(location = 2) out vec4 facing;
void main() {
  // (a part in colours on a silhouette — its tone 3: a book's pages in a candle's light — painted as one in colours in the
  // light is)
  int pm = toned > 2.5 && toned < 3.5 ? 5 : paint;
  vec3 N = facets && smoothed < 0.5 ? normalize(cross(dFdx(wp), dFdy(wp))) : normalize(n);
  if (dot(N, eye - wp) < 0.0) N = -N;
  // (two tones: the shadow's where the surface turns from the key light, or something stands between it and the light)
  vec3 c = pm == 0 ? ink : pm == 2 && (dot(N, key) < 0.12 || cleared(wp, 0) < 0.5) ? col * vec3(0.7, 0.71, 0.78) : col;
  // in the scene's light: flat, one shadow tone (on what takes it), a little lighter up the figure, under the light's
  // colour; a rim of the light behind, low (from the side: not on what faces up), along the edges facing it; faded
  // into the air
  if (pm == 5) {
    c = col * mix(vec3(0.8, 0.8, 0.88), vec3(1.0), max(1.0 - toned, smoothstep(-0.04, 0.04, dot(N, key)))) * mix(0.9, 1.04, clamp(wp.y / tall, 0.0, 1.0)) * light;
    c = mix(c, rim, smoothstep(0.5, 0.7, 1.0 - max(dot(N, normalize(eye - wp)), 0.0)) * smoothstep(0.05, 0.3, dot(N, normalize(back * vec3(1.0, 0.2, 1.0)))));
    c = mix(c, bg, haze);
  }
  // a rim: where the surface turns away from the eye, on the side the light comes from behind
  if (pm == 4) {
    float wrap = 0.5 + 0.5 * dot(N, key), turn = 1.0 - max(dot(N, normalize(eye - wp)), 0.0);
    c = col * (0.6 + 0.42 * wrap) * (1.0 - 0.14 * turn * turn) * mix(vec3(0.93, 0.95, 1.0), vec3(1.03, 1.0, 0.96), wrap);
  }
  if (pm == 3) c = mix(ink, rim, smoothstep(0.42, 0.68, 1.0 - max(dot(N, normalize(eye - wp)), 0.0)) * smoothstep(0.0, 0.3, dot(N, back)));
  // lit by the scene's sources (people.js — a scene that lays no light itself): the strongest's light (key, lit1) and
  // the next's (back, lit2) by how each point faces them, over the light all round (amb); a silhouette with a rim of each
  // where its edge turns to it
  if (sourced && !ground) {
    // (a rim: the edge alone, where the surface turns away from the eye — on the side the source is, whether it is
    // behind or before them)
    float edge = smoothstep(0.62, 0.86, 1.0 - max(dot(N, normalize(eye - wp)), 0.0));
    // (as much of each as comes through what stands between: ink.js, SHADED)
    float k1 = cleared(wp, 0), k2 = cleared(wp, 1);
    if (pm == 0) c = ink;
    else if (pm == 3) {
      // (a silhouette in the dark; as the light all round them grows towards daylight, their own colours come through
      // it, lit as the colours are — no one is a shadow on a grey day)
      vec3 rims = k1 * lit1 * edge * smoothstep(0.0, 0.3, dot(N, key)) + k2 * lit2 * edge * smoothstep(0.0, 0.3, dot(N, back));
      vec3 seen = col * (amb + k1 * lit1 * smoothstep(-0.25, 0.65, dot(N, key)) + 0.6 * k2 * lit2 * smoothstep(-0.25, 0.65, dot(N, back)));
      c = mix(ink, seen, smoothstep(DUSKY, DAYLIGHT, dot(amb, vec3(0.3, 0.59, 0.11)))) + rims;
    }
    else c *= amb + k1 * lit1 * smoothstep(-0.25, 0.65, dot(N, key)) + 0.6 * k2 * lit2 * smoothstep(-0.25, 0.65, dot(N, back));
  }
  // in a lit scene (people.js): the colours alone — the scene's light lays itself on them, by how they face
  if (scene) c = pm == 0 || pm == 3 ? ink : col;
  if (ground) c = col;
  // (a colour that glows — its tone 2: a lamp's glass, a flame — is its own, whatever the paint and the light; its facing
  // (1, 1, 1): no surface's, for a lit scene to lay no light on it)
  bool glows = !ground && toned > 1.5 && toned < 2.5;
  if (glows) c = col;
  color = vec4(c, 1.0);
  facing = glows ? vec4(1.0) : vec4(normalize(world * N) * 0.5 + 0.5, 1.0);
  mark = ground ? vec4(0.0) : vec4(!glows && (pm == 0 || pm == 3) ? ink : col, 1.0);
}`;

  // the program people are drawn with: one a context, every person's
  const programs = new WeakMap();
  function programOf(gl) {
    if (programs.has(gl)) return programs.get(gl);
    const prog = gl.createProgram();
    for (const [kind, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS.replace('/*SHADED*/', MooodInk.SHADED.glsl)]]) {
      const s = gl.createShader(kind); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(prog, s);
    }
    gl.linkProgram(prog);
    programs.set(gl, prog);
    return prog;
  }

  // a figure of shapes on a skeleton, as a mesh — what make draws, and what a person's card asks how far it reaches
  function figure(sk) {
    const at = sk.at, T = sk.T;
    const P = j => [T[at[j] * 3], T[at[j] * 3 + 1], T[at[j] * 3 + 2]];
    let key = '', fit = null, reach = null, token = null, made = null, marked = {};
    const springs = new Map();
    const wear = L => {
      const k = JSON.stringify([L.body, L.style]) + (L.cast ? ' cast' : '');
      if (k !== key) { key = k; fit = sk.fit(bodyOf(L)); springs.clear(); }
    };

    // things that swing: each a point following where it should be, a little late (as it is, when time jumps — or what
    // it hangs from does: a new pose all at once, a body stood up for its garment)
    let last = -1;
    const swing = (name, target, dt, stiff = 120) => {
      const s = springs.get(name);
      if (!s || dt < 0 || dt > 0.25 || Math.hypot(...sub(target, s.x)) > 0.5 * fit.h) { springs.set(name, { x: target, v: [0, 0, 0] }); return target; }
      if (dt === 0) return s.x;
      for (let i = 0, n = Math.ceil(dt * 240); i < n; i++) {
        const h = dt / n, acc = sub(mul(sub(target, s.x), stiff), mul(s.v, 2 * Math.sqrt(stiff) * 0.7));
        s.v = add(s.v, mul(acc, h)); s.x = add(s.x, mul(s.v, h));
      }
      return s.x;
    };

    // the figure at frame t, as a mesh: its body, its garment hanging; then what the look puts on it, each part drawn on
    // F (above: what is put on the figure)
    const build = (t, L) => {
      const dt = last < 0 ? 0 : (t - last) / sk.fps;
      last = t;
      const T = tablesOf(L.cast), st = T.styles[L.style], b = L.body, col = Object.fromEntries(Object.entries(L.colors).map(([c, v]) => [c, [...hex(v), c === 'skin' ? 0 : 1]]));
      const G = T.garments[L.garment] ?? T.garments.none, M = meshes(), k = fit.h * b.thick, sides = st.sides, layers = G.hang ?? [];
      const fwd = j => unit(sk.dir(at[j], [0, 0, 1])), side = j => unit(sk.dir(at[j], [1, 0, 0])), up = j => unit(sk.dir(at[j], [0, 1, 0]));
      const sleeve = (G.sleeves === 'garment' ? col.garment : col.top).map(v => v * (st.sleeves ?? 1));
      const legsCol = G.bare ? col.skin : col.bottom;

      // how far the body lies (0 upright … 1 on its back): its spine far from upright, its hips down by the floor (not
      // on a chair, bent over a table) — and, if it does, the turn standing it up about its hips for its garment (stand),
      // back (lay), and the garment's points laid back down with it (back: the floor under them — what is below it lies
      // on it)
      const lying = () => {
        const hips = P('Hips'), spine = unit(sub(P('Neck1'), hips)), w = smooth(0.5, 0.15, spine[1]) * smooth(0.3 * fit.h, 0.18 * fit.h, hips[1]);
        if (w < 0.01) return null;
        const axis = cross(spine, [0, 1, 0]), l = Math.hypot(...axis);
        if (l < 1e-6) return null;
        const ang = Math.atan2(l, spine[1]) * w, R = rotation(mul(axis, 1 / l), ang), Ri = rotation(mul(axis, 1 / l), -ang);
        const turn = (Q, c, v) => add(c, mat3(Q, sub(v, c)));
        let lift = 0;
        const apply = (Q, dy) => {
          for (let j = 0; j < sk.J; j++) {
            const q = turn(Q, hips, [sk.T[j * 3], sk.T[j * 3 + 1] - dy, sk.T[j * 3 + 2]]);
            sk.T.set([q[0], q[1], q[2]], j * 3);
            const cols = [0, 1, 2].map(c => mat3(Q, [sk.R[j * 9 + c], sk.R[j * 9 + 3 + c], sk.R[j * 9 + 6 + c]]));
            for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) sk.R[j * 9 + r * 3 + c] = cols[c][r];
          }
        };
        const floor = 0.02 * fit.h;
        return {
          w,
          stand() {
            apply(R, 0);
            let low = Infinity;
            for (let j = 0; j < sk.J; j++) low = Math.min(low, sk.T[j * 3 + 1]);
            lift = Math.max(0, -low);
            for (let j = 0; j < sk.J; j++) sk.T[j * 3 + 1] += lift;
          },
          lay() { apply(Ri, lift); },
          point: q => { const v = turn(Ri, hips, [q[0], q[1] - lift, q[2]]); return [v[0], Math.max(floor, v[1]), v[2]]; },
          back(ps) { for (let j = 0; j < ps.length; j += 3) { const v = this.point([ps[j], ps[j + 1], ps[j + 2]]); ps[j] = v[0]; ps[j + 1] = v[1]; ps[j + 2] = v[2]; } },
        };
      };
      // the trunk's sections, bottom to top: each a centre, its side and front, its half-widths (the shoulders' also how
      // far down its sides fall from the neck: shoulders slope, a coat hung from them too)
      // (the pelvis holds the tops of the thighs: at the hip joints it is as wide as they are apart and as thick as a
      // thigh is, and its seat below them goes round both — the legs come out from under it, never from its sides)
      const thighR = T.legs[st.feet][0][1] * k * st.limb, apart = Math.hypot(...sub(P('LeftLeg'), P('RightLeg'))) / 2;
      const trunk = s => {
        const tk = k * s, hp = b.hips, sh = b.shoulders, hips = mix(P('LeftLeg'), P('RightLeg'), 0.5), uh = up('Hips'), { w, d } = st.trunk;
        const seat = (apart + thighR * 0.97) * s, pelvis = (apart + thighR * 1.03) * s, thick = thighR * 1.05 * s;
        return [
          [add(hips, mul(uh, -thighR * 0.55)), side('Hips'), fwd('Hips'), Math.max(R.hip * tk * hp * 0.9 * w[0], seat), Math.max(R.hipD * tk * 0.9 * d[0], thick)],
          [add(hips, mul(uh, 0.02 * fit.h)), side('Hips'), fwd('Hips'), Math.max(R.hip * tk * hp * w[1], pelvis), Math.max(R.hipD * tk * d[1], thick)],
          [P('Spine1'), side('Spine1'), fwd('Spine1'), R.waist * tk * (hp + sh) / 2 * w[2], R.waistD * tk * d[2]],
          [P('Chest'), side('Chest'), fwd('Chest'), R.chest * tk * sh * w[3], R.chestD * tk * d[3]],
          [add(mix(P('LeftArm'), P('RightArm'), 0.5), mul(up('Chest'), 0.01 * fit.h)), side('Chest'), fwd('Chest'), R.shoulder * tk * sh * w[4], R.shoulderD * tk * d[4],
            mul(up('Chest'), -0.2 * R.shoulder * tk * sh * w[4])],
        ];
      };
      const ringOf = ([c, sd, fw, w, d, fall], n, square) => Array.from({ length: n }, (_, q) => {
        const a = q / n * Math.PI * 2, p = round(c, sd, fw, w, d, a, square);
        return fall ? add(p, mul(fall, Math.abs(Math.cos(a)) ** (4 / square))) : p;
      });
      const tr = trunk(1), n = Math.max(12, sides * 2);
      // (trousers up to the waist — the seat and the hips theirs — a belt between, the top above it: the colours meet at
      // the belt's section, twice, in an edge)
      const belt = [mix(tr[1][0], tr[2][0], 0.5), tr[2][1], tr[2][2], (tr[1][3] + tr[2][3]) / 2, (tr[1][4] + tr[2][4]) / 2];
      const lower = G.bodice ? col.garment : legsCol, upper = G.bodice ? col.garment : col.top;
      const sections = [tr[0], tr[1], belt, belt, ...tr.slice(2)], shades = [lower, lower, lower, upper, upper, upper, upper];
      M.rings(sections.map(s2 => ringOf(s2, n, st.square)), [...shades.map(c => Array(n).fill(c)), [lower], [upper]], add(tr[0][0], mul(up('Hips'), -thighR * 0.4)), P('Neck1'));

      // the head, and what is on it
      const hd = fit.h * b.head * st.head, rh = R.head * hd, hu = up('Head'), hf = fwd('Head'), hs = side('Head');
      const head = add(P('Head'), add(mul(hu, 0.07 * hd), mul(hf, 0.012 * hd)));
      const egg = st.egg, hsides = st.facets ? 7 : Math.max(10, sides);
      ball(M, head, [hs, hu, hf], egg.map(e => e * rh), col.skin, hsides, st.headSquare);
      // (a faceted head's face rounded: its front a finer cap over the facets — the face reads, the head stays cut)
      if (hsides < 10) { M.smooth = 1; cap(M, head, [hs, hu, hf], egg.map(e => e * rh * FACE_ROUND), [0, 0.05, 1], 0.35, col.skin, 18, st.headSquare); M.smooth = 0; }
      // (what is on the head stands out of its faces however few: its own flat faces cut no deeper than a cos of their
      // half-angle, twice)
      const out = 1.04 / Math.cos(Math.PI / hsides) ** 2;
      // a point of the head's surface where it faces d (across, up, forwards), a little out of it
      // (on a faceted head, over its rounded face)
      const face = hsides < 10 ? FACE_ROUND : 1;
      const on = (d, o2 = 1) => { d = unit(d); o2 *= face; return add(head, add(add(mul(hs, egg[0] * rh * d[0] * o2), mul(hu, egg[1] * rh * d[1] * o2)), mul(hf, egg[2] * rh * d[2] * o2))); };
      tube(M, [P('Neck1'), mix(P('Neck1'), P('Head'), 0.5), P('Head')], [[0, R.neck * k * 1.3], [1, R.neck * k], [2, R.neck * k * 0.95]], [[0, col.skin]], Math.max(6, sides - 4), hf);

      // the limbs: each one tube from the shoulder to the fingertips, from the hip to the toes, by the style's profile —
      // sleeves to the wrist (a dress's short), the hand bare (a robe's sleeves widening down the forearm); trousers to
      // the ankle (under a dress, the legs bare), shoes below
      const lk = k * st.limb, arm = T.arms[st.arms].map(([w, r]) => [w, r * lk * (G.wide && w > 1 && w <= 2 ? 1 + (w - 1) * G.wide : 1)]);
      const leg = T.legs[st.feet].map(([w, r]) => [w, r * lk]);
      // (knee socks: from a little below the knee)
      const socks = L.socks ? [[1.15, col.socks]] : [];
      // (a foot without its shoe: the stocking's, else bare)
      const shod = s => (L.barefoot === 'both' || L.barefoot === s.toLowerCase() ? (L.socks ? col.socks : col.skin) : col.shoes);
      if (st.rigid) for (const s of ['Left', 'Right']) {
        // or each bone a bar: the upper arm, the forearm (a dress's sleeve short), a round hand; the thigh, the shin, a
        // shoe — rigid on the foot, a rounded block from the heel to the toes
        const ra = w => arm.find(([x]) => x === w)[1], rl = w => leg.find(([x]) => x === w)[1], hint = fwd('Chest');
        // (the upper arm from within the shoulder: its round end level with the shoulder's line, not a ball on it)
        const shoulder = add(P(`${s}Arm`), add(mul(sub(mix(P('LeftArm'), P('RightArm'), 0.5), P(`${s}Arm`)), ra(0) * 0.6 / (Math.hypot(...sub(P('LeftArm'), P('RightArm'))) / 2)), mul(up('Chest'), -ra(0) * 0.9)));
        bar(M, shoulder, P(`${s}ForeArm`), ra(0), ra(1), [[0, sleeve]], sides, hint, 0.9);
        bar(M, P(`${s}ForeArm`), P(`${s}Hand`), ra(1), ra(2), [[0, sleeve], ...(G.short ? [[0.15, col.skin]] : [])], sides, hint, 0.9);
        ball(M, mix(P(`${s}Hand`), P(`${s}HandMiddle1`), 0.45), [side(`${s}Hand`), up(`${s}Hand`), fwd(`${s}Hand`)], [ra(3), ra(3), ra(3) * 0.85], col.skin, sides);
        bar(M, P(`${s}Leg`), P(`${s}Shin`), rl(0), rl(1), [[0, legsCol]], sides, fwd('Hips'));
        bar(M, P(`${s}Shin`), P(`${s}Foot`), rl(1), rl(2), [[0, legsCol], ...socks.map(([w, c]) => [w - 1, c])], sides, fwd('Hips'));
        const sw = rl(3), sh = sw * 0.78, rest = j => sk.tb[at[`${s}${j}`]], ankle = rest('Foot'), toe = rest('ToeEnd');
        const shoe = p => add(P(`${s}Foot`), mul(sk.dir(at[`${s}Foot`], sub(p, ankle)), fit.h));
        bar(M, shoe([ankle[0], sh / fit.h, ankle[2] - 0.05 + sw / fit.h]), shoe([toe[0], sh / fit.h, toe[2] + 0.01 - sw / fit.h]), sw, sw,
          [[0, shod(s)]], sides, side(`${s}Foot`), 0.78);
      }
      else for (const s of ['Left', 'Right']) {
        // (the hand's end along the palm: to the knuckles, where the fingers go on; without them, as far again — the
        // fingers' curl is not the hand's shape)
        const hand = P(`${s}Hand`), tip = add(hand, mul(sub(P(`${s}HandMiddle1`), hand), st.fingers ? 1 : 1.9));
        tube(M, [P(`${s}Arm`), P(`${s}ForeArm`), hand, tip], arm,
          [[0, sleeve], [G.short ? 1.15 : 2, col.skin]], sides, fwd('Chest'), st.arms === 'mitten' || st.arms === 'leaf' ? 0.8 : 1);
        if (st.fingers) for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
          const js = [1, 2, 3, ...(f === 'Thumb' ? [] : [4]), 'End'].map(i => P(`${s}Hand${f}${i}`)), w = (f === 'Thumb' ? 0.0085 : 0.0072) * fit.h * b.thick;
          tube(M, js, [[0, w], [js.length - 1, w * 0.45]], [[0, col.skin]], 6, side(`${s}Hand`));
        }
        tube(M, [P(`${s}Leg`), P(`${s}Shin`), P(`${s}Foot`), mix(P(`${s}ToeBase`), P(`${s}ToeEnd`), 0.5)], leg, [[0, legsCol], ...socks, [2, shod(s)]], sides, fwd('Hips'));
      }

      // a garment: round the trunk (a little off it) from the shoulders or the waist to the hips, then hanging from the
      // hips straight down to its length — each section wide enough for the hips (wider towards the hem) and for every
      // part of the legs above it, down to the next; each layer of it so, the outer round the inner
      // (the layers' sections so far: [height, outline round the hips]…, top down; the outer one's from the shoulders)
      // (a body lying — on its back in a coffin, on a bed: its trunk far from upright, its hips low — wears its garment
      // as it would standing: the skeleton stood up about its hips for it, as much as it lies, the cloth made so — each
      // section across the body, the hem toward its feet, not flaring — and laid back down with it; what of it would be
      // below the floor lies on it)
      const lain = lying(), spread = lain ? 1 - lain.w : 1;
      if (lain) lain.stand();
      const Mg = lain ? meshes() : M;
      const inner = [];
      let worn3 = null, outer = null;
      for (const [i, hang] of layers.entries()) {
        const color = col[hang.color ?? 'garment'], around = trunk(hang.off ?? 1.12), n2 = hang.pleats ? hang.pleats * 4 : st.facets ? 16 : 40;
        const hips = mix(P('LeftLeg'), P('RightLeg'), 0.5);
        // (between the legs at height y: where each leg is there, down its bones — the hips above them, the toes below)
        const legsMid = y => mix(...['Left', 'Right'].map(s => {
          const js = ['Leg', 'Shin', 'Foot', 'ToeEnd'].map(j => P(`${s}${j}`));
          if (y >= js[0][1]) return [hips[0], y, hips[2]];
          for (let q = 1; q < js.length; q++) if (y >= js[q][1]) return mix(js[q - 1], js[q], (js[q - 1][1] - y) / (js[q - 1][1] - js[q][1] || 1));
          return js[js.length - 1];
        }), 0.5);
        const thigh = Math.hypot(...sub(P('LeftShin'), P('LeftLeg'))), shin = Math.hypot(...sub(P('LeftFoot'), P('LeftShin')));
        const length = hang.to <= 1 ? hang.to * thigh : thigh + (hang.to - 1) * shin;
        const [, sd0, fw0, w0, d0] = around[1], sd = level(sd0), fw = level(fw0), lift = 0.02 * fit.h;
        // the legs as pieces (a ball at either end), for each section to take what of them is above it (draped, the legs
        // hanging: a thigh that does not hang — lying, sitting, squatting, the knee drawn up — is in the lap, the cloth
        // over it its own)
        const widest = (a, c) => Math.max(...leg.filter(([w]) => w >= a && w <= c).map(([, r]) => r)) + 0.02 * fit.h;
        const lies = s => { const v = sub(P(`${s}Shin`), P(`${s}Leg`)); return -v[1] < Math.hypot(v[0], v[2]); };
        const lap = st.drape ? ['Left', 'Right'].filter(lies) : [];
        const legs = ['Left', 'Right'].filter(s => !lap.includes(s)).flatMap(s => [[P(`${s}Leg`), P(`${s}Shin`), widest(0, 1)], [P(`${s}Shin`), P(`${s}Foot`), widest(1, 2)],
          [P(`${s}Foot`), P(`${s}ToeEnd`), widest(2, 3)]].map(([a, c, r]) => [a, c, r, r]));
        // (from the top of the thighs — a leg's thickness rises above its hip joint as it swings — down; below the waist by
        // as much as the cloth needs to go out over the hips in a curve, not a step — straight lines need none)
        const top = Math.min(hips[1] + widest(0, 1), around[2][0][1] - (st.straight ? 0.02 : 0.1) * fit.h);
        // (how far something there, r thick, is out of the hips' outline, and how far below its top; the cloth's length)
        const past = (p, r) => {
          const v = sub(p, hips), x = dot(v, sd), z = dot(v, fw), a = Math.atan2(z, x);
          return [Math.max(0, Math.hypot(x, z) + r - 1 / Math.hypot(Math.cos(a) / w0, Math.sin(a) / d0)), top - p[1] - r];
        };
        const cloth = top - hips[1] + length;
        // how far down it hangs: its length; or, draped, what of it is left over the knees — the cloth going from the
        // hips' outline over each knee (as far as it is out of that outline, and down) — hanging from them
        // (a lap — both thighs lying: round the hips only down to the seat, under the thighs where they leave them, or the
        // trunk's bottom; one still hanging, the cloth hangs to its length round it)
        let span = cloth;
        if (st.drape) for (const s of ['Left', 'Right']) {
          const [out, down] = past(P(`${s}Shin`), widest(0, 1));
          if (!lap.includes(s)) span = Math.min(span, Math.max(0.15 * span, down + Math.max(0, cloth - Math.hypot(out, down))));
          else if (lap.length === 2) span = Math.min(span, Math.max(0.05 * fit.h, top - Math.min(P(`${s}Leg`)[1] - leg[0][1], around[0][0][1] - 0.03 * fit.h)));
        }
        const steps = 8, below = [], outlines = [];
        // what of the legs a section round c at height y holds — and down to the next: the cloth between two goes
        // straight, it must pass outside what is there — each piece of a leg cut at that height, its ends' circles
        // (a piece counts as far as its thickness reaches: an end below that is cut where its round still does; draped,
        // as far as the cloth reaches it — its way from the hips' outline out to it and down no longer than the cloth)
        const reaches = (p, r2) => Math.hypot(...past(p, r2)) <= cloth;
        // (hanging: only the pieces of a leg hanging from the hip down, steep each one, all of it above them so too)
        const legsAt = (c, floor, hanging = false) => {
          const pts = [];
          let lying = false;
          for (const [q0, [a, c2, ra, rb]] of legs.entries()) {
            if (q0 % 3 === 0) lying = false;
            lying ||= hanging && Math.abs(a[1] - c2[1]) < Math.hypot(a[0] - c2[0], a[2] - c2[2]);
            if (a[1] + ra < floor && c2[1] + rb < floor || lying) continue;
            const cut = (p, q, rp, rq) => { const u = Math.max(0, Math.min(1, (floor - rp - p[1]) / (q[1] - p[1] || 1e-6))); return [mix(p, q, u), rp + (rq - rp) * u]; };
            let ends = a[1] + ra >= floor && c2[1] + rb >= floor ? [[a, ra], [c2, rb]] : a[1] + ra >= floor ? [[a, ra], cut(a, c2, ra, rb)] : [cut(c2, a, rb, ra), [c2, rb]];
            if (st.drape) {
              const [[p0, r0], [p1, r1]] = ends, in0 = reaches(p0, r0), in1 = reaches(p1, r1);
              if (!in0 && !in1) continue;
              if (in0 !== in1) {
                // (the reached end, and the other moved back along the piece to where the cloth still reaches)
                const [[pi, ri], [po, ro]] = in0 ? ends : [ends[1], ends[0]];
                let lo = 0, hi = 1;
                for (let s = 0; s < 8; s++) { const m = (lo + hi) / 2; if (reaches(mix(pi, po, m), ri + (ro - ri) * m)) lo = m; else hi = m; }
                ends = [[pi, ri], [mix(pi, po, lo), ri + (ro - ri) * lo]];
              }
            }
            for (const [p, r2] of ends) {
              const v = sub(p, c), x = dot(v, sd), z = dot(v, fw);
              for (let q = 0; q < 8; q++) { const a2 = q / 8 * Math.PI * 2; pts.push([x + r2 * Math.cos(a2), z + r2 * Math.sin(a2)]); }
            }
          }
          return pts;
        };
        // a section's outline: n points round (0, 0) as far each way as its half-widths say (across +, −, forwards +, −)
        const oval = ([xp, xn, zp, zn], n3, square) => Array.from({ length: n3 }, (_, q) => {
          const a = q / n3 * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a), e = 2 / square;
          return [(cs < 0 ? xn : xp) * Math.sign(cs) * Math.abs(cs) ** e, (sn < 0 ? zn : zp) * Math.sign(sn) * Math.abs(sn) ** e];
        });
        // its sections' half-widths: the hips' (wider towards the hem); or, straight, on lines from its top section's to
        // the hem's — the hem as far each way as it must be round the legs hanging through it (standing, walking, apart):
        // a coat a trapezoid from anywhere (legs lying — a lap, knees up — each section takes round them, not the line)
        const first = hang.from === 'shoulders' ? around[4] : around[2], hemY = Math.max(lift, top - span), g1 = 1 + hang.flare * spread;
        const hem = st.straight ? [...oval([w0 * g1, w0 * g1, d0 * g1, d0 * g1], 24, 2), ...legsAt([hips[0], hemY, hips[2]], hemY - span / steps - 0.01, true)] : [];
        const reachOf = [Math.max(...hem.map(p => p[0])), -Math.min(...hem.map(p => p[0])), Math.max(...hem.map(p => p[1])), -Math.min(...hem.map(p => p[1]))];
        const widths = (y, f) => {
          if (!st.straight) return [w0 * (1 + hang.flare * spread * f), w0 * (1 + hang.flare * spread * f), d0 * (1 + hang.flare * spread * f), d0 * (1 + hang.flare * spread * f)];
          const u = Math.max(0, Math.min(1, (first[0][1] - y) / (first[0][1] - hemY || 1)));
          return reachOf.map((e, j) => first[j < 2 ? 3 : 4] + (e - first[j < 2 ? 3 : 4]) * u);
        };
        // top down: from the shoulders, their section and the chest's — cloth hung from the shoulders falls from the
        // chest, it doesn't go in at the waist (the waist's, turned with the spine just above the hips' level, would crease
        // it too); from the waist, none: it begins with its level section there
        const tops = (hang.from === 'shoulders' ? around.slice(3) : []).reverse();
        const rings = tops.map(s => (st.straight
          ? oval(widths(s[0][1]), n2, st.square).map(([x, z]) => add(s[0], add(add(mul(s[1], x), mul(s[2], z)), s[5] ? mul(s[5], (x / s[3]) ** 2) : [0, 0, 0])))
          : ringOf(s, n2, st.square)));
        // (with no section of the trunk's waist: each section round the trunk's lower sections too, what of them is above
        // the next one, and round its own sections above — falling from them: bent over, from the chest; over a lap, down
        // to it)
        // (the trunk's belt too — between the pelvis and the waist, wider than the waist: a section at its height holds it)
        const girth = [mix(around[1][0], around[2][0], 0.5), around[2][1], around[2][2], (around[1][3] + around[2][3]) / 2, (around[1][4] + around[2][4]) / 2];
        const held = [...around.slice(0, 2), girth, around[2]].flatMap(s2 => ringOf(s2, 16, st.square)), fall = rings.flat();
        const waistY = Math.max(top + 0.02 * fit.h, around[2][0][1]);
        // (first a section at the waist, as the rest — holding only what is above the next, the lap below it; unless
        // straight, two more between it and the hips' top, for the curve over the hips whatever the length below)
        const over = st.straight ? 1 : 3, hipY = q => top + (waistY - top) * q / over;
        for (let r = -over; r <= steps; r++) {
          const f = Math.max(0, r) / steps, y = r < 0 ? hipY(-r) : Math.max(lift, top - span * f);
          // (each section swings to and fro, late; its height is where the cloth hangs to now — off a lap, at once)
          // (lying, each section goes round the legs where they are at its height: the cloth along them, not hanging
          // from the hips)
          const sw = lain ? legsMid(y) : swing(`hem${i}.${r}`, [hips[0], y, hips[2]], dt, 220 - 120 * f), c = [sw[0], y, sw[2]];
          // (what a section holds: down to the next one — over the hips, unless straight, a third of the way: the waist
          // keeps close to the body, the curve over the hips is the next ones')
          const floor = r < 0 ? (st.straight ? top + 0.005 : hipY(-r - 1) - 0.01) : y - span / steps - 0.01;
          // (the waist's sections, unless straight, round the body there only — not the hips' outline, not the tops of the
          // thighs, which the pelvis holds there: a dress keeps its waist)
          const pts = [...(r < 0 && !st.straight ? [] : [...oval(widths(y, f), 24, st.straight ? st.square : 2), ...legsAt(c, floor)]), ...[...(lain && y < top ? [] : held), ...((lap.length || lain) && y < top ? [] : fall)].filter(p => p[1] >= floor).map(p => { const v = sub(p, c); return [dot(v, sd) * 1.03, dot(v, fw) * 1.03]; })];
          // (round the inner layers there, a little off them — draped, as far as it reaches)
          for (const o of inner) {
            const j = o.findIndex(([y2], q) => q > 0 && y2 <= y);
            if (j < 0 || o[0][0] < y) continue;
            const u = (o[j - 1][0] - y) / (o[j - 1][0] - o[j][0] || 1);
            o[j][1].forEach(([x, z], q) => {
              const p = [(o[j - 1][1][q][0] + (x - o[j - 1][1][q][0]) * u) * 1.03, (o[j - 1][1][q][1] + (z - o[j - 1][1][q][1]) * u) * 1.03];
              if (!st.drape || reaches(add(c, add(mul(sd, p[0]), mul(fw, p[1]))), 0)) pts.push(p);
            });
          }
          // folds: the section waved round, the more the lower; a ragged hem: its tatters hanging lower, here and there;
          // pleats: knife pleats, the more the lower — each a face going out over three of its points, then a narrow one
          // folding back in
          const fold = st.folds && hang.folds !== false && !hang.pleats ? st.folds : null, tatter = st.ragged && hang.ragged && r === steps;
          // (taken round from within: the hips' centre — or, it outside, the section round the trunk leaning back, its
          // own middle)
          const hull = hull2(pts), o = hull.every((p, q) => { const p2 = hull[(q + 1) % hull.length]; return p[0] * p2[1] - p[1] * p2[0] >= 0; })
            ? [0, 0] : [0, 1].map(e => hull.reduce((sum, p) => sum + p[e], 0) / hull.length);
          const outline = along(hull.map(([x, z]) => [x - o[0], z - o[1]]), n2).map(([x, z]) => [x + o[0], z + o[1]]).map(([x, z], q) => {
            const g = (fold ? 1 + fold.depth * f ** 1.5 * Math.sin(q / n2 * Math.PI * 2 * fold.n + 0.7) : 1) * (hang.pleats ? 1 + 0.06 * f * (q % 4 * 2 / 3 - 1) : 1);
            return [x * g, z * g];
          });
          outlines.push([y, outline]);
          below.push(outline.map(([x, z], q) => {
            const drop = tatter ? st.ragged * length * (0.5 + 0.5 * Math.sin(q * 2.399) * Math.sin(q * 0.73 + 1.3)) : 0;
            return add(c, add(add(mul(sd, x), mul(fw, z)), [0, -Math.min(drop, Math.max(0, y - lift)), 0]));
          }));
        }
        inner.push(outlines);
        outer = [...rings, ...below];
        if (hang.from === 'shoulders') worn3 = [...rings, below[0]];
        // (pleats' edges sharp: each point twice, a face of its own on either side — the faces folding back in, in the
        // fold's shade)
        const all = [...rings, ...below].map(ring => (hang.pleats ? ring.flatMap(p => [p, p]) : ring));
        const shade = color.map(v => v * 0.78), tints = hang.pleats ? [...all.map(ring => ring.map((_, j) => ((j >> 1) % 4 === (j % 2 ? 3 : 0) ? shade : color))), [color], [color]] : color;
        // (open at the hem, as cloth is: a section round two legs is no shape to close with one point)
        Mg.rings(all, tints, hang.from === 'shoulders' ? P('Neck1') : null, null);
        // a lap: the cloth along the lying thighs from the hips — round each one's top, bridging between the two only
        // along their tops — as far as it reaches, no further than the thigh is straight (its end an edge lying on it);
        // what is left there falls from the knees' front. A thin sheet: its way across and back a little within
        if (lap.length) {
          const off = 0.012 * fit.h + i * 0.008 * fit.h, thin = 0.004 * fit.h, steps2 = 6;
          const along2 = lap.map(s => {
            const a0 = P(`${s}Leg`), a1 = P(`${s}Shin`), a2 = P(`${s}Foot`), len = Math.hypot(...sub(a1, a0)) || 1e-6, t = mul(sub(a1, a0), 1 / len);
            const upT = unit(sub([0, 1, 0], mul(t, t[1]))), side0 = cross(t, upT), outT = dot(side0, sub(a0, hips)) > 0 ? side0 : mul(side0, -1);
            const rad = u => thick(leg, u) + off, axis = u => add(a0, mul(t, len * u)), top3 = u => add(axis(u), mul(upT, rad(u)));
            // (straight to the knee — a bar's corner is the joint; a tube rounds it from a third of the shorter bone
            // before — and the knee's front: as far before as the leg there reaches, its thickness out)
            const shinLen = Math.hypot(...sub(a2, a1)) || 1e-6, round2 = st.rigid ? 0 : Math.min(len, shinLen) / 3, most = 1 - round2 / len;
            const tl = level(t), dn = mul(sub(a2, a1), 1 / shinLen), knee = Array.from({ length: 5 }, (_, q) => {
              const v = q / 4, ka = sub(a1, mul(t, round2)), kb = add(a1, mul(dn, round2));
              return add(add(mul(ka, (1 - v) ** 2), mul(a1, 2 * (1 - v) * v)), mul(kb, v * v));
            });
            const front = Math.max(...knee.map(p => dot(sub(p, a0), tl))) + thick(leg, 1) + off;
            let lo = 0, hi = most;
            if (reaches(top3(hi), 0)) lo = hi;
            else for (let q = 0; q < 10; q++) { const m = (lo + hi) / 2; if (reaches(top3(m), 0)) lo = m; else hi = m; }
            const over = add(top3(most), mul(tl, front - dot(sub(top3(most), a0), tl)));
            const left = lo >= most ? cloth - Math.hypot(...past(over, 0)) : 0;
            return { t, tl, a0, upT, outT, rad, axis, end: lo, left, front };
          });
          // (round a thigh from its outer side, a little below its middle, over its top, to its inner side — or, alone,
          // on round to its other side)
          const arc = ({ upT, outT, rad, axis }, u, from, to) => Array.from({ length: 7 }, (_, q) => {
            const th = from + (to - from) * q / 6, d = add(mul(outT, Math.cos(th)), mul(upT, Math.sin(th)));
            return [add(axis(u), mul(d, rad(u))), mul(d, -1)];
          });
          const lo2 = -0.6, cross2 = (L2, u) => (L2.length === 2 ? [...arc(L2[0], u * L2[0].end, lo2, 2.45), ...arc(L2[1], u * L2[1].end, 2.45, lo2)] : arc(L2[0], u * L2[0].end, lo2, Math.PI - lo2));
          const sheet = path => [...path.map(([p]) => p), ...path.map(([p, d]) => add(p, mul(d, thin))).reverse()];
          const rs = Array.from({ length: steps2 + 1 }, (_, q) => cross2(along2, q / steps2));
          const left = Math.min(...along2.map(l => l.left));
          if (left > 0.03 * fit.h) {
            // (before the knees, then down by what is left, to a level hem)
            const end = rs[steps2], idx = along2.length === 2 ? q => (q < 7 ? 0 : 1) : () => 0;
            const front = end.map(([p], q) => { const l = along2[idx(q)]; return [add(p, mul(l.tl, Math.max(0, l.front - dot(sub(p, l.a0), l.tl)))), mul(l.tl, -1)]; });
            const hemY2 = Math.max(lift, Math.max(...front.map(([p]) => p[1])) - left);
            rs.push(front, front.map(([p, d]) => [[p[0], Math.min(p[1], hemY2), p[2]], d]));
          }
          Mg.rings(rs.map(sheet), color, null, null);
        }
      }
      if (lain) {
        lain.lay();
        lain.back(Mg.p);
        // (what is worn round them — kept clear of by hair, by parts — laid down too: each section once)
        for (const r of new Set([...(outer ?? []), ...(worn3 ?? [])])) r.forEach((q, j) => { r[j] = lain.point(q); });
        const base = M.p.length / 3;
        M.p.push(...Mg.p); M.c.push(...Mg.c); M.s.push(...Mg.s); M.i.push(...Mg.i.map(v => v + base));
      }
      // what hangs over what is worn — long straight hair, a ponytail, a scarf's end — kept out of it: a point behind
      // its back (s = -1) or before it (s = 1), r further, while it is beside it (bent over, they hang free); its
      // sections (the outer garment's, or the trunk's — closed at the neck), each as far before and behind the chest as
      // it reaches, up it
      const uc = up('Chest'), fc = fwd('Chest'), o3 = P('Chest'), nk = sub(P('Neck1'), o3);
      const faces = [...(outer ?? trunk(1).map(s => ringOf(s, 16, st.square))).map(ring => {
        const d = ring.map(p => dot(sub(p, o3), fc));
        return [dot(sub(mean(ring), o3), uc), Math.max(...d), Math.min(...d)];
      }), [dot(nk, uc), dot(nk, fc), dot(nk, fc)]].sort((a, b) => a[0] - b[0]);
      const clear = (p, s, r) => {
        const v = sub(p, o3), u = dot(v, uc), i = faces.findIndex(([x], j) => j > 0 && x >= u);
        if (u < faces[0][0] || i < 0) return p;
        const w = (u - faces[i - 1][0]) / (faces[i][0] - faces[i - 1][0] || 1), at = j => faces[j][s > 0 ? 1 : 2];
        const gap = s * (dot(v, fc) - (at(i - 1) + (at(i) - at(i - 1)) * w));
        return gap < r ? add(p, mul(fc, s * (r - gap))) : p;
      };
      // what the look puts on it: its garment's own (a collar, a panel), its hair (none under a hood), its face, a hat
      // (none over a hood), its parts — each drawn on the figure as it is now (what swings from it — hair, a bag — lies
      // on the floor where it would hang through it: long hair under the head of one lying down)
      let marking = false;
      const F = {
        look: L, style: st, colors: col, fit, k, sides, P, fwd, side, up,
        head: { at: head, axes: [hs, hu, hf], egg, r: rh, out, sides: hsides, square: st.headSquare, on },
        trunk, ringOf, worn: worn3, clear, swing: (name, target, stiff) => { const q = swing(name, target, dt, stiff); return q[1] < 0.01 * fit.h ? [q[0], 0.01 * fit.h, q[2]] : q; },
        ball: (...a) => ball(M, ...a), cap: (...a) => cap(M, ...a), tube: (...a) => tube(M, ...a), bar: (...a) => bar(M, ...a),
        shell: (...a) => shell(M, ...a), rings: (...a) => M.rings(...a),
        // (a point a part marks where it draws it: a person's '#name' point like the others)
        point: (name, p) => { if (marking) marked[name] = [p[0], p[1], p[2]]; },
      };
      G.draw?.(F);
      if (!L.hood) T.hair[L.hair]?.draw?.(F);
      T.faces[L.face]?.draw?.(F);
      if (!L.hood) T.hats[L.hat]?.draw?.(F);
      for (const name of [...(L.hood ? ['hood'] : []), ...(L.scarf ? ['scarf'] : [])]) T.parts[name]?.draw?.(F);
      // (and how far what they have with them reaches: round them, up and down — their card keeps room for it)
      const from = M.p.length;
      marked = {}; marking = true;
      for (const name of L.parts) T.parts[name]?.draw?.(F);
      marking = false;
      reach = null;
      for (let i = from; i < M.p.length; i += 3) {
        const x = M.p[i], y = M.p[i + 1], z = M.p[i + 2], r = Math.hypot(x, z);
        reach ||= { r, top: y, low: y };
        reach.r = Math.max(reach.r, r); reach.top = Math.max(reach.top, y); reach.low = Math.min(reach.low, y);
      }
      return M;
    };

    return {
      sk, fit: () => fit,
      scale: L => { wear(L); return fit.kr; },
      // the figure at frame t (posed then) as a mesh: made once for a token (people.js: once a frame — their card asks
      // how far it reaches before it is drawn), each time without one
      mesh(t, L, tok = null) {
        if (tok != null && tok === token && made) return made;
        token = tok;
        wear(L);
        sk.pose(t, fit);
        return (made = build(t, L));
      },
      // how far the parts they have with them reach in the mesh made last (metres, their own space: round their anchor,
      // the highest and the lowest) — null with none
      reach: () => reach,
      // the points the parts they have with them mark in the mesh made last (F.point: {name: [x, y, z]}, metres, their own
      // space)
      marks: () => marked,
    };
  }

  function make(gl, sk, fig = figure(sk)) {
    sk = fig.sk;
    const prog = programOf(gl);
    const u = n => gl.getUniformLocation(prog, n), vao = gl.createVertexArray(), bufs = {};
    gl.bindVertexArray(vao);
    for (const name of ['at', 'normal', 'tint', 'soft']) {
      bufs[name] = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufs[name]);
      const loc = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, { tint: 4, soft: 1 }[name] ?? 3, gl.FLOAT, false, 0, 0);
    }
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bindVertexArray(null);
    const ink = MooodInk.make(gl);

    return {
      scale: fig.scale,
      ground: L => tablesOf(L.cast).grounds[L.ground],
      render([x, y, w, h], k, t, L, cam, world, scene = null) {
        const M = fig.mesh(t, L, scene?.token), fit = fig.fit();
        const T = tablesOf(L.cast), g = T.grounds[L.ground], st = T.styles[L.style];
        const under = meshes();
        if ((L.paint === 'clay' || L.paint === 'lit') && !scene) {
          const feet = ['Left', 'Right'].map(s => sk.T.slice(sk.at[`${s}Foot`] * 3, sk.at[`${s}Foot`] * 3 + 3)), c = mix([...feet[0]], [...feet[1]], 0.5);
          const reach = Math.max(0.22 * fit.h, Math.hypot(feet[0][0] - feet[1][0], feet[0][2] - feet[1][2]) / 2 + 0.14 * fit.h), bg = hex(g.bg);
          const rings = [1, 0.8, 0.6, 0.35, 0.12].map(f => Array.from({ length: 32 }, (_, q) => [c[0] + reach * f * Math.cos(q / 16 * Math.PI), 0.001, c[2] + reach * f * 0.75 * Math.sin(q / 16 * Math.PI)]));
          under.rings(rings, [...[1, 0.8, 0.6, 0.35, 0.12].map(f => Array(32).fill(bg.map(v => v * (1 - 0.16 * (1 - f) ** 0.7)))), [bg], [bg.map(v => v * 0.84)]], null, [c[0], 0.001, c[2]]);
        }
        const pos = new Float32Array(M.p), idx = new Uint32Array(M.i), nrm = new Float32Array(pos.length);
        for (let f = 0; f < idx.length; f += 3) {
          const a = idx[f] * 3, b = idx[f + 1] * 3, c = idx[f + 2] * 3;
          const e = cross([pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]]);
          for (const v of [a, b, c]) { nrm[v] += e[0]; nrm[v + 1] += e[1]; nrm[v + 2] += e[2]; }
        }
        ink.begin([x, y, w, h], k >= 2 ? 1 : 2, scene ? null : hex(g.bg));
        world();
        gl.useProgram(prog);
        gl.uniform1i(u('ground'), 0); gl.uniform1i(u('scene'), scene?.lit ? 1 : 0);
        gl.uniformMatrix3fv(u('world'), false, scene ? scene.world : [1, 0, 0, 0, 1, 0, 0, 0, 1]);
        gl.uniformMatrix4fv(u('view'), false, cam.V);
        gl.uniform1i(u('paint'), { silhouette: 0, flat: 1, toned: 2, rim: 3, clay: 4, lit: 5 }[L.paint] ?? 1); gl.uniform1i(u('facets'), st.facets ? 1 : 0);
        gl.uniform3fv(u('light'), hex(g.light ?? '#ffffff')); gl.uniform3fv(u('bg'), hex(g.bg)); gl.uniform1f(u('haze'), g.haze ?? 0); gl.uniform1f(u('tall'), fit.h);
        const sources = scene?.light;
        gl.uniform1i(u('sourced'), sources ? 1 : 0);
        gl.uniform3fv(u('key'), sources ? sources.key : unit(add(add(mul(cam.right, -0.5), mul(cam.up, 0.75)), mul(cam.back, 0.45))));
        gl.uniform3fv(u('back'), sources ? sources.back : unit(add(add(mul(cam.right, 0.8), mul(cam.up, 0.35)), mul(cam.back, -0.45))));
        if (sources) { gl.uniform3fv(u('amb'), sources.amb); gl.uniform3fv(u('lit1'), sources.keyCol); gl.uniform3fv(u('lit2'), sources.backCol); }
        MooodInk.SHADED.set(gl, prog, sources);
        gl.uniform3fv(u('eye'), cam.eye); gl.uniform3fv(u('ink'), hex(g.ink)); gl.uniform3fv(u('rim'), hex(g.rim));
        gl.bindVertexArray(vao);
        for (const [name, data] of [['at', pos], ['normal', nrm], ['tint', new Float32Array(M.c)], ['soft', new Float32Array(M.s)]]) { gl.bindBuffer(gl.ARRAY_BUFFER, bufs[name]); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW); }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STREAM_DRAW);
        gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_INT, 0);
        if (under.i.length) {
          gl.uniform1i(u('ground'), 1);
          for (const [name, data] of [['at', new Float32Array(under.p)], ['normal', new Float32Array(under.p.length).fill(0)], ['tint', new Float32Array(under.c)], ['soft', new Float32Array(under.s)]]) {
            gl.bindBuffer(gl.ARRAY_BUFFER, bufs[name]); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
          }
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(under.i), gl.STREAM_DRAW);
          gl.drawElements(gl.TRIANGLES, under.i.length, gl.UNSIGNED_INT, 0);
        }
        gl.bindVertexArray(null);
        ink.end([x, y, w, h], { width: L.line && L.paint !== 'silhouette' && L.paint !== 'rim' ? st.line * k : 0, color: hex(g.ink), differ: 0.06, tint: st.tinted ? 1 : 0, ...scene });
      },
    };
  }

  // the figure's vectors, for a world's parts: [x, y, z]
  const V = { add, sub, mul, dot, cross, mix, unit, level, mean };
  globalThis.MooodShapes = { look, figure, make, tablesOf, bodyOf, names, STYLES, CHARACTERS, GARMENTS, HAIR, HATS, FACES, PARTS, PAINTS, GROUNDS, ARMS, LEGS, BODY, V };
})();
