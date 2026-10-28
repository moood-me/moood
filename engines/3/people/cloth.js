// Cloth: what of a garment hangs loose (a skirt, a coat's tails; a sheet — an apron) — a few hinged strips. Round each
// hanging layer (across a sheet: an open layer) a few chains of controls hang from the hips, each link as long as the
// cloth is there at rest; a control falls, swings
// and lags, is drawn to where the garment hangs in the pose (the less loose, the nearer) — as wide as the legs in it
// need, and over a thigh that lies (sitting, a knee drawn up): along its top to the knee, then down (5.8) —, stays as
// far from the one above it as it was made, no further from its neighbours round the layer than the pose has them, out
// of the legs on its chain's own outer side and over the floor. Each control is a row of the person's bones (rig.js): the layer's mesh is skinned to the four
// controls round each of its points, on the GPU — nothing of the mesh is moved here.
// Moved on the scene's thread, for the people shown: one or two steps a shown frame; at rest in the pose (put on:
// the shape it hangs in there) when they are first shown, across a new shot, and after more than LATE of their own time unseen. Nothing of it is
// saved: a moment come back to shows it at rest.
// It is moved in what carries the person (a deck, a carriage: their place in it and their turn in it — else the
// world): what carries them walks nobody's cloth, their own going does.
//   strips(layers) → how many chains round (across) and links down each layer has: [{ around, down }] — a person's
//     controls sampled so that their total fits CONTROLS (the spacing round widens)
//   new Hang({ rings, around, down, open, loose, row, legs, hips, sd, fw, cut }) — a layer's controls: rings — its
//     hanging sections at rest, top down (each the same count of points; the person's own space) — round, or, open,
//     from one edge of a sheet to the other; row — its first control's row among the person's; legs — the legs'
//     half-widths [thigh, shin, foot]; hips, sd, fw — the middle between the hip joints at rest, the body's side and
//     forward there; cut — a garment's layer: how its sections widen round the legs ({ straight, firstY, hemY }); a
//     sheet: null. hang.weights(r, q, out) — the four rows and weights of the point q of section r (out: [row,
//     weight] × 4); hang.sway() → a person's own state of it
//   hang.step(sway, hips, T, where, fresh, rows) — a shown frame: hips — the pelvis's skinning row now (12 numbers,
//     the person's space); T — the joints' places; where — [x, y, z, turn, dt, floor]: the person in what carries
//     them, their own seconds since the frame before, the floor's height (the person's space); fresh — put on at
//     rest; rows — the person's rows, written
// Nothing is made in a step (5.16): its numbers are in arrays made once, and none is handed to a function or back by
// one — a number that is, is made on the heap each time.
import { AT } from './rig.js';
import { LATE } from '../base.js';

// the most controls a person's cloth has (5.8)
const CONTROLS = 64;
// a layer's chains round it and links down it, at their closest: a chain every AROUND of a turn, a link every LINK
// metres of a man's cloth — never fewer than LEAST chains (a ring of them holds a shape) and one link; an open layer's
// (a sheet's): ACROSS chains from edge to edge, never fewer than its two edges'
const AROUND = 12, LEAST = 4, ACROSS = 4, EDGES = 2, LINK = 0.13, LINKS = 4;
// how fast a control goes where the body takes it the less loose it is (per second; the loosest still by LOOSEST of
// it), how fast its swinging dies down (per second), how much of the pelvis's going it goes along with (the rest it
// lags: it swings), how far it stays off the legs (metres), the passes it is kept in a step and put on in
const PULL = 30, LOOSEST = 0.05, DRAG = 1.4, CARRY = 0.85, OFF = 0.02, PASSES = 2, ON = 8, GRAVITY = 9.8;
// a thigh lies — the cloth goes over it — turned up from hanging by more than 60° (LIES: its cosine); cloth lying over
// one is that much less loose (held as by friction); a quarter of an ellipse round, of half-widths a and b, is about
// QUARTER × (a + b)
const LIES = 0.5, LAID = 0.85, QUARTER = Math.PI / 4;
// a frame longer than this is two steps
const LONG = 1 / 45;
// the legs' pieces the cloth keeps out of: from a joint to a joint
const LEGS = ['Left', 'Right'].flatMap(s => [[`${s}Leg`, `${s}Shin`, 0], [`${s}Shin`, `${s}Foot`, 1], [`${s}Foot`, `${s}ToeEnd`, 2]]).map(([a, b, k]) => [AT[a], AT[b], k]);

// how each hanging layer is sampled: layers — [{ length (metres: how far it hangs), size (their height against a
// man's), sections (its hanging sections, the one it hangs from among them: a link spans one at least), open (a sheet:
// not round) }]; a layer too short to swing (under half a link) has no controls: it goes with the hips
export function strips(layers) {
  const least = layers.map(({ open }) => (open ? EDGES : LEAST));
  const out = layers.map(({ length, size, sections, open }) => {
    const down = Math.max(0, Math.min(LINKS, sections - 1, Math.round(length / (LINK * size))));
    return { around: down ? (open ? ACROSS : AROUND) : 0, down };
  });
  const total = () => out.reduce((n, s) => n + s.around * s.down, 0);
  // (over the person's controls: the spacing round widens — the layer with the most chains first; then links go)
  while (total() > CONTROLS) {
    let most = null;
    for (const [i, s] of out.entries()) if (s.down > 0 && s.around > least[i] && (!most || s.around * s.down > most.around * most.down)) most = s;
    if (most) { most.around--; continue; }
    for (const s of out) if (s.down > 0 && (!most || s.down > most.down)) most = s;
    most.down--;
    if (!most.down) most.around = 0;
  }
  return out;
}

