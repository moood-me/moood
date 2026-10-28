// Particles (5.18, LG12; render/wgsl/particles.js is their GPU side): the emitters' buffers. SCENE keeps each
// emitter's history (world.emitters: its ring, its bursts, the wind log) and stamps what it writes; RENDER lays them
// out for the GPU — the stamped rings, less the render origin, their times since the frame's epoch — and writes each
// emitter's row: what never changes of it at the build, what moves in each call that draws (where its stream is in
// its lap, its ring's oldest moment, the ground under it, whether anything of it may be in the air).
//   The cap (PARTICLES.MAX alive in a scene at the most) is SCENE's compile's: the numbers given here are laid out as
// they are (WT5).
//   The sprites are layers of one array, PT.SPRITE px a side. Its first PT.PUFFS layers are the engine's lumps — soft
// lumps of a few tens of blobs each, made once (plain arithmetic into bytes: the built-in puffs): a puff is
// one of them, by its number. After them, for every emitter whose code paints its own, a layer a FRAME: a painted
// sprite is a picture of its recording (SH9) — of the recording's rect, whose `frames` are painted side by side, a
// frame a column: the picture is asked `frames` sprites wide and cut into that many layers, and a particle's quad
// has one frame's shape (the rect's width over `frames`, by its height). Awaited at the build; one painted again
// (its recording is another) is pictured beside the frames, the old picture drawn until the new one is in. An
// emitter whose painting gave nothing (its sprite null: SCENE says it) draws nothing.
//   An emitter is a draw — draw(4, its particles, 8 · its row + 4 · its order, its first particle of the scene's). In
// the frame's view each is drawn among what blends, by how far it is, weather last (render/quads.js) — its own
// particles oldest first or youngest first, whichever end of its plume lies farther along the view's gaze (its drift
// · the gaze; weather: as they are numbered); what stops light is drawn into the movers' maps of the casting lights
// (`particles-cast`).
import { RING, MOMENT, BURSTS, WINDS, WIND, lifeOf, mostOf, fallHeight } from '../world/emitters.js';
import { PT, RINGS } from './wgsl/particles.js';
import { TIME } from './wgsl/frame.js';
import { ahead } from './views.js';

const ROW = PT.BYTES / 4, WIND0 = RINGS.HEAD, EACH = RING * RINGS.MOMENT + BURSTS * RINGS.BURST, GONE = -1e30;
// the most layers a 2D array has on every device (4.6)
const LAYERS_MOST = 256;

// The lumps (the sprites' first layers), white, premultiplied, stored sRGB-encoded — made once: each a few tens of
// soft blobs scattered about its middle, each a little light fading out to its edge, laid one over another; kept
// within the square, its edge soft. A particle's colour tints them
let lumped = null;
function lumps() {
  if (lumped) return lumped;
  const N = PT.SPRITE, alpha = new Float32Array(N * N);
  lumped = new Uint8Array(PT.PUFFS * N * N * 4);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const encoded = c => Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055));
  for (let v = 0; v < PT.PUFFS; v++) {
    alpha.fill(0);
    for (let k = 0; k < 56; k++) {
      const x = N / 2 + gauss() * N * 0.13, y = N / 2 + gauss() * N * 0.13, r = N * (0.1 + 0.16 * rnd()), a = 0.1 + 0.16 * rnd();
      const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(N - 1, Math.ceil(x + r)), y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(N - 1, Math.ceil(y + r));
      for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
        const d = Math.sqrt((i + 0.5 - x) ** 2 + (j + 0.5 - y) ** 2);
        if (d < r) alpha[j * N + i] += a * (1 - d / r) * (1 - alpha[j * N + i]);
      }
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = alpha[j * N + i] * Math.min(1, Math.max(0, (N / 2 - Math.sqrt((i + 0.5 - N / 2) ** 2 + (j + 0.5 - N / 2) ** 2)) / (0.3 * N))), o = 4 * ((v * N + j) * N + i);
      lumped[o] = lumped[o + 1] = lumped[o + 2] = encoded(a); lumped[o + 3] = Math.round(255 * a);
    }
  }
  return lumped;
}

