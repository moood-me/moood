// A motion's skeleton: Kimodo's 77 joints (SOMA: soma.bin's T-pose and parents), each turned as the motion
// has it, placed again from the pelvis down its bones — of the lengths a person asks for (a child's, a tall
// man's: the motion retargeted), and their pelvis as high and going as far as their legs make it. What the
// people drawn from a motion stand on (figure.js: a body; shapes.js: a figure of shapes).
// The motion: Kimodo's, as the motion service gives it ({n, fps, names, q: each joint's rotation a frame, p: each
// joint's place, or the pelvis's alone — p0}); or a player of motions (people.js: several mixed, looped, turned) —
// {n, fps, names, sample(t, q, root)}: at frame t, each joint's rotation (x, y, z, w, into q) and the pelvis's place
// (metres, into root); after(skeleton, fit), if it has one, once the joints are placed (the feet set on the ground).
//   MooodSkeleton.make(B, motion) → {J, n, fps, at, names, parent, tb, R, T, fit(body), pose(t, fit, still?), dir(j, v), hips(f, kr)}
//     body — factors of Kimodo's (a man's, 1.76 m): {height, head, neck, shoulders, arms, hips, legs, feet};
//     fit — what pose takes: {h: all of it, f: per joint, its bone's length (from its parent), kr: the pelvis's
//     height and going};
//     after pose: R — each joint's rotation (9 numbers, rows), T — its place; dir — a direction of the T-pose,
//     as the joint has turned it; still — this much of the way back to the T-pose
(function () {
  const bytes = b64 => Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
  const place = (M, o, v) => [M[o] * v[0] + M[o + 1] * v[1] + M[o + 2] * v[2] + M[o + 3], M[o + 4] * v[0] + M[o + 5] * v[1] + M[o + 6] * v[2] + M[o + 7],
    M[o + 8] * v[0] + M[o + 9] * v[1] + M[o + 10] * v[2] + M[o + 11]];
  const rot = (R, o, v) => [R[o] * v[0] + R[o + 1] * v[1] + R[o + 2] * v[2], R[o + 3] * v[0] + R[o + 4] * v[1] + R[o + 5] * v[2],
    R[o + 6] * v[0] + R[o + 7] * v[1] + R[o + 8] * v[2]];

  // the T-pose of the body: each joint's place and rotation (its inverse bind, undone), its offset from its parent
  function restOf(B) {
    if (B.rest) return B.rest;
    const J = B.J, I = B.inverse;
    const tb = Array.from({ length: J }, (_, j) => {
      const o = j * 12, t = [I[o + 3], I[o + 7], I[o + 11]];
      return [-(I[o] * t[0] + I[o + 4] * t[1] + I[o + 8] * t[2]), -(I[o + 1] * t[0] + I[o + 5] * t[1] + I[o + 9] * t[2]),
        -(I[o + 2] * t[0] + I[o + 6] * t[1] + I[o + 10] * t[2])];
    });
    const parent = Array.from(B.parent, p => (p === 255 ? -1 : p));
    const offset = tb.map((t, j) => (parent[j] < 0 ? t : place(I, parent[j] * 12, t)));
    const quat = new Float32Array(J * 4);
    for (let j = 0; j < J; j++) {
      const o = j * 12, m = [[I[o], I[o + 4], I[o + 8]], [I[o + 1], I[o + 5], I[o + 9]], [I[o + 2], I[o + 6], I[o + 10]]];
      const tr = m[0][0] + m[1][1] + m[2][2];
      let v;
      if (tr > 0) { const k = 2 * Math.sqrt(tr + 1); v = [(m[2][1] - m[1][2]) / k, (m[0][2] - m[2][0]) / k, (m[1][0] - m[0][1]) / k, k / 4]; } else {
        const a = m[0][0] > m[1][1] && m[0][0] > m[2][2] ? 0 : m[1][1] > m[2][2] ? 1 : 2, b = (a + 1) % 3, c = (a + 2) % 3;
        const k = 2 * Math.sqrt(1 + m[a][a] - m[b][b] - m[c][c]);
        v = []; v[a] = k / 4; v[b] = (m[b][a] + m[a][b]) / k; v[c] = (m[c][a] + m[a][c]) / k; v[3] = (m[c][b] - m[b][c]) / k;
      }
      quat.set(v, j * 4);
    }
    return (B.rest = { tb, parent, offset, quat });
  }

  // which of the body's lengths a joint's bone is (the bone from its parent to it)
  const kindOf = n =>
    /^(Left|Right)Leg$/.test(n) ? 'hips' : /Shin$|Foot$/.test(n) ? 'legs' : /Toe/.test(n) ? 'feet' :
    /^(Spine1|Spine2|Chest|Neck1)$/.test(n) ? 'torso' : /^(Neck2|Head)$/.test(n) ? 'neck' : /^(HeadEnd|Jaw|LeftEye|RightEye)$/.test(n) ? 'head' :
    /Shoulder$|^(Left|Right)Arm$/.test(n) ? 'shoulders' : /ForeArm$|^(Left|Right)Hand$/.test(n) ? 'arms' : /Hand/.test(n) ? 'hands' : 'root';

  // a motion of Kimodo's as a player: its frames, each mixed with the next between them
  function played(motion, J) {
    const n = motion.n, q = new Int16Array(bytes(motion.q).buffer), pos = new Int16Array(bytes(motion.p ?? motion.p0).buffer), step = motion.p ? J : 1;
    const root = (f, out, w = 1) => { for (let k = 0; k < 3; k++) out[k] += w * pos[f * step * 3 + k] / 1000; };
    return {
      n, fps: motion.fps, names: motion.names, root,
      sample(t, out, at) {
        const a = Math.floor(t) % n, b = Math.min(n - 1, a + 1), u = t - Math.floor(t);
        for (let j = 0; j < J; j++) {
          const ia = (a * J + j) * 4, ib = (b * J + j) * 4;
          const sign = q[ia] * q[ib] + q[ia + 1] * q[ib + 1] + q[ia + 2] * q[ib + 2] + q[ia + 3] * q[ib + 3] < 0 ? -1 : 1;
          for (let k = 0; k < 4; k++) out[j * 4 + k] = q[ia + k] * (1 - u) + sign * q[ib + k] * u;
        }
        at[0] = at[1] = at[2] = 0; root(a, at, 1 - u); root(b, at, u);
      },
    };
  }

  function make(B, motion) {
    const { tb, parent, offset, quat } = restOf(B), J = B.J, I = B.inverse;
    const src = motion.sample ? motion : played(motion, J), n = src.n;
    const names = src.names, at = Object.fromEntries(names.map((nm, i) => [nm, i]));
    const R = new Float32Array(J * 9), T = new Float32Array(J * 3), Q = new Float32Array(J * 4), root = new Float32Array(3);
    const pose = (t, fit, still = 0) => {
      src.sample(t, Q, root);
      for (let j = 0; j < J; j++) {
        let x = Q[j * 4], y = Q[j * 4 + 1], z = Q[j * 4 + 2], w = Q[j * 4 + 3];
        let l = Math.hypot(x, y, z, w); x /= l; y /= l; z /= l; w /= l;
        if (still) {
          const r = quat.subarray(j * 4, j * 4 + 4), sg = x * r[0] + y * r[1] + z * r[2] + w * r[3] < 0 ? -1 : 1;
          x = x * (1 - still) + sg * r[0] * still; y = y * (1 - still) + sg * r[1] * still;
          z = z * (1 - still) + sg * r[2] * still; w = w * (1 - still) + sg * r[3] * still;
          l = Math.hypot(x, y, z, w); x /= l; y /= l; z /= l; w /= l;
        }
        R.set([1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
          2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)], j * 9);
        const p = parent[j];
        if (p < 0) {
          for (let k = 0; k < 3; k++) T[j * 3 + k] = fit.kr * root[k];
          if (still) T[j * 3 + 1] += (fit.kr * tb[j][1] - T[j * 3 + 1]) * still;
        } else {
          const o = rot(R, p * 9, offset[j]), s = fit.h * fit.f[j];
          for (let k = 0; k < 3; k++) T[j * 3 + k] = T[p * 3 + k] + s * o[k];
        }
      }
      if (src.after) src.after(self, fit);
    };
    // a direction of the T-pose (where the body faces +z, its left +x), as joint j has turned it
    const dir = (j, v) => { const o = j * 12; return rot(R, j * 9, [I[o] * v[0] + I[o + 1] * v[1] + I[o + 2] * v[2], I[o + 4] * v[0] + I[o + 5] * v[1] + I[o + 6] * v[2],
      I[o + 8] * v[0] + I[o + 9] * v[1] + I[o + 10] * v[2]]); };
    const kind = names.map(kindOf);
    const legs = { hip: tb[at.Hips][1] - tb[at.LeftLeg][1], leg: tb[at.LeftLeg][1] - tb[at.LeftFoot][1], foot: tb[at.LeftFoot][1] };
    const fit = body => {
      const b = { height: 1, head: 1, neck: 1, shoulders: 1, arms: 1, hands: 1, hips: 1, legs: 1, feet: 1, torso: 1, root: 1, ...body };
      const f = Float32Array.from(kind, k => b[k]), h = b.height;
      return { h, f, kr: h * (legs.hip * b.hips + legs.leg * b.legs + legs.foot * b.feet) / (legs.hip + legs.leg + legs.foot) };
    };
    // where the pelvis is at frame f, on legs this much of Kimodo's (a motion of Kimodo's)
    const hips = (f, kr) => { const o = [0, 0, 0]; src.root(f, o); return o.map(v => v * kr); };
    const self = { J, n, fps: src.fps, at, names, kind, parent, tb, offset, R, T, quat, fit, pose, dir, hips };
    return self;
  }

  globalThis.MooodSkeleton = { make };
})();