export class Hang {
  // hips — the middle between the hip joints at rest, sd, fw — the body's side and forward there, level (the person's
  // own space); cut — a garment's layer: { straight, firstY, hemY } (a straight cut's sides are lines from its top
  // section, at firstY, to its hem, at hemY), null — a sheet: its sections are not widened
  constructor({ rings, around, down, open, loose, row, legs, hips, sd, fw, cut = null }) {
    const sections = rings.length, n = rings[0].length, C = around, D = down, W = D + 1, N = C * W;
    // the controls' places at rest: level 0 the section it hangs from (pinned: the hips'), then a level a link —
    // each chain at its share of the way round (between two of the section's points, mixed); open: of the way across,
    // the first chain at one edge, the last at the other
    const rest = new Float64Array(N * 3), length = new Float64Array(N), apart = new Float64Array(N);
    for (let c = 0; c < C; c++) for (let l = 0; l <= D; l++) {
      const ring = rings[Math.round(l * (sections - 1) / D)], f = open ? c * (n - 1) / (C - 1) : c * n / C, q = Math.floor(f), u = f - q, o = (c * W + l) * 3;
      const a = ring[q % n], b = ring[open ? Math.min(q + 1, n - 1) : (q + 1) % n];
      for (let k = 0; k < 3; k++) rest[o + k] = a[k] + (b[k] - a[k]) * u;
    }
    // (far: how far along its chain a control is from where the chain hangs from)
    const far = new Float64Array(N);
    for (let c = 0; c < C; c++) for (let l = 0; l <= D; l++) {
      const i = c * W + l, o = i * 3, up = o - 3, next = (((c + 1) % C) * W + l) * 3;
      const ux = rest[o] - rest[up], uy = rest[o + 1] - rest[up + 1], uz = rest[o + 2] - rest[up + 2], nx = rest[o] - rest[next], ny = rest[o + 1] - rest[next + 1], nz = rest[o + 2] - rest[next + 2];
      length[i] = l ? Math.sqrt(ux * ux + uy * uy + uz * uz) : 0;
      far[i] = l ? far[i - 1] + length[i] : 0;
      apart[i] = Math.sqrt(nx * nx + ny * ny + nz * nz);
    }
    // each control's way out of its level's middle (across, forwards), each level's reach each way (across +, −,
    // forwards +, −), its height and how far below it the next one is: what the legs inside it widen, as they go
    const off = new Float64Array(N * 2), ext = new Float64Array(W * 4), ys = new Float64Array(W).fill(-Infinity), drop = new Float64Array(W);
    for (let c = 0; c < C; c++) for (let l = 0; l <= D; l++) {
      const i = c * W + l, dx = rest[i * 3] - hips[0], dz = rest[i * 3 + 2] - hips[2], x = dx * sd[0] + dz * sd[2], z = dx * fw[0] + dz * fw[2];
      off[i * 2] = x; off[i * 2 + 1] = z;
      ext[l * 4] = Math.max(ext[l * 4], x); ext[l * 4 + 1] = Math.max(ext[l * 4 + 1], -x); ext[l * 4 + 2] = Math.max(ext[l * 4 + 2], z); ext[l * 4 + 3] = Math.max(ext[l * 4 + 3], -z);
      ys[l] = Math.max(ys[l], rest[i * 3 + 1]);
    }
    for (let l = 0; l <= D; l++) drop[l] = l < D ? ys[l] - ys[l + 1] : ys[D - 1] - ys[D];
    // (beside: the chains that have a neighbour to stay near — round, every one; open, all but the last)
    Object.assign(this, { C, D, sections, n, open, beside: open ? C - 1 : C, row, rest, length, apart, far, legs, count: C * D,
      hips: Float64Array.from(hips), sd: Float64Array.from(sd), fw: Float64Array.from(fw), cut, off, ext, ys, drop,
      // (the lower the looser)
      loose: Float64Array.from({ length: D + 1 }, (_, l) => (l / D) ** 0.8 * loose),
      // this frame's, the same arrays each: the garment as wide as the legs in it need (the person's own space, at
      // rest), what the legs need of each level and how much wider that makes it, where each control lies over the
      // thighs and how much it does, how far it may be from its neighbour round the layer, each chain's outer side
      shaped: Float64Array.from(rest), need: new Float64Array(W * 4), wide: new Float64Array(W * 4).fill(1), laid: new Float64Array(N * 3), lays: new Float64Array(N), span: new Float64Array(N), out: new Float64Array(C * 2) });
  }

  // the rows a point of the layer's mesh is skinned to and how much to each: q of n round section r — the two chains
  // it is between, the two levels (level 0: the pelvis's own row), into out ([row, weight] × 4)
  weights(r, q, out) {
    const { C, D, sections, n, row, open } = this, fl = r * D / (sections - 1), l0 = Math.min(D - 1, Math.floor(fl)), tl = fl - l0;
    const fc = open ? q * (C - 1) / (n - 1) : q * C / n, c0 = open ? Math.min(C - 2, Math.floor(fc)) : Math.floor(fc) % C, c1 = open ? c0 + 1 : (c0 + 1) % C;
    const tc = fc - (open ? c0 : Math.floor(fc));
    const at = (c, l) => (l ? row + c * D + l - 1 : AT.Hips);
    out[0] = at(c0, l0); out[1] = (1 - tl) * (1 - tc);
    out[2] = at(c1, l0); out[3] = (1 - tl) * tc;
    out[4] = at(c0, l0 + 1); out[5] = tl * (1 - tc);
    out[6] = at(c1, l0 + 1); out[7] = tl * tc;
    return out;
  }

