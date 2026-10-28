// A person's picture, drawn in depth and inked: what is in front is so for each point of the picture (a depth
// buffer, not an order of whole shapes), drawn ss× as many pixels each way and averaged (smooth edges); then
// lines — round the person, where one part is well in front of another, and where what a shader marked
// differs between neighbours (a part's colour, a surface's turn). For the people drawn from a motion
// (shapes.js, figure.js). A shader drawing into it writes three colours: the picture; its mark (rgb: what
// is compared; a: 1 for the person, 0 for what is under them — the floor); the way the surface faces (its
// normal, n / 2 + ½, in the world the camera sees it in).
// On a background (a sheet of frames: motion.js) or on nothing — a person standing in a scene (people.js): the
// picture premultiplied by how much of each pixel the person covers, and beside it, for the scene's light,
// how they face and how far they are there (n · a, depth · a: 16-bit floats).
//   MooodInk.make(gl) → {begin([x, y, w, h], ss, bg), end([x, y, w, h], {width, color, differ, tint, into})}
//     x, y, w, h — device pixels of the canvas (or of the target drawn into); bg — the background's colour, or
//     null: none; width — the line's, in device pixels (0: none); differ — how different two marks are for a line
//     between them; tint — lines a darker shade of the mark they edge (0…1), rather than the colour; into — a
//     target {fbo, aux} to draw into (aux: it takes the facing and the depth too) rather than the canvas, and
//     the camera's near and far (metres), and unit: the metres of a unit of the depth it takes
(function () {
  const OUT_VS = `#version 300 es
void main() { vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0); gl_Position = vec4(p, 0.0, 1.0); }`;
  const OUT_FS = `#version 300 es
precision highp float;
uniform sampler2D colorT, markT, depthT, normalT; uniform int ss, width; uniform ivec4 area; uniform bool aux; uniform vec3 line; uniform float differ, tint, near, far, unit;
layout(location = 0) out vec4 color; layout(location = 1) out vec4 facing;
float depth(ivec2 p) { float z = texelFetch(depthT, p, 0).r; return 2.0 * near * far / (far + near - (z * 2.0 - 1.0) * (far - near)); }
// a line here (a), the mark it edges (the person's, the nearer one's) in rgb — and how far that is (d)
vec4 edge(ivec2 p, out float d) {
  vec4 a = texelFetch(markT, p, 0); d = depth(p);
  for (int k = 0; k < 4; k++) {
    ivec2 o = p + ivec2(k == 0 ? width : k == 1 ? -width : 0, k == 2 ? width : k == 3 ? -width : 0);
    // (beyond the picture: nothing — what is there is another's, or older)
    bool out_ = any(lessThan(o, area.xy)) || any(greaterThanEqual(o, area.zw));
    vec4 b = out_ ? vec4(0.0) : texelFetch(markT, o, 0);
    if (a.a < 0.5 && b.a < 0.5) continue;
    float e = depth(o);
    bool other = a.a < 0.5 || (b.a > 0.5 && e < d);
    if (abs(a.a - b.a) > 0.5 || abs(e - d) > 0.06 + 0.02 * d || distance(a.rgb, b.rgb) > differ) { if (other) d = e; return vec4(other ? b.rgb : a.rgb, 1.0); }
  }
  return vec4(0.0);
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy) * ss;
  vec4 c = vec4(0.0), f = vec4(0.0);
  for (int y = 0; y < ss; y++) for (int x = 0; x < ss; x++) {
    ivec2 q = p + ivec2(x, y);
    vec4 s = texelFetch(colorT, q, 0);
    float on = texelFetch(markT, q, 0).a, d = depth(q);
    vec3 n = on > 0.5 ? texelFetch(normalT, q, 0).rgb * 2.0 - 1.0 : vec3(0.0);
    if (width > 0) { float e; vec4 l = edge(q, e); s = mix(s, vec4(mix(line, l.rgb * 0.45, tint), 1.0), l.a); if (l.a > 0.0 && on < 0.5) d = e; }
    c += s; f += vec4(n * s.a, d / unit * s.a);
  }
  color = c / float(ss * ss);
  if (aux) facing = f / float(ss * ss);
}`;

  // (one a context: its targets are as big as the canvas — every person drawn there draws through it, in turn)
  const made = new WeakMap();
  function make(gl) {
    if (!made.has(gl)) made.set(gl, inked(gl));
    return made.get(gl);
  }
  function inked(gl) {
    const p = gl.createProgram();
    for (const [kind, src] of [[gl.VERTEX_SHADER, OUT_VS], [gl.FRAGMENT_SHADER, OUT_FS]]) {
      const s = gl.createShader(kind); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    const u = n => gl.getUniformLocation(p, n), empty = gl.createVertexArray();
    let fb = null, size = '', ss = 1;
    // the textures, at least as big as the canvas (ss× each way)
    const target = (w, h) => {
      if (size === `${w}x${h}x${ss}`) return;
      if (fb) { gl.deleteFramebuffer(fb.f); fb.t.forEach(t => gl.deleteTexture(t)); }
      const tex = (fmt, ifmt, type) => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w * ss, h * ss, 0, fmt, type, null);
        for (const q of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, q, gl.NEAREST);
        for (const q of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, q, gl.CLAMP_TO_EDGE);
        return t;
      };
      const t = [tex(gl.RGBA, gl.RGBA8, gl.UNSIGNED_BYTE), tex(gl.RGBA, gl.RGBA8, gl.UNSIGNED_BYTE), tex(gl.DEPTH_COMPONENT, gl.DEPTH_COMPONENT24, gl.UNSIGNED_INT),
        tex(gl.RGBA, gl.RGBA8, gl.UNSIGNED_BYTE)];
      const f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t[0], 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, t[1], 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, t[3], 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, t[2], 0);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      fb = { f, t }; size = `${w}x${h}x${ss}`;
    };
    return {
      // drawing into the picture: the cell cleared to the background (or to nothing), depth on
      begin([x, y, w, h], scale, bg) {
        ss = scale;
        target(Math.max(gl.drawingBufferWidth, x + w), Math.max(gl.drawingBufferHeight, y + h));
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb.f);
        gl.enable(gl.SCISSOR_TEST);
        gl.viewport(x * ss, y * ss, w * ss, h * ss); gl.scissor(x * ss, y * ss, w * ss, h * ss);
        gl.clearBufferfv(gl.COLOR, 0, bg ? [...bg, 1] : [0, 0, 0, 0]); gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]); gl.clearBufferfv(gl.COLOR, 2, [0.5, 0.5, 0.5, 0]);
        gl.clearBufferfv(gl.DEPTH, 0, [1]);
        gl.enable(gl.DEPTH_TEST);
      },
      // the picture onto the canvas (or into a target), inked
      end([x, y, w, h], { width = 0, color = [0, 0, 0], differ = 0.1, tint = 0, into = null, near = 0.05, far = 100, unit = 1 } = {}) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, into ? into.fbo : null);
        gl.viewport(x, y, w, h); gl.scissor(x, y, w, h);
        gl.disable(gl.DEPTH_TEST);
        gl.useProgram(p);
        fb.t.forEach((t, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); });
        gl.uniform1i(u('colorT'), 0); gl.uniform1i(u('markT'), 1); gl.uniform1i(u('depthT'), 2); gl.uniform1i(u('normalT'), 3);
        gl.uniform4i(u('area'), x * ss, y * ss, (x + w) * ss, (y + h) * ss);
        gl.uniform1i(u('ss'), ss); gl.uniform1i(u('width'), Math.round(width * ss / 2)); gl.uniform3fv(u('line'), color); gl.uniform1f(u('differ'), differ); gl.uniform1f(u('tint'), tint);
        gl.uniform1i(u('aux'), into?.aux ? 1 : 0); gl.uniform1f(u('near'), near); gl.uniform1f(u('far'), far); gl.uniform1f(u('unit'), unit);
        gl.bindVertexArray(empty); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null);
        gl.activeTexture(gl.TEXTURE0);
      },
    };
  }

  // What stands between a person and the lights that light them (a scene that lays no light itself: people.js) —
  // the planes that cast the shadows of that light (a table top over the knees of those sitting at it, a roof, a
  // balcony): for each point of them, how much of each light comes through (0…1). In the person's own space: the key
  // light (key: the way to it; keyAt: where it is, if it is a point) and the next (back, backAt); the planes, the
  // key's first, as their middle and half-sides, each as dark as its shadow. The figures' shaders (shapes.js,
  // figure.js) take SHADED.glsl after their uniforms key and back, and call cleared(point, 0 | 1).
  const SHADED = {
    glsl: `uniform vec3 shC[8], shA[8], shB[8], keyAt, backAt; uniform float shK[8]; uniform ivec2 shN; uniform bvec2 shPoint;
float cleared(vec3 p, int which) {
  vec3 D = which == 0 ? (shPoint.x ? keyAt - p : key * 1000.0) : (shPoint.y ? backAt - p : back * 1000.0);
  int from = which == 0 ? 0 : shN.x, n = which == 0 ? shN.x : shN.y;
  float lit = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i < from || i >= from + n) continue;
    vec3 nn = normalize(cross(shA[i], shB[i]));
    float dn = dot(D, nn);
    if (abs(dn) < 1e-6) continue;
    float t = dot(shC[i] - p, nn) / dn;
    if (t <= 0.0 || t >= 1.0) continue;
    vec3 q = p + D * t - shC[i];
    float u = abs(dot(q, shA[i])) / dot(shA[i], shA[i]), v = abs(dot(q, shB[i])) / dot(shB[i], shB[i]);
    lit *= 1.0 - shK[i] * (1.0 - smoothstep(0.96, 1.04, u)) * (1.0 - smoothstep(0.96, 1.04, v));
  }
  return lit;
}`,
    // its uniforms, for program p, from light {keyAt, backAt, planes: [[{c, a, b, k}…] (the key's), […] (the next's)]}
    set(gl, p, light) {
      const u = n => gl.getUniformLocation(p, n), pl = light?.planes || [[], []], key = pl[0].slice(0, 4), back = pl[1].slice(0, 8 - key.length), all = [...key, ...back];
      const flat = f => { const out = new Float32Array(24); all.forEach((q, i) => out.set(f(q), i * 3)); return out; };
      gl.uniform3fv(u('shC'), flat(q => q.c)); gl.uniform3fv(u('shA'), flat(q => q.a)); gl.uniform3fv(u('shB'), flat(q => q.b));
      const k = new Float32Array(8); all.forEach((q, i) => { k[i] = q.k; }); gl.uniform1fv(u('shK'), k);
      gl.uniform2i(u('shN'), key.length, back.length);
      gl.uniform3fv(u('keyAt'), light?.keyAt || [0, 0, 0]); gl.uniform3fv(u('backAt'), light?.backAt || [0, 0, 0]);
      gl.uniform2i(u('shPoint'), light?.keyAt ? 1 : 0, light?.backAt ? 1 : 0);
    },
  };

  globalThis.MooodInk = { make, SHADED };
})();
