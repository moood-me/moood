// The local player over a copy of fixture/: its page and the host's requests (docs/host.md) as the pages ask them; it
// answers localhost only, takes a change only from its own pages, reads no symbolic link and nothing outside the folder;
// what check finds wrong said in the page's language.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

const FIXTURE = new URL('./fixture/', import.meta.url).pathname, SERVER = new URL('../player/server.js', import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), 'moood-player-')), work = join(dir, 'work');
let player, port;

// a request as a browser at `host` sends it → {status, body}
const ask = (path, { method = 'GET', host = `localhost:${port}`, origin, body } = {}) => new Promise((ok, fail) => {
  const headers = { host, ...(origin && { origin }), ...(body && { 'content-type': 'application/json' }) };
  const r = request({ port, path, method, headers }, res => {
    const parts = [];
    res.on('data', c => parts.push(c)).on('end', () => ok({ status: res.statusCode, body: Buffer.concat(parts).toString('utf8') }));
  });
  r.on('error', fail).end(body && JSON.stringify(body));
});
const json = async (...a) => { const r = await ask(...a); return { ...r, json: JSON.parse(r.body) }; };

before(async () => {
  cpSync(FIXTURE, work, { recursive: true });
  // (outside the folder; a link to it inside: neither is the folder's)
  writeFileSync(join(dir, 'secret.js'), 'g.fillRect(0, 0, 1, 1);');
  symlinkSync(join(dir, 'secret.js'), join(work, 'lamp/scenes/lamp/elements/secret.js'));
  symlinkSync(join(dir, 'secret.js'), join(work, 'evening/bespoke/secret.js'));
  // (a world that says a language moood has not)
  mkdirSync(join(work, 'stray'));
  writeFileSync(join(work, 'stray/world.json'), JSON.stringify({ title: 'Stray', languages: ['en', 'xx'] }));
  port = await new Promise(ok => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => ok(p)); }); });
  player = spawn(process.execPath, [SERVER, work], { env: { ...process.env, PORT: String(port), MOOOD_DATA: join(dir, 'data') }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(ok => player.stdout.once('data', ok));
});
after(() => { player?.kill(); rmSync(dir, { recursive: true, force: true }); });

test('its page, in Russian, with what check finds wrong said in Russian', async () => {
  const r = await ask('/?lang=ru');
  assert.equal(r.status, 200);
  assert.match(r.body, /Вечер/);
  assert.match(r.body, /<code>stray\/world.json<\/code> &#34;languages&#34; — xx: таких у moood нет \(en, ru, zh-hant\)/);
});

test('a scene and a play as the pages ask for them', async () => {
  const scene = await json('/api/scene?world=lamp&scene=lamp&lang=ru');
  assert.equal(scene.status, 200);
  assert.equal(scene.json.title, 'Лампа');
  assert.match(scene.json.spec.objects.find(o => o.id === 'lamp').code, /e\.light/);
  const begun = await json('/api/play', { method: 'POST', origin: `http://localhost:${port}`, body: { game: 'evening' } });
  assert.equal(begun.status, 200);
  const play = await json(`/api/play?play=${begun.json.id}&lang=ru`);
  assert.deepEqual(play.json.game, { id: 'evening', title: 'Вечер', mine: true });
  assert.equal(play.json.world, 'lamp');
  assert.equal('version' in play.json, false);
  assert.deepEqual(play.json.people, {});
  assert.match((await ask(`/api/${play.json.code}game.js`)).body, /bespoke\.show/);
});

test('another host, another site\'s change: refused', async () => {
  assert.equal((await ask('/', { host: 'evil.example' })).status, 403);
  assert.equal((await ask('/api/scene?world=lamp&scene=lamp&lang=en', { host: `rebound.example:${port}` })).status, 403);
  assert.equal((await ask('/api/play', { method: 'POST', body: { game: 'evening' } })).status, 403);
  assert.equal((await ask('/api/play', { method: 'POST', origin: 'http://evil.example', body: { game: 'evening' } })).status, 403);
});

test('no symbolic link, nothing outside the folder', async () => {
  // (a link in a scene's folder is no file of it: nothing names it, nothing reads it)
  const scene = await json('/api/scene?world=lamp&scene=lamp&lang=en');
  assert.equal(scene.status, 200);
  assert.equal(scene.json.spec.objects.some(o => /fillRect\(0, 0, 1, 1\)/.test(o.code ?? '')), false);
  const { json: { id } } = await json('/api/play', { method: 'POST', origin: `http://localhost:${port}`, body: { game: 'evening' } });
  assert.equal((await ask(`/api/code/${id}/secret.js`)).status, 404);
  assert.equal((await ask(`/api/code/${id}/..%2F..%2F..%2Fsecret.js`)).status, 404);
  assert.equal((await ask('/engines/..%2F..%2Fsecret.js')).status, 404);
});