  // a person's own: where each control is and was (in what carries them), where the pelvis was, whether it is on
  sway() {
    const n = this.C * (this.D + 1);
    return { x: new Float64Array(n * 3), xp: new Float64Array(n * 3), goal: new Float64Array(n * 3), hips: new Float64Array(3), on: false };
  }

  // A garment as wide as the legs in it need (as it was made round them at rest: each section round what of the legs
  // is above the next; a straight cut — a coat a trapezoid — its sides straight lines from its top to a hem round the
  // legs hanging through it): each level's way out, each way, widened where the legs go further than at rest — into
  // `shaped` (the person's own space, at rest). A leg whose thigh lies is not in it: the cloth lies over it (hang).
  // h: the pelvis's row in what carries them; the legs' pieces there: PIECES, LIE
  reshape(h) {
    const { C, D, rest, shaped, cut, off, ext, ys, drop, need, wide, hips, sd, fw } = this, W = D + 1, straight = cut.straight;
    // (the middle between the hips now; the pelvis's side and forward there, level)
    const hx = (PIECES[0] + PIECES[21]) / 2, hy = (PIECES[1] + PIECES[22]) / 2, hz = (PIECES[2] + PIECES[23]) / 2;
    let ax = h[0] * sd[0] + h[1] * sd[1] + h[2] * sd[2], az = h[8] * sd[0] + h[9] * sd[1] + h[10] * sd[2], l = Math.sqrt(ax * ax + az * az) || 1;
    const sx = ax / l, sz = az / l;
    ax = h[0] * fw[0] + h[1] * fw[1] + h[2] * fw[2]; az = h[8] * fw[0] + h[9] * fw[1] + h[10] * fw[2]; l = Math.sqrt(ax * ax + az * az) || 1;
    const fx = ax / l, fz = az / l;
    need.fill(0);
    for (let r = 1; r <= D; r++) {
      const y = hy + ys[r] - hips[1], floor = y - drop[r] - 0.01, hemRow = straight && r === D;
      for (let s = 0; s < 2; s++) {
        if (LIE[s]) continue;
        // (a piece hangs: steeper than level, and all above it so — a straight cut's hem is round the legs hanging
        // through it)
        let hangs = true;
        for (let k = 0; k < 3; k++) {
          const p = (s * 3 + k) * 7, ra = PIECES[p + 6];
          let px = PIECES[p], py = PIECES[p + 1], pz = PIECES[p + 2], qx = PIECES[p + 3], qy = PIECES[p + 4], qz = PIECES[p + 5];
          hangs &&= Math.abs(py - qy) >= Math.sqrt((px - qx) * (px - qx) + (pz - qz) * (pz - qz));
          if (hemRow && !hangs) continue;
          if (py + ra < floor && qy + ra < floor) continue;
          // (cut where it goes below the floor of this section)
          if (qy + ra < floor) { const u = Math.max(0, Math.min(1, (floor - ra - py) / (qy - py || 1e-6))); qx = px + (qx - px) * u; qy = py + (qy - py) * u; qz = pz + (qz - pz) * u; }
          if (py + ra < floor) { const u = Math.max(0, Math.min(1, (floor - ra - qy) / (py - qy || 1e-6))); px = qx + (px - qx) * u; py = qy + (py - qy) * u; pz = qz + (pz - qz) * u; }
          for (let e = 0; e < 2; e++) {
            const dx = (e ? qx : px) - hx, dz = (e ? qz : pz) - hz, x = dx * sx + dz * sz, z = dx * fx + dz * fz;
            need[r * 4] = Math.max(need[r * 4], x + ra); need[r * 4 + 1] = Math.max(need[r * 4 + 1], ra - x);
            need[r * 4 + 2] = Math.max(need[r * 4 + 2], z + ra); need[r * 4 + 3] = Math.max(need[r * 4 + 3], ra - z);
          }
        }
      }
    }
    // (each level's way out each way: its own, or what the legs need of it — a straight cut's at least on a line from
    // its top to its hem's)
    const hem = D * 4;
    for (let r = 1; r <= D; r++) for (let k = 0; k < 4; k++) {
      const e = ext[r * 4 + k], u = straight ? Math.max(0, Math.min(1, (cut.firstY - ys[r]) / (cut.firstY - cut.hemY || 1))) : 0;
      wide[r * 4 + k] = Math.max(e + Math.max(0, need[hem + k] - ext[hem + k]) * u, need[r * 4 + k]) / (e || 1);
    }
    for (let c = 0; c < C; c++) for (let r = 1; r <= D; r++) {
      const i = c * W + r, x = off[i * 2], z = off[i * 2 + 1], gx = x * ((x > 0 ? wide[r * 4] : wide[r * 4 + 1]) - 1), gz = z * ((z > 0 ? wide[r * 4 + 2] : wide[r * 4 + 3]) - 1);
      shaped[i * 3] = rest[i * 3] + sd[0] * gx + fw[0] * gz; shaped[i * 3 + 1] = rest[i * 3 + 1]; shaped[i * 3 + 2] = rest[i * 3 + 2] + sd[2] * gx + fw[2] * gz;
    }
  }

