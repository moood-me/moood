#!/usr/bin/env node
// moood's local player: node player/server.js <folder> — the worlds and games of an author's folder (a repository of
// content, as it lies on disk) shown and played by this repository's pages, as they are anywhere else: it is their host
// (docs/host.md). Served: the player's page (/: what the folder holds, home.js); the pages and what they load
// (engines/, scene/, play/, i18n/); the host's requests under /api/ — the folder read anew for each (folder.js, through
// the folder's source: packages/check/repository.js), the plays kept in the data folder (plays.js), the files saved in
// it told as they are (changes: the folder watched).
// Voices and music are moood's workshop's (a deployment's — its studio's; workshop.js): with MOOOD_WORKSHOP (the
// studio's address) they are taken from it by key — made already, or, with MOOOD_TOKEN (a person's token made on their
// profile there), made now under that person's quota; without it the player has none: asked for, they are refused, and
// the pages go on without them.
//   PORT (8080), MOOOD_BIND (the address it listens on: 127.0.0.1), MOOOD_DATA (where the plays are kept:
// ~/.moood/player), MOOOD_WORKSHOP, MOOOD_TOKEN.
//   It is the author's own, on their machine: it answers only a page it serves itself, at localhost — a request named for
// another host (a site's name pointed at this machine: DNS rebinding) is refused, and so is a change (POST, PUT) sent
// from another site's page. The folder is read as git reads it: a symbolic link in it is not followed, nothing outside
// it is read (packages/check/repository.js).
import { createServer } from 'node:http';
import { existsSync, readFileSync, realpathSync, statSync, watch } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blobId, folder as folderOf, within } from '../packages/check/repository.js';
import { contents, game, gameTitle, peopleOf, Refusal, sceneIn, speaks, world, worldIn, worldOf } from './folder.js';
import { plays as keeper } from './plays.js';
import { chosen, home } from './home.js';
import { typeOf } from './types.js';
import { workshop } from './workshop.js';

const folder = process.argv[2];
if (!folder) { console.error('node player/server.js <folder> — the folder of worlds and games to show'); process.exit(2); }
if (!existsSync(folder) || !statSync(folder).isDirectory()) { console.error(`${resolve(folder)}: no such folder`); process.exit(2); }
const root = realpathSync(folder);
const PAGES = ['engines', 'scene', 'play', 'i18n'], here = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const data = resolve(process.env.MOOOD_DATA || join(homedir(), '.moood', 'player')), plays = keeper(data);
const SAVE = 1 << 20;  // what a game keeps of a play: up to a megabyte
// the workshop voices and music are taken from, or none
const shop = (() => {
  const { MOOOD_WORKSHOP: at, MOOOD_TOKEN: token } = process.env;
  if (!at) {
    if (token) { console.error('MOOOD_TOKEN: a person\'s token at the workshop MOOOD_WORKSHOP names'); process.exit(2); }
    return null;
  }
  let url;
  try { url = new URL(at); } catch { console.error('MOOOD_WORKSHOP: a studio\'s address (https://studio.moood.me)'); process.exit(2); }
  return workshop(url.origin, token || null);
})();

// The folder as the pages' source: its files, and those given to the pages by their content's id (git's blob sha) —
// kept: an id is the file for good (for as long as the player runs: every version of a file given, held in memory —
// an author's tool, restarted at will)
const given = new Map();
const source = {
  ...folderOf(root),
  async id(path) {
    const file = within(root, path);
    if (!file || !statSync(file).isFile()) return null;
    const bytes = readFileSync(file), id = blobId(bytes);
    given.set(id, bytes);
    return id;
  },
};

function send(res, status, body, type, cache = 'no-cache') {
  res.writeHead(status, { 'content-type': type, 'cache-control': cache, 'x-content-type-options': 'nosniff' });
  res.end(body);
}
const json = (res, status, o) => send(res, status, JSON.stringify(o), 'application/json; charset=utf-8', 'no-store');
// a file of a folder (a folder's index.html), as it is now → whether there is one (within it, no link on the way)
function file(res, dir, path) {
  let p = within(dir, path);
  if (p && statSync(p).isDirectory()) p = within(dir, `${path}/index.html`);
  if (!p || !statSync(p).isFile()) return false;
  send(res, 200, readFileSync(p), typeOf(p));
  return true;
}

