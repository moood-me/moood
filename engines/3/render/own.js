// An element's own shader (LG2): the wrapper round the author's text is render/wgsl/quad.js (`render.own`: layer(),
// emission, at_dx, at_dy, u_time, a u_<name> for each uniform; the engine's names there begin e_); a distinct text is
// one module and one set of pipelines, asked when the scene's spec is compiled (render/library.js: own:<n>,
// own:<n>:mirror, own-cast:<n> — render/quads.js finds a slot's three by number).
//   Here: each own slot's group (layout `own`) — a slot is an element's (a copy's) own shader as it runs: world.own
// gives its uniforms as its animate set them, the quad rows whose sheets `layer(k)` reads (k = 0 its base) and which
// of those sheets its text reads only where the quad stands (`stands`: WT5). The slot's uniform: its values
// (OWN.VALUES floats); then for each of its OWN.SHEETS paintings the sheet's handle, whether there is one, which ways
// it wraps (1 across, 2 down: there `layer` reads round) and whether it stands; then its rect in the painting's
// units; then how its corner lies from the painting's own — whole pages (x, y) and the rest in px, worked out here in
// doubles: a sheet that stands is read from the quad's own origin page, moved by these (SH14). Written when the slot
// or one of its quads was stamped.
import { OWN, FLAG, SHEET } from '../base.js';
import { OWN_BYTES } from './wgsl/quad.js';

const VALUES = OWN.VALUES * 4, SHEETS = VALUES, RECTS = SHEETS + OWN.SHEETS * 16, LIES = RECTS + OWN.SHEETS * 16;

export function createOwn(gpu, quads) {
  let world = null, slots = [];
  const data = new ArrayBuffer(OWN_BYTES), f32 = new Float32Array(data), u32 = new Uint32Array(data);
  const X = {};
  // a world's own slots. What the world before had is let go
  X.build = w => {
    for (const s of slots) gpu.drop(s.buffer);
    world = w;
    slots = w.own.map(o => {
      const buffer = gpu.buffer('own', OWN_BYTES, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
      return { buffer, bind: gpu.bind('own', [{ binding: 0, resource: { buffer } }]), timed: /\b(u_time|cycle)\b/.test(o.text), written: -1, group: 0, at: -1 };
    });
  };
  // whether a slot's shader reads the time — `u_time`, or `cycle`: the two of LG2's names that do (its picture moves
  // by itself)
  X.timed = slot => slots[slot].timed;
  // a slot's group of this frame (a number a run carries: render/quads.js), its uniform written if it is stale
  X.group = slot => {
    const s = slots[slot];
    if (s.at !== X.frameNo) {
      s.at = X.frameNo;
      s.group = quads.group(s.bind);
      written(slot);
    }
    return s.group;
  };
  // … its bind group itself (the sky's base draws with it: render/sky.js), its uniform written if it is stale
  X.bind = slot => { written(slot); return slots[slot].bind; };
  // a slot's uniform written if one of what it is worked out from was stamped since it was
  function written(slot) {
    const s = slots[slot], o = world.own[slot], Q = world.quads;
    let stamp = o.stamp;
    for (let k = 0; k < OWN.SHEETS; k++) if (o.quads[k] >= 0 && Q.stamp[o.quads[k]] > stamp) stamp = Q.stamp[o.quads[k]];
    if (stamp !== s.written) {
      s.written = stamp;
      f32.fill(0);
      for (let k = 0; k < Math.min(OWN.VALUES, o.values.length); k++) f32[k] = o.values[k];
      const base = o.quads[0];
      for (let k = 0; k < OWN.SHEETS; k++) {
        const q = o.quads[k], has = q >= 0 && Q.sheet[q] >= 0;
        if (!has) continue;
        const at = SHEETS / 4 + 4 * k, stands = o.stands[k] !== 0 && base >= 0;
        u32[at] = Q.sheet[q]; u32[at + 1] = 1; u32[at + 2] = (Q.flags[q] & FLAG.WRAP_X ? 1 : 0) | (Q.flags[q] & FLAG.WRAP_Y ? 2 : 0); u32[at + 3] = stands ? 1 : 0;
        for (let a = 0; a < 4; a++) f32[RECTS / 4 + 4 * k + a] = Q.rect[4 * q + a];
        if (!stands) continue;
        // (its corner from the painting's own, px: whole pages and the rest)
        for (let a = 0; a < 2; a++) {
          const px = (Q.rect[4 * base + a] - Q.rect[4 * q + a]) * SHEET.MAX_PPM, pages = Math.floor(px / SHEET.PAGE);
          f32[LIES / 4 + 4 * k + a] = pages; f32[LIES / 4 + 4 * k + 2 + a] = px - pages * SHEET.PAGE;
        }
      }
      gpu.write(s.buffer, 0, data);
    }
  }
  X.frameNo = 0;
  return X;
}