  // Where it hangs in this pose (5.8), into goal (in what carries them): the garment as wide as the legs in it need,
  // carried by the pelvis — or, where a thigh lies (sitting, a knee drawn up), over it: each control's way from where
  // its chain hangs from — to the thigh's top where the thigh is as far along as it, along it, over the knee, then
  // along the shin's front to the ankle where the shin bears it (its front turned up), else straight down from the
  // knee, and down — as far along that as it is along its chain: each link as long as it was made; round the thigh by
  // as far aside of it as the chain hangs (over it, at its side, down beside it); between two lying thighs the two
  // ways mixed by how near each is, what is off both sagging into the gap. What does not lie over them hangs from
  // where it hangs from about the world's up — not the pelvis's, tipped back as it sits. Worked out with the hips at
  // rest (LAP: the legs there). h: the pelvis's row in what carries them
  hang(goal, h) {
    const { C, D, rest, shaped, laid, lays } = this, W = D + 1, R = TILT;
    if (this.cut) this.reshape(h);
    lays.fill(0);
    const lying = LIE[0] + LIE[1];
    this.lap(h, lying);
    for (let c = 0; c < C; c++) for (let l = 0; l <= D; l++) {
      const i = c * W + l, o = i * 3, t = c * W * 3;
      let x = shaped[o], y = shaped[o + 1], z = shaped[o + 2];
      // (a thigh lies: what is not over one hangs about the world's up; what is, as much as it lies over it, there)
      if (lying && l) {
        const dx = x - rest[t], dy = y - rest[t + 1], dz = z - rest[t + 2], w = lays[i];
        x = rest[t] + R[0] * dx + R[1] * dy + R[2] * dz; y = rest[t + 1] + R[3] * dx + R[4] * dy + R[5] * dz; z = rest[t + 2] + R[6] * dx + R[7] * dy + R[8] * dz;
        x += (laid[o] - x) * w; y += (laid[o + 1] - y) * w; z += (laid[o + 2] - z) * w;
      }
      goal[o] = h[0] * x + h[1] * y + h[2] * z + h[3]; goal[o + 1] = h[4] * x + h[5] * y + h[6] * z + h[7]; goal[o + 2] = h[8] * x + h[9] * y + h[10] * z + h[11];
    }
  }

