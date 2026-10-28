// A painted page into the cache (sheets/cache.js `place`): the painter's pixels as its canvas gave them (getImageData:
// sRGB, not premultiplied) are written to the GPU as they are (into a layer of a small staging texture), and two short
// passes write its cell: the page — premultiplied linear, stored
// sRGB-encoded by the cache's format (rgba8unorm-srgb) — and its half level (each texel four of the page's, averaged
// as light). Past an edge the sheet does not wrap round, every pixel takes the rect's last whole pixel of its row or
// column there (page.js cellInside: the painter painted only up to it). So no pixel of a page is touched by the CPU
// after its raster.
//   Pages go in batches of BATCH (the staging texture's layers): `place` writes one in and notes its cell; `flush`
// writes the noted cells — one pass a cache layer and level, a draw a page — in one submit. (Not an ImageBitmap of the
// canvas copied with copyExternalImageToTexture: from a painter's CPU canvas that stalled Chrome's GPU for seconds.)
//   SHEETS' own layout `sheetUpload` (GP7: registered by layouts(gpu) before createSheets) and its two pipelines
// ('sheet page', 'sheet half'), asked as the sheets are made: the renderer's gpu.ready() waits for them, so they are
// made before anything is placed. exercise(gpu) — for the whole-set check alone — encodes and submits a batch.
import { SHEET } from '../base.js';

const { SLOT } = SHEET, BATCH = 8, PAGE_BYTES = 32;

const UPLOAD_WGSL = /* wgsl */ `
struct Page { at: vec2u, layer: u32, pad: u32, inside: vec4u }
@group(0) @binding(0) var painted: texture_2d_array<f32>;
@group(0) @binding(1) var<storage, read> pages: array<Page>;
struct Out { @builtin(position) p: vec4f, @location(0) @interpolate(flat) k: u32 }

// one triangle over the viewport (the cell); the page's number from the draw's instance
@vertex fn cover(@builtin(vertex_index) v: u32, @builtin(instance_index) k: u32) -> Out {
  let xy = vec2f(f32((v << 1u) & 2u), f32(v & 2u));
  return Out(vec4f(xy * vec2f(2.0, -2.0) + vec2f(-1.0, 1.0), 0.0, 1.0), k);
}
// pixel q of the cell as the cache keeps it: the painted pixel there — past an edge that does not wrap, the last whole
// one inside — in linear light, premultiplied
fn texel(P: Page, q: vec2i) -> vec4f {
  let at = clamp(q, vec2i(i32(P.inside.x), i32(P.inside.z)), vec2i(i32(P.inside.y) - 1, i32(P.inside.w) - 1));
  let c = textureLoad(painted, at, i32(P.layer), 0);
  let lin = select(pow((c.rgb + 0.055) / 1.055, vec3f(2.4)), c.rgb / 12.92, c.rgb <= vec3f(0.04045));
  return vec4f(lin * c.a, c.a);
}
@fragment fn page(in: Out) -> @location(0) vec4f {
  let P = pages[in.k];
  return texel(P, vec2i(floor(in.p.xy)) - vec2i(P.at));
}
@fragment fn half(in: Out) -> @location(0) vec4f {
  let P = pages[in.k];
  let q = 2 * (vec2i(floor(in.p.xy)) - vec2i(P.at / 2u));
  return 0.25 * (texel(P, q) + texel(P, q + vec2i(1, 0)) + texel(P, q + vec2i(0, 1)) + texel(P, q + vec2i(1, 1)));
}
`;

export function layouts(gpu) {
  const F = GPUShaderStage.FRAGMENT;
  gpu.layout('sheetUpload', [
    { binding: 0, visibility: F, texture: { sampleType: 'float', viewDimension: '2d-array' } },   // the painted pages
    { binding: 1, visibility: F, buffer: { type: 'read-only-storage' } },                        // their cells (Page)
  ]);
}

