// The stand's detail (RN8, GP11): for each stage of an R.frame call before its passes — `place` (the pages that
// arrived placed), the views placed: `view` (the stage, the frame's view and `toward`'s), `lights` (the lit set, the
// air), `land`, `mirrors`, `shadows`, `ahead` (the shots made ready ahead), `particles`; `people` (people.show and the
// blobs), the quads culled and ordered: `cull` (the frame's view), `cull mirrors`, `cull shadows`, `cull ahead`;
// the views asked: `ask` (the frame's), `ask mirrors`, `ask shadows`, `ask ahead` (`toward`'s and the shots ahead's);
// `weigh` (the cache's weighing), `judge` (the shots ahead judged), `request` (what is wanted sent to the painters),
// `outcome` (what the call draws of the rationed things, whether the picture is held or idle), `write` (the buffers
// written before the passes), and `submit` (the commands handed to the GPU) — the ms the thread spent in it; and per
// pass of 4.4 the ms the thread spent encoding it and the ms the GPU spent in it — only while R.detailed(true): the
// GPU's from gpu.times (of the frame before the last; needs the device made with timestamp-query), the thread's from
// two clock reads round each stage. Off, nothing is read and nothing is kept.
//   R.timing is ONE object made once — { [stage]: { js, gpu } }: the stages before the passes in their order, then
// the passes in theirs —, its numbers rewritten in place, of the last R.frame call. A stage has no GPU time: −1. A
// stage or a pass that did not run in the call reads −1 in both — every pass, after an idle call (gpu.times is of a
// frame before: a pass's is read only where the pass ran in this call); a held call's stages are there.
import { PASSES } from '../base.js';

const STAGES = Object.freeze(['place', 'view', 'lights', 'land', 'mirrors', 'shadows', 'ahead', 'particles', 'people', 'cull', 'cull mirrors', 'cull shadows', 'cull ahead',
  'ask', 'ask mirrors', 'ask shadows', 'ask ahead', 'weigh', 'judge', 'request', 'outcome', 'write', 'submit']);

export function createTiming(gpu) {
  const names = [...STAGES, ...PASSES], first = STAGES.length;
  const row = Object.fromEntries(names.map((name, i) => [name, i]));
  const js = new Float64Array(names.length), report = Object.fromEntries(names.map(name => [name, { js: -1, gpu: -1 }]));
  let on = false, since = 0, stage = -1;
  const T = {
    detailed(yes) { on = !!yes; gpu.timing(on); js.fill(-1); },
    // an R.frame call begins: the thread's times anew — no stage, no pass has run
    begin() { if (on) { js.fill(-1); stage = -1; } },
    // from here the thread's time is this stage's or this pass's (null: nobody's)
    mark(name) {
      if (!on) return;
      const now = performance.now();
      if (stage >= 0) js[stage] += now - since;
      stage = name ? row[name] : -1; since = now;
      if (stage >= 0 && js[stage] < 0) js[stage] = 0;
    },
    // per stage and pass { js, gpu } ms, or null when not detailed
    get timing() {
      if (!on) return null;
      for (let i = 0; i < names.length; i++) { const r = report[names[i]]; r.js = js[i]; r.gpu = i < first || js[i] < 0 ? -1 : gpu.times[i - first]; }
      return report;
    },
  };
  return T;
}
