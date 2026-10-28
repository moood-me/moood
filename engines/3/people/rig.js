// A person's skeleton: Kimodo's 77 joints (SOMA: soma.bin's T-pose and parents) placed again on the bones a person
// asks for (a child's, a tall man's: the motion retargeted), the pelvis as high and going as far as their legs make
// it. A pose is each joint's turn (R: 3×3, rows — from the joint's own frame at rest into the person's space) and
// place (T), in the person's own space: Kimodo's — metres, y up, facing +z, their left +x. What the GPU skins with is
// rows of the people's bones table (person.wgsl.js): 3 × 4 each, three rows of four — a joint's skinning matrix (its
// pose over its rest), a slot of what follows no one joint (shapes.js writes it), a cloth's control (cloth.js).
//   loadSoma() → a promise of SOMA's skeleton {inverse, parent}
//   rigOf({inverse, parent}) → the rest: {J, parent, inverse, rest, offset, bind, kind, below(j), legs}
//   fitOf(rig, body) → {h, f, kr}: body — factors of Kimodo's man (1.76 m) {height, head, neck, shoulders, arms,
//     hands, hips, legs, feet, torso}; h all of it, f each bone's, kr the pelvis's height and going
//   restOf(rig, fit) → the joints' places at rest on these bones (what a figure is built on)
//   pose(rig, fit, L, root, P) — FK: local turns L (quaternions x, y, z, w a joint) and the pelvis's place (Kimodo's
//     metres) into P {R, T}
//   skin(rig, P, rest, rows) — the joints' skinning matrices into rows (12 numbers a joint, from row 0)
//   slot(rows, i, x, y, z, p) — row i: its columns x, y, z and its place
//   bindLocals(rig) — the turns of the pose at rest
// Nothing here is the GPU's and nothing a browser's but the request that reads a file.

// SOMA's joints, in the order of soma.bin and of Kimodo's motions
const NAMES = ['Hips', 'Spine1', 'Spine2', 'Chest', 'Neck1', 'Neck2', 'Head', 'HeadEnd', 'Jaw', 'LeftEye', 'RightEye',
  ...['Left', 'Right'].flatMap(s => [`${s}Shoulder`, `${s}Arm`, `${s}ForeArm`, `${s}Hand`, ...['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']
    .flatMap(f => [...(f === 'Thumb' ? [1, 2, 3] : [1, 2, 3, 4]), 'End'].map(i => `${s}Hand${f}${i}`))]),
  ...['Left', 'Right'].flatMap(s => ['Leg', 'Shin', 'Foot', 'ToeBase', 'ToeEnd'].map(b => `${s}${b}`))];
export const J = NAMES.length;
export const AT = Object.freeze(Object.fromEntries(NAMES.map((n, i) => [n, i])));

// the people's data: engine 1's folder holds it (soma.bin, people/) — data, not code, read by its address (BD2)
export const ASSETS = new URL('../../1/', import.meta.url);

// a file (a request, not fetch: a render may read the engine from files, and fetch doesn't)
export const read = (url, type = 'arraybuffer') => new Promise((resolve, reject) => {
  const x = new XMLHttpRequest();
  x.open('GET', url); x.responseType = type;
  x.onload = () => (x.response != null && (x.status === 200 || x.status === 0) ? resolve(x.response) : reject(new Error(`${url}: ${x.status}`)));
  x.onerror = () => reject(new Error(`${url}: not read`));
  x.send();
});

// (read once a thread; a reading that failed is forgotten: the next scene asks again)
let soma = null;
export function loadSoma() {
  if (soma) return soma;
  const asked = soma = read(new URL('soma.bin', ASSETS)).then(buf => {
    const [V, F, n] = new Uint32Array(buf, 0, 3);
    let at = 12 + V * 3 * 4 + F * 3 * 2 + V * 8 * 2;
    const inverse = new Float32Array(buf.slice(at, at + n * 48)); at += n * 48;
    return { inverse, parent: new Uint8Array(buf.slice(at, at + n)) };
  });
  asked.catch(() => { if (soma === asked) soma = null; });
  return asked;
}

