// The local player's voices and music from a workshop (player/workshop.js; docs/host.md: The workshop) — one stood in
// for here, as docs/host.md says a workshop answers: without MOOOD_WORKSHOP — refused, no-voices, no-music; with it, what
// is made is taken by its key (what is not: unmade); with MOOOD_TOKEN too, what is not made is asked to be made, the
// token carried.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

const FIXTURE = new URL('./fixture/', import.meta.url).pathname, SERVER = new URL('../player/server.js', import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), 'moood-workshop-')), work = join(dir, 'work');
const key = o => createHash('sha256').update(JSON.stringify(o)).digest('hex');
const KEPT = { text: 'The lamp waits.', voice: 'Charon', how: 'quietly' }, MUSIC = { prompts: [{ text: 'rain', weight: 1 }], config: {} };
const WAV = Buffer.from('RIFF a voice'), FRAMES = Buffer.from([2, 2, 0, 0, 0, 123, 125]);
const players = [];
let shop, asked = [];

// a player over a copy of the fixture, with env → its address
async function player(env) {
  const port = await new Promise(ok => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => ok(p)); }); });
  const p = spawn(process.execPath, [SERVER, work], { env: { ...process.env, PORT: String(port), MOOOD_DATA: join(dir, `data-${port}`), ...env }, stdio: ['ignore', 'pipe', 'inherit'] });
  players.push(p);
  await new Promise(ok => p.stdout.once('data', ok));
  return `http://localhost:${port}`;
}
const post = (at, path, body) => fetch(`${at}/api/${path}`, { method: 'POST', headers: { origin: at, 'content-type': 'application/json' }, body: JSON.stringify(body) });

before(async () => {
  cpSync(FIXTURE, work, { recursive: true });
  // (the workshop: a voice and a track kept; a person's token "t-ivan" makes what is not)
  const made = new Set([key(KEPT), key(MUSIC)]);
  shop = createServer(async (req, res) => {
    const parts = [];
    for await (const c of req) parts.push(c);
    const sent = parts.length ? JSON.parse(Buffer.concat(parts).toString()) : null, token = req.headers.authorization ?? null;
    asked.push({ method: req.method, path: req.url, token, args: sent?.args });
    const answer = (status, o) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    const op = req.url.slice('/workshop/'.length);
    if (req.method === 'POST' && op === 'speech.key') return answer(200, { key: key(sent.args), kept: made.has(key(sent.args)) });
    if (req.method === 'POST' && op === 'music.key') return answer(200, { key: key(sent.args.music), whole: made.has(key(sent.args.music)), making: false });
    if (req.method === 'POST' && (op === 'speech.speak' || op === 'music.track')) {
      if (token !== 'Bearer t-ivan') return answer(401, { code: 'signed-out', values: {} });
      const k = key(op === 'speech.speak' ? sent.args : sent.args.music);
      made.add(k);
      return answer(200, { key: k });
    }
    const m = /^\/workshop\/(speech|music)\/([0-9a-f]{64})$/.exec(req.url);
    if (req.method === 'GET' && m && made.has(m[2])) {
      res.writeHead(200, { 'content-type': m[1] === 'speech' ? 'audio/wav' : 'application/octet-stream' });
      return res.end(m[1] === 'speech' ? WAV : FRAMES);
    }
    answer(404, { code: 'not-found', values: { name: req.url } });
  });
  await new Promise(ok => shop.listen(0, '127.0.0.1', ok));
});
after(() => { for (const p of players) p.kill(); shop.close(); rmSync(dir, { recursive: true, force: true }); });

test('no workshop: voices and music refused — no-voices, no-music', async () => {
  const at = await player({});
  assert.equal((await (await post(at, 'speak', KEPT)).json()).code, 'no-voices');
  assert.equal((await (await post(at, 'music', { music: MUSIC })).json()).code, 'no-music');
  assert.equal((await (await fetch(`${at}/api/music?key=${key(MUSIC)}`)).json()).code, 'no-music');
});

test('a workshop, no token: what is made taken by its key; what is not — unmade, nothing asked to be made', async () => {
  const at = await player({ MOOOD_WORKSHOP: `http://127.0.0.1:${shop.address().port}` });
  asked = [];
  const r = await post(at, 'speak', KEPT);
  assert.equal(r.status, 200);
  const { url } = await r.json();
  assert.equal(url, `speech/${key(KEPT)}`);
  const voice = await fetch(`${at}/api/${url}`);
  assert.deepEqual([voice.status, voice.headers.get('content-type'), Buffer.from(await voice.arrayBuffer()).toString()], [200, 'audio/wav', WAV.toString()]);
  const no = await post(at, 'speak', { text: 'Not yet.', voice: 'Charon', how: '' });
  assert.deepEqual([no.status, (await no.json()).code], [404, 'unmade']);
  assert.deepEqual((await (await post(at, 'music', { music: MUSIC })).json()), { key: key(MUSIC) });
  const heard = await fetch(`${at}/api/music?key=${key(MUSIC)}`);
  assert.deepEqual(Buffer.from(await heard.arrayBuffer()), FRAMES);
  assert.equal((await (await post(at, 'music', { music: { prompts: [{ text: 'snow', weight: 1 }], config: {} } })).json()).code, 'unmade');
  assert.deepEqual(asked.filter(a => a.method === 'POST').map(a => [a.path, a.token]),
    [['/workshop/speech.key', null], ['/workshop/speech.key', null], ['/workshop/music.key', null], ['/workshop/music.key', null]]);
});

test('a workshop and a person\'s token: what is not made, made under their quota there — the token carried, never on a read by key; one it does not take, said', async () => {
  const at = await player({ MOOOD_WORKSHOP: `http://127.0.0.1:${shop.address().port}`, MOOOD_TOKEN: 't-ivan' });
  asked = [];
  const line = { text: 'Now it is.', voice: 'Charon', how: '' };
  assert.deepEqual(await (await post(at, 'speak', line)).json(), { url: `speech/${key(line)}` });
  assert.equal((await fetch(`${at}/api/speech/${key(line)}`)).status, 200);
  assert.deepEqual(asked.map(a => [a.method, a.path, a.token]), [['POST', '/workshop/speech.speak', 'Bearer t-ivan'], ['GET', `/workshop/speech/${key(line)}`, null]]);
  const wrong = await player({ MOOOD_WORKSHOP: `http://127.0.0.1:${shop.address().port}`, MOOOD_TOKEN: 't-nobody' });
  const no = await post(wrong, 'speak', line);
  assert.deepEqual([no.status, (await no.json()).code], [502, 'failed']);
});
