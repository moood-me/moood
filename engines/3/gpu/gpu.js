// Engine 3's GPU layer — one object, `gpu`, made once per mount on the
// scene's thread.
// It is thin: the device, its queue and the canvas's context; tables (a storage buffer with its mirror and a dirty
// range); buffers and textures, each counted in bytes; shader modules with a compilation message told by chunk and
// line; pipelines by key, always made asynchronously; bind group layouts by name; the frame's one encoder and its one
// submit; the loss and the errors told to the thread; the passes' times for the stand's detail run and the pacer.
//   A pipeline is held by its key till gpu.forget(key) lets it go. A shader module is held by nothing here but the
// pipelines made of it — the last of them forgotten, the module is gone with it; its report (what the compiler said
// of its text) is still told when it comes.
//   A text's faults — its compilation errors, and an `enable` or a `requires`, which is refused — are told once, each
// as { chunk, line, message } (line 0: the compiler named no line). Of an engine text: to host.error, the refused
// directive thrown. Of a text given with `heard` (an author's own): to heard(faults) and nowhere else — called only
// when there are faults, at once for a refused text (gpu.module then gives null), else when the report comes
// (gpu.reported() resolves after it).
//   It does NOT keep a scene or objects, sort or batch, own any shader's content, choose a format (4.3 does), fall
// back to another format, feature level or API, resize by itself, or hide WebGPU: the areas hold pass encoders and
// call setPipeline / draw themselves, and make pipeline layouts and views from `gpu.device` as WebGPU has them.
//   What the device must give (4.6): core WebGPU and ONE feature, rg11b10ufloat-renderable; timestamp-query is
// required only when the stand asks for the detail (`host.flags.stand === 'detail'`), and otherwise taken when the
// adapter has it (`gpu.stamps`): the pacer reads the GPU's time of a frame by it (5.1). The limits are the core
// defaults: nothing higher is asked.
//   Counted (gpu.memory()): every buffer and texture made through gpu.table, gpu.buffer and gpu.texture, till it is
// dropped — a texture that can be drawn into (RENDER_ATTACHMENT) under `targets`, another under `textures`, with its
// mip levels; the timing's own small buffers under `buffers`. NOT counted: the canvas's buffer (the browser's),
// samplers, pipelines, bind groups, and what an area makes straight from `gpu.device`.
//   After the device is lost the thread is about to be ended (2.8). The host is told once (`host.lost`) and nothing
// more is told to it; the methods go on calling the lost device, on which WebGPU makes every call do nothing, and no
// promise made here is left to reject with nobody listening.
import { PASSES } from '../base.js';
import { locate, directive } from './wgsl.js';
import { layouts, SAMPLERS } from './layouts.js';

const FEATURE = 'rg11b10ufloat-renderable', TIMESTAMP = 'timestamp-query';
// the canvas's format where there is no canvas (the whole-set check in node), and the side of its stand-in
const NODE_FORMAT = 'bgra8unorm', NODE_SIDE = 64;
// the most passes a frame may have while they are timed: two timestamps a pass in one query set
const TIMED = 256;
const ROW = Object.fromEntries(PASSES.map((name, i) => [name, i]));
const FRAME = { label: 'frame' };

// bytes a texel, for the count: the formats of 4.3, and no other
const TEXEL = {
  r8unorm: 1,
  rgba8unorm: 4, 'rgba8unorm-srgb': 4, rgba8uint: 4, rg11b10ufloat: 4, r32float: 4, depth32float: 4,
  rgba16float: 8,
  rgba32float: 16,
};

// The features a device of the engine is made with — the whole-set check asks its own device for exactly these.
export function features(host) {
  return host.flags.stand === 'detail' ? [FEATURE, TIMESTAMP] : [FEATURE];
}