  // What of it lies over the thighs (hang's way, with the hips at rest): where each control goes, into laid; how much
  // it lies, into lays; the turn from the pelvis's up to the world's, into TILT. h: the pelvis's row in what carries
  // them. A function of its own: it first runs when someone first sits, and the engine's compiler then makes anew
  // only it — what hangs is not worked out slowly meanwhile (and what is worked out slowly makes numbers on the heap).
  // Called every step, back at once when no thigh lies (lying: how many do): its call is no way hang has never taken
  lap(h, lying) {
    if (!lying) return;
    const { C, D, rest, shaped, far, laid, lays, legs, hips } = this, W = D + 1, K = LAP, U = UP, R = TILT, Wy = WAY;
    // (the pelvis's row undone: a point of now, where it is with the hips at rest; the world's up, there; the turn
    // from the pelvis's up to it, about up × it — rows)
    U[0] = h[4]; U[1] = h[5]; U[2] = h[6];
    const kx = U[2], kz = -U[0], sn = Math.sqrt(kx * kx + kz * kz), cs = U[1], ax = sn > 1e-9 ? kx / sn : 1, az = sn > 1e-9 ? kz / sn : 0;
    R[0] = cs + ax * ax * (1 - cs); R[1] = -az * sn; R[2] = ax * az * (1 - cs);
    R[3] = az * sn; R[4] = cs; R[5] = -ax * sn;
    R[6] = ax * az * (1 - cs); R[7] = ax * sn; R[8] = cs + az * az * (1 - cs);
    for (let s = 0; s < 2; s++) {
      const o = s * LEGK;
      // (its hip, its knee, its ankle)
      for (let e = 0; e < 3; e++) {
        const p = (s * 3 + (e ? e - 1 : 0)) * 7 + (e ? 3 : 0), x = PIECES[p] - h[3], y = PIECES[p + 1] - h[7], z = PIECES[p + 2] - h[11];
        for (let r = 0; r < 3; r++) K[o + e * 3 + r] = h[r] * x + h[4 + r] * y + h[8 + r] * z;
      }
      // (the thigh's way along and up from it — up as the world has it, less its share along it —, the shin's; the
      // thigh's length, the shin's)
      for (let b = 0; b < 2; b++) {
        const a = o + b * 3, u = o + 9 + b * 6, ux = K[a + 3] - K[a], uy = K[a + 4] - K[a + 1], uz = K[a + 5] - K[a + 2], len = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1e-6;
        K[u] = ux / len; K[u + 1] = uy / len; K[u + 2] = uz / len;
        const along = K[u] * U[0] + K[u + 1] * U[1] + K[u + 2] * U[2];
        const vx = U[0] - along * K[u], vy = U[1] - along * K[u + 1], vz = U[2] - along * K[u + 2], l = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
        K[u + 3] = vx / l; K[u + 4] = vy / l; K[u + 5] = vz / l;
        K[o + (b ? 22 : 23)] = len;
      }
      K[o + 21] = LIE[s];
      // (the shin's front: the thigh's way less its share along the shin — the knee's outside; a straight leg's, the
      // shin's up)
      const d = K[o + 9] * K[o + 15] + K[o + 10] * K[o + 16] + K[o + 11] * K[o + 17];
      const fx = K[o + 9] - d * K[o + 15], fy = K[o + 10] - d * K[o + 16], fz = K[o + 11] - d * K[o + 17], fl = Math.sqrt(fx * fx + fy * fy + fz * fz);
      // (both worked out, one taken: a way first taken late is not code the compiler has never seen run)
      const straight = fl < 0.2, by = straight ? 1 : fl, ux = K[o + 18], uy = K[o + 19], uz = K[o + 20];
      K[o + 24] = (straight ? ux : fx) / by; K[o + 25] = (straight ? uy : fy) / by; K[o + 26] = (straight ? uz : fz) / by;
    }
    // (how far over a thigh's line the cloth lies: as far as it keeps out of it; by the knee as much thicker or
    // thinner as the shin is)
    const r = legs[0] + OFF + 0.005, arc = QUARTER * 2 * r, kn = (legs[1] + OFF + 0.005) / r, hx = hips[0], hz = hips[2];
    for (let c = 0; c < C; c++) {
      const top = c * W * 3, sx = rest[top], sy = rest[top + 1], sz = rest[top + 2], N = LAPN;
      // (each thigh's near, lat, at — none: 0)
      N.fill(0);
      for (let s = 0; s < 2; s++) {
        const o = s * LEGK;
        if (!K[o + 21]) continue;
        const ux = K[o + 9], uz = K[o + 11], hl = Math.sqrt(ux * ux + uz * uz) || 1;
        // (before the hips, the way the thigh goes; aside of the thigh: across its level way — how much it lies over
        // it: further aside than twice its thickness, less —; and where across the hips the thigh is, as far along)
        const lat = ((sx - K[o]) * -uz + (sz - K[o + 2]) * ux) / hl;
        if ((sx - hx) * ux + (sz - hz) * uz <= 0) continue;
        const off = Math.max(0, Math.min(1, (Math.abs(lat) - r * 2) / (r * 3 - r * 2))), near = 1 - off * off * (3 - 2 * off);
        if (near <= 0) continue;
        const at = K[o] + K[o + 9] * Math.max(0, (sx - K[o]) * K[o + 9] + (sy - K[o + 1]) * K[o + 10] + (sz - K[o + 2]) * K[o + 11]);
        N[3 * s] = near; N[3 * s + 1] = lat; N[3 * s + 2] = at;
      }
      const near0 = N[0], lat0 = N[1], at0 = N[2], near1 = N[3], lat1 = N[4], at1 = N[5];
      if (near0 <= 0 && near1 <= 0) continue;
      // (between two lying thighs — one aside each way across the hips — over both, sagging between them as a sheet
      // between two holds does; else round the nearer)
      const both = near0 > 0 && near1 > 0 && (sx - at0) * (sx - at1) < 0;
      N[6] = both ? Math.abs(lat1) / (Math.abs(lat0) + Math.abs(lat1) || 1) : near0 > 0 && (near1 <= 0 || Math.abs(lat0) <= Math.abs(lat1)) ? 1 : 0;
      const share0 = N[6];
      const lay = both ? Math.max(near0, near1) : share0 ? near0 : near1, e0 = Math.abs(lat0) - r, e1 = Math.abs(lat1) - r;
      for (let l = 1; l <= D; l++) {
        const i = c * W + l, d = far[i], G = LAPG;
        // (G: where it goes — the thighs' ways mixed by their shares — and the first's less the second's)
        G.fill(0);
        for (let s = 0; s < 2; s++) {
          const o = s * LEGK, share = s === 0 ? share0 : 1 - share0;
          if (share <= 0 || (s === 0 ? near0 : near1) <= 0) continue;
          const lat = s === 0 ? lat0 : lat1, ux = K[o + 9], uz = K[o + 11], hl = Math.sqrt(ux * ux + uz * uz) || 1, ex = -uz / hl, ez = ux / hl;
          // (its way off the thigh's line: up and aside — round it by its arc, then down beside it)
          if (Math.abs(lat) <= arc) { const t = lat / arc * Math.PI / 2; G[6] = r * Math.sin(t); G[7] = r * Math.cos(t); }
          else { G[6] = Math.sign(lat) * r; G[7] = -(Math.abs(lat) - arc); }
          const a = G[6], b = G[7];
          // the way: where it hangs from; the thigh where it is as far along; the knee; the knee's front as the shin
          // has it; the ankle's front where the shin bears it (else as far straight down from the knee) — then down
          const t0 = Math.max(0, Math.min(K[o + 23], (sx - K[o]) * K[o + 9] + (sy - K[o + 1]) * K[o + 10] + (sz - K[o + 2]) * K[o + 11]));
          const f = t0 / (K[o + 23] || 1), b0 = b * (1 + (kn - 1) * f), a0 = a * (1 + (kn - 1) * f), b1 = b * kn, a1 = a * kn;
          const over = Math.max(0, b) * kn, under = Math.min(0, b), shin = K[o + 22];
          G[8] = Math.max(0, Math.min(1, (K[o + 24] * U[0] + K[o + 25] * U[1] + K[o + 26] * U[2]) / 0.25));
          const borne = G[8], bear = borne * borne * (3 - 2 * borne);
          Wy[0] = sx; Wy[1] = sy; Wy[2] = sz;
          for (let k = 0; k < 3; k++) {
            const e = k === 0 ? ex : k === 2 ? ez : 0, side = e * a1, low = U[k] * under, front = K[o + 3 + k] + K[o + 24 + k] * over + side + low;
            Wy[3 + k] = K[o + k] + K[o + 9 + k] * t0 + K[o + 12 + k] * b0 + e * a0;
            Wy[6 + k] = K[o + 3 + k] + K[o + 12 + k] * b1 + side;
            Wy[9 + k] = front;
            Wy[12 + k] = (K[o + 6 + k] + K[o + 24 + k] * over + side + low) * bear + (front - U[k] * shin) * (1 - bear);
          }
          // (as far along the way as it is along its chain — into A: x, y, z; past the way's end, on down; A[3]: what
          // is left of the way to go)
          const A = LAPA;
          A[3] = d;
          let along = false;
          for (let q = 0; q < 4; q++) {
            const p = q * 3, wx = Wy[p + 3] - Wy[p], wy = Wy[p + 4] - Wy[p + 1], wz = Wy[p + 5] - Wy[p + 2], ln = Math.sqrt(wx * wx + wy * wy + wz * wz);
            if (A[3] <= ln) { const u = A[3] / (ln || 1); A[0] = Wy[p] + (Wy[p + 3] - Wy[p]) * u; A[1] = Wy[p + 1] + (Wy[p + 4] - Wy[p + 1]) * u; A[2] = Wy[p + 2] + (Wy[p + 5] - Wy[p + 2]) * u; along = true; break; }
            A[3] -= ln;
          }
          const ox = Wy[12] - U[0] * A[3], oy = Wy[13] - U[1] * A[3], oz = Wy[14] - U[2] * A[3];
          const x = along ? A[0] : ox, y = along ? A[1] : oy, z = along ? A[2] : oz;
          G[0] += x * share; G[1] += y * share; G[2] += z * share;
          if (s === 0) { G[3] = x; G[4] = y; G[5] = z; } else { G[3] -= x; G[4] -= y; G[5] -= z; }
        }
        const gx = G[0], gy = G[1], gz = G[2], px = G[3], py = G[4], pz = G[5];
        // (off both thighs' tops, between them: as deep as a sheet across the gap between them, w, with as much more
        // cloth as it was made wider there than at its top — a flared skirt's hem the slacker — sags: a parabola's
        // depth for its length, w + 8h²/3w)
        if (both && e0 > 0 && e1 > 0) {
          const ax2 = shaped[i * 3] - hx, az2 = shaped[i * 3 + 2] - hz, tx = sx - hx, tz = sz - hz, slack = Math.max(0, Math.sqrt(ax2 * ax2 + az2 * az2) / (Math.sqrt(tx * tx + tz * tz) || 1) - 1);
          const u = e0 / (e0 + e1), w = Math.sqrt(px * px + py * py + pz * pz) * (e0 + e1) / (Math.abs(lat0) + Math.abs(lat1)), sag = 4 * u * (1 - u) * w * Math.sqrt(0.375 * slack);
          laid[i * 3] = gx - U[0] * sag; laid[i * 3 + 1] = gy - U[1] * sag; laid[i * 3 + 2] = gz - U[2] * sag;
        } else { laid[i * 3] = gx; laid[i * 3 + 1] = gy; laid[i * 3 + 2] = gz; }
        lays[i] = lay;
      }
    }
  }