export function createParticles(gpu, sheets, lib, host) {
  const B = GPUBufferUsage, T = GPUTextureUsage;
  let world = null, list = [], n = 0, rows = null, rings = null, emitters = null, ringsBuffer = null, sprites = null, spritesView = null, group = null, depthWith = null;
  let stamps = [], windStamp = -1, epoch = -1, originStamp = -1, now_ = 0, lo = 0, hi = 0;
  // what RENDER keeps of each emitter: its first particle of the scene's, how many it has, its stream's, its rate;
  // its painted sprite's first layer (−1: it paints none) and frames; the recording asked for a picture, the one
  // pictured; how far its particles go in their lives without the wind (down: its fall under gravity and drag), and
  // how far the wind carries them a metre a second of it; which of them the frame's view draws first (1: the oldest)
  let first = new Int32Array(0), count = new Int32Array(0), stream = new Int32Array(0), rate = new Float64Array(0), layer = new Int32Array(0), frames = new Int32Array(0), asked = [], shown = [];
  let fall = new Float64Array(0), carried = new Float64Array(0), oldest = new Uint8Array(0), pipe = null, castPipe = null;
  const P = { alive: false, casting: false, n: 0, ahead: new Float64Array(0) };
  const failed = err => host.error(err);
  const base = e => WIND0 + WINDS * RINGS.WIND + e * EACH;
  const touch = (a, b) => { if (a < lo) lo = a; if (b > hi) hi = b; };
  // a moment of a history (R at s) into the rings at w: its place less the origin and its time since the epoch t0;
  // how much, how fast; how turned. → its time
  function moment(R, s, w, O, t0) {
    const time = R[s];
    rings[w] = R[s + 1] - O[0]; rings[w + 1] = R[s + 2] - O[1]; rings[w + 2] = R[s + 3] - O[2]; rings[w + 3] = time > -Infinity ? time - t0 : GONE;
    rings[w + 4] = R[s + 7]; rings[w + 5] = R[s + 4]; rings[w + 6] = R[s + 5]; rings[w + 7] = R[s + 6];
    rings[w + 8] = R[s + 8]; rings[w + 9] = R[s + 9]; rings[w + 10] = R[s + 10]; rings[w + 11] = R[s + 11];
    return time;
  }
  // an emitter's sprite pictured: its recording rastered over its rect — its frames side by side — and cut into its
  // layers, a frame each; a frame's shape is the rect's width over the frames, by its height
  async function picture(e, rec, w) {
    const S = PT.SPRITE, n = frames[e], bytes = await sheets.picture(rec, n * S, S);
    // (the world replaced meanwhile, or the sprite painted once more: this picture is nobody's)
    if (world !== w || asked[e] !== rec) return;
    for (let f = 0; f < n; f++) gpu.queue.writeTexture({ texture: sprites, origin: [0, 0, layer[e] + f] }, bytes, { offset: 4 * S * f, bytesPerRow: 4 * S * n, rowsPerImage: S }, [S, S, 1]);
    rows[e * ROW + 58] = (rec.rect[2] - rec.rect[0]) / n / Math.max(1e-6, rec.rect[3] - rec.rect[1]);
    shown[e] = rec;
  }

  P.dispose = () => { for (const t of [emitters, ringsBuffer, sprites]) if (t) gpu.drop(t); emitters = ringsBuffer = sprites = null; world = null; list = []; n = 0; group = null; P.alive = false; P.casting = false; P.n = 0; };
  // a world's emitters: their rows' fixed part, the sprites painted (awaited: no frame ever lacks one)
  P.build = async w => {
    world = w;
    const E = w.emitters;
    if (!E || !E.n) return;
    list = E.list; n = E.n; P.n = n;
    rows = new Float32Array(n * ROW); rings = new Float32Array(base(n) * 4);
    emitters = gpu.buffer('emitters', rows.byteLength, B.STORAGE | B.COPY_DST);
    ringsBuffer = gpu.buffer('emitters histories', rings.byteLength, B.STORAGE | B.COPY_DST);
    stamps = new Array(n).fill(-1); windStamp = -1; epoch = -1;
    first = new Int32Array(n); count = new Int32Array(n); stream = new Int32Array(n); rate = new Float64Array(n); layer = new Int32Array(n).fill(-1); frames = new Int32Array(n);
    asked = new Array(n).fill(null); shown = new Array(n).fill(null); P.ahead = new Float64Array(n);
    fall = new Float64Array(n); carried = new Float64Array(n); oldest = new Uint8Array(n);
    let at = 0, layers = PT.PUFFS;
    for (let e = 0; e < n; e++) {
      const m = list[e], p = m.p, o = e * ROW, add = p.blend === 'add', painted = p.shape === 'painted', puff = p.shape === 'puff';
      first[e] = at; count[e] = mostOf(p); stream[e] = p.around ? 0 : Math.ceil(p.rate * lifeOf(p)); rate[e] = p.rate;
      if (painted) {
        if (layers + p.frames > LAYERS_MOST) throw new Error(`particles: the scene's painted sprites have more than ${LAYERS_MOST - PT.PUFFS} frames in all`);
        layer[e] = layers; frames[e] = p.frames; layers += p.frames;
      }
      // (how far its particles go in their lives: their fall — gravity against drag, a closed form —, and what the
      // wind carries them: which end of its plume is the farther one)
      const life = lifeOf(p), k = p.drag;
      fall[e] = -p.gravity * (k > 1e-4 ? (life - (1 - Math.exp(-k * life)) / k) / k : 0.5 * life * life);
      carried[e] = p.wind * life * (1 + p.gust * 0.6);
      const set = (v, a, b = 0, c = 0, d = 0) => { rows[o + 4 * v] = a; rows[o + 4 * v + 1] = b; rows[o + 4 * v + 2] = c; rows[o + 4 * v + 3] = d; };
      set(0, p.around ? 1 : 0, add ? 1 : 0, count[e], Math.floor(m.seed * 65521));
      set(1, rate[e], stream[e], p.burst ? p.burst.count : 0, p.flat ? 1 : 0);
      set(2, p.life[0], p.life[1], p.burst ? p.burst.over : 0, p.inherit);
      set(3, p.direction[0], p.direction[1], p.direction[2], Math.cos(p.spread * Math.PI / 180));
      set(4, p.source[0], p.source[1], p.source[2], p.shadow);
      set(5, p.speed[0], p.speed[1]);
      set(6, p.gravity, p.drag, p.wind, p.gust);
      set(7, p.turbulence, Math.max(0.01, p.swirl), p.sheer, m.inside ? 1 : 0);
      set(8, p.size[0], p.size[1], p.spin * Math.PI / 180, p.tumble ? 1 : 0);
      set(9, p.color[0][0], p.color[0][1], p.color[0][2], p.opacity);
      set(10, p.color[1][0], p.color[1][1], p.color[1][2], p.colors ? p.colors.length : 0);
      set(11, p.glow[0], p.glow[1], p.fade[0], p.fade[1]);
      set(12, PT.GROUND[p.ground], p.settle, p.bounce, p.soft);
      set(13, p.streak, p.blink, p.flicker, 0);
      // (its sprites: a puff's — the lumps; a painted one's — its frames, from its first layer: a frame's aspect
      // comes with its picture)
      set(14, puff ? PT.PUFFS : p.frames, painted ? layer[e] : 0, 1, PT.SHAPES[p.shape]);
      for (let c = 0; c < 4; c++) { const col = p.colors && p.colors[c]; set(15 + c, col ? col[0] : 0, col ? col[1] : 0, col ? col[2] : 0, 0); }
      set(19, p.reach, fallHeight(p), p.reach, p.around && p.area ? 1 : 0);
      if (p.area) set(20, p.area[0], p.area[1], p.area[2], p.area[3]);
      at += count[e];
    }
    sprites = gpu.texture('sprites', { size: [PT.SPRITE, PT.SPRITE, layers], format: 'rgba8unorm-srgb', usage: T.TEXTURE_BINDING | T.COPY_DST });
    spritesView = sprites.createView({ dimension: '2d-array' });
    gpu.queue.writeTexture({ texture: sprites }, lumps(), { bytesPerRow: PT.SPRITE * 4, rowsPerImage: PT.SPRITE }, [PT.SPRITE, PT.SPRITE, PT.PUFFS]);
    const pictures = [];
    for (let e = 0; e < n; e++) if (layer[e] >= 0 && list[e].sprite) { asked[e] = list[e].sprite; pictures.push(picture(e, asked[e], w)); }
    await Promise.all(pictures);
  };
  // its group (the scene's depth is in it: made again when that is another)
  P.bind = depthView => {
    if (!group || depthWith !== depthView) {
      depthWith = depthView;
      group = gpu.bind('particles', [{ binding: 0, resource: { buffer: emitters } }, { binding: 1, resource: { buffer: ringsBuffer } }, { binding: 2, resource: spritesView }, { binding: 3, resource: depthView }]);
    }
    return group;
  };
  // whether emitter e has anything to draw now: particles that may be in the air, and — one that paints its own — a
  // picture
  P.flies = e => count[e] > 0 && list[e].gave + list[e].life > now_ && (layer[e] < 0 || shown[e] !== null);

  // The frame's part, nothing written: what is in the air, how far each emitter is before the frame's eye (weather:
  // the nearest of all — drawn last) and which end of its plume is the farther one along the gaze, a sprite painted
  // again asked for its picture. t: the scene's seconds; view: the frame's
  P.frame = (t, view) => {
    P.alive = false; P.casting = false;
    now_ = t;
    if (!n) return;
    const air = world.emitters.air, gaze = view.e.fwd;
    for (let e = 0; e < n; e++) {
      const m = list[e];
      if (layer[e] >= 0 && m.sprite !== asked[e]) {
        asked[e] = m.sprite;
        // (a picture that cannot be made is the engine's fault: told, the old picture stays)
        if (m.sprite) picture(e, m.sprite, world).catch(failed); else shown[e] = null;
      }
      if (!P.flies(e)) continue;
      P.alive = true;
      if (m.p.shadow > 0) P.casting = true;
      if (m.p.around) P.ahead[e] = -Infinity; else ahead(view.e, m.position, P.ahead, e);
      // (its particles go away from the eye: the oldest are the farthest — drawn first)
      oldest[e] = !m.p.around && air.x * carried[e] * gaze[0] + fall[e] * gaze[1] + air.z * carried[e] * gaze[2] > 0 ? 1 : 0;
    }
  };
  // The emitters' buffers written — in a call that draws: the histories that were stamped, each emitter's moving
  // numbers. eye: the frame's
  P.write = eye => {
    if (!n) return;
    const E = world.emitters, O = world.origin, t = now_, now = Math.floor(t / TIME.STEP), t0 = now * TIME.STEP, all = now !== epoch || world.originStamp !== originStamp;
    epoch = now; originStamp = world.originStamp;
    rings[0] = E.windN;
    lo = Infinity; hi = -1;
    touch(0, 4);
    if (all || E.windStamp !== windStamp) {
      windStamp = E.windStamp;
      for (let k = 0; k < E.windN; k++) {
        const s = k * WIND, o = 4 * (WIND0 + k * RINGS.WIND), L = E.wind;
        rings[o] = L[s] - t0; rings[o + 1] = L[s + 1]; rings[o + 2] = L[s + 2]; rings[o + 3] = L[s + 3];
        rings[o + 4] = L[s + 4]; rings[o + 5] = L[s + 5]; rings[o + 6] = L[s + 6]; rings[o + 7] = 0;
      }
      touch(4 * WIND0, 4 * (WIND0 + WINDS * RINGS.WIND));
    }
    for (let e = 0; e < n; e++) {
      const m = list[e], p = m.p, o = e * ROW, at = base(e);
      if (all || m.stamp !== stamps[e]) {
        stamps[e] = m.stamp;
        for (let k = 0; k < RING; k++) moment(m.ring, k * MOMENT, 4 * (at + k * RINGS.MOMENT), O, t0);
        for (let k = 0; k < BURSTS; k++) {
          const w = 4 * (at + RING * RINGS.MOMENT + k * RINGS.BURST), time = moment(m.bursts, k * MOMENT, w, O, t0);
          // (a burst's own number: its seeds are never another burst's)
          rings[w + 12] = time > -Infinity ? (time * 977) % 65536 : 0; rings[w + 13] = 0; rings[w + 14] = 0; rings[w + 15] = 0;
        }
        touch(4 * at, 4 * (at + EACH));
      }
      // its stream's lap and where it is in it; its ring's oldest moment; the ground under it; whether it may have
      // anything in the air
      const nc = stream[e], total = rate[e] * t, lap = nc ? Math.floor(total / nc) : 0;
      let ground = 0;
      if (p.ground !== 'pass' && world.relief) ground = p.around ? world.relief.height(eye[0], -eye[2]) : world.relief.height(m.position[0], -m.position[2]);
      rows[o + 55] = ground - O[1];
      rows[o + 84] = at; rows[o + 85] = m.n; rows[o + 86] = (m.head - m.n + RING) % RING; rows[o + 87] = lap & 4095;
      rows[o + 88] = nc ? total - lap * nc : 0; rows[o + 89] = at + RING * RINGS.MOMENT; rows[o + 90] = 0; rows[o + 91] = P.flies(e) ? 1 : 0;
      rows[o + 92] = m.offset[0]; rows[o + 93] = m.offset[1]; rows[o + 94] = first[e]; rows[o + 95] = 0;
    }
    gpu.write(emitters, 0, rows);
    if (hi > lo) gpu.write(ringsBuffer, 4 * lo, rings, lo, hi - lo);
  };
  // emitter e drawn (main-blend; groups 0 and 1 set; group 2 is left its own): its particles in the order the
  // frame's view asks — the draw's bit (render/wgsl/particles.js). counters: RENDER's tally
  P.draw = (pass, depthView, e, counters) => {
    pass.setPipeline(pipe || (pipe = lib.get('particles')));
    pass.setBindGroup(2, P.bind(depthView));
    pass.draw(4, count[e], 8 * e + 4 * oldest[e], first[e]);
    counters.draws++; counters.triangles += 2 * count[e]; counters.particles += count[e];
  };
  // what stops light, cast into a light's map
  P.cast = (pass, depthView) => {
    pass.setPipeline(castPipe || (castPipe = lib.get('particles-cast')));
    pass.setBindGroup(2, P.bind(depthView));
    for (let e = 0; e < n; e++) if (list[e].p.shadow > 0 && P.flies(e)) pass.draw(4, count[e], 8 * e, first[e]);
  };
  return P;
}
