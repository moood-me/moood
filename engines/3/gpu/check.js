// The whole-set check of engine 3's GPU programs — the engine's side of it: every WGSL
// module, every layout, every pipeline of a world that has everything, and one frame of every pass, on a device that
// executes nothing and validates everything (Dawn's GPU-less backend: Chrome's own WGSL compiler and its own
// validation). Its runner, test/gpu/check.mjs (moood's CI runs it), makes Dawn's entry in node and prints what this
// returns; nothing of the engine calls this module.
//   check(entry, own) → every error, as lines. `entry` — what navigator.gpu is in a browser; `own` — the own shaders
// to compile with the set: [{ text, names }], as a compiled spec's `has.own` has them.
//   What is created: the device, asked for exactly the features createGpu asks for (the GPU-less adapter offers every
// feature: asked for all, it would hide a layout that needs one); `gpu` over it (GP1 with `device`: no canvas — the
// canvas pass draws into the stand-in gpu.canvasView() gives); GPU's four layouts with it, then PEOPLE's and RENDER's
// (GP7); then RENDER's lib.all(gpu, has) for a `has` that has everything — it assembles and compiles every
// module and asks every pipeline; then RENDER's lib.exercise(gpu), which encodes and submits the frame; then SHEETS'
// upload of painted pages (sheets/upload.js exercise: its two pipelines made, a batch encoded and submitted).
//   How an error is heard: an engine text that does not compile — by gpu.module, with its chunk and line (an own
// text's faults gpu.module hands to RENDER, and lib.all fails with them: a step's line); a pipeline that
// fails — by its promise, with its key; everything else Dawn refuses (a bind group against its layout, a texture
// bound and written in one pass, a pass's targets against its pipelines', vertex buffers, sizes) — as the device's
// uncaptured errors, each one, through host.error: the very path a viewer's thread has. (An error scope would keep
// only the first error it caught; the list has every one.) What a step throws is a line too. A step is not run when
// the step it stands on failed, and the list says so.
//   When the list is whole: lib.all settles only when every pipeline it asked has — made or failed — and every
// module's report is in (RN2); a step that throws before that leaves pipelines being made. So, before the device is
// destroyed, the check waits till no pipeline is pending (gpu.waiting()) and every module's report is in
// (gpu.reported()), and then for the errors of everything asked.
import { createGpu, features } from './gpu.js';
import { layouts as peopleLayouts } from '../people/person.wgsl.js';
import * as lib from '../render/library.js';
import { layouts as sheetsLayouts, exercise as exerciseUpload } from '../sheets/upload.js';

export async function check(entry, own) {
  const errors = [];
  let ended = false;
  const host = {
    flags: { debug: null, stand: null },
    lost(reason) { if (!ended) errors.push(`the device was lost: ${reason}`); },
    error(err) { errors.push(err.message.trim()); },
  };
  const adapter = await entry.requestAdapter();
  if (!adapter) throw new Error('no graphics adapter to check on');
  const device = await adapter.requestDevice({ requiredFeatures: features(host) });
  const gpu = await createGpu(null, host, { device });

  // the same gpu, with each failed pipeline said by its key
  const failed = new Set();
  const watched = Object.create(gpu, {
    pipeline: {
      value(key, descriptor) {
        const p = gpu.pipeline(key, descriptor);
        p.catch(err => { if (!failed.has(key)) { failed.add(key); errors.push(`pipeline ${key}: ${err.message.trim()}`); } });
        return p;
      },
    },
  });

  const step = async (name, run) => {
    try { await run(); return true; }
    catch (err) {
      // (a failed pipeline is in the list already, by its key)
      if (err.name !== 'GPUPipelineError') errors.push(`${name}: ${err.stack || err.message}`);
      return false;
    }
  };
  const has = {
    relief: true, people: true, emitters: true, casters: true, reflects: true, glass: true, clips: true, inserts: true, beams: true, own,
    // (every own text as the sky's base's too: each compiled in that wrapper)
    skyOwn: own,
  };
  const registered = await step('layouts', () => { sheetsLayouts(watched); peopleLayouts(watched); lib.layouts(watched); });
  const made = registered && await step('lib.all', () => lib.all(watched, has));
  if (made) await step('lib.exercise', () => lib.exercise(watched));
  else errors.push(registered ? 'lib.exercise was not run: the pipelines were not made' : 'lib.all and lib.exercise were not run: the layouts were not registered');
  if (registered) await step('sheets upload', () => exerciseUpload(watched));

  // no pipeline is pending (ready() ends at the first that failed: asked again till none is left), every module's
  // report is in
  for (let w = gpu.waiting(); w[0] < w[1]; w = gpu.waiting()) await gpu.ready().catch(() => {});
  await gpu.reported();
  // every error of what was asked so far is told before a scope asked after it answers
  await gpu.done();
  device.pushErrorScope('validation');
  await device.popErrorScope();
  ended = true;
  device.destroy();
  return errors;
}
