// 3 × 4 matrices in tables: twelve numbers a row, column-major — the x axis (0…2), the y axis (3…5), the z axis (6…8),
// the origin (9…11) — metres, the world's (x across, y up, z = −distance). Every function reads and writes at an
// offset of an array (a row of world.nodes.m, or a scratch of twelve): nothing is made.
// Points and directions are three numbers at an offset of an array too.

export const identity = (m, o = 0) => { m[o] = 1; m[o + 1] = 0; m[o + 2] = 0; m[o + 3] = 0; m[o + 4] = 1; m[o + 5] = 0; m[o + 6] = 0; m[o + 7] = 0; m[o + 8] = 1; m[o + 9] = 0; m[o + 10] = 0; m[o + 11] = 0; return m; };
export const copy = (a, ao, m, o = 0) => { for (let i = 0; i < 12; i++) m[o + i] = a[ao + i]; return m; };
export const same = (a, ao, b, bo) => { for (let i = 0; i < 12; i++) if (a[ao + i] !== b[bo + i]) return false; return true; };

// out = a · b (b first, then a); out may be a or b
const T = new Float64Array(12);
export function multiply(a, ao, b, bo, out, oo = 0) {
  for (let c = 0; c < 4; c++) {
    const x = b[bo + 3 * c], y = b[bo + 3 * c + 1], z = b[bo + 3 * c + 2];
    T[3 * c] = a[ao] * x + a[ao + 3] * y + a[ao + 6] * z + (c === 3 ? a[ao + 9] : 0);
    T[3 * c + 1] = a[ao + 1] * x + a[ao + 4] * y + a[ao + 7] * z + (c === 3 ? a[ao + 10] : 0);
    T[3 * c + 2] = a[ao + 2] * x + a[ao + 5] * y + a[ao + 8] * z + (c === 3 ? a[ao + 11] : 0);
  }
  for (let i = 0; i < 12; i++) out[oo + i] = T[i];
  return out;
}

// a place and a turn: at (x, y, z), turned by Euler angles in the order Y, X, Z (radians: yaw about y, then pitch
// about x, then roll about z — three.js's 'YXZ'), every axis scaled by `scale`
export function compose(x, y, z, pitch, yaw, roll, scale, m, o = 0) {
  const a = Math.cos(pitch), b = Math.sin(pitch), c = Math.cos(yaw), d = Math.sin(yaw), e = Math.cos(roll), f = Math.sin(roll);
  m[o] = (c * e + d * b * f) * scale; m[o + 1] = a * f * scale; m[o + 2] = (c * b * f - d * e) * scale;
  m[o + 3] = (d * b * e - c * f) * scale; m[o + 4] = a * e * scale; m[o + 5] = (d * f + c * b * e) * scale;
  m[o + 6] = a * d * scale; m[o + 7] = -b * scale; m[o + 8] = a * c * scale;
  m[o + 9] = x; m[o + 10] = y; m[o + 11] = z;
  return m;
}
export const translation = (x, y, z, m, o = 0) => { identity(m, o); m[o + 9] = x; m[o + 10] = y; m[o + 11] = z; return m; };
// three axes and an origin (each three numbers)
export function basis(xa, ya, za, at, m, o = 0) {
  for (let i = 0; i < 3; i++) { m[o + i] = xa[i]; m[o + 3 + i] = ya[i]; m[o + 6 + i] = za[i]; m[o + 9 + i] = at[i]; }
  return m;
}