  step(S, hips, T, where, fresh, rows) {
    const { C, D, rest, loose, legs, lays, span, apart, out, beside } = this, W = D + 1, n = C * W, { x, xp, goal } = S, dt = where[4];
    // the person's space into what carries them: upright at their place, turned as they face in it
    const cs = Math.cos(Math.PI - where[3]), sn = Math.sin(Math.PI - where[3]), px = where[0], py = where[1], pz = where[2];
    // (the pelvis's turn in it: the turn about the vertical over the skinning row's)
    const h = HIPS;
    for (let k = 0; k < 4; k++) {
      const a = hips[k], b = hips[4 + k], c = hips[8 + k];
      h[k] = cs * a + sn * c + (k === 3 ? px : 0); h[4 + k] = b + (k === 3 ? py : 0); h[8 + k] = -sn * a + cs * c + (k === 3 ? pz : 0);
    }
    // the legs' pieces; whether each thigh lies (turned up from hanging by more than 60°: sitting, a knee drawn up)
    for (let k = 0; k < LEGS.length; k++) {
      const a = LEGS[k][0] * 3, b = LEGS[k][1] * 3, o = k * 7;
      PIECES[o] = cs * T[a] + sn * T[a + 2] + px; PIECES[o + 1] = T[a + 1] + py; PIECES[o + 2] = -sn * T[a] + cs * T[a + 2] + pz;
      PIECES[o + 3] = cs * T[b] + sn * T[b + 2] + px; PIECES[o + 4] = T[b + 1] + py; PIECES[o + 5] = -sn * T[b] + cs * T[b + 2] + pz;
      PIECES[o + 6] = legs[LEGS[k][2]] + OFF;
    }
    for (let s = 0; s < 2; s++) { const o = s * 21, tx = PIECES[o + 3] - PIECES[o], ty = PIECES[o + 4] - PIECES[o + 1], tz = PIECES[o + 5] - PIECES[o + 2]; LIE[s] = PIECES[o + 1] - PIECES[o + 4] < LIES * Math.sqrt(tx * tx + ty * ty + tz * tz) ? 1 : 0; }
    // where it hangs in this pose; then, of it: how far a control may be from its neighbour round the layer (as far
    // as it was made, or as the pose has the two), and each chain's outer side — away from the body's axis, level
    this.hang(goal, h);
    const mx = (PIECES[0] + PIECES[21]) / 2, mz = (PIECES[2] + PIECES[23]) / 2;
    for (let c = 0; c < C; c++) {
      const t = c * W * 3, ox = goal[t] - mx, oz = goal[t + 2] - mz, l = Math.sqrt(ox * ox + oz * oz);
      out[c * 2] = l > 1e-9 ? ox / l : 0; out[c * 2 + 1] = l > 1e-9 ? oz / l : 0;
    }
    for (let c = 0; c < beside; c++) for (let l = 1; l <= D; l++) {
      const i = c * W + l, o = i * 3, j = (((c + 1) % C) * W + l) * 3;
      const gx = goal[j] - goal[o], gy = goal[j + 1] - goal[o + 1], gz = goal[j + 2] - goal[o + 2];
      span[i] = Math.max(apart[i], Math.sqrt(gx * gx + gy * gy + gz * gz));
    }
    LOW[0] = where[5] + py + 0.01;
    const hx = h[3], hy = h[7], hz = h[11];
    if (fresh || !S.on || dt > LATE) {
      // put on where the body is: as it hangs in this pose, then kept as long as it was made, out of the legs — not
      // moving
      x.set(goal);
      for (let pass = 0; pass < ON; pass++) this.keep(x, goal);
      xp.set(x);
      S.on = true;
    } else if (dt > 0) {
      // (most of the pelvis's own going comes along at once: the rest it lags)
      const cx = (hx - S.hips[0]) * CARRY, cy = (hy - S.hips[1]) * CARRY, cz = (hz - S.hips[2]) * CARRY;
      for (let o = 0; o < n * 3; o += 3) { x[o] += cx; x[o + 1] += cy; x[o + 2] += cz; xp[o] += cx; xp[o + 1] += cy; xp[o + 2] += cz; }
      const steps = dt > LONG ? 2 : 1, hh = dt / steps, damp = Math.exp(-DRAG * hh);
      for (let s = 0; s < steps; s++) {
        for (let c = 0; c < C; c++) for (let l = 1; l <= D; l++) {
          // (what lies over a thigh is that much less loose: held there, as by friction)
          const i = c * W + l, o = i * 3, free = loose[l] * (1 - LAID * lays[i]), pull = 1 - Math.exp(-PULL * (1 - (1 - LOOSEST) * free) * hh);
          for (let k = 0; k < 3; k++) {
            const was = x[o + k];
            let now = was + (was - xp[o + k]) * damp - (k === 1 ? GRAVITY * hh * hh * free : 0);
            now += (goal[o + k] - now) * pull;
            xp[o + k] = was; x[o + k] = now;
          }
        }
        for (let pass = 0; pass < PASSES; pass++) this.keep(x, goal);
      }
    }
    S.hips[0] = hx; S.hips[1] = hy; S.hips[2] = hz;
    // each control's row: the pelvis's turn, turned on from the link as the garment was made (carried by the pelvis)
    // to the link as it hangs now, and the place that takes its point at rest to where it is — back in the person's
    // own space
    for (let c = 0; c < C; c++) for (let l = 1; l <= D; l++) {
      const i = c * W + l, o = i * 3, up = o - 3;
      const lx = rest[o] - rest[up], ly = rest[o + 1] - rest[up + 1], lz = rest[o + 2] - rest[up + 2];
      WAYS[0] = h[0] * lx + h[1] * ly + h[2] * lz; WAYS[1] = h[4] * lx + h[5] * ly + h[6] * lz; WAYS[2] = h[8] * lx + h[9] * ly + h[10] * lz; WAYS[3] = x[o] - x[up]; WAYS[4] = x[o + 1] - x[up + 1]; WAYS[5] = x[o + 2] - x[up + 2];
      turn();
      const rx = rest[o], ry = rest[o + 1], rz = rest[o + 2], at = (this.row + c * D + l - 1) * 12;
      for (let r = 0; r < 3; r++) {
        // (Q · the pelvis's turn in what carries them)
        const m0 = Q[r * 3] * h[0] + Q[r * 3 + 1] * h[4] + Q[r * 3 + 2] * h[8], m1 = Q[r * 3] * h[1] + Q[r * 3 + 1] * h[5] + Q[r * 3 + 2] * h[9], m2 = Q[r * 3] * h[2] + Q[r * 3 + 1] * h[6] + Q[r * 3 + 2] * h[10];
        M[r * 4] = m0; M[r * 4 + 1] = m1; M[r * 4 + 2] = m2; M[r * 4 + 3] = x[o + r] - (m0 * rx + m1 * ry + m2 * rz);
      }
      // (out of what carries them: the turn about the vertical undone, their place taken off)
      for (let k = 0; k < 4; k++) {
        const a = M[k] - (k === 3 ? px : 0), b = M[4 + k] - (k === 3 ? py : 0), e = M[8 + k] - (k === 3 ? pz : 0);
        rows[at + k] = cs * a - sn * e; rows[at + 4 + k] = b; rows[at + 8 + k] = sn * a + cs * e;
      }
    }
  }