// which of the body's lengths a joint's bone is (the bone from its parent to it)
const kindOf = n =>
  /^(Left|Right)Leg$/.test(n) ? 'hips' : /Shin$|Foot$/.test(n) ? 'legs' : /Toe/.test(n) ? 'feet' :
  /^(Spine1|Spine2|Chest|Neck1)$/.test(n) ? 'torso' : /^(Neck2|Head)$/.test(n) ? 'neck' : /^(HeadEnd|Jaw|LeftEye|RightEye)$/.test(n) ? 'head' :
  /Shoulder$|^(Left|Right)Arm$/.test(n) ? 'shoulders' : /ForeArm$|^(Left|Right)Hand$/.test(n) ? 'arms' : /Hand/.test(n) ? 'hands' : 'root';
const KIND = NAMES.map(kindOf);

// The rest of a skeleton from its joints' inverse binds (3×4 each, rows): each joint's place at rest, its offset from
// its parent in the parent's own frame, its turn at rest (a quaternion: the bind's rotation)
export function rigOf({ inverse, parent: par }) {
  const I = inverse, parent = Int32Array.from(par, p => (p === 255 ? -1 : p));
  const rest = new Float32Array(J * 3), offset = new Float32Array(J * 3), bind = new Float32Array(J * 4);
  for (let j = 0; j < J; j++) {
    const o = j * 12, tx = I[o + 3], ty = I[o + 7], tz = I[o + 11];
    rest[j * 3] = -(I[o] * tx + I[o + 4] * ty + I[o + 8] * tz);
    rest[j * 3 + 1] = -(I[o + 1] * tx + I[o + 5] * ty + I[o + 9] * tz);
    rest[j * 3 + 2] = -(I[o + 2] * tx + I[o + 6] * ty + I[o + 10] * tz);
    // (the bind's rotation: the inverse's, transposed — as a quaternion)
    const m00 = I[o], m01 = I[o + 4], m02 = I[o + 8], m10 = I[o + 1], m11 = I[o + 5], m12 = I[o + 9], m20 = I[o + 2], m21 = I[o + 6], m22 = I[o + 10];
    const tr = m00 + m11 + m22;
    let x, y, z, w;
    if (tr > 0) { const k = 2 * Math.sqrt(tr + 1); x = (m21 - m12) / k; y = (m02 - m20) / k; z = (m10 - m01) / k; w = k / 4; }
    else if (m00 > m11 && m00 > m22) { const k = 2 * Math.sqrt(1 + m00 - m11 - m22); x = k / 4; y = (m01 + m10) / k; z = (m02 + m20) / k; w = (m21 - m12) / k; }
    else if (m11 > m22) { const k = 2 * Math.sqrt(1 + m11 - m00 - m22); x = (m01 + m10) / k; y = k / 4; z = (m12 + m21) / k; w = (m02 - m20) / k; }
    else { const k = 2 * Math.sqrt(1 + m22 - m00 - m11); x = (m02 + m20) / k; y = (m12 + m21) / k; z = k / 4; w = (m10 - m01) / k; }
    bind[j * 4] = x; bind[j * 4 + 1] = y; bind[j * 4 + 2] = z; bind[j * 4 + 3] = w;
  }
  for (let j = 0; j < J; j++) {
    const p = parent[j], v0 = rest[j * 3], v1 = rest[j * 3 + 1], v2 = rest[j * 3 + 2];
    if (p < 0) { offset[j * 3] = v0; offset[j * 3 + 1] = v1; offset[j * 3 + 2] = v2; continue; }
    const o = p * 12;
    offset[j * 3] = I[o] * v0 + I[o + 1] * v1 + I[o + 2] * v2 + I[o + 3];
    offset[j * 3 + 1] = I[o + 4] * v0 + I[o + 5] * v1 + I[o + 6] * v2 + I[o + 7];
    offset[j * 3 + 2] = I[o + 8] * v0 + I[o + 9] * v1 + I[o + 10] * v2 + I[o + 11];
  }
  // the joints at and below each (what turns with it) — every one's found here: asked many times an update, below
  // only hands one back
  const under = (k, j) => { for (let q = parent[k]; q >= 0; q = parent[q]) if (q === j) return true; return false; };
  const subtrees = NAMES.map((_, j) => Int32Array.from([j, ...NAMES.keys()].filter((k, i) => i === 0 || under(k, j))));
  const below = j => subtrees[j];
  const y = n => rest[AT[n] * 3 + 1];
  return { J, parent, inverse: I, rest, offset, bind, kind: KIND, below,
    legs: { hip: y('Hips') - y('LeftLeg'), leg: y('LeftLeg') - y('LeftFoot'), foot: y('LeftFoot') } };
}