// the point (x, y, z) through m → out (three numbers at oo)
export function point(m, o, x, y, z, out, oo = 0) {
  out[oo] = m[o] * x + m[o + 3] * y + m[o + 6] * z + m[o + 9];
  out[oo + 1] = m[o + 1] * x + m[o + 4] * y + m[o + 7] * z + m[o + 10];
  out[oo + 2] = m[o + 2] * x + m[o + 5] * y + m[o + 8] * z + m[o + 11];
  return out;
}
// a direction through m (no translation; not normalised)
export function direction(m, o, x, y, z, out, oo = 0) {
  out[oo] = m[o] * x + m[o + 3] * y + m[o + 6] * z;
  out[oo + 1] = m[o + 1] * x + m[o + 4] * y + m[o + 7] * z;
  out[oo + 2] = m[o + 2] * x + m[o + 5] * y + m[o + 8] * z;
  return out;
}
// a world point in m's own frame (m: a turn, one scale on every axis, a place) → out
export function inversePoint(m, o, x, y, z, out, oo = 0) {
  const dx = x - m[o + 9], dy = y - m[o + 10], dz = z - m[o + 11];
  const s = m[o] * m[o] + m[o + 1] * m[o + 1] + m[o + 2] * m[o + 2] || 1;
  out[oo] = (dx * m[o] + dy * m[o + 1] + dz * m[o + 2]) / s;
  out[oo + 1] = (dx * m[o + 3] + dy * m[o + 4] + dz * m[o + 5]) / s;
  out[oo + 2] = (dx * m[o + 6] + dy * m[o + 7] + dz * m[o + 8]) / s;
  return out;
}
// m inverted (a turn, one scale, a place) → out; out may be m
export function invert(m, o, out, oo = 0) {
  const s = m[o] * m[o] + m[o + 1] * m[o + 1] + m[o + 2] * m[o + 2] || 1;
  const x = m[o + 9], y = m[o + 10], z = m[o + 11];
  T[0] = m[o] / s; T[1] = m[o + 3] / s; T[2] = m[o + 6] / s;
  T[3] = m[o + 1] / s; T[4] = m[o + 4] / s; T[5] = m[o + 7] / s;
  T[6] = m[o + 2] / s; T[7] = m[o + 5] / s; T[8] = m[o + 8] / s;
  T[9] = -(T[0] * x + T[3] * y + T[6] * z); T[10] = -(T[1] * x + T[4] * y + T[7] * z); T[11] = -(T[2] * x + T[5] * y + T[8] * z);
  for (let i = 0; i < 12; i++) out[oo + i] = T[i];
  return out;
}
// the scale of m (the length of its x axis)
export const scaleOf = (m, o = 0) => Math.sqrt(m[o] * m[o] + m[o + 1] * m[o + 1] + m[o + 2] * m[o + 2]);
// m's turn as a quaternion (x, y, z, w) → out (four numbers at oo); its scale taken out first
export function quaternion(m, o, out, oo = 0) {
  const s = scaleOf(m, o) || 1;
  const m11 = m[o] / s, m21 = m[o + 1] / s, m31 = m[o + 2] / s, m12 = m[o + 3] / s, m22 = m[o + 4] / s, m32 = m[o + 5] / s, m13 = m[o + 6] / s, m23 = m[o + 7] / s, m33 = m[o + 8] / s;
  const trace = m11 + m22 + m33;
  if (trace > 0) { const k = 0.5 / Math.sqrt(trace + 1); out[oo + 3] = 0.25 / k; out[oo] = (m32 - m23) * k; out[oo + 1] = (m13 - m31) * k; out[oo + 2] = (m21 - m12) * k; }
  else if (m11 > m22 && m11 > m33) { const k = 2 * Math.sqrt(1 + m11 - m22 - m33); out[oo + 3] = (m32 - m23) / k; out[oo] = 0.25 * k; out[oo + 1] = (m12 + m21) / k; out[oo + 2] = (m13 + m31) / k; }
  else if (m22 > m33) { const k = 2 * Math.sqrt(1 + m22 - m11 - m33); out[oo + 3] = (m13 - m31) / k; out[oo] = (m12 + m21) / k; out[oo + 1] = 0.25 * k; out[oo + 2] = (m23 + m32) / k; }
  else { const k = 2 * Math.sqrt(1 + m33 - m11 - m22); out[oo + 3] = (m21 - m12) / k; out[oo] = (m13 + m31) / k; out[oo + 1] = (m23 + m32) / k; out[oo + 2] = 0.25 * k; }
  return out;
}