// what was sent: JSON, at most `most` bytes
async function body(req, most = 64 << 10) {
  const parts = [];
  let n = 0;
  for await (const c of req) {
    n += c.length;
    if (n > most) throw new Refusal(413, 'request', {}, `more than ${most} bytes`);
    parts.push(c);
  }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); } catch (e) { throw new Refusal(400, 'request', {}, `not JSON: ${e.message}`); }
}

// a play as the page has it: {id, game: {id, title, mine}, world, code, people, save}
async function shown(p, lang) {
  const g = await game(source, p.game), w = await worldOf(source, g);
  speaks(g, 'game', lang);
  speaks(w, 'world', lang);
  return { id: p.id, game: { id: g.name, title: await gameTitle(source, g, lang), mine: true }, world: w.name, code: `code/${p.id}/`, people: await peopleOf(source, g), save: p.save };
}
function playOf(id) {
  const p = plays.get(id);
  if (!p || p.folder !== root) throw new Refusal(404, 'not-found', { name: id ?? '' }, 'no such play');
  return p;
}

// Files saved: the folder watched (its hidden files and folders not: an editor's, git's; nor the plays, if they are kept
// in it) — each saved file's path from its root to whoever follows a world's or a game's (changes) and the player's
// page (all of it)
const following = new Set();
watch(root, { recursive: true }, (kind, name) => {
  const path = name?.split(sep).join('/');
  if (!path || path.split('/').some(p => p.startsWith('.')) || join(root, name).startsWith(`${data}${sep}`)) return;
  for (const f of following) f(path);
});
// GET changes?world= | ?game= (none: the whole folder) — an event stream: a message (the path) once what is followed —
// the world's folder; the game's and its world's — has a file saved, a burst of saves told once
async function changes(req, res, q) {
  const { worlds, games } = await contents(source), name = q.get('world') ?? q.get('game');
  let bases = [''];
  if (q.has('world')) bases = worlds.filter(w => w.name === name).map(w => w.base);
  else if (q.has('game')) {
    const g = games.find(x => x.name === name);
    bases = g ? [g.base, ...await worldOf(source, g).then(w => [w.base], () => [])] : [];
  }
  if (!bases.length) throw new Refusal(404, 'not-found', { name: name ?? '' }, 'nothing to follow');
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
  res.write(': following\n\n');
  let soon = 0;
  const saved = path => {
    if (!bases.some(b => path.startsWith(b))) return;
    clearTimeout(soon);
    soon = setTimeout(() => res.write(`data: ${JSON.stringify(path)}\n\n`), 200);
  };
  following.add(saved);
  req.on('close', () => { clearTimeout(soon); following.delete(saved); });
}

// what the workshop answered of a key, passed on to the page — let go as it goes
async function passed(req, res, path) {
  const stop = new AbortController();
  req.once('close', () => stop.abort());
  const r = await shop.read(path, { signal: stop.signal, headers: req.headers.range ? { range: req.headers.range } : {} });
  res.writeHead(r.status, Object.fromEntries(['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'].map(h => [h, r.headers.get(h)]).filter(([, v]) => v)));
  try {
    for await (const chunk of r.body ?? []) if (!res.write(chunk)) await new Promise(ok => { res.once('drain', ok); res.once('close', ok); });
  } catch { /* (the page went, or the workshop's stream broke) */ }
  res.end();
}
const KEY = /^[0-9a-f]{64}$/;