  // kept: each link as long as it was made (from the top down: the one above holds), no further from its neighbours
  // round the layer than it may be (span), out of the legs — on its chain's own outer side: away from the body's
  // axis; up, where it lies on the length of a thigh that lies; never to the nearest surface (that is beside or
  // under a thigh that lies, and inside the hem for a leg that strides) —, over the floor (LOW)
  keep(x, goal) {
    const { C, D, length, span, beside, out } = this, W = D + 1, low = LOW[0];
    for (let c = 0; c < C; c++) { const o = c * W * 3; x[o] = goal[o]; x[o + 1] = goal[o + 1]; x[o + 2] = goal[o + 2]; }
    for (let c = 0; c < beside; c++) for (let l = 1; l <= D; l++) {
      const i = c * W + l, o = i * 3, j = (((c + 1) % C) * W + l) * 3;
      const dx = x[j] - x[o], dy = x[j + 1] - x[o + 1], dz = x[j + 2] - x[o + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > span[i] && d > 1e-9) {
        const k = 0.5 * (d - span[i]) / d;
        x[o] += dx * k; x[o + 1] += dy * k; x[o + 2] += dz * k; x[j] -= dx * k; x[j + 1] -= dy * k; x[j + 2] -= dz * k;
      }
    }
    for (let c = 0; c < C; c++) for (let l = 1; l <= D; l++) {
      const i = c * W + l, o = i * 3, up = o - 3, nx = out[c * 2], nz = out[c * 2 + 1];
      for (let k = 0; k < LEGS.length; k++) {
        const p = k * 7, ax = PIECES[p], ay = PIECES[p + 1], az = PIECES[p + 2], bx = PIECES[p + 3] - ax, by = PIECES[p + 4] - ay, bz = PIECES[p + 5] - az, r = PIECES[p + 6];
        const u = Math.max(0, Math.min(1, ((x[o] - ax) * bx + (x[o + 1] - ay) * by + (x[o + 2] - az) * bz) / (bx * bx + by * by + bz * bz || 1)));
        const dx = x[o] - (ax + bx * u), dy = x[o + 1] - (ay + by * u), dz = x[o + 2] - (az + bz * u), dd = dx * dx + dy * dy + dz * dz;
        if (dd >= r * r) continue;
        // (over the length of a thigh that lies — not past its knee or its hip, not under it —: straight up out of it;
        // else along the chain's outer side, as far as takes it out)
        if (k % 3 === 0 && LIE[k / 3] && u > 0 && u < 1 && dy >= 0) x[o + 1] = ay + by * u + Math.sqrt(Math.max(0, r * r - dx * dx - dz * dz));
        else { const along = dx * nx + dz * nz, t = Math.sqrt(along * along + r * r - dd) - along; x[o] += nx * t; x[o + 2] += nz * t; }
      }
      if (x[o + 1] < low) x[o + 1] = low;
      const dx = x[o] - x[up], dy = x[o + 1] - x[up + 1], dz = x[o + 2] - x[up + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > 1e-9) { const k = length[i] / d; x[o] = x[up] + dx * k; x[o + 1] = x[up + 1] + dy * k; x[o + 2] = x[up + 2] + dz * k; }
    }
  }
}