// target: the cache texture (rgba8unorm-srgb, 2 levels, RENDER_ATTACHMENT) → { ready, place, draw, flush }
export function createUpload(gpu, target) {
  const T = GPUTextureUsage, device = gpu.device;
  const staging = gpu.texture('sheetUpload', { size: [SLOT, SLOT, BATCH], format: 'rgba8unorm', usage: T.TEXTURE_BINDING | T.COPY_DST });
  const params = gpu.buffer('sheetUpload pages', BATCH * PAGE_BYTES, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
  const group = gpu.bind('sheetUpload', [{ binding: 0, resource: staging.createView({ dimension: '2d-array' }) }, { binding: 1, resource: { buffer: params } }]);
  const module = gpu.module('sheet upload', UPLOAD_WGSL);
  const layout = device.createPipelineLayout({ label: 'sheet upload', bindGroupLayouts: [gpu.layout('sheetUpload')] });
  const piped = entry => gpu.pipeline(`sheet ${entry}`, { layout, vertex: { module, entryPoint: 'cover' }, fragment: { module, entryPoint: entry, targets: [{ format: target.format }] }, primitive: { topology: 'triangle-list' } });
  let pagePipe = null, halfPipe = null;
  const ready = Promise.all([piped('page'), piped('half')]).then(([p, h]) => { pagePipe = p; halfPipe = h; });
  ready.catch(() => {});
  // the batch: its pages' cells (x, y, layer, w, h — mip 0) and their Page rows
  const words = new Uint32Array(BATCH * PAGE_BYTES / 4), cells = new Int32Array(BATCH * 5), order = new Int32Array(BATCH);
  let n = 0;
  // a view of the cache, and a pass's descriptor on it, for each layer and level (made as first drawn into)
  const passes = new Map();
  const passOf = (z, m) => {
    const key = z * 2 + m;
    let d = passes.get(key);
    if (!d) {
      const view = target.createView({ dimension: '2d', baseArrayLayer: z, arrayLayerCount: 1, baseMipLevel: m, mipLevelCount: 1 });
      passes.set(key, d = { label: 'sheet upload', colorAttachments: [{ view, loadOp: 'load', storeOp: 'store' }] });
    }
    return d;
  };
  const into = { texture: staging, origin: [0, 0, 0] }, rows = { bytesPerRow: 0, rowsPerImage: 0 }, size = [0, 0, 1];

  // a page whose painted pixels are in the staging texture's layer n now (`place`; the check's batch) — its cell noted
  function draw(x, y, z, w, h, inside) {
    const o = n * 8, c = n * 5;
    words[o] = x; words[o + 1] = y; words[o + 2] = n; words[o + 3] = 0;
    words[o + 4] = inside[0]; words[o + 5] = inside[1]; words[o + 6] = inside[2]; words[o + 7] = inside[3];
    cells[c] = x; cells[c + 1] = y; cells[c + 2] = z; cells[c + 3] = w; cells[c + 4] = h;
    n++;
  }
  // the noted cells written: one pass a cache layer and level, the pages of that layer drawn in it
  function flush() {
    if (!n) return;
    if (!pagePipe) throw new Error('sheets: a page placed before its pipelines are made');
    gpu.write(params, 0, words, 0, n * 8);
    const encoder = device.createCommandEncoder({ label: 'sheet upload' });
    // (the pages by their layer, in the order they came within it: at most BATCH of them, sorted in place)
    for (let k = 0; k < n; k++) {
      let i = k;
      for (; i > 0 && cells[order[i - 1] * 5 + 2] > cells[k * 5 + 2]; i--) order[i] = order[i - 1];
      order[i] = k;
    }
    for (let s = 0; s < n;) {
      const z = cells[order[s] * 5 + 2];
      let e = s;
      while (e < n && cells[order[e] * 5 + 2] === z) e++;
      for (let m = 0; m < 2; m++) {
        const pass = encoder.beginRenderPass(passOf(z, m));
        pass.setPipeline(m ? halfPipe : pagePipe);
        pass.setBindGroup(0, group);
        for (let i = s; i < e; i++) {
          const k = order[i], c = k * 5;
          pass.setViewport(cells[c] >> m, cells[c + 1] >> m, cells[c + 3] >> m, cells[c + 4] >> m, 0, 1);
          pass.draw(3, 1, 0, k);
        }
        pass.end();
      }
      s = e;
    }
    gpu.queue.submit([encoder.finish()]);
    n = 0;
  }
  // a painted page (its pixels, w × h: its cell's size) into cell (x, y) of layer z: written in (the queue copies
  // them), its cell noted — a full batch written first
  function place(pixels, x, y, z, w, h, inside) {
    if (n === BATCH) flush();
    into.origin[2] = n; rows.bytesPerRow = w * 4; rows.rowsPerImage = h; size[0] = w; size[1] = h;
    gpu.queue.writeTexture(into, pixels, rows, size);
    draw(x, y, z, w, h, inside);
  }
  return { ready, place, draw, flush };
}

// For the whole-set check only: a batch of pages written into a small cache of the cache's format
export async function exercise(gpu) {
  const T = GPUTextureUsage;
  const target = gpu.texture('check sheet cache', { size: [SLOT, SLOT, 2], format: 'rgba8unorm-srgb', mipLevelCount: 2, usage: T.TEXTURE_BINDING | T.RENDER_ATTACHMENT });
  const U = createUpload(gpu, target);
  await U.ready;
  U.draw(0, 0, 0, SLOT, SLOT, [0, SLOT, 0, SLOT]);
  U.draw(68, 0, 1, 68, 136, [8, 40, 0, 136]);
  U.flush();
}