// the host's requests (docs/host.md), under /api/
async function api(req, res, path, q) {
  const lang = q.get('lang'), head = path.split('/')[0], route = `${req.method} ${['files', 'code', 'speech'].includes(head) ? head : path}`;
  switch (route) {
    case 'GET world': { const w = await world(source, q.get('world')); speaks(w, 'world', lang); return json(res, 200, await worldIn(source, w, lang)); }
    case 'GET scene': { const w = await world(source, q.get('world')); speaks(w, 'world', lang); return json(res, 200, { ...await sceneIn(source, w, q.get('scene'), lang), files: 'files/' }); }
    case 'GET files': {
      const bytes = given.get(path.slice('files/'.length));
      if (!bytes) throw new Refusal(404, 'not-found', { name: path }, 'no such file given');
      return send(res, 200, bytes, 'application/octet-stream', 'public, max-age=31536000, immutable');
    }
    case 'POST play': {
      const g = await game(source, (await body(req))?.game);
      await worldOf(source, g);
      return json(res, 200, { id: (plays.mine(root, g.name) ?? plays.begin(root, g.name)).id });
    }
    case 'GET play': return json(res, 200, await shown(playOf(q.get('play')), lang));
    case 'PUT play': {
      const p = playOf(q.get('play')), save = await body(req, SAVE);
      if (!save || typeof save !== 'object' || Array.isArray(save)) throw new Refusal(400, 'request', {}, 'a save is a JSON object');
      plays.keep(p, save);
      res.writeHead(204).end();
      return;
    }
    case 'POST restart': {
      const p = playOf(q.get('play'));
      plays.end(p);
      return json(res, 200, { id: plays.begin(root, p.game).id });
    }
    case 'GET code': {
      const [, id, ...rest] = path.split('/'), g = await game(source, playOf(id).game);
      if (!file(res, join(root, g.base, 'bespoke'), rest.join('/'))) throw new Refusal(404, 'not-found', { name: `${g.base}bespoke/${rest.join('/')}` }, 'no such file');
      return;
    }
    case 'GET changes': return changes(req, res, q);
    case 'POST speak':
      if (!shop) throw new Refusal(501, 'no-voices', {}, 'voices are made by moood\'s workshop: the local player takes them from one with MOOOD_WORKSHOP');
      return json(res, 200, { url: `speech/${await shop.speak(await body(req))}` });
    case 'GET speech': {
      const key = path.slice('speech/'.length);
      if (!shop || !KEY.test(key)) throw new Refusal(404, 'not-found', { name: key }, 'no such voice here');
      return passed(req, res, `speech/${key}`);
    }
    case 'POST music':
      if (!shop) throw new Refusal(501, 'no-music', {}, 'music is made by moood\'s workshop: the local player takes it from one with MOOOD_WORKSHOP');
      return json(res, 200, { key: await shop.track((await body(req))?.music) });
    case 'GET music':
      if (!shop) throw new Refusal(501, 'no-music', {}, 'music is made by moood\'s workshop: the local player takes it from one with MOOOD_WORKSHOP');
      if (!KEY.test(q.get('key') ?? '')) throw new Refusal(404, 'not-found', { name: q.get('key') ?? '' }, 'no such track');
      return passed(req, res, `music/${q.get('key')}`);
    default: throw new Refusal(404, 'request', {}, `${req.method} ${path}: no such request (docs/host.md)`);
  }
}

// whom it answers: a page at localhost (any port) — its Host; a change only from its own pages — their Origin
const LOCAL = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;
const foreign = req => {
  const host = req.headers.host ?? '';
  if (!LOCAL.test(host)) return `Host ${JSON.stringify(host)}: the player answers localhost only`;
  if ((req.method === 'POST' || req.method === 'PUT') && req.headers.origin !== `http://${host}`) return `Origin ${JSON.stringify(req.headers.origin ?? '')}: a change only from the player's own pages`;
  return null;
};

createServer(async (req, res) => {
  const refused = foreign(req);
  if (refused) return json(res, 403, { code: 'request', values: {}, detail: refused });
  const url = new URL(req.url, 'http://player');
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { return json(res, 400, { code: 'request', values: {}, detail: 'not a path' }); }
  try {
    if (path.startsWith('/api/')) return await api(req, res, path.slice(5), url.searchParams);
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { code: 'request', values: {}, detail: `${req.method}: not here` });
    if (path === '/') return send(res, 200, await home(source, root, chosen(url.searchParams.get('lang'), req.headers.cookie, req.headers['accept-language'])), 'text/html; charset=utf-8');
    const top = path.split('/')[1];
    if (PAGES.includes(top) && path === `/${top}`) { res.writeHead(301, { location: `/${top}/${url.search}` }).end(); return; }
    if (PAGES.includes(top) && file(res, join(here, top), path.slice(top.length + 2))) return;
    send(res, 404, 'not found', 'text/plain; charset=utf-8');
  } catch (e) {
    if (e instanceof Refusal) return json(res, e.status, { code: e.code, values: e.values, detail: e.message });
    console.error(e);
    json(res, 500, { code: 'failed', values: {}, detail: String(e.message || e) });
  }
}).listen(Number(process.env.PORT || 8080), process.env.MOOOD_BIND || '127.0.0.1', function () {
  const { address, port } = this.address();
  console.log(`moood player: ${root} — http://${address === '0.0.0.0' ? 'localhost' : address}:${port}/${shop ? ` — voices and music from ${shop.url}` : ''}`);
});
