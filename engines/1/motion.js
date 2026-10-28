// A person's motion made by a model (NVIDIA Kimodo: the motion service), drawn on a body — what the
// sandbox plays (the site) and what the render shows an assistant (motion.html: frames of it in a
// sheet). The body is Kimodo's own (soma.bin beside this file — its SOMA skin, Apache-2.0: soma.md):
// 18k vertices on 77 joints, 8 weights each, moved by every joint's rotation and place as Kimodo made
// them ({n, fps, names, q, p}: the motion service's /api/motions/<key>/body); how the person is seen —
// who, what they wear, how drawn — is the look: a body (figure.js) or a figure of flat shapes (shapes.js),
// both on the motion's skeleton placed again on their bones (skeleton.js); the floor in metres, the
// pelvis's path on it. Over it, if asked, the skeleton a people module gets from the same motion (its data entry,
// {n, fps, v, p, c, r}: bone directions, the pelvis, foot contacts, the path over the floor — rebuilt on a body of
// usual proportions).
// Kimodo's axes: y up, metres; at frame 0 the pelvis over the origin, the person facing +z, their left +x.
//   MooodMotion.body() → the body (fetched once, with skeleton.js, ink.js, figure.js, shapes.js)
//   MooodMotion.view(canvas, body, motion, clip?) → {n, fps, draw(t, camera, {kit, cells, look})}
//     t — the frame (fractional: between two, mixed); camera — {yaw, pitch, dist} around the pelvis
//     at t (yaw 0: from +z), or {facing: 'front' | 'side' | 'back'} — from where the person faces at t;
//     kit — the module's skeleton over the body; cells — [[x, y, w, h, t, camera]…] for several
//     frames on one canvas (a sheet), instead of t and camera; look — MooodShapes.look's (kind: 'shapes')
//     or MooodFigure.look's (by default: Kimodo's body, shaded, in a shirt and trousers)
(function () {
  const HERE = globalThis.document?.currentScript?.src ?? location.href;  // (a page's script, or the scene's thread's: thread.js)
  let soma = null;

  const bytes = b64 => Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));

  // (a request, not fetch: the local render reads the engine from files, and fetch doesn't)
  const read = url => new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('GET', url); x.responseType = 'arraybuffer';
    x.onload = () => (x.response && (x.status === 200 || x.status === 0) ? resolve(x.response) : reject(new Error(`${url}: ${x.status}`)));
    x.onerror = () => reject(new Error(`${url}: not read`));
    x.send();
  });

  // a script of the engine's, loaded: on a page, a <script>; in the scene's thread, imported
  const script = src => (globalThis.document ? new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error(`${src}: not loaded`));
    document.head.append(s);
  }) : Promise.resolve().then(() => importScripts(String(src))));

  function body() {
    return (soma ??= Promise.all([read(new URL('soma.bin', HERE)),
      ...['skeleton', 'ink', 'figure', 'shapes'].map(f => script(new URL(`${f}.js`, HERE)))]).then(([buf]) => {
      const [V, F, J] = new Uint32Array(buf, 0, 3);
      let at = 12;
      const take = (Kind, n, size) => { const a = new Kind(buf.slice(at, at + n * size)); at += n * size; return a; };
      const B = { V, F, J, bind: take(Float32Array, V * 3, 4), faces: take(Uint16Array, F * 3, 2), joint: take(Uint8Array, V * 8, 1),
        weight: take(Uint8Array, V * 8, 1), inverse: take(Float32Array, J * 12, 4), parent: take(Uint8Array, J, 1) };
      return MooodFigure.load().then(() => B);  // (the person drawn when no look is asked for)
    }));
  }

  // ── the module's skeleton (the clip, as feat.py has it) ────────────────

  const VEC = ['pF', 'pU', 'cF', 'cU', 'hF', 'hU', 'spine', 'neck', 'rUp', 'rFo', 'rHa', 'lUp', 'lFo', 'lHa', 'rTh', 'rSh', 'rFt', 'lTh', 'lSh', 'lFt'];
  const D = { leg: 0.9, thigh: 0.43, shin: 0.43, spine: 0.5, neck: 0.1, head: 0.24, sw: 0.36, hw: 0.18, upper: 0.31, fore: 0.26, foot: 0.15 };
  const BONES = [['pelvis', 'spine'], ['spine', 'chest'], ['chest', 'neck'], ['neck', 'headtop'], ['rhip', 'lhip'],
    ...['r', 'l'].flatMap(s => [['chest', `${s}shoulder`], [`${s}shoulder`, `${s}elbow`], [`${s}elbow`, `${s}wrist`], [`${s}wrist`, `${s}hand`],
      [`${s}hip`, `${s}knee`], [`${s}knee`, `${s}ankle`], [`${s}ankle`, `${s}ball`], [`${s}ball`, `${s}toe`]])];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (v, k) => [v[0] * k, v[1] * k, v[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = v => mul(v, 1 / (Math.hypot(...v) || 1));
  // a frame (its columns: right, up, forward) from forward and up; applied to v; one frame in another
  const frame = (F, U) => { F = unit(F); U = unit(add(U, mul(F, -dot(U, F)))); return [cross(U, F), U, F]; };
  const apply = (M, v) => add(add(mul(M[0], v[0]), mul(M[1], v[1])), mul(M[2], v[2]));
  const within = (A, B) => B.map(c => apply(A, c));

  // the clip's frames as the module's joints, the body going along its path (r) — in Kimodo's axes (the kit's x is
  // the person's right: mirrored back)
  function skeleton(clip) {
    const v = new Int8Array(bytes(clip.v).buffer), p = new Int16Array(bytes(clip.p).buffer), r = clip.r ? new Int16Array(bytes(clip.r).buffer) : null;
    return Array.from({ length: clip.n }, (_, i) => {
      const V = Object.fromEntries(VEC.map((k, j) => [k, [v[i * 60 + j * 3] / 127, v[i * 60 + j * 3 + 1] / 127, v[i * 60 + j * 3 + 2] / 127]]));
      const P = frame(V.pF, V.pU), C = within(P, frame(V.cF, V.cU)), H = within(C, frame(V.hF, V.hU));
      const hip = [(p[i * 3] / 8000 + (r ? r[i * 2] / 100 : 0)) * D.leg, p[i * 3 + 1] / 8000 * D.leg, (p[i * 3 + 2] / 8000 + (r ? r[i * 2 + 1] / 100 : 0)) * D.leg];
      const J = { pelvis: hip, rhip: add(hip, apply(P, [D.hw / 2, 0, 0])), lhip: add(hip, apply(P, [-D.hw / 2, 0, 0])) };
      J.spine = add(hip, mul(apply(P, V.spine), D.spine / 2));
      J.chest = add(hip, mul(apply(P, V.spine), D.spine));
      J.neck = add(J.chest, mul(apply(C, V.neck), D.neck));
      J.headtop = add(J.neck, apply(H, [0, D.head, 0]));
      for (const [s, sg] of [['r', 1], ['l', -1]]) {
        J[`${s}shoulder`] = add(J.chest, apply(C, [sg * D.sw / 2, -0.03, 0]));
        J[`${s}elbow`] = add(J[`${s}shoulder`], mul(apply(C, V[`${s}Up`]), D.upper));
        J[`${s}wrist`] = add(J[`${s}elbow`], mul(apply(C, V[`${s}Fo`]), D.fore));
        J[`${s}hand`] = add(J[`${s}wrist`], mul(apply(C, V[`${s}Ha`]), 0.08));
        J[`${s}knee`] = add(J[`${s}hip`], mul(apply(P, V[`${s}Th`]), D.thigh));
        J[`${s}ankle`] = add(J[`${s}knee`], mul(apply(P, V[`${s}Sh`]), D.shin));
        J[`${s}ball`] = add(J[`${s}ankle`], mul(apply(P, V[`${s}Ft`]), D.foot));
        J[`${s}toe`] = add(J[`${s}ball`], apply(P, [0, 0, 0.05]));
      }
      for (const k in J) J[k] = [-J[k][0], J[k][1], J[k][2]];
      return J;
    });
  }

  // ── WebGL ─────────────────────────────────────────────────────────────

  const LINE_VS = `#version 300 es
in vec3 at; uniform mat4 view; void main() { gl_Position = view * vec4(at, 1.0); }`;
  // (into a picture of ink.js too: its mark — under the person)
  const LINE_FS = `#version 300 es
precision mediump float; uniform vec4 tint; layout(location = 0) out vec4 color; layout(location = 1) out vec4 mark; layout(location = 2) out vec4 facing;
void main() { color = tint; mark = vec4(0.0); facing = vec4(0.5, 0.5, 0.5, 0.0); }`;

  function program(gl, vs, fs) {
    const p = gl.createProgram();
    for (const [kind, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(kind);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    return p;
  }

  const FOCAL = 1 / Math.tan(0.4);  // the camera's: a picture's half-height, at a distance of 1
  // perspective × look-at, column-major
  function viewOf(eye, target, aspect) {
    const f = unit([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
    const r = unit(cross([0, 1, 0], f)), u = cross(f, r);
    const V = [r[0], u[0], f[0], 0, r[1], u[1], f[1], 0, r[2], u[2], f[2], 0, -dot(r, eye), -dot(u, eye), -dot(f, eye), 1];
    const t = FOCAL, n = 0.05, far = 100;
    const P = [t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (far + n) / (n - far), -1, 0, 0, 2 * far * n / (n - far), 0];
    const M = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r2 = 0; r2 < 4; r2++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += P[k * 4 + r2] * V[c * 4 + k];
      M[c * 4 + r2] = s;
    }
    return M;
  }

  function view(canvas, B, motion, clip) {
    const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true });
    const pos = new Int16Array(bytes(motion.p).buffer), J = motion.names.length, n = motion.n;
    const kit = clip ? skeleton(clip) : null;
    const sk = MooodSkeleton.make(B, motion), fig = MooodFigure.make(gl, B, motion), flat = MooodShapes.make(gl, sk), lines = program(gl, LINE_VS, LINE_FS), lineBuf = gl.createBuffer(), lineAt = gl.getAttribLocation(lines, 'at');
    const drawLines = (points, tint, V, mode = gl.LINES) => {
      gl.useProgram(lines);
      gl.uniformMatrix4fv(gl.getUniformLocation(lines, 'view'), false, V);
      gl.uniform4fv(gl.getUniformLocation(lines, 'tint'), tint);
      gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STREAM_DRAW);
      gl.enableVertexAttribArray(lineAt); gl.vertexAttribPointer(lineAt, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(mode, 0, points.length / 3);
      gl.disableVertexAttribArray(lineAt);
    };
    const joint = (f, j) => [0, 1, 2].map(k => pos[(f * J + j) * 3 + k] / 1000);
    // which way the person faces at frame f, as the camera's yaw from the front: the line from the right
    // hip to the left one (+x while facing +z), turned a quarter
    const L = motion.names.indexOf('LeftLeg'), Rl = motion.names.indexOf('RightLeg');
    const facing = f => { const l = joint(f, L), r = joint(f, Rl); return Math.atan2(-(l[2] - r[2]), l[0] - r[0]); };
    let floor = null, floorOf = null;

    const cell = (x, y, w, h, k, t, camera, kitOn, look) => {
      // the pelvis's path on this body, and the floor around all of it
      const shapes = look.kind === 'shapes', kr = (shapes ? flat : fig).scale(look);
      if (floorOf !== kr) {
        const hips = Array.from({ length: n }, (_, i) => sk.hips(i, kr));
        const mid = [hips.reduce((s, p) => s + p[0], 0) / n, hips.reduce((s, p) => s + p[2], 0) / n];
        const reach = Math.max(...hips.map(p => Math.hypot(p[0] - mid[0], p[2] - mid[1])));
        const R = Math.ceil(reach) + 5, x0 = Math.round(mid[0]), z0 = Math.round(mid[1]), grid = [];
        for (let d = -R; d <= R; d++) grid.push(x0 + d, 0, z0 - R, x0 + d, 0, z0 + R, x0 - R, 0, z0 + d, x0 + R, 0, z0 + d);
        floor = { hips, grid, path: hips.flatMap(p => [p[0], 0.002, p[2]]) }; floorOf = kr;
      }
      const f = Math.min(n - 1, Math.floor(t)), at = [floor.hips[f][0], 0.85 * kr, floor.hips[f][2]];
      let { yaw = 0.6, pitch = 0.22, dist = 3.6 } = camera;
      if (camera.facing) yaw = facing(f) + { front: 0, side: Math.PI / 2, back: Math.PI }[camera.facing];
      const eye = [at[0] + dist * Math.cos(pitch) * Math.sin(yaw), at[1] + dist * Math.sin(pitch), at[2] + dist * Math.cos(pitch) * Math.cos(yaw)];
      const V = viewOf(eye, at, w / h), back = unit(sub(eye, at)), right = unit(cross([0, 1, 0], back));
      if (shapes) {
        const g = [1, 3, 5].map(i => parseInt(flat.ground(look).grid.slice(i, i + 2), 16) / 255);
        flat.render([x, y, w, h], k, t, look, { V, eye, right, up: cross(back, right), back }, () => drawLines(floor.grid, [...g, 1], V));
      } else {
        const g = fig.ground(look), c = s => [...[1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16) / 255), 1];
        fig.render([x, y, w, h], k, t, look, { V, eye, right, up: cross(back, right), back }, () => {
          drawLines(floor.grid, c(g.grid), V);
          drawLines(floor.path, c(g.path), V, gl.LINE_STRIP);
        });
      }
      if (kitOn && kit) {
        // (its clip may be a frame or two shorter or longer: the same moment)
        const S = kit[Math.min(kit.length - 1, Math.round(t * kit.length / n))];
        drawLines(BONES.flatMap(([a, b]) => [...S[a], ...S[b]]), [0.91, 0.79, 0.54, 1], V);
      }
    };
    return {
      n, fps: motion.fps,
      draw(t, camera = {}, { kit: kitOn = false, cells = null, look = {} } = {}) {
        const L = look.kind === 'shapes' ? MooodShapes.look(look) : MooodFigure.look(look);
        const k = devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
        if (canvas.width !== Math.round(w * k) || canvas.height !== Math.round(h * k)) { canvas.width = Math.round(w * k); canvas.height = Math.round(h * k); }
        gl.enable(gl.SCISSOR_TEST);
        if (!cells) return cell(0, 0, canvas.width, canvas.height, k, t, camera, kitOn, L);
        // cells in CSS pixels from the top left; WebGL's from the bottom left
        for (const [x, y, cw, ch, ct, cc] of cells) cell(Math.round(x * k), Math.round(canvas.height - (y + ch) * k), Math.round(cw * k), Math.round(ch * k), k, ct, cc, kitOn, L);
      },
    };
  }

  globalThis.MooodMotion = { body, view };
})();