function textureBytes(name, d) {
  const texel = TEXEL[d.format];
  if (!texel) throw new Error(`gpu: texture '${name}' has a format that is not one of the engine's (4.3): ${d.format}`);
  const size = d.size, listed = Array.isArray(size);
  const w = listed ? size[0] : size.width, h = (listed ? size[1] : size.height) ?? 1, layers = (listed ? size[2] : size.depthOrArrayLayers) ?? 1;
  const levels = d.mipLevelCount ?? 1;
  let texels = 0;
  for (let m = 0; m < levels; m++) texels += Math.max(1, w >> m) * Math.max(1, h >> m) * layers;
  return texels * texel;
}

export async function createGpu(canvas, host, { device: given = null } = {}) {
  const needs = features(host);
  let device, info, format, context = null;
  if (given) {
    device = given;
    for (const f of needs) if (!device.features.has(f)) throw new Error(`the graphics device was made without ${f}`);
    info = device.adapterInfo;
    format = NODE_FORMAT;
  } else {
    const entry = globalThis.navigator?.gpu;
    if (!entry) throw new Error('this browser has no WebGPU');
    const adapter = await entry.requestAdapter();
    if (!adapter) throw new Error('WebGPU found no graphics adapter');
    for (const f of needs) if (!adapter.features.has(f)) throw new Error(`the graphics adapter lacks ${f}`);
    // (timestamp-query taken where the adapter has it — the pacer's measure; never required but for the detail)
    device = await adapter.requestDevice({ requiredFeatures: !needs.includes(TIMESTAMP) && adapter.features.has(TIMESTAMP) ? [...needs, TIMESTAMP] : needs });
    info = adapter.info;
    format = entry.getPreferredCanvasFormat();
  }
  // (a device that is lost already: its promise is settled, and wins this race)
  const gone = await Promise.race([device.lost, Promise.resolve(null)]);
  if (gone) throw new Error(`the graphics device was lost: ${gone.message || gone.reason}`);
  let lost = false;
  // (timestamps: the device has them — required for the detail, or taken because the adapter had them)
  const stamps = device.features.has(TIMESTAMP);
  device.lost.then(i => { lost = true; host.lost(i.message || i.reason || 'lost'); });
  device.addEventListener('uncapturederror', e => { if (!lost) host.error(new Error(`gpu: ${e.error.message}`)); });
  if (!given) {
    context = canvas.getContext('webgpu');
    if (!context) throw new Error('the canvas gave no WebGPU context');
    context.configure({ device, format, alphaMode: 'opaque' });
  }
  const queue = device.queue;

  // ── what is allocated, in bytes (GP10) ──
  const held = new Map();   // a buffer or a texture → { kind, bytes }
  const sums = { textures: 0, targets: 0, buffers: 0 };
  const count = (thing, kind, bytes) => { held.set(thing, { kind, bytes }); sums[kind] += bytes; return thing; };
  const buffer = (name, size, usage) => count(device.createBuffer({ label: name, size, usage }), 'buffers', size);
  const texture = (name, descriptor) => {
    const bytes = textureBytes(name, descriptor);
    const kind = descriptor.usage & GPUTextureUsage.RENDER_ATTACHMENT ? 'targets' : 'textures';
    return count(device.createTexture({ ...descriptor, label: name }), kind, bytes);
  };
  const drop = thing => {
    const was = held.get(thing);
    if (!was) throw new Error('gpu: dropped what was not made here, or was dropped already');
    held.delete(thing);
    sums[was.kind] -= was.bytes;
    thing.destroy();
  };

  // ── tables (GP2) ──
  function table(name, { stride, capacity }) {
    if (!(stride > 0) || stride % 4) throw new Error(`gpu: table '${name}' needs a stride of whole 4 bytes`);
    const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
    let lo = Infinity, hi = 0;   // the dirty rows: [lo, hi)
    const bytes = new ArrayBuffer(stride * capacity);
    const t = {
      buffer: buffer(name, stride * capacity, usage), bytes, f32: new Float32Array(bytes), u32: new Uint32Array(bytes), capacity, version: 0,
      mark(firstRow, rows) {
        if (!(rows > 0)) return;
        if (firstRow < 0 || firstRow + rows > t.capacity) throw new RangeError(`gpu: table '${name}' has no rows ${firstRow}…${firstRow + rows - 1}`);
        if (firstRow < lo) lo = firstRow;
        if (firstRow + rows > hi) hi = firstRow + rows;
      },
      flush() {
        if (hi <= lo) return;
        queue.writeBuffer(t.buffer, lo * stride, t.bytes, lo * stride, (hi - lo) * stride);
        lo = Infinity; hi = 0;
      },
      grow(larger) {
        if (!(larger > t.capacity)) throw new RangeError(`gpu: table '${name}' grows to more rows than it has`);
        const wider = new ArrayBuffer(stride * larger);
        new Uint8Array(wider).set(new Uint8Array(t.bytes));
        drop(t.buffer);
        t.buffer = buffer(name, stride * larger, usage);
        t.bytes = wider; t.f32 = new Float32Array(wider); t.u32 = new Uint32Array(wider);
        t.capacity = larger;
        lo = 0; hi = larger;
        t.version++;
      },
    };
    return t;
  }

  // ── modules (GP5) ──
  const NOWHERE = { chunk: null, line: 0 };
  const said = (name, f) => `shader ${name}, ${f.line ? (f.chunk === null ? `line ${f.line}` : `chunk ${f.chunk}, line ${f.line}`) : 'no line'}: ${f.message}`;
  const reports = new Set();   // the modules' reports that are not in yet
  function module(name, wgsl, heard) {
    const refused = directive(wgsl);
    if (refused) {
      const fault = { ...locate(wgsl, refused.line), message: `'${refused.word}' — a shader has no enable and no requires` };
      if (!heard) throw new Error(said(name, fault));
      heard([fault]);
      return null;
    }
    const tell = faults => {
      if (lost || !faults.length) return;
      if (heard) heard(faults);
      else for (const f of faults) host.error(new Error(said(name, f)));
    };
    // (a text that does not compile is also a validation error of the device: taken here, so it is told once, with
    // its chunk and line)
    device.pushErrorScope('validation');
    const made = device.createShaderModule({ label: name, code: wgsl });
    const caught = device.popErrorScope();
    const report = Promise.all([made.getCompilationInfo(), caught]).then(([info, error]) => {
      const faults = [];
      for (const m of info.messages) if (m.type === 'error') faults.push({ ...(m.lineNum ? locate(wgsl, m.lineNum) : NOWHERE), message: m.message });
      if (error && !faults.length) faults.push({ ...NOWHERE, message: error.message });
      tell(faults);
    }, err => {
      tell([{ ...NOWHERE, message: err.message }]);
    }).then(() => { reports.delete(report); });
    reports.add(report);
    return made;
  }

  // ── pipelines (GP6) ──
  const pipelines = new Map(), pending = new Set();   // key → its promise; those of them not settled yet
  function pipeline(key, descriptor) {
    let p = pipelines.get(key);
    if (!p) {
      p = device.createRenderPipelineAsync({ ...descriptor, label: key });
      pipelines.set(key, p);
      pending.add(p);
      const settled = () => { pending.delete(p); };
      p.then(settled, settled);
    }
    return p;
  }
  function forget(key) {
    const p = pipelines.get(key);
    if (!p) throw new Error(`gpu: no pipeline '${key}' to forget`);
    pipelines.delete(key);
    pending.delete(p);
  }

  // ── layouts, bind groups, samplers (GP7) ──
  const groups = new Map(), samplers = new Map();
  function layout(name, entries) {
    if (entries === undefined) {
      const known = groups.get(name);
      if (!known) throw new Error(`gpu: no layout '${name}'`);
      return known;
    }
    if (groups.has(name)) throw new Error(`gpu: layout '${name}' is registered twice`);
    const fresh = device.createBindGroupLayout({ label: name, entries });
    groups.set(name, fresh);
    return fresh;
  }

  // ── the frame (GP8) and the passes' times (GP11) ──
  let encoder = null, last = Promise.resolve(), flying = 0, submits = 0, done = 0;
  let stand = null;            // the timing's query set and buffers, made when it is first turned on
  let timing = false;          // asked: taken at the next begin — the stand's (`timing`) or the pacer's (`frames`)
  let detail = false, frames = false;
  // the one listener of the submits done and of the frames' GPU times (the pacer: set once — `gpu.hear`)
  let heard = null;
  let timed = false;           // this frame's passes are timed
  let record = null;           // … and their rows of `times`, in order, with the buffer they are read back into
  const batch = [null];        // the one command buffer of a submit
  // (a submit's work done: it comes down whichever way the promise ends — gpu.done() always resolves)
  const landed = () => { flying--; done++; if (heard) heard.done(done); };
  const times = new Float64Array(PASSES.length).fill(-1);

  // a frame's stamps read back: `record` — one of the stand's (its read buffer; the rows of `times` of that frame's
  // timed passes, in order, and how many; its two handlers, made with it) — is the stand's again when it is read
  function recordOf() {
    const record = { into: buffer('times read', TIMED * 16, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST), rows: new Int32Array(TIMED), n: 0, detail: false, read: null, failed: null };
    // (a stamp is two 32-bit words, ns: read as a double — exact for 104 days —, no BigInt made)
    record.read = () => {
      const w = new Uint32Array(record.into.getMappedRange(0, record.n * 16));
      if (record.detail) { times.fill(-1); for (let i = 0; i < record.n; i++) times[record.rows[i]] = 0; }
      let sum = 0;
      for (let i = 0; i < record.n; i++) {
        // (two stamps may come out of order: such a difference counts as 0)
        const ms = Math.max(0, ((w[4 * i + 2] - w[4 * i]) + (w[4 * i + 3] - w[4 * i + 1]) * 4294967296) / 1e6);
        sum += ms;
        if (record.detail) times[record.rows[i]] += ms;
      }
      record.into.unmap();
      stand.spare.push(record);
      if (heard) heard.timed(sum);
    };
    // (the device lost under the read: the host is told of the loss, by `lost`)
    record.failed = err => { if (!lost) host.error(err); };
    return record;
  }

  // without a canvas: the small texture the canvas pass draws into
  const makeStandIn = () => device.createTexture({ label: 'canvas', size: [NODE_SIDE, NODE_SIDE], format, usage: GPUTextureUsage.RENDER_ATTACHMENT });
  const standIn = context ? null : makeStandIn();

  for (const name in SAMPLERS) samplers.set(name, device.createSampler({ label: name, ...SAMPLERS[name] }));

  const gpu = {
    device, queue, format,
    info: { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description },

    // the canvas's buffer, px (RENDER sets it: RN3; never called without a canvas)
    size(w, h) {
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
    },

    table,
    buffer,
    write(target, offset, data, dataOffset, size) { queue.writeBuffer(target, offset, data, dataOffset, size); },
    texture,
    drop,
    memory() { return { textures: sums.textures, targets: sums.targets, buffers: sums.buffers, total: sums.textures + sums.targets + sums.buffers }; },

    module,
    // every module's report pending now is in (its faults told)
    reported() { return Promise.all([...reports]).then(() => {}); },
    pipeline,
    // every pipeline pending now is made; rejected by the first of those that failed
    ready() { return Promise.all([...pending]).then(() => {}); },
    // [settled, asked]: of the pipelines asked and not forgotten, how many are no longer pending — made, or failed
    waiting() { return [pipelines.size - pending.size, pipelines.size]; },
    forget,

    layout,
    bind(name, entries) { return device.createBindGroup({ label: name, layout: layout(name), entries }); },
    sampler(name) {
      const known = samplers.get(name);
      if (!known) throw new Error(`gpu: no sampler '${name}'`);
      return known;
    },

    begin() {
      // (an encoder left unsubmitted by a frame that threw is let go here: it holds nothing — its record of stamps
      // is the stand's again)
      encoder = device.createCommandEncoder(FRAME);
      if (record) stand.spare.push(record);
      timed = timing;
      record = timed ? stand.spare.pop() || recordOf() : null;
      if (record) { record.n = 0; record.detail = detail; }
    },
    // a pass of the frame begun. `descriptor` is the caller's own, the same object every frame (5.16): its label is
    // set on it, and — while the passes are timed — which two stamps it writes
    pass(name, descriptor) {
      const row = ROW[name];
      if (row === undefined) throw new Error(`gpu: '${name}' is not a pass of the frame`);
      if (!encoder) throw new Error(`gpu: pass '${name}' outside a frame`);
      if (descriptor.label !== name) descriptor.label = name;
      if (!timed) {
        if (descriptor.timestampWrites) descriptor.timestampWrites = undefined;
        return encoder.beginRenderPass(descriptor);
      }
      if (record.n === TIMED) throw new Error(`gpu: more than ${TIMED} passes in a timed frame`);
      descriptor.timestampWrites = stand.writes[record.n];
      record.rows[record.n++] = row;
      return encoder.beginRenderPass(descriptor);
    },
    canvasView() { return (context ? context.getCurrentTexture() : standIn).createView(); },
    submit() {
      if (!encoder) throw new Error('gpu: nothing to submit');
      const read = record && record.n ? record : null;
      if (read) {
        encoder.resolveQuerySet(stand.queries, 0, read.n * 2, stand.resolved, 0);
        encoder.copyBufferToBuffer(stand.resolved, 0, read.into, 0, read.n * 16);
      } else if (record) stand.spare.push(record);
      record = null;
      batch[0] = encoder.finish();
      queue.submit(batch);
      batch[0] = null;
      encoder = null;
      flying++; submits++;
      last = queue.onSubmittedWorkDone().then(landed, landed);
      if (read) read.into.mapAsync(GPUMapMode.READ, 0, read.n * 16).then(read.read, read.failed);
    },
    // the last submit's work is done on the GPU
    done() { return last; },
    // submits whose `done` has not resolved yet
    get flying() { return flying; },
    // submits made so far (the n-th submit's done is told to the listener as n)
    get submits() { return submits; },
    // whether the device has timestamps (the frames' GPU time can be taken)
    stamps,
    // the one listener (the pacer's, set once): { done(n) — the n-th submit's work is done (in the order of the
    // submits); timed(ms) — a timed frame's GPU time, its passes summed, read back a frame or two after its submit }
    hear(listener) { heard = listener; },
    // the pacer's: every frame's passes timed (their sum told to `timed`) while on — only where the device has stamps
    timeFrames(on) { frames = !!on && stamps; timing = detail || frames; ensure(); },

    // the passes' GPU times, for the stand's detail run: `times` — ms of each pass of PASSES (a pass run more than
    // once in a frame: their sum; one not run: -1), of the last frame whose stamps were read back — they come a frame
    // or two after its submit; -1 for every pass till the first has been read
    timing(on) {
      if (on && !stamps) throw new Error(`gpu: the passes are timed only on a device made with ${TIMESTAMP}`);
      detail = !!on; timing = detail || frames; ensure();
    },
    times,
  };
  // (the timing's query set and buffers, made when the passes are first timed)
  function ensure() {
    if (!timing || stand) return;
    const queries = device.createQuerySet({ label: 'times', type: 'timestamp', count: TIMED * 2 });
    stand = {
      queries, resolved: buffer('times', TIMED * 16, GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC), spare: [],
      // (the two stamps of the k-th timed pass of a frame: one object each, made once)
      writes: Array.from({ length: TIMED }, (_, k) => ({ querySet: queries, beginningOfPassWriteIndex: 2 * k, endOfPassWriteIndex: 2 * k + 1 })),
    };
  }
  layouts(gpu);
  return gpu;
}
