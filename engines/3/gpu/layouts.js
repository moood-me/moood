// The bind group layouts every pipeline that draws the world shares, and the three samplers —
// as the engine's architecture fixes them: nothing here is chosen by this file. createGpu registers them (GP7) before it returns; every
// other layout is registered by the area that owns its family (PEOPLE's and RENDER's layouts(gpu); SHEETS' upload's).
//   A pipeline that draws the world: group 0 `frame`, group 1 `view` or `viewCast`, group 2 its family's, group 3
// `none` or `person`. A pass never uses a pipeline whose layout holds a texture that pass writes — which is why the
// shadow, blob and masks passes take `viewCast`, and why no texture a pass renders into is in `frame`.
//   The vertex stage sees six storage buffers in `frame` (nodes, quads, layers, sheetTable, lights, lightGrid); a
// family's group adds at most two; the core limit is eight. Nobody adds a storage buffer to `frame` or `view` without
// changing 4.2.
//   The names of the bindings are WGSL's, declared by the chunk of the area whose data each is (4.1): `world` —
// nodes, quads, layers, forms; `sheets` — sheetTable, sheetCache, sheetSampler; `frame` (RENDER's) — the rest and
// all of group 1.

export const SAMPLERS = {
  // the hardware's 2 × 2 compare, depth reversed
  shadowSampler: { compare: 'greater-equal', magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' },
  // read with textureSampleLevel; no anisotropy
  sheetSampler: { magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' },
  linear: { magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' },
};

export function layouts(gpu) {
  const V = GPUShaderStage.VERTEX, F = GPUShaderStage.FRAGMENT, VF = V | F;
  const uniform = (binding, visibility) => ({ binding, visibility, buffer: { type: 'uniform' } });
  const storage = (binding, visibility) => ({ binding, visibility, buffer: { type: 'read-only-storage' } });
  const texture = (binding, visibility, sampleType, viewDimension = '2d') => ({ binding, visibility, texture: { sampleType, viewDimension } });
  const sampler = (binding, visibility, type) => ({ binding, visibility, sampler: { type } });

  gpu.layout('frame', [
    uniform(0, VF),                             // frame: Frame
    storage(1, V),                              // nodes
    storage(2, V),                              // quads
    storage(3, V),                              // layers
    storage(4, VF),                             // sheetTable
    texture(5, VF, 'float', '2d-array'),        // sheetCache (written by SHEETS' upload passes only)
    sampler(6, VF, 'filtering'),                // sheetSampler
    storage(7, VF),                             // lights — the lit set
    storage(8, VF),                             // lightGrid
    texture(9, VF, 'float'),                    // panes — the panes' masks
    sampler(10, VF, 'filtering'),               // linear
    texture(11, V, 'unfilterable-float'),       // forms — rgba32float, read with textureLoad only
  ]);

  gpu.layout('view', [
    uniform(0, VF),                             // view: View
    texture(1, VF, 'depth'),                    // shadowStatic
    texture(2, VF, 'depth'),                    // shadowMovers
    sampler(3, VF, 'comparison'),               // shadowSampler
    uniform(4, VF),                             // shadows (RENDER's)
    texture(5, VF, 'float'),                    // blob
    texture(6, VF, 'float'),                    // air
    texture(7, F, 'float'),                     // masks — the clip masks of this view
    uniform(8, VF),                             // land (RENDER's) — the levels of this view's land field
    texture(9, VF, 'unfilterable-float'),       // landHeights — r32float, read with textureLoad
    texture(10, VF, 'unfilterable-float'),      // landShadow — rgba32float, read with textureLoad
  ]);

  gpu.layout('viewCast', [
    uniform(0, VF),                             // view: View
  ]);

  gpu.layout('none', []);
}