// (scratch: the pelvis's row in what carries them; a control's row there; the legs' pieces — two ends and a
// thickness each; the turn from one direction to another, 3 × 3 rows)
const HIPS = new Float64Array(12), M = new Float64Array(12), PIECES = new Float64Array(LEGS.length * 7), Q = new Float64Array(9);
// (… whether each thigh lies; the legs with the hips at rest — LEGK a leg: its hip, knee, ankle; the thigh's way along
// and up from it; the shin's; whether the thigh lies; the shin's length, the thigh's; the shin's front —, the world's
// up there, the turn from the pelvis's up to it; a control's way over a thigh: five points)
const LEGK = 27, LIE = new Uint8Array(2), LAP = new Float64Array(2 * LEGK), UP = new Float64Array(3), TILT = new Float64Array(9), WAY = new Float64Array(15);
// (… a chain over the thighs: each thigh's near, lat, at and the first's share; a link's way over them and its turn
// round a thigh — a, b — and how much the shin bears it; a point along the way and what is left of the way: numbers a
// loop carries, or a branch leaves, are kept in arrays — 5.16)
const LAPN = new Float64Array(7), LAPG = new Float64Array(9), LAPA = new Float64Array(4);
// (… the floor's height in what carries them, a little over it; two directions: a, then b)
const LOW = new Float64Array(1), WAYS = new Float64Array(6);
// the turn taking direction a to direction b (WAYS), into Q (none where either is nothing, or they are opposite: as
// it is)
function turn() {
  let ax = WAYS[0], ay = WAYS[1], az = WAYS[2], bx = WAYS[3], by = WAYS[4], bz = WAYS[5], l = Math.sqrt(ax * ax + ay * ay + az * az), m = Math.sqrt(bx * bx + by * by + bz * bz);
  Q[0] = Q[4] = Q[8] = 1; Q[1] = Q[2] = Q[3] = Q[5] = Q[6] = Q[7] = 0;
  if (l < 1e-9 || m < 1e-9) return;
  ax /= l; ay /= l; az /= l; bx /= m; by /= m; bz /= m;
  let x = ay * bz - az * by, y = az * bx - ax * bz, z = ax * by - ay * bx, w = 1 + ax * bx + ay * by + az * bz;
  l = Math.sqrt(x * x + y * y + z * z + w * w);
  if (l < 1e-7) return;
  x /= l; y /= l; z /= l; w /= l;
  Q[0] = 1 - 2 * (y * y + z * z); Q[1] = 2 * (x * y - z * w); Q[2] = 2 * (x * z + y * w);
  Q[3] = 2 * (x * y + z * w); Q[4] = 1 - 2 * (x * x + z * z); Q[5] = 2 * (y * z - x * w);
  Q[6] = 2 * (x * z - y * w); Q[7] = 2 * (y * z + x * w); Q[8] = 1 - 2 * (x * x + y * y);
}
