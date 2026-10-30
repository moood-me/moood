// check over a repository (fixture/: a world and a game on it, in English and Russian): all right as it is; what is
// wrong said by code and values, in words of either language; advice kept apart from it and refusing nothing (the
// library's list, the command line's exit and --json); a folder read as git reads it — no symbolic link followed or
// written through.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import { check } from '../packages/check/index.js';
import { ADVICE, say } from '../packages/check/problems/problems.js';
import { folder } from '../packages/check/repository.js';
import '../i18n/i18n.js';

const FIXTURE = new URL('./fixture/', import.meta.url).pathname, made = [];
const copy = () => { const d = mkdtempSync(join(tmpdir(), 'moood-')); made.push(d); cpSync(FIXTURE, d, { recursive: true }); return d; };
const edit = (path, fn) => writeFileSync(path, JSON.stringify(fn(JSON.parse(readFileSync(path, 'utf8')))));
after(() => { for (const d of made) rmSync(d, { recursive: true, force: true }); });

test('the fixture is all right', async () => {
  const { problems, advice } = await check(folder(FIXTURE));
  assert.deepEqual(problems, []);
  assert.deepEqual(advice, []);
});

// a cast's style in the old word for its hands (the engine reads it still): advice
const CLI = new URL('../packages/check/cli.js', import.meta.url).pathname;
const cli = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
const oldHands = d => writeFileSync(join(d, 'lamp/scenes/lamp/elements/cast.js'), "const cast = { styles: { ink: { from: 'soft', fingers: false } } };\n");

test('an old word that works is advice: not a problem, said in English and in Russian', async () => {
  const d = copy();
  oldHands(d);
  const { problems, advice } = await check(folder(d));
  assert.deepEqual(problems, []);
  assert.deepEqual(advice.map(p => [p.at.replace(/:\d+$/, ''), p.code, p.values]), [['lamp/scenes/lamp/elements/cast.js', 'hands-old', { word: 'fingers: false', hands: 'mitten' }]]);
  assert.deepEqual([...ADVICE], ['hands-old']);
  const strings = JSON.parse(readFileSync(new URL('../packages/check/problems/lang/ru.json', import.meta.url), 'utf8')).strings;
  const { translator, source } = globalThis.MooodI18n;
  assert.equal(say(advice[0], translator(source)), 'fingers: false — an old word: write hands: "mitten"');
  assert.notEqual(say(advice[0], translator('ru', strings, 'check')), 'hands-old');
});

test('the command line: advice alone is all right (exit 0); --json has it beside the problems', () => {
  const d = copy();
  oldHands(d);
  const plain = cli(d);
  assert.equal(plain.status, 0, plain.stdout + plain.stderr);
  assert.match(plain.stdout, /^advice \(works as it is, better written so\):\n  lamp\/scenes\/lamp\/elements\/cast\.js:\d+: fingers: false — an old word/m);
  assert.match(plain.stdout, /^all right \(1 advice\) — /m);
  const json = cli(d, '--json'), report = JSON.parse(json.stdout);
  assert.equal(json.status, 0);
  assert.deepEqual(report.problems, []);
  assert.deepEqual(report.advice.map(p => [p.code, p.text]), [['hands-old', 'fingers: false — an old word: write hands: "mitten"']]);
  assert.ok(Array.isArray(report.scopes) && Array.isArray(report.lines));
});

test('the command line: what is wrong still fails (exit 1), advice or not', () => {
  const d = copy();
  oldHands(d);
  edit(join(d, 'lamp/scenes/lamp/lang/ru.json'), l => ({ strings: l.strings.filter(e => e.text !== 'It is lit.') }));
  const plain = cli(d);
  assert.equal(plain.status, 1);
  assert.match(plain.stdout, /^1 wrong \(1 advice\) — /m);
  const report = JSON.parse(cli(d, '--json').stdout);
  assert.deepEqual(report.problems.map(p => p.code), ['untranslated']);
  assert.deepEqual(report.advice.map(p => p.code), ['hands-old']);
});

test('what is wrong: a code and values, said in English and in Russian', async () => {
  const d = copy();
  edit(join(d, 'evening/game.json'), g => ({ ...g, languages: ['en', 'xx'], world: '../nowhere' }));
  edit(join(d, 'lamp/scenes/lamp/lang/ru.json'), l => ({ strings: l.strings.filter(e => e.text !== 'It is lit.') }));
  edit(join(d, 'lamp/scenes/lamp/scene.json'), s => ({ ...s, engine: 2, music: { prompts: [{ text: 'a lamp humming', weight: 1 }], bpm: 300, density: 0.5, scale: 'H_MAJOR' } }));
  const { problems } = await check(folder(d)), of = code => problems.find(p => p.code === code);
  assert.deepEqual(of('languages-unknown'), { at: 'evening/game.json', code: 'languages-unknown', values: { languages: 'xx', known: 'en, ru, uk, de, es, ja, be, fr, zh-hant, pt, pl, ko' } });
  assert.deepEqual(of('world-not-there').values, { field: 'world', ref: '"../nowhere"', file: 'nowhere/world.json' });
  assert.equal(of('untranslated').values.text, 'It is lit.');
  assert.deepEqual(of('music-range'), { at: 'lamp/scenes/lamp/scene.json', code: 'music-range', values: { field: 'bpm', value: 300, least: 60, most: 200 } });
  assert.equal(of('music-scale').values.scale, 'H_MAJOR');
  assert.deepEqual(of('engine-gone'), { at: 'lamp/scenes/lamp/scene.json', code: 'engine-gone', values: { engine: '2' } });
  const strings = JSON.parse(readFileSync(new URL('../packages/check/problems/lang/ru.json', import.meta.url), 'utf8')).strings;
  const { translator, source } = globalThis.MooodI18n, en = translator(source), ru = translator('ru', strings, 'check');
  assert.equal(say(of('untranslated'), en), '"It is lit." — not translated');
  assert.equal(say(of('untranslated'), ru), '"It is lit." — не переведено');
  for (const p of problems) assert.notEqual(say(p, ru), p.code, `${p.code}: said in Russian`);
});

test('a symbolic link is neither read nor written through', async () => {
  const d = copy(), outside = join(d, '..', `${d.split('/').pop()}-outside.json`);
  made.push(outside);
  writeFileSync(outside, '{"strings": []}');
  symlinkSync(outside, join(d, 'lamp/scenes/lamp/elements/stray.js'));
  rmSync(join(d, 'lamp/lang/ru.json'));
  symlinkSync(outside, join(d, 'lamp/lang/ru.json'));
  const source = folder(d);
  assert.equal((await source.list('lamp/scenes/lamp/elements/')).some(e => e.name === 'stray.js'), false);
  assert.equal(await source.read('lamp/scenes/lamp/elements/stray.js'), null);
  assert.equal(await source.read('../outside.json'), null);
  await assert.rejects(check(source, { write: true }), /not written/);
  assert.equal(readFileSync(outside, 'utf8'), '{"strings": []}');
});