const BODY = { height: 1, head: 1, neck: 1, shoulders: 1, arms: 1, hands: 1, hips: 1, legs: 1, feet: 1, torso: 1, root: 1 };
export function fitOf(rig, body = {}) {
  const b = { ...BODY, ...body }, f = Float32Array.from(rig.kind, k => b[k] ?? 1), h = b.height, L = rig.legs;
  return { h, f, kr: h * (L.hip * b.hips + L.leg * b.legs + L.foot * b.feet) / (L.hip + L.leg + L.foot) };
}

// the joints' places at rest on these bones (the pelvis as high as these legs hold it)
export function restOf(rig, fit) {
  const out = new Float32Array(J * 3), { parent, offset, inverse: I, rest } = rig;
  for (let j = 0; j < J; j++) {
    const p = parent[j];
    if (p < 0) { out[0] = rest[0] * fit.kr; out[1] = rest[1] * fit.kr; out[2] = rest[2] * fit.kr; continue; }
    // (the parent's bind turns the offset into the person's space: the inverse's rotation, transposed)
    const o = p * 12, s = fit.h * fit.f[j], v0 = offset[j * 3], v1 = offset[j * 3 + 1], v2 = offset[j * 3 + 2];
    out[j * 3] = out[p * 3] + s * (I[o] * v0 + I[o + 4] * v1 + I[o + 8] * v2);
    out[j * 3 + 1] = out[p * 3 + 1] + s * (I[o + 1] * v0 + I[o + 5] * v1 + I[o + 9] * v2);
    out[j * 3 + 2] = out[p * 3 + 2] + s * (I[o + 2] * v0 + I[o + 6] * v1 + I[o + 10] * v2);
  }
  return out;
}

export const poseOf = () => ({ R: new Float32Array(J * 9), T: new Float32Array(J * 3), G: new Float32Array(J * 4) });

// FK: each joint's turn in the person's space (its parent's, then its own), its place along its parent's turn
export function pose(rig, fit, L, root, P) {
  const { parent, offset } = rig, { R, T, G } = P;
  for (let j = 0; j < J; j++) {
    const p = parent[j], o = j * 4;
    let x = L[o], y = L[o + 1], z = L[o + 2], w = L[o + 3];
    if (p >= 0) {
      const q = p * 4, ax = G[q], ay = G[q + 1], az = G[q + 2], aw = G[q + 3];
      const nx = aw * x + ax * w + ay * z - az * y, ny = aw * y - ax * z + ay * w + az * x, nz = aw * z + ax * y - ay * x + az * w, nw = aw * w - ax * x - ay * y - az * z;
      x = nx; y = ny; z = nz; w = nw;
    }
    const l = 1 / (Math.sqrt(x * x + y * y + z * z + w * w) || 1);
    x *= l; y *= l; z *= l; w *= l;
    G[o] = x; G[o + 1] = y; G[o + 2] = z; G[o + 3] = w;
    const r = j * 9;
    R[r] = 1 - 2 * (y * y + z * z); R[r + 1] = 2 * (x * y - z * w); R[r + 2] = 2 * (x * z + y * w);
    R[r + 3] = 2 * (x * y + z * w); R[r + 4] = 1 - 2 * (x * x + z * z); R[r + 5] = 2 * (y * z - x * w);
    R[r + 6] = 2 * (x * z - y * w); R[r + 7] = 2 * (y * z + x * w); R[r + 8] = 1 - 2 * (x * x + y * y);
    if (p < 0) { T[0] = fit.kr * root[0]; T[1] = fit.kr * root[1]; T[2] = fit.kr * root[2]; continue; }
    const q = p * 9, s = fit.h * fit.f[j], v0 = offset[j * 3] * s, v1 = offset[j * 3 + 1] * s, v2 = offset[j * 3 + 2] * s;
    T[j * 3] = T[p * 3] + R[q] * v0 + R[q + 1] * v1 + R[q + 2] * v2;
    T[j * 3 + 1] = T[p * 3 + 1] + R[q + 3] * v0 + R[q + 4] * v1 + R[q + 5] * v2;
    T[j * 3 + 2] = T[p * 3 + 2] + R[q + 6] * v0 + R[q + 7] * v1 + R[q + 8] * v2;
  }
}

