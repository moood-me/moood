// The light in the air (5.18; render/wgsl/post.js `render.air…`): a 64 × 36 × 24 volume of the frame's view laid out
// as 6 × 4 tiles of one small texture, filled after the shadow passes — so it reads this frame's shadow maps — and
// read by whatever is hazed, where it stands (render/wgsl/light.js e_airLight). There is one when the look has
// shafts, or the haze glows (the look's hazeGlow) round a lamp that shines in the view — any lamp of the world, in
// the lit set or not (render/lights.js: the halos).
//   Two small passes of the name `air`: the steps — each cell the light of its own stretch of its ray: the far
// lights' shafts by one triangle, every lamp's halo by a quad a depth, added —, then the sum — each cell its stretch
// and those before it. So a cell works out one stretch whatever its depth.
//   Its depths: w = log2(1 + z / Z0) / log2(1 + Z / Z0), z along the gaze — a third of a metre apart at arm's length,
// a third of its distance far off —, out to Z: as far as the air is seen — six of the haze's reaches, or the farthest
// point of the world's bounds from the eye where that is nearer (in clear air a far hill gathers most of the shafts'
// light beyond three reaches).
//   Over the sky (`air-sky`, in `main-solid` after the sky's sheets, the frame's view only): one triangle at the far
// plane adds the volume's whole depth where nothing stands before the sky — else a far hill is lifted by the shafts
// and the sky behind it is not.
//   The steps' group 1 is the layout `air`: `view` without what these passes may not read (they write the air).
//   A beam of the lit set in the haze is not in the volume — its cells are far coarser than a narrow beam — but drawn
// per pixel where it is seen (`beam`, render/wgsl/post.js render.beam), in `main-blend` after what blends: A.beam.
import { AIR } from './wgsl/frame.js';
import { FORMATS } from './library.js';

export function createAir(gpu, lib) {
  const T = GPUTextureUsage;
  const target = name => gpu.texture(name, { size: [AIR.W * AIR.TX, AIR.H * AIR.TY], format: FORMATS.AIR, usage: T.RENDER_ATTACHMENT | T.TEXTURE_BINDING }).createView();
  const view = target('air'), steps = target('air steps');
  const sum = gpu.bind('sum', [{ binding: 0, resource: steps }]);
  const cleared = { view: steps, loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }, summed = { view, loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] };
  const stepsPass = { colorAttachments: [cleared] }, sumPass = { colorAttachments: [summed] };
  const shaftsPipe = lib.get('air'), haloPipe = lib.get('air-halo'), sumPipe = lib.get('air-sum'), skyPipe = lib.get('air-sky');
  const A = { view, on: false, far: 1, shafts: false, halos: false, beams: false };
  // (the beams' group: the scene's depth — made again when that is another)
  let beamGroup = null, beamDepth = null;
  // whether there is light in the air this frame, and how far its depths go (the Frame's e_airIn: on, 1 / Z0, 1 /
  // log2(1 + Z / Z0)). world: its bounds; eye: the frame's
  A.place = (look, reach, lights, into, at, world, eye) => {
    A.shafts = look.shafts > 0; A.halos = look.hazeGlow > 0 && lights.haloN > 0; A.beams = look.hazeGlow > 0 && lights.spotN > 0;
    A.on = A.shafts || A.halos;
    const lo = world.bounds.min, hi = world.bounds.max;
    const edge = Math.sqrt((Math.max(eye[0] - lo[0], hi[0] - eye[0])) ** 2 + (Math.max(eye[1] - lo[1], hi[1] - eye[1])) ** 2 + (Math.max(eye[2] - lo[2], hi[2] - eye[2])) ** 2);
    A.far = Math.max(50, Math.min(6 * reach, edge));
    into[at] = A.on ? 1 : 0; into[at + 1] = 1 / AIR.Z0; into[at + 2] = 1 / Math.log2(1 + A.far / AIR.Z0); into[at + 3] = 0;
  };
  // its passes: group 0 the frame's, group 1 the frame's view as `air` has it; lights: the halos' rows
  A.draw = (frameGroup, airGroup, lights) => {
    let pass = gpu.pass('air', stepsPass);
    pass.setBindGroup(0, frameGroup); pass.setBindGroup(1, airGroup);
    if (A.shafts) { pass.setPipeline(shaftsPipe); pass.draw(3); }
    if (A.halos) { pass.setPipeline(haloPipe); pass.setVertexBuffer(0, lights.halos); pass.draw(6 * AIR.S, lights.haloN); }
    pass.end();
    pass = gpu.pass('air', sumPass);
    pass.setPipeline(sumPipe); pass.setBindGroup(0, sum);
    pass.draw(3);
    pass.end();
  };
  // its light over the sky: one triangle at the far plane (the frame's groups 0 and 1 set, the others `none`)
  A.sky = pass => { pass.setPipeline(skyPipe); pass.draw(3); };
  // the beams in the haze, in `main-blend` (the frame's groups 0 and 1 set; depthView: the scene's depth, read-only
  // there): the box about each one's cone, its pixels adding its light
  A.beam = (pass, depthView, lights, none) => {
    if (beamDepth !== depthView) { beamDepth = depthView; beamGroup = gpu.bind('beam', [{ binding: 0, resource: depthView }]); }
    pass.setPipeline(lib.get('beam')); pass.setBindGroup(2, beamGroup);
    pass.draw(36, lights.spotN);
    pass.setBindGroup(2, none);
  };
  return A;
}
