// Engine 3's GPU programs checked whole, in node — no browser, no scene drawn, no picture (engines/3/gpu/check.js;
// docs/engine3/architecture.md 5.11):
//   cd test/gpu && npm ci
//   node check.mjs [a scene's folder — <world>/scenes/<folder>, with its scene.json] …
// It makes a device on Dawn's GPU-less backend (the npm package `webgpu`: Chrome's own WGSL compiler and Dawn's own
// validation; it executes nothing and calls no platform compiler) and gives it to the engine's own check: every WGSL
// module, every layout, every pipeline of a world that has everything, the own shaders of the scenes given compiled
// with them, and one frame of every pass encoded and submitted. Every error is printed in one list; the exit code is 1
// when there is any. moood's CI runs it with no scene.
//   An own shader is what the engine makes of it in that scene: the scene is put together as a host puts it
// (player/folder.js: each text from elements/<id>.wgsl) and compiled as the thread compiles a spec
// (engines/3/world/spec.js) — the text with the names of its element's `uniforms` in scene.json. Given no scene, the
// own-shader programs are not compiled, and the last line says so. The texts are printed numbered from 1, in the order
// they are given to the check: an error's `own shader <k>` names line k.
//   What it cannot show: a driver's faults, the platform's shader compiler, that the picture is right.
//   (Dawn prints each uncaptured error itself as well, as the process ends, under `validation:` — the same errors;
// the numbered list is the check's.)
import { basename, dirname, resolve } from 'node:path';
import { create, globals } from 'webgpu';
import { folder } from '../../packages/check/repository.js';
import { sceneOf, world } from '../../player/folder.js';
import { compile } from '../../engines/3/world/spec.js';

Object.assign(globalThis, globals);

// the distinct own shaders of the scenes given — a text with its uniforms' names —, each with the elements that have it
const own = [];
for (const arg of process.argv.slice(2)) {
  const at = resolve(arg), source = folder(dirname(dirname(at)));
  const { spec } = await sceneOf(source, await world(source, '.'), basename(at));
  if (spec.engine !== 3) throw new Error(`${at}: not an engine-3 scene (its scene.json says "engine": ${JSON.stringify(spec.engine)})`);
  const warned = [];
  for (const E of compile(spec, text => warned.push(text)).elements) {
    const where = `${at}: ${E.who}`;
    if (!E.shader) {
      if (E.o.shader != null) throw new Error(`${where}: the engine does not take its shader —\n  ${warned.join('\n  ')}`);
      continue;
    }
    const same = own.find(o => o.text === E.shader.text && o.names.join() === E.shader.names.join());
    if (same) same.elements.push(where);
    else own.push({ text: E.shader.text, names: E.shader.names, elements: [where] });
  }
}
const texts = `${own.length} own shader text${own.length === 1 ? '' : 's'}`;
console.log(own.length ? `${texts}:` : 'no scene with an own shader was given');
own.forEach((o, k) => console.log(`  ${k + 1}. ${o.elements.join(', ')}${o.names.length ? ` — uniforms: ${o.names.join(', ')}` : ''}`));

// (a promise of the engine's that failed with nobody listening is a finding, not the check's end)
const unheard = [];
process.on('unhandledRejection', err => unheard.push(`a rejection nobody handled: ${err && (err.stack || err.message) || err}`));

const { check } = await import('../../engines/3/gpu/check.js');
const errors = [...await check(create(['backend=null']), own.map(({ text, names }) => ({ text, names }))), ...unheard];
if (errors.length) {
  console.log(`\n${errors.length} error${errors.length === 1 ? '' : 's'}:`);
  errors.forEach((text, i) => console.log(`\n[${i + 1}] ${text}`));
  process.exitCode = 1;
} else {
  console.log(`\nno errors: every module of the engine compiled, every pipeline was made, the frame of every pass was valid — ${
    own.length ? `with ${texts}` : 'NO own shader was given: the own-shader programs were not compiled'}`);
}