// a direction of the T-pose (the body facing +z, its left +x) as joint j is turned now, into out (at o)
export function dir(rig, P, j, vx, vy, vz, out, o = 0) {
  const I = rig.inverse, k = j * 12, R = P.R, r = j * 9;
  const a = I[k] * vx + I[k + 1] * vy + I[k + 2] * vz, b = I[k + 4] * vx + I[k + 5] * vy + I[k + 6] * vz, c = I[k + 8] * vx + I[k + 9] * vy + I[k + 10] * vz;
  out[o] = R[r] * a + R[r + 1] * b + R[r + 2] * c;
  out[o + 1] = R[r + 3] * a + R[r + 4] * b + R[r + 5] * c;
  out[o + 2] = R[r + 6] * a + R[r + 7] * b + R[r + 8] * c;
  return out;
}

// The rows a figure's meshes skin with — 12 numbers each: three rows of four (a 3 × 4 matrix, its place in each
// row's last). The joints' skinning matrices now, into rows 0 … J − 1: P — the pose; rest — the joints' places at
// rest the meshes were built on
export function skin(rig, P, rest, rows) {
  const I = rig.inverse, { R, T } = P;
  for (let j = 0; j < J; j++) {
    const r = j * 9, k = j * 12, o = j * 12, x = rest[j * 3], y = rest[j * 3 + 1], z = rest[j * 3 + 2];
    // (the skinning matrix: the pose's turn over the bind's — R · Rbind⁻¹ — and the place it takes the rest's joint to)
    for (let i = 0; i < 3; i++) {
      const a = R[r + i * 3], b = R[r + i * 3 + 1], c = R[r + i * 3 + 2];
      const m0 = a * I[k] + b * I[k + 4] + c * I[k + 8], m1 = a * I[k + 1] + b * I[k + 5] + c * I[k + 9], m2 = a * I[k + 2] + b * I[k + 6] + c * I[k + 10];
      rows[o + i * 4] = m0; rows[o + i * 4 + 1] = m1; rows[o + i * 4 + 2] = m2;
      rows[o + i * 4 + 3] = T[j * 3 + i] - (m0 * x + m1 * y + m2 * z);
    }
  }
}
// a row: its columns x, y, z and its place (any of them arrays of three)
export function slot(rows, i, x, y, z, p) {
  const o = i * 12;
  rows[o] = x[0]; rows[o + 1] = y[0]; rows[o + 2] = z[0]; rows[o + 3] = p[0];
  rows[o + 4] = x[1]; rows[o + 5] = y[1]; rows[o + 6] = z[1]; rows[o + 7] = p[1];
  rows[o + 8] = x[2]; rows[o + 9] = y[2]; rows[o + 10] = z[2]; rows[o + 11] = p[2];
}

// the bind's own turns, each under its parent's (what a pose at rest is made of)
export function bindLocals(rig) {
  const L = new Float32Array(J * 4), b = rig.bind;
  for (let j = 0; j < J; j++) {
    const p = rig.parent[j], o = j * 4;
    let x = b[o], y = b[o + 1], z = b[o + 2], w = b[o + 3];
    if (p >= 0) {
      const q = p * 4, ax = -b[q], ay = -b[q + 1], az = -b[q + 2], aw = b[q + 3];
      const nx = aw * x + ax * w + ay * z - az * y, ny = aw * y - ax * z + ay * w + az * x, nz = aw * z + ax * y - ay * x + az * w, nw = aw * w - ax * x - ay * y - az * z;
      x = nx; y = ny; z = nz; w = nw;
    }
    L[o] = x; L[o + 1] = y; L[o + 2] = z; L[o + 3] = w;
  }
  return L;
}
