// People in a scene: an element with "person" is someone standing in it — drawn in 3D as the scene's camera sees
// them (a figure of shapes: shapes.js, or a body: figure.js), moved by motions Kimodo made, lit by the scene's light,
// in front of and behind what is round them pixel by pixel. Who they are and how they move is the world's: its cast
// (a module the element names — its data: the motions, the characters, the styles…) over what the engine has.
// How they move is the scene's state (engine.js keeps it, scenestate.js moves it): where they stand (the element's
// place, as any element's), and keys of their own — <id>_do: what they do (a motion's name, or {motion, loop, from, going});
// <id>_turn: where they face standing (degrees: 0 away from the camera at the start, 90 to its right, 180 towards
// it); <id>_look: what they look at; <id>_reach: what their hands reach for ({r, l}); <id>_with: what of their parts
// they have with them now (a guitar in their hands); <id>_mood: the face's expression (a body's; a figure of shapes' face `simple`); <id>_talk: talking
// (0…1). Going from one place to another they walk (the cast's gait, its steps as long as the way gone: feet that never
// slide), facing the way they go. A motion done once leaves them where it ends: their place and their turn are its
// end's (it begins where it takes them from — startOf says where that is).
//   MooodPeople.load() → a promise: the engine's part of it (the skeleton, the figures, the bodies' files)
//   MooodPeople.make(spec element, cast) → a person: {look, height, update(t, at, keys, ground), points(), point(name),
//     startOf(motion, turn), …}
//   MooodPeople.draw(gl, person, view) → {tex, aux, r}: the person drawn into a texture of theirs, as the card of
//     their element is shown now (view: {m, r, k, cam, W, H, yh, at, lit, dpr, sources, paint}); r — the region of the stage
//     it holds (as much as asked, or a little more) — world.js
//   MooodPeople.silhouette(person, H), .inkAt(person, x, y, rad, H) — what of them was drawn last (pick.js: the selection's
//     glow round them, what is picked where they are)
(function () {
  const HERE = globalThis.document?.currentScript?.src ?? location.href;  // (a page's script, or the scene's thread's: thread.js)
  const EYE = 1.7;
  const FPS = 30;  // the clock the figures go by (frames of a second: their springs, their cloth)

  // ── loading ───────────────────────────────────────────────────────────

  // SOMA's joints, in the order of soma.bin and of Kimodo's motions
  const NAMES = ['Hips', 'Spine1', 'Spine2', 'Chest', 'Neck1', 'Neck2', 'Head', 'HeadEnd', 'Jaw', 'LeftEye', 'RightEye',
    ...['Left', 'Right'].flatMap(s => [`${s}Shoulder`, `${s}Arm`, `${s}ForeArm`, `${s}Hand`, ...['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']
      .flatMap(f => [...(f === 'Thumb' ? [1, 2, 3] : [1, 2, 3, 4]), 'End'].map(i => `${s}Hand${f}${i}`))]),
    ...['Left', 'Right'].flatMap(s => ['Leg', 'Shin', 'Foot', 'ToeBase', 'ToeEnd'].map(b => `${s}${b}`))];
  // Kimodo's body (soma.bin) and its T-pose's rotations, once the scripts are here
  let loading = null, base = null;
  // a script of the engine's, loaded: on a page, a <script>; in the scene's thread, imported
  const script = src => (globalThis.document ? new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error(`${src}: not loaded`));
    document.head.append(s);
  }) : Promise.resolve().then(() => importScripts(String(src))));
  const load = () => (loading ??= (globalThis.MooodMotion ? Promise.resolve() : script(new URL('motion.js', HERE))).then(() => MooodMotion.body()).then(B => {
    base = { B, rest: MooodSkeleton.make(B, { n: 1, fps: FPS, names: NAMES, sample() {} }).quat };
  }));

  // The engine's own motions (people/<name>.json, made by Kimodo), each fetched when a person
  // first needs it — a world's cast has its own over them
  const LIBRARY = { stand: 'stands', walk: 'walks' };
  const library = {}, got = {};
  const read = url => new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('GET', url); x.responseType = 'text';
    x.onload = () => (x.status === 200 || x.status === 0 ? resolve(x.response) : reject(new Error(`${url}: ${x.status}`)));
    x.onerror = () => reject(new Error(`${url}: not read`));
    x.send();
  });
  const fromLibrary = name => (library[name] ??= read(new URL(`people/${name}.json`, HERE)).then(text => { got[name] = JSON.parse(text); }));

  // ── quaternions [x, y, z, w] ─────────────────────────────────────────

  const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const qconj = q => [-q[0], -q[1], -q[2], q[3]];
  const qrot = (q, v) => { const t = qmul(qmul(q, [...v, 0]), qconj(q)); return [t[0], t[1], t[2]]; };
  const yawQ = a => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];
  // (into out at o: a turned by yaw y — yq its quaternion)
  const yawInto = (out, o, yq) => {
    const x = out[o], y = out[o + 1], z = out[o + 2], w = out[o + 3], s = yq[1], c = yq[3];
    out[o] = c * x + s * z; out[o + 1] = c * y + s * w; out[o + 2] = c * z - s * x; out[o + 3] = c * w - s * y;
  };
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const qnorm = q => { const l = Math.hypot(...q); return q.map(v => v / l); };
  const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul3 = (v, k) => [v[0] * k, v[1] * k, v[2] * k];
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), unit3 = v => mul3(v, 1 / (Math.hypot(...v) || 1));
  const smooth = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  // the turn taking direction a to b (unit vectors)
  const turnOf = (a, b) => { const ax = cross3(a, b), cs = dot3(a, b); return Math.hypot(...ax) < 1e-9 ? [0, 0, 0, 1] : qnorm([ax[0], ax[1], ax[2], 1 + cs]); };
  // A x = b, three by three (Cramer's)
  const solve3 = (A, b) => {
    const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const d = det(A) || 1e-12;
    return [0, 1, 2].map(c => det(A.map((row, r) => row.map((v, k) => (k === c ? b[r] : v)))) / d);
  };
  // (a weight going toward what it is to be, at most `rate` a second)
  const toward = (v, to, rate, dt) => v + Math.max(-rate * dt, Math.min(rate * dt, to - v));

  // ── turning the posed skeleton (skeleton.js: R, T after pose) ───────────
  // the joints at and below joint i
  const P3 = (sk, i) => [sk.T[i * 3], sk.T[i * 3 + 1], sk.T[i * 3 + 2]];
  const ALL = sk => (sk.all ??= Array.from({ length: sk.J }, (_, i) => i));
  const below = (sk, i) => {
    const kids = sk.below ??= [];
    return kids[i] ??= [i, ...Array.from({ length: sk.J }, (_, k) => k).filter(k => { for (let q = sk.parent[k]; q >= 0; q = sk.parent[q]) if (q === i) return true; return false; })];
  };
  // the joints `js` turned about point c, as much (w) of the turn taking direction a to b as is asked
  function turnJoints(sk, js, c, a, b, w = 1) {
    const T = sk.T, R = sk.R;
    a = unit3(a); b = unit3(b);
    const ax = cross3(a, b), cs = dot3(a, b);
    if (Math.hypot(...ax) < 1e-7) return;
    const full = qnorm([ax[0], ax[1], ax[2], 1 + cs]), q = w >= 1 ? full : qnorm([full[0] * w, full[1] * w, full[2] * w, 1 - w + full[3] * w]);
    for (const k of js) {
      const p = qrot(q, [T[k * 3] - c[0], T[k * 3 + 1] - c[1], T[k * 3 + 2] - c[2]]);
      T[k * 3] = c[0] + p[0]; T[k * 3 + 1] = c[1] + p[1]; T[k * 3 + 2] = c[2] + p[2];
      const m = [0, 1, 2].map(col => qrot(q, [R[k * 9 + col], R[k * 9 + 3 + col], R[k * 9 + 6 + col]]));
      for (let r = 0; r < 3; r++) for (let col = 0; col < 3; col++) R[k * 9 + r * 3 + col] = m[col][r];
    }
  }
  // a limb (three joints: its root, its bend, its end) reaching for `goal` — the root's bone turned, then the bend's,
  // in the plane the limb bends in now; what is below the end as it was turned (a sole, a hand) if `keep`
  function reach(sk, [a, b, c], goal, keep) {
    const P = i => [sk.T[i * 3], sk.T[i * 3 + 1], sk.T[i * 3 + 2]];
    const end = below(sk, c), kept = keep ? end.map(k => sk.R.slice(k * 9, k * 9 + 9)) : null;
    const root = P(a), bend = P(b), tip = P(c), la = dist3(root, bend), lb = dist3(bend, tip);
    const lc = Math.max(Math.abs(la - lb) + 1e-4, Math.min(dist3(root, goal), la + lb - 1e-4)), d = unit3(sub3(goal, root));
    const off = sub3(sub3(bend, root), mul3(d, dot3(sub3(bend, root), d))), pole = Math.hypot(...off) > 1e-6 ? unit3(off) : unit3(sub3(bend, root));
    const ca = Math.max(-1, Math.min(1, (la * la + lc * lc - lb * lb) / (2 * la * lc))), to = add3(root, add3(mul3(d, la * ca), mul3(pole, la * Math.sqrt(1 - ca * ca))));
    turnJoints(sk, below(sk, a), root, sub3(bend, root), sub3(to, root));
    const b2 = P(b);
    turnJoints(sk, below(sk, b), b2, sub3(P(c), b2), sub3(goal, b2));
    if (keep) end.forEach((k, q) => sk.R.set(kept[q], k * 9));
  }

  // ── a motion, made ready to be played ─────────────────────────────────
  // Its frames' rotations and the pelvis's place; where it faces each frame (the pelvis's forward, levelled; lying, the
  // way along the body) and its way over the floor, both smoothed over a second (what is left: the sway of its steps);
  // and its best loop — the stretch whose last frame is most like its first, the way gone set aside (a walk's two steps,
  // a breath).

  const ready = new WeakMap();
  function prepared(m, rest) {
    if (ready.has(m)) return ready.get(m);
    const bytes = b64 => Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
    const J = (m.names || NAMES).length, n = m.n, q = new Int16Array(bytes(m.q).buffer), pos = new Int16Array(bytes(m.p ?? m.p0).buffer), step = m.p ? J : 1;
    const root = Float32Array.from({ length: n * 3 }, (_, i) => pos[Math.floor(i / 3) * step * 3 + i % 3] / 1000);
    const rest0 = qconj(rest.slice(0, 4));
    // (lying, the pelvis's forward points up or down and says nothing of where they face: its up — the way to the head —
    // takes over as it does, face down, and against it on the back: where the feet are — so a body pitched any way
    // faces where it faced standing)
    const heading = Float32Array.from({ length: n }, (_, f) => {
      const g = qmul([q[f * J * 4], q[f * J * 4 + 1], q[f * J * 4 + 2], q[f * J * 4 + 3]].map(v => v / 32767), rest0), d = qrot(g, [0, 0, 1]), u = qrot(g, [0, 1, 0]);
      return Math.atan2(d[0] - d[1] * u[0], d[2] - d[1] * u[2]);
    });
    for (let f = 1; f < n; f++) heading[f] = heading[f - 1] + wrap(heading[f] - heading[f - 1]);  // (unwrapped)
    const half = Math.round(m.fps / 2), avg = (a, f, k = 1, o = 0) => {
      let s = 0, c = 0;
      for (let g = Math.max(0, f - half); g <= Math.min(n - 1, f + half); g++) { s += a[g * k + o]; c++; }
      return s / c;
    };
    const way = Float32Array.from({ length: n }, (_, f) => avg(heading, f));
    const path = Float32Array.from({ length: n * 2 }, (_, i) => avg(root, i >> 1, 3, (i & 1) * 2));
    const M = { J, n, fps: m.fps, q, root, heading, way, path, loop: null };
    M.loop = loopOf(M);
    // (walked in — a gait — the stretch where it goes: a sidestep standing still a moment before it sets off loops on
    // its steps, not on the standing; one whose best loop goes, on that)
    M.walk = M.loop.stride / ((M.loop.b - M.loop.a) / M.fps) >= 0.15 ? M.loop : loopOf(M, true);
    ready.set(m, M);
    return M;
  }

  // a frame of motion M as played on the spot (its way and its turn taken out: 'loop' — its smoothed way at that very
  // frame; 'once' — where it ends: done once, it leaves them where they are, facing as they face), into Q (rotations)
  // and R (the pelvis), weighted w with what they hold (nlerp)
  function frameOf(M, u, mode, Q, R, w) {
    const f = Math.max(0, Math.min(M.n - 1, u)), a = Math.floor(f), b = Math.min(M.n - 1, a + 1), t = f - a, J = M.J, q = M.q, e = M.n - 1;
    const yaw = mode === 'loop' ? M.way[a] * (1 - t) + M.way[b] * t : M.heading[e], yq = yawQ(-yaw);
    const ox = mode === 'loop' ? M.path[a * 2] * (1 - t) + M.path[b * 2] * t : M.root[e * 3], oz = mode === 'loop' ? M.path[a * 2 + 1] * (1 - t) + M.path[b * 2 + 1] * t : M.root[e * 3 + 2];
    const p = [0, 1, 2].map(k => M.root[a * 3 + k] * (1 - t) + M.root[b * 3 + k] * t), r = qrot(yq, [p[0] - ox, 0, p[2] - oz]);
    const k = w >= 1 ? 0 : 1 - w;
    const tmp = [0, 0, 0, 0];
    for (let j = 0; j < J; j++) {
      const ia = (a * J + j) * 4, ib = (b * J + j) * 4;
      const sg = q[ia] * q[ib] + q[ia + 1] * q[ib + 1] + q[ia + 2] * q[ib + 2] + q[ia + 3] * q[ib + 3] < 0 ? -1 : 1;
      for (let c = 0; c < 4; c++) tmp[c] = q[ia + c] * (1 - t) + sg * q[ib + c] * t;
      yawInto(tmp, 0, yq);
      const l = Math.hypot(...tmp), o = j * 4;
      if (!k) { for (let c = 0; c < 4; c++) Q[o + c] = tmp[c] / l; continue; }
      const s = Q[o] * tmp[0] + Q[o + 1] * tmp[1] + Q[o + 2] * tmp[2] + Q[o + 3] * tmp[3] < 0 ? -w : w;
      for (let c = 0; c < 4; c++) Q[o + c] = Q[o + c] * k + s * tmp[c] / l;
      const L = Math.hypot(Q[o], Q[o + 1], Q[o + 2], Q[o + 3]);
      for (let c = 0; c < 4; c++) Q[o + c] /= L;
    }
    const y = p[1];
    if (!k) { R[0] = r[0]; R[1] = y; R[2] = r[2]; } else { R[0] = R[0] * k + r[0] * w; R[1] = R[1] * k + y * w; R[2] = R[2] * k + r[2] * w; }
  }

  // the stretch [a, b] of a motion that loops best (0.7 s to 2.6 s long, out of its first and last quarter-second): its
  // frames on the spot most alike at both ends — and the way it goes in that time (metres; a gait's stride), and which
  // way that is from where it faces (radians: 0 forwards, π a walk backwards)
  function loopOf(M, going = false) {
    const { n, fps, J } = M, A = new Float32Array(J * 4), B = new Float32Array(J * 4), ra = [0, 0, 0], rb = [0, 0, 0];
    const lo = Math.round(0.7 * fps), hi = Math.round(2.6 * fps), edge = Math.round(0.25 * fps);
    let best = null;
    for (let a = edge; a + lo < n - edge; a += 2) {
      frameOf(M, a, 'loop', A, ra, 1);
      for (let b = a + lo; b <= Math.min(n - 1 - edge, a + hi); b++) {
        frameOf(M, b, 'loop', B, rb, 1);
        let cost = Math.abs(ra[1] - rb[1]) * 20;
        for (let j = 0; j < J; j++) cost += 1 - Math.abs(A[j * 4] * B[j * 4] + A[j * 4 + 1] * B[j * 4 + 1] + A[j * 4 + 2] * B[j * 4 + 2] + A[j * 4 + 3] * B[j * 4 + 3]);
        cost -= (b - a) / fps * 0.002;  // (of two alike, the longer: whole cycles, not half of one)
        if (going) cost -= 1.5 * Math.hypot(M.path[b * 2] - M.path[a * 2], M.path[b * 2 + 1] - M.path[a * 2 + 1]) / ((b - a) / fps);
        if (!best || cost < best.cost) best = { a, b, cost };
      }
    }
    if (!best) return { a: 0, b: n - 1, stride: 0, aside: 0 };
    const dx = M.path[best.b * 2] - M.path[best.a * 2], dz = M.path[best.b * 2 + 1] - M.path[best.a * 2 + 1], stride = Math.hypot(dx, dz);
    const aside = stride > 0.05 ? wrap(Math.atan2(dx, dz) - (M.way[best.a] + M.way[best.b]) / 2) : 0;
    return { a: best.a, b: best.b, stride, aside };
  }

  // a motion looped: at u frames from its loop's start, its seam crossfaded (the last quarter-second into the first)
  function looped(M, u, Q, R, w, L = M.loop) {
    const { a, b } = L, P = b - a, f = ((u % P) + P) % P, x = Math.min(P / 3, M.fps * 0.25);
    frameOf(M, a + f, 'loop', Q, R, w);
    if (f > P - x) frameOf(M, a + f - P, 'loop', Q, R, w * smooth((f - (P - x)) / x));
  }

  // ── a person ──────────────────────────────────────────────────────────

  const BLEND = 0.35;       // seconds one thing done goes over into the next
  const TURN = 4.5;         // radians a second they turn at most
  const LOOKING = 0.12;     // seconds the head takes to follow the eyes to a new point (most of the way)
  const HEAD_TURN = 1.22, WAIST_TURN = 0.87; // radians a head turns round from the chest (70°); the waist and the chest, more (50°)
  const REACHING = 0.5;     // seconds a hand takes from what it held to the next thing it reaches for
  const STEPS = [0.08, 0.35]; // the speed (m/s) between standing and walking
  const BOX = [-0.75, -1.25, 0.75, 0.12];  // the card's box, heights of them round their feet
  // the points the box keeps round, each with the room it leaves round it (heights): a hand's for what it holds
  const ROOM = [['head', 0.12], ['hand_r', 0.38], ['hand_l', 0.38], ['foot_r', 0.12], ['foot_l', 0.12]];
  const PART_ROOM = 0.04;   // and the room round what the parts they have with them reach (heights): their lines
  // what of them touches the floor when that joint is this low (metres, a man's 1.76 m: an ankle standing, a knee
  // kneeling, the pelvis sitting, a wrist on the floor, the head or the chest lying) — and which of them are the feet
  const TOUCH = { LeftFoot: 0.12, RightFoot: 0.12, LeftToeBase: 0.06, RightToeBase: 0.06, LeftShin: 0.14, RightShin: 0.14, Hips: 0.2, LeftHand: 0.1, RightHand: 0.1, Head: 0.16, Chest: 0.2 };
  const FEET = new Set(['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']), SIDES = ['Left', 'Right'];

  function make(o, cast = {}) {
    const p = o.person && typeof o.person === 'object' ? o.person : {};
    // what is wrong with them, said once each
    const said = new Set(), warn = text => { if (!said.has(text)) { said.add(text); (globalThis.__mooodWarnings ||= []).push(`${o.name || o.id}: ${text}`); } };
    const characters = cast.characters || {}, own = characters[p.who] || {};
    const L0 = { ...own, ...(p.look || {}) }, shapes = L0.kind === 'shapes';
    const look = shapes ? MooodShapes.look(L0, cast) : MooodFigure.look(L0, cast);
    const motions = { ...cast.motions };
    const named = name => (typeof name === 'string' && (motions[name] || LIBRARY[name]) ? name : null);
    // a motion's frames (the cast's, else the engine's — null while it is being fetched)
    const body = name => motions[name] ?? got[name] ?? (fromLibrary(name), null);
    // (what they do when nothing is said — standing, if theirs is not here)
    const does = p.does ?? cast.does ?? 'stand';
    if (!named(does)) warn(`"does": "${does}" — no such motion in its cast`);
    const gaitName = named(p.gait ?? cast.gait ?? 'walk'), standName = named(does) ?? named('stand');
    let rest = null;
    const M = name => prepared(body(name), rest);
    // what they do: the act now and the one it goes over from — {name, loop, from, at (seconds), key}
    let act = null, before = null, beforeEnd = 0;
    // moving: how fast (m/s, smoothed), the gait's phase, which way they face (radians, 0 away, + to the right); the gait
    // they walked before this one and since when (one goes over into the next); how much the gait gives way now to a
    // motion done as they go (0…1)
    const go = { at: null, t: null, speed: 0, phase: 0, phase0: 0, t0: 0, weight: 0, weight0: 0, gait: gaitName, was: null, since: 0, give: 0 };
    // looking at, reaching for (points of the world, metres: the engine's), each with how much of it there is now (a
    // head turns to it and back, a hand goes out to it and comes back, over a moment); the parts they have with them
    const aim = { look: null, lookTo: null, lookW: 0, r: null, rW: 0, l: null, lW: 0, foot_r: null, foot_rW: 0, foot_l: null, foot_lW: 0, over: {} };
    let parts = look.parts ? [...look.parts] : null, worn = '';
    let facing = ((p.turn ?? 180) * Math.PI) / 180;

    const actOf = (v, t) => {
      const d = typeof v === 'string' ? { motion: v } : v && typeof v === 'object' ? v : { motion: standName };
      const name = named(d.motion) ?? (d.motion != null && d.motion !== standName ? (warn(`"${d.motion}" — no such motion in its cast`), standName) : standName);
      // (one being fetched: what was done goes on till it is here)
      const loop = d.loop ?? name === standName;
      return name && body(name) && { name, loop, going: !loop && d.going === true, from: Number(d.from) || 0, at: t, key: JSON.stringify(d) };
    };
    // (a motion done once as they go: still being played)
    const playing = A => A && A.going && (A.from + clockT - A.at) * M(A.name).fps < M(A.name).n - 1;
    // a pose of an act at time t, into Q, R (weight w)
    const actPose = (A, t, Q, R, w) => {
      const m = M(A.name), u = (A.from + t - A.at) * m.fps;
      if (A.loop) looped(m, u, Q, R, w); else frameOf(m, u, A.going ? 'loop' : 'once', Q, R, w);
    };

    // the skeleton's player: at frame t (of the person's clock), all they do mixed
    const src = {
      n: Infinity, fps: FPS, names: NAMES,
      sample(tf, Q, R) {
        const t = tf / FPS;
        if (!act) { for (let j = 0; j < Q.length; j += 4) Q.set(rest.subarray(j, j + 4), j); R[0] = 0; R[1] = 0.93; R[2] = 0; return; }
        actPose(act, t, Q, R, 1);
        if (before && t < beforeEnd) {
          const w = 1 - smooth((t - act.at) / BLEND);
          actPose(before, t, Q, R, w);
          if (before.shift) for (let k = 0; k < 3; k++) R[k] += before.shift[k] * w;
        }
        // walking: between the last step's time and this one's, the phase and the weight as far along
        // (giving way to a motion done as they go; a gait just taken going over from the one before — each looped on the
        // stretch where it goes)
        const k = go.t > go.t0 ? Math.max(0, Math.min(1, (t - go.t0) / (go.t - go.t0))) : 1, g = (go.weight0 + (go.weight - go.weight0) * k) * (1 - smooth(go.give));
        const phase = go.phase0 + (go.phase - go.phase0) * k, over = go.was && body(go.was) ? smooth((t - go.since) / BLEND) : 1;
        if (g > 0.001 && over < 1) { const m = M(go.was); looped(m, phase * (m.walk.b - m.walk.a), Q, R, g, m.walk); }
        if (g > 0.001 && go.gait && body(go.gait)) { const m = M(go.gait); looped(m, phase * (m.walk.b - m.walk.a), Q, R, g * over, m.walk); }
      },
    };

    // where they stand, the ground's height (metres: engine.js — the relief) and their skeleton as it is now (their
    // points: their head, their hands)
    // (held: on a seat or another's arms — not laid on the land; seat: the floor under the seat they sit on, else null)
    let figure = null, ticks = 0;
    let at = null, ground = null, bones = null, fitted = null, fetched = shapes, clockT = 0, wasHeld = false, held = false, seat = null;
    const world = v => {
      const f = facing, c = Math.cos(f), s = Math.sin(f);
      return [at.across - v[0] * c + v[2] * s, at.elevation + v[1], at.distance + v[0] * s + v[2] * c];
    };
    // a point of the world (metres) as their painting has it: metres from their anchor across their card and down it,
    // seen from the start (engine.js: e.at)
    const onCard = p => [p[0] * at.distance / p[2] - at.across, (EYE - p[1]) * at.distance / p[2] - EYE + at.elevation];
    const joint = name => world([0, 1, 2].map(k => bones.T[bones.at[name] * 3 + k]));
    // a point of the world (metres) in their own space (the skeleton's)
    const local = q => {
      const f = facing, c = Math.cos(f), s2 = Math.sin(f), x = q[0] - at.across, z = q[2] - at.distance;
      return [-x * c + z * s2, q[1] - at.elevation, x * s2 + z * c];
    };
    // each arm as the motion has it, before it reaches: {hand, shoulder} (world metres), its length — where a hand held in
    // another's can meet it
    const unreached = { r: null, l: null };
    // (a turn about the vertical: direction v by a radians, as a head's yaw goes)
    const yawed = (v, a) => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
    // how far round from the chest's forward the head is to turn to look at point q (radians, + to their left), and that forward
    const lookYaw = (sk, q) => {
      const T = sk.T, j = n => sk.at[n], P = i => [T[i * 3], T[i * 3 + 1], T[i * 3 + 2]];
      const want = unit3(sub3(local(q), P(j('Head')))), ch = sk.dir(j('Chest'), [0, 0, 1]), cf = unit3([ch[0], 0, ch[2]]), wl = unit3([want[0], 0, want[2]]);
      return { want, cf, yaw: Math.atan2(cf[2] * wl[0] - cf[0] * wl[2], dot3(cf, wl)) };
    };
    // Over the motion: the feet on the ground, the body turned at the waist to look further round than a head turns, the
    // hands to what they reach for, the head to what they look at
    src.after = (sk, fit) => {
      if (!at) return;
      feet(sk, fit);
      const T = sk.T, j = n => sk.at[n], P = i => [T[i * 3], T[i * 3 + 1], T[i * 3 + 2]];
      // (looking further round than 70° — back over a shoulder: the waist and the chest turn the rest, up to 50° more,
      // the hips going on as the motion has them)
      const w = smooth(aim.lookW);
      if (w > 0.002 && aim.look) {
        const { cf, yaw } = lookYaw(sk, aim.look), over = Math.sign(yaw) * Math.min(Math.max(0, Math.abs(yaw) - HEAD_TURN), WAIST_TURN) * w;
        if (Math.abs(over) > 1e-3) for (const [name, share] of [['Spine1', 0.3], ['Spine2', 0.3], ['Chest', 0.4]]) turnJoints(sk, below(sk, j(name)), P(j(name)), cf, yawed(cf, over * share));
      }
      for (const [h, s2] of [['r', 'Right'], ['l', 'Left']]) {
        const [a, b, c] = [`${s2}Arm`, `${s2}ForeArm`, `${s2}Hand`].map(n => P(j(n)));
        unreached[h] = { hand: world(c), shoulder: world(a), length: dist3(a, b) + dist3(b, c) };
      }
      for (const [h, s2] of [['r', 'Right'], ['l', 'Left']]) {
        const w = smooth(aim[`${h}W`]);
        if (w < 0.002 || !aim[h]) continue;
        const tip = P(j(`${s2}Hand`)), goal = local(aim[h]);
        reach(sk, [j(`${s2}Arm`), j(`${s2}ForeArm`), j(`${s2}Hand`)], [0, 1, 2].map(k => tip[k] + (goal[k] - tip[k]) * w), false);
      }
      // (a foot to what it reaches for: the leg's reach, the sole as it was turned)
      for (const [h, s2] of [['foot_r', 'Right'], ['foot_l', 'Left']]) {
        const w = smooth(aim[`${h}W`]);
        if (w < 0.002 || !aim[h]) continue;
        const tip = P(j(`${s2}Foot`)), goal = local(aim[h]);
        reach(sk, [j(`${s2}Leg`), j(`${s2}Shin`), j(`${s2}Foot`)], [0, 1, 2].map(k => tip[k] + (goal[k] - tip[k]) * w), true);
      }
      // the head turned to it, no further than a head turns (70° round from the chest's forward, 40° up or down), the
      // neck taking part of it
      if (w > 0.002 && aim.look) {
        const { want, cf, yaw: y0 } = lookYaw(sk, aim.look);
        const yaw = Math.max(-HEAD_TURN, Math.min(HEAD_TURN, y0)), pitch = Math.max(-0.7, Math.min(0.7, Math.asin(Math.max(-1, Math.min(1, want[1])))));
        const level = yawed(cf, yaw);
        const goal = add3(mul3(level, Math.cos(pitch)), [0, Math.sin(pitch), 0]);
        for (const [name, share] of [['Neck1', 0.3], ['Neck2', 0.43], ['Head', 1]]) {
          const i = j(name), now = sk.dir(j('Head'), [0, 0, 1]);
          turnJoints(sk, below(sk, i), P(i), now, goal, w * share);
        }
      }
    };
    // On uneven ground (a relief) they touch the land where the motion touches its floor. Standing, walking — the feet
    // alone: the pelvis lowered as far as the lower foot's ground is below where the motion stands (the whole of them
    // with it), the other leg bent at the knee till its foot is on its own ground (a two-bone reach), each foot as it was
    // turned. Sitting, kneeling, lying, leaning on a hand — the body as it is, laid along the land under what touches it
    // (the slope through those points, held level where they are close together) and raised till none of them is in it.
    // Off the floor (a leap): from how they lay where they last touched it to how they lie where they touch it next.
    const feet = (sk, fit) => {
      const land = !held && ground, now = land && laid(sk, fit.h), off = land && !now && act && !act.loop && between(act, fit);
      if (seat != null) floored(sk, fit);
      if (now) { lay(sk, now); if (now.feet) now.feet.forEach(([i, lift]) => lift >= 0.003 && reach(sk, [sk.at[`${SIDES[i]}Leg`], sk.at[`${SIDES[i]}Shin`], sk.at[`${SIDES[i]}Foot`]], add3(P3(sk, sk.at[`${SIDES[i]}Foot`]), [0, lift, 0]), true)); }
      else if (off) lay(sk, off);
      // (let down from a seat or another's arms into a motion done once: where they were held, left as it goes)
      const k = landing && landing.act === act ? 1 - landed(act) : 0;
      if (k > 0.001) lay(sk, { up: [0, 1, 0], t: mul3(landing.t, k) });
    };
    // Sat on a seat: the feet the motion has on its floor set on the floor under the seat, as far as the legs reach with
    // the knee still bent — a low seat, the knees up; a seat a little high, the feet down to the floor; a high one (a
    // barrel, a child on a stool it can't reach the floor from), the legs hang as the motion has them
    const floored = (sk, fit) => {
      for (const s2 of SIDES) {
        const f = sk.at[`${s2}Foot`], p = P3(sk, f);
        if (p[1] >= TOUCH[`${s2}Foot`] * fit.h) continue;
        const w = world(p), goal = [p[0], p[1] + (ground ? ground(w[0], w[2]) : 0) + seat - at.elevation, p[2]];
        const hip = P3(sk, sk.at[`${s2}Leg`]), knee = P3(sk, sk.at[`${s2}Shin`]);
        if (dist3(hip, goal) < 0.9 * (dist3(hip, knee) + dist3(knee, p))) reach(sk, [sk.at[`${s2}Leg`], sk.at[`${s2}Shin`], f], goal, true);
      }
    };
    // how far a motion done once has gone from its first pose to its last (0…1): by the hips' height, when it rises or
    // sinks (off a high seat onto the feet), else by its time — from where it was when they were let down
    let landing = null;
    const landed = A => {
      const m = M(A.name), u = Math.max(0, Math.min(m.n - 1, (A.from + clockT - A.at) * m.fps)), u0 = Math.min(landing.u, m.n - 1), e = m.n - 1;
      const y = f => { const a = Math.floor(f), b = Math.min(e, a + 1); return m.root[a * 3 + 1] + (m.root[b * 3 + 1] - m.root[a * 3 + 1]) * (f - a); };
      const y0 = y(u0), y1 = y(e);
      return smooth(Math.abs(y1 - y0) > 0.05 ? (y(u) - y0) / (y1 - y0) : (u - u0) / Math.max(1, e - u0));
    };
    // how they lie on the land as the skeleton is posed now: {up, t} — turned (the floor's up to the land's) about their
    // origin, then moved by t; feet: each foot's lift above the lower one (standing) — null: nothing of them on the floor
    const laid = (sk, h) => {
      const touch = Object.keys(TOUCH).filter(n => sk.T[sk.at[n] * 3 + 1] < TOUCH[n] * h);
      if (!touch.length) return null;
      const here = ground(at.across, at.distance), rel = p => { const w = world(p); return ground(w[0], w[2]) - here; };
      if (touch.every(n => FEET.has(n))) {
        const rise = SIDES.map(s2 => rel(P3(sk, sk.at[`${s2}Foot`]))), drop = Math.min(...rise);
        return { up: [0, 1, 0], t: [0, drop, 0], feet: rise.map((r, i) => [i, r - drop]) };
      }
      // (the slope through what touches: y = a + bx·x + bz·z, least squares, each slope held toward level by as much as
      // the points are not spread its way)
      const pts = touch.map(n => P3(sk, sk.at[n])), hs = pts.map(rel), k = 0.04 * h * h;
      let n0 = 0, sx = 0, sz = 0, sxx = 0, szz = 0, sxz = 0, sy = 0, sxy = 0, szy = 0;
      pts.forEach(([x, , z], i) => { n0++; sx += x; sz += z; sxx += x * x; szz += z * z; sxz += x * z; sy += hs[i]; sxy += x * hs[i]; szy += z * hs[i]; });
      const A = [[n0, sx, sz], [sx, sxx + k, sxz], [sz, sxz, szz + k]], b = [sy, sxy, szy], [, bx, bz] = solve3(A, b);
      const up = unit3([-bx, 1, -bz]), q = turnOf([0, 1, 0], up);
      // (raised till none of them is below the land, each as high over it as it is over the floor)
      const t = [0, Math.max(...pts.map(p => { const r = qrot(q, p); return rel(r) + p[1] - r[1]; })), 0];
      return { up, t };
    };
    // the skeleton laid so: turned about its origin, moved
    const lay = (sk, { up, t }) => {
      if (up[1] < 0.99999) turnJoints(sk, ALL(sk), [0, 0, 0], [0, 1, 0], up);
      for (let i = 0; i < sk.J; i++) for (let c = 0; c < 3; c++) sk.T[i * 3 + c] += t[c];
    };
    // off the floor in a motion done once: how they lie, between where they last touched it and where they touch it next
    // (its frames posed alone, on a skeleton of their own); null if they don't, before or after
    let alone = null;
    const between = (A, fit) => {
      const m = M(A.name), u = (A.from + clockT - A.at) * m.fps;
      alone ??= MooodSkeleton.make(base.B, { n: Infinity, fps: FPS, names: NAMES, sample(tf, Q, R) { frameOf(M(alone.motion), tf, 'once', Q, R, 1); } });
      alone.motion = A.name;
      const at2 = f => { alone.pose(f, fit); return laid(alone, fit.h); };
      let a = Math.floor(u), b = Math.ceil(u + 1e-6), la = null, lb = null;
      for (; a >= 0 && !(la = at2(a)); a--);
      for (; b < m.n && !(lb = at2(b)); b++);
      if (!la || !lb) return la || lb;
      const w = (u - a) / (b - a || 1);
      return { up: unit3(add3(mul3(la.up, 1 - w), mul3(lb.up, w))), t: add3(mul3(la.t, 1 - w), mul3(lb.t, w)) };
    };
    // (a shoulder: where the wrist of a hand laid on it is — out from the neck by the shoulder's thickness and a little
    // below its top, so the hand lies over it; behind them: the nape — where hands round their neck meet; the back — where
    // arms round them hold, between the shoulder blades; a man's, as far behind the joint as the body is thick there)
    const POINTS = { head: 'Head', hand_r: 'RightHand', hand_l: 'LeftHand', hands: ['RightHand', 'LeftHand'], chest: 'Chest', hips: 'Hips', foot_r: 'RightFoot', foot_l: 'LeftFoot', feet: 'LeftToeBase',
      shoulder_r: { joint: 'RightArm', from: 'Neck1', out: 0.08, up: -0.07 }, shoulder_l: { joint: 'LeftArm', from: 'Neck1', out: 0.08, up: -0.07 },
      nape: { joint: 'Neck1', back: 0.06 }, back: { joint: 'Spine2', back: 0.13 } };
    // (a point of theirs: a joint, or between two, or out from one — or behind it, away from where their chest faces —
    // or on a part they have with them: off a joint along its own axes, [side, up, forward] metres of a man's 1.76 m, and
    // `rise` metres straight up — the flame of a torch held upright —, or where the part marks it as it is drawn (F.point:
    // the middle of a star held on its pole between the hands))
    const pointOf = jn => {
      if (Array.isArray(jn)) return mul3(add3(joint(jn[0]), joint(jn[1])), 0.5);
      if (typeof jn !== 'object') return joint(jn);
      if (jn.mark) return world(meshNow().marks()[jn.mark]);
      if (jn.off) {
        const i = bones.at[jn.joint], k = me.height / 1.76, T = bones.T;
        const v = [0, 1, 2].map(a => T[i * 3 + a]), d = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(e => bones.dir(i, e));
        const q = [0, 1, 2].map(a => v[a] + (d[0][a] * jn.off[0] + d[1][a] * jn.off[1] + d[2][a] * jn.off[2] + (a === 1 ? jn.rise ?? 0 : 0)) * k);
        return world(q);
      }
      const j = joint(jn.joint), k = me.height / 1.76;
      if (jn.back) {
        const d = bones.dir(bones.at.Chest, [0, 0, 1]), c = Math.cos(facing), s2 = Math.sin(facing);
        return add3(j, mul3(unit3([-d[0] * c + d[2] * s2, 0, d[0] * s2 + d[2] * c]), -jn.back * k));
      }
      const o = sub3(j, joint(jn.from)), out = unit3([o[0], 0, o[2]]);
      return add3(j, [out[0] * jn.out * k, jn.up * k, out[2] * jn.out * k]);
    };
    // the points of the parts they have with them now (a part's `points`: {name: {joint, off}} — the cast's parts — and
    // those they mark where they draw them: {mark})
    const partPoints = () => {
      if (!shapes || !look.parts?.length || !bones) return {};
      const T = MooodShapes.tablesOf(look.cast).parts, out = Object.assign({}, ...look.parts.map(n => T[n]?.points || {}));
      for (const n of Object.keys(meshNow().marks())) out[n] = { mark: n };
      return out;
    };
    // (their figure of shapes as it is this frame)
    const meshNow = () => { const fig = me.figure(); fig.mesh(me.clock, look, ticks); return fig; };
    const LIMBS = [['Hips', 'Spine2', 0.17], ['Spine2', 'Neck1', 0.2], ['Neck1', 'Head', 0.07], ...['Left', 'Right'].flatMap(s => [
      [`${s}Arm`, `${s}ForeArm`, 0.06], [`${s}ForeArm`, `${s}Hand`, 0.05], [`${s}Leg`, `${s}Shin`, 0.08], [`${s}Shin`, `${s}Foot`, 0.06], [`${s}Foot`, `${s}ToeBase`, 0.05]])];
    const shade = (look.colors?.top || look.colors?.garment || '#444444');

    const me = {
      id: o.id, look, shapes, src,
      // what their look needs fetched (a body's files) — null when it is here
      // and the motions they start with
      ready() {
        const wait = [...(fetched ? [] : [MooodFigure.load(look).then(() => { fetched = true; })]),
          ...[standName, gaitName].filter(n => n && !body(n)).map(fromLibrary)];
        return wait.length ? Promise.all(wait) : null;
      },
      // their points as their painting has them: {head, hand_l, hand_r} — [x, y] (metres from their anchor)
      points() {
        if (!bones) return {};
        return Object.fromEntries(Object.entries({ ...POINTS, ...partPoints() }).map(([n, jn]) => [n, onCard(pointOf(jn))]));
      },
      // one of their points (head, hand_r, hand_l, shoulder_r, shoulder_l, hands — between them, chest, hips, foot_r, foot_l,
      // feet) in the world (metres: across, up, distance), as they were posed last — null before; offset — the same from
      // where they stand
      point(name) { const jn = bones && (POINTS[name] ?? partPoints()[name]); return jn ? pointOf(jn) : null; },
      offset(name) { const q = this.point(name); return q && at ? [q[0] - at.across, q[1] - at.elevation, q[2] - at.distance] : null; },
      // arm h ('r', 'l') as the motion has it, before it reaches, as they were posed last: {hand, shoulder} (world
      // metres), length — null before
      arm: h => unreached[h],
      // where motion `name`, done once facing `turn` (degrees) at its end, begins: [across, distance] from its end (their
      // legs' length), and the turn they face then — null while the motion is not here
      startOf(name, turn) {
        const m = named(name) && body(name) && M(name), e = m && m.n - 1;
        if (!m) return null;
        const yq = yawQ(-m.heading[e]), v = qrot(yq, [m.root[0] - m.root[e * 3], 0, m.root[2] - m.root[e * 3 + 2]]).map(x => x * this.scale);
        const f = (turn * Math.PI) / 180, c = Math.cos(f), s2 = Math.sin(f);
        return { across: -v[0] * c + v[2] * s2, distance: v[0] * s2 + v[2] * c, turn: turn + ((m.heading[0] - m.heading[e]) * 180) / Math.PI };
      },
      // their silhouette, as they stand now (g: metres from their anchor, y down) — what is picked where they are
      paint(g) {
        if (!bones) return;
        g.strokeStyle = g.fillStyle = shade; g.lineCap = 'round';
        const k = this.height / 1.76;
        for (const [a, b, w] of LIMBS) { const p = onCard(joint(a)), q = onCard(joint(b)); g.lineWidth = 2 * w * k; g.beginPath(); g.moveTo(...p); g.lineTo(...q); g.stroke(); }
        const h = onCard(joint('Head'));
        g.beginPath(); g.arc(h[0], h[1] - 0.04 * k, 0.11 * k, 0, 7); g.fill();
      },
      // their height (metres): the figure's
      get height() { return shapes ? 1.76 * (look.body?.height ?? 1) : 1.76 * this.scale; },
      // the card's box, heights of them round their feet: as wide and as tall as they are now — an arm up with a torch
      // over the head, lying full length, a lunge — with room round the hands for what is in them, and round all that the
      // parts they have with them reach now (a star on its pole over the head: their figure's mesh, made for this frame
      // here, drawn as it is) — a quarter-height at a time, so it changes seldom
      get box() {
        const h = this.height, up = v => Math.ceil(v * 4) / 4, out = [...BOX];
        const keep = (r, y, room) => {
          const w = up(r / h + room);
          out[0] = Math.min(out[0], -w); out[2] = Math.max(out[2], w);
          out[1] = Math.min(out[1], -up(y / h + room)); out[3] = Math.max(out[3], up(room - y / h));
        };
        for (const [n, room] of ROOM) {
          const q = this.offset(n);
          if (q) keep(Math.hypot(q[0], q[2]), q[1], room);
        }
        const R = look.parts?.length && this.figure() ? meshNow().reach() : null;
        if (R) { keep(R.r, R.top, PART_ROOM); keep(R.r, R.low, PART_ROOM); }
        return out;
      },
      // their figure of shapes (shapes.js: a mesh made once a frame — `tick` — for their box and their drawing); null for
      // a body, or before they are first posed
      figure: () => (shapes && bones ? (figure ||= MooodShapes.figure(MooodSkeleton.make(base.B, src))) : null),
      get tick() { return ticks; },
      facing: () => facing,
      // the moment t (seconds): at — where they stand ({across, distance, elevation}, metres), keys — the state's
      // values of theirs ({do, turn}); what they do, how fast they go and where they face, as of now; shot — which shot
      // it is (the state's cuts): in a new one they are already where it has them, doing what it says, facing as they
      // are turned, looking and reaching at what they do — no steps to where they were, nothing gone over from before
      update(now, at0, keys, groundAt, shot) {
        ground = groundAt; held = !!keys.held; seat = held && typeof keys.floor === 'number' ? keys.floor : null;
        rest ||= base.rest;
        // (their own time: it stands while they are still — the pose of that moment held, no breath, the cloth hanging as
        // it hung — and goes on from there when they are let go)
        if (keys.still && this.now != null) this.stopped += now - this.now;
        this.now = now;
        const t = now - this.stopped;
        this.clock = t * FPS; clockT = t;
        const cut = shot !== this.shot;
        this.shot = shot;
        // (a face's expression, talking — a figure of shapes' face has its expression alone, at rest when none)
        if (!shapes) { if (typeof keys.mood === 'string') look.expression = keys.mood; look.talk = !!keys.talk; }
        else look.expression = typeof keys.mood === 'string' ? keys.mood : null;
        // (what they wear now: their look's fields over it — a foot bare, a hat off; a figure of shapes')
        const wear = keys.wear && typeof keys.wear === 'object' ? JSON.stringify(keys.wear) : '';
        if (wear !== worn) {
          worn = wear;
          // (and their skeleton fitted to it again: a look of another height — the boy years later)
          if (shapes) { Object.assign(look, MooodShapes.look({ ...L0, ...(keys.wear || {}) }, cast)); parts = look.parts ? [...look.parts] : null; fitted = null; }
          else if (wear) warn('"wear" changes a figure of shapes — a body\'s clothes are its look');
        }
        // (how they walk now: a gait of theirs, the cast's by default)
        const gait = keys.gait != null ? named(keys.gait) ?? (warn(`"gait": "${keys.gait}" — no such motion in its cast`), gaitName) : gaitName;
        if (gait !== go.gait) { go.was = go.gait; go.since = t; go.gait = gait; }
        // (a new act: over from what was being done)
        const next = actOf(keys.do, t);
        if (next && (!act || next.key !== act.key)) {
          before = act; beforeEnd = t + BLEND; act = next;
          // (a motion done once begins where it takes them from: their place is its end's now, which is no step taken —
          // and what they did before goes over into it from where it was done)
          // (one done as they go — a stumble in a run — is played on the spot, their place carrying them on)
          if (!act.loop && !act.going) { if (before && go.at) before.where = go.at; go.at = null; go.speed = 0; }
        }
        if (cut) { before = null; go.at = null; go.speed = 0; go.weight = go.weight0 = 0; go.was = null; }
        // going: the way gone since the last moment, the steps as many as it takes
        const dt = go.t == null ? 0 : Math.max(0, t - go.t);
        let way = null;
        if (go.at && dt > 0) {
          const dx = at0.across - go.at.across, dz = at0.distance - go.at.distance, d = Math.hypot(dx, dz);
          go.speed += (d / dt - go.speed) * Math.min(1, dt / 0.15);
          if (d > 1e-4) way = Math.atan2(dx, dz);
          go.phase0 = go.phase; go.weight0 = go.weight;
          const m = go.gait && body(go.gait) && M(go.gait), stride = m ? Math.max(0.2, m.walk.stride) * this.scale : 1;
          go.phase += d / stride;
        }
        go.t0 = go.t ?? t; go.t = t; go.at = { ...at0 };
        // (the gait gives way to a motion done as they go while it is played, and comes back as it ends)
        go.give = cut ? (playing(act) ? 1 : 0) : toward(go.give, playing(act) ? 1 : 0, 1 / BLEND, dt);
        // (moved without steps — sliding, carried — they are moved as they are)
        go.weight = keys.steps === false ? 0 : smooth((go.speed - STEPS[0]) / (STEPS[1] - STEPS[0]));
        // facing: the way they go while they go (as their gait faces it: a walk backwards, away from it), else where they
        // are turned — and in a motion done once, its end's at once (the motion turns them itself, from where it began)
        const turned = typeof keys.turn === 'number' ? (keys.turn * Math.PI) / 180 : ((p.turn ?? 180) * Math.PI) / 180;
        const aside = go.gait && body(go.gait) ? M(go.gait).walk.aside : 0;
        const want = way != null && go.weight > 0.05 ? way - aside : turned;
        const d = wrap(want - facing);
        if (cut || (act && !act.loop && go.weight < 0.05)) facing = turned;
        else facing += Math.sign(d) * Math.min(Math.abs(d), TURN * dt * Math.min(1, 0.25 + Math.abs(d)));
        if (before?.where) {
          const dx = before.where.across - at0.across, dz = before.where.distance - at0.distance, c = Math.cos(facing), s2 = Math.sin(facing);
          // (in the motion's own metres: the skeleton takes the pelvis's place as long as their legs make it)
          before.shift = [(-dx * c + dz * s2) / (this.scale || 1), 0, (dx * s2 + dz * c) / (this.scale || 1)]; before.where = null;
        }
        // what they look at and reach for, coming and going
        // (the eyes go to a new point at once, the head after them in a moment — a nod, a glance from one to another)
        aim.lookTo = keys.look ?? aim.lookTo; aim.lookW = cut ? (keys.look ? 1 : 0) : toward(aim.lookW, keys.look ? 1 : 0, 2.2, dt);
        aim.look = cut || !aim.look || !aim.lookTo || aim.lookW < 0.01 ? aim.lookTo : add3(aim.look, mul3(sub3(aim.lookTo, aim.look), Math.min(1, dt / LOOKING)));
        // (a hand on one thing, told to another — off the lid onto a friend's hand — goes over to it from where it was,
        // in a moment; not at once)
        for (const h of ['r', 'l', 'foot_r', 'foot_l']) {
          const g = keys.reach?.[h], ref = g ? JSON.stringify(keys.aims?.[h] ?? null) : null, A = aim.over[h] ??= { ref: null, from: null, t0: 0 };
          if (g && !cut && aim[h] && aim[`${h}W`] > 0.01 && A.ref != null && ref !== A.ref) { A.from = aim[h]; A.t0 = t; }
          if (g) A.ref = ref;
          if (cut || !g) A.from = null;
          const u = A.from ? (t - A.t0) / REACHING : 1;
          if (u >= 1) A.from = null;
          aim[h] = g ? (A.from ? add3(A.from, mul3(sub3(g, A.from), smooth(u))) : g) : aim[h];
          aim[`${h}W`] = cut ? (g ? 1 : 0) : toward(aim[`${h}W`], g ? 1 : 0, 2.5, dt);
        }
        if (parts) look.parts = [...parts, ...(Array.isArray(keys.with) ? keys.with : keys.with ? [keys.with] : [])];
        // (let down from a seat or another's arms into a motion done once: from where they were held — in their own space)
        if (wasHeld && !keys.held && at && act && !act.loop) {
          const dx = at.across - at0.across, dy = (at.elevation || 0) - (at0.elevation || 0), dz = at.distance - at0.distance, c = Math.cos(facing), s2 = Math.sin(facing);
          landing = { act, u: (act.from + t - act.at) * M(act.name).fps, t: [-dx * c + dz * s2, dy, dx * s2 + dz * c] };
        } else if (landing && landing.act !== act) landing = null;
        wasHeld = !!keys.held;
        at = { ...at0 };
        bones ||= MooodSkeleton.make(base.B, src);
        // (their points where the figure's joints are drawn: its legs and neck as long as its style makes them)
        fitted ||= bones.fit(shapes ? MooodShapes.bodyOf(look) : { height: this.height / 1.76 });
        bones.pose(this.clock, fitted);
        ticks++;
      },
      // the figure's scale: how far its legs take it, against Kimodo's (shapes.js, figure.js: the pelvis's height)
      scale: 1, clock: 0, now: null, stopped: 0,
      warn,
    };
    return me;
  }

  // ── drawn as the scene's camera sees them, into their own texture ──────

  const drawers = new WeakMap();  // a context's: the figures of each person, their targets
  function drawerOf(gl) {
    if (!drawers.has(gl)) drawers.set(gl, { people: new Map(), float: !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float')) });
    return drawers.get(gl);
  }
  // a target for the picture: at least w × h (grown in steps: a person seen nearer and nearer is not given a new one
  // every frame); aux — the facing and the depth too
  function targetOf(gl, D, P, w, h) {
    let T = P.target;
    if (T && T.W >= w && T.H >= h) return T;
    if (T) { gl.deleteFramebuffer(T.fbo); gl.deleteTexture(T.tex); if (T.aux) gl.deleteTexture(T.aux); }
    const W = Math.ceil(w / 128) * 128, H = Math.ceil(h / 128) * 128, fbo = gl.createFramebuffer();
    const tex2 = fmt => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, W, H);
      for (const q of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, q, gl.LINEAR);
      for (const q of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, q, gl.CLAMP_TO_EDGE); return t; };
    const tex = tex2(gl.RGBA8), aux = D.float ? tex2(gl.RGBA16F) : null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (aux) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, aux, 0);
    gl.drawBuffers(aux ? [gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1] : [gl.COLOR_ATTACHMENT0]);
    return (P.target = { fbo, tex, aux, W, H });
  }

  // 4×4 column-major product
  const mat = (A, B) => { const M = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += A[k * 4 + r] * B[c * 4 + k]; M[c * 4 + r] = s; } return M; };
  const NEAR = 0.05, FAR = 600;

  // The person drawn now. view: m — the card's transform (stage px → frame px: [s, 0, 0, s, e, f]), r — the region of
  // the stage the texture holds (px), k — texture px a stage px, cam — the camera (engine.js: eye heights, yaw), W, H —
  // the frame, yh — the horizon, at — where they stand (metres), lit — the scene's light lays itself on them,
  // dpr — device px a CSS px (lines' widths)
  function draw(gl, person, view) {
    const D = drawerOf(gl), { m, k, cam, W, H, yh, at, lit, dpr } = view;
    const w = Math.max(1, Math.round(view.r.w * k)), h = Math.max(1, Math.round(view.r.h * k));
    let P = D.people.get(person);
    if (!P) {
      P = { fig: person.shapes ? MooodShapes.make(gl, null, person.figure()) : MooodFigure.make(gl, base.B, person.src), target: null };
      D.people.set(person, P);
    }
    person.scale = P.fig.scale(person.look);
    // (all of the target: the region asked for, and on to its size)
    const T = targetOf(gl, D, P, w, h), r = { x: view.r.x, y: view.r.y, w: T.W / k, h: T.H / k };
    // the person's own space (Kimodo's: metres, y up, facing +z, their left +x) in the world (metres: x to the right, y
    // up, z away from the camera at the start): turned as they face, where they stand
    const f = person.facing(), F = [Math.sin(f), 0, Math.cos(f)], left = [-Math.cos(f), 0, Math.sin(f)], up = [0, 1, 0];
    const O = [at.across, at.elevation, at.distance];
    const model = new Float32Array([...left, 0, ...up, 0, ...F, 0, ...O, 1]);
    // the camera: at (x, h, z) eye heights, turned yaw; a point (xc, yc, zc) before it seen at W/2 + H·xc/zc,
    // (yh − y)·H − H·yc/zc in the frame — then by the card's transform back into the stage, and into the texture
    const c = Math.cos(cam.yaw || 0), s = Math.sin(cam.yaw || 0), ce = [cam.x * EYE, (cam.h ?? 1) * EYE, cam.z * EYE];
    const viewM = new Float32Array([c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, -(c * ce[0] - s * ce[2]), -ce[1], -(s * ce[0] + c * ce[2]), 1]);
    const A = 2 / (m[0] * r.w), B = -A * (m[4] + m[0] * r.x) - 1, C = 2 / (m[3] * r.h), Dd = -C * (m[5] + m[3] * r.y) - 1, sy = (yh - (cam.y || 0)) * H;
    // (texture rows from the top: the canvas's way, as every element's painting is)
    const proj = new Float32Array([A * H, 0, 0, 0, 0, -C * H, 0, 0, A * W / 2 + B, C * sy + Dd, (FAR + NEAR) / (FAR - NEAR), 1, 0, 0, -2 * FAR * NEAR / (FAR - NEAR), 0]);
    const V = mat(proj, mat(viewM, model));
    // the camera in the person's space: where the eye is, its right, up and back (their light and their rims)
    const back = [s, 0, -c], right = [c, 0, -s];
    const inv = v => [v[0] * left[0] + v[2] * left[2], v[1], v[0] * F[0] + v[2] * F[2]];
    const eye = inv([ce[0] - O[0], ce[1] - O[1], ce[2] - O[2]]);
    const camera = { V, eye, right: inv(right), up: [0, 1, 0], back: inv(back) };
    // (the context as the scene's renderer keeps it: its own again after)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.disable(gl.BLEND); gl.depthMask(true);
    // (a scene that lays no light itself: they are lit by its sources at their chest — the strongest and the next, each a
    // direction in their own space and a colour as strong as it reaches them — over the light all round)
    const toOwn = v => inv(v), src2 = !lit && view.sources ? view.sources : null;
    // (each, if it is a point, where it is — and the planes that stand between it and them: ink.js, SHADED)
    const ownAt = q => inv([q[0] - O[0], q[1] - O[1], q[2] - O[2]]);
    const light = src2 && {
      key: src2[0] ? toOwn(src2[0].dir) : camera.up, keyCol: src2[0] ? src2[0].col : [0, 0, 0],
      back: src2[1] ? toOwn(src2[1].dir) : camera.back, backCol: src2[1] ? src2[1].col : [0, 0, 0], amb: view.ambient,
      keyAt: src2[0]?.at ? ownAt(src2[0].at) : null, backAt: src2[1]?.at ? ownAt(src2[1].at) : null,
      planes: [0, 1].map(i => (src2[i]?.planes || []).map(q => ({ c: ownAt(q.c), a: inv(q.a), b: inv(q.b), k: q.k }))),
    };
    P.fig.render([0, 0, T.W, T.H], dpr * k / m[0], person.clock, person.look, camera, () => {}, { into: T, lit, light, world: [...left, ...up, ...F], near: NEAR, far: FAR, unit: EYE, token: person.tick });
    gl.disable(gl.SCISSOR_TEST); gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.enable(gl.BLEND); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.bindVertexArray(null); gl.activeTexture(gl.TEXTURE0);
    drawn.set(person, { gl, T, r, k, paint: view.paint });
    return { tex: T.tex, aux: T.aux, r };
  }

  // ── what of them was drawn: their silhouette as seen ──────────────────

  // the person as drawn last (draw): the context, the target, the region of the stage it holds, texture px a stage px,
  // the frame's height the stage is painted at (view.paint: world.js paints cards finer than a CSS px)
  const drawn = new WeakMap();
  // the texture px (x, y, w, h) of the target as drawn last: RGBA, rows from the top of the picture
  function readDrawn({ gl, T }, x, y, w, h) {
    const px = new Uint8Array(w * h * 4), was = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, T.fbo);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, was);
    return px;
  }
  // their silhouette as the camera saw them last — what the selection glows round: { c (a canvas), x, y, k } — its
  // corner at (x, y) of the stage painted for a frame H px high, k of its px a px of that; null if they were not drawn
  function silhouette(person, H) {
    const d = drawn.get(person);
    if (!d) return null;
    const c = new OffscreenCanvas(d.T.W, d.T.H), f = H / (d.paint || H);
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(readDrawn(d, 0, 0, d.T.W, d.T.H).buffer), d.T.W, d.T.H), 0, 0);
    return { c, x: d.r.x * f, y: d.r.y * f, k: d.k / f };
  }
  // whether any of them was drawn within `rad` px of (x, y) of the stage painted for a frame H px high — what is picked
  // where they are; null if they were not drawn
  function inkAt(person, x, y, rad, H) {
    const d = drawn.get(person);
    if (!d) return null;
    const f = (d.paint || H) / H;
    x *= f; y *= f; rad *= f;
    const x0 = Math.max(0, Math.floor((x - rad - d.r.x) * d.k)), y0 = Math.max(0, Math.floor((y - rad - d.r.y) * d.k));
    const x1 = Math.min(d.T.W, Math.ceil((x + rad - d.r.x) * d.k)), y1 = Math.min(d.T.H, Math.ceil((y + rad - d.r.y) * d.k));
    if (x1 <= x0 || y1 <= y0) return false;
    const px = readDrawn(d, x0, y0, x1 - x0, y1 - y0);
    for (let i = 3; i < px.length; i += 4) if (px[i] > 40) return true;
    return false;
  }

  globalThis.MooodPeople = { load, loaded: () => !!base, make, draw, silhouette, inkAt, LIBRARY, FPS, EYE };
})();
