// The host the pages are served by (docs/host.md): its address — the page's <meta name="moood-host"> (relative to the
// page) — and what the pages ask of it: JSON in, JSON out. A refusal is an Error saying, in the page's language, what
// its code means (refused); its detail — for developers — goes to the console. The language a page is shown in: its
// address's ?lang=, else this browser's choice (words.js chosen) — the host answers in it, or refuses. The page's words
// (scene/: lang/<lang>.json) are tr.
import { chosen, languages, words } from '../i18n/words.js';
import { spans } from './span.js';

const meta = document.querySelector('meta[name="moood-host"]');
if (!meta) throw new Error('the page has no <meta name="moood-host">: where its host is');
export const HOST = new URL(meta.content, location.href);
// an address of the host's, as an absolute URL (what it gives relative to itself: a game's code, a world's files)
export const at = path => new URL(path, HOST).href;
// a query of ids and values (a world's — its path in its repo, as the host names it —, a scene's folder, a play's…)
export const query = o => new URLSearchParams(o).toString();
// what the page is asked to show (?world=, ?scene=, ?game=, ?lang=): its address's query — or, a host that serves the
// page at an address of its own, what it put in <meta name="moood-page"> (a query too)
export const asked = new URLSearchParams(document.querySelector('meta[name="moood-page"]')?.content ?? location.search);
export const lang = asked.get('lang') || chosen(await languages());
export const tr = await words(new URL('./', import.meta.url), lang);

const span = await spans(lang);

// what a refusal's code means (docs/host.md: Refusals), what it names put in; a code the page does not know — the
// host's own — is named as it is
function refused(code, v, status) {
  switch (code) {
    case 'not-found': return tr('There is no “{name}” here.', { name: v.name ?? '' });
    case 'language': return tr('It is not in this language.');
    case 'untranslated': return tr('“{text}” is not translated ({file}).', { text: v.text ?? '', file: v.file ?? '' });
    case 'content': return tr('{file} is not right: check says what is wrong.', { file: v.file ?? '' });
    case 'elsewhere': return tr('{ref} is in another repository, not here.', { ref: v.ref ?? '' });
    case 'no-voices': return tr('Voices are not made here.');
    case 'no-music': return tr('Music is not made here.');
    case 'unmade': return tr('It is not made yet, and is not made here.');
    case 'quota': return v.again == null ? tr('You have no quota for this.')
      : tr('Your quota is used up ({count} in {window}): again in {again}.', { count: v.count, window: span(v.window, true), again: span(v.again, false) });
    case 'busy': return v.again == null ? tr('It is busy now: ask again later.') : tr('It is busy now: again in {again}.', { again: span(v.again, false) });
    case 'streams': return tr('{most} streams are open at most: close a page of this site.', { most: v.most });
    case 'request': return tr('The page asked for something wrong.');
    case 'failed': return tr('The host failed.');
    default: return tr('The host refused ({code}).', { code: code ?? status });
  }
}

// a request of the host's → its answer (a Response); a refusal thrown
export async function request(method, path, body, signal) {
  const r = await fetch(at(path), { method, signal, ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
  if (!r.ok) {
    const o = await r.json().catch(() => ({}));
    if (o.detail) console.warn(`${method} ${path}: ${o.detail}`);
    throw Object.assign(new Error(refused(o.code, o.values ?? {}, r.status)), { code: o.code, detail: o.detail });
  }
  return r;
}
// a request's JSON answer (none: 204)
export async function ask(method, path, body, signal) {
  const r = await request(method, path, body, signal);
  return r.status === 204 ? null : r.json();
}

// a world's scene in the page's language, as the stage takes it: {spec, title, strings, modules — where they come from
// (kit.js: its world's files by their sha, the modules by theirs), …}; play — the play it is shown in (a play's page)
export async function scene(world, folder, play) {
  const s = await ask('GET', `scene?${query({ world, scene: folder, lang, ...(play ? { play } : {}) })}`);
  return { ...s, folder, files: at(s.files) };
}

// a line's voice (speech.js: speak) — the address of its recording
export const voice = async (line, signal) => new URL((await ask('POST', 'speak', line, signal)).url, at('speak')).href;
// a scene's music (music.js): its key — its recording begun, if it is neither recorded nor being made —, and its stream
export const music = {
  track: async (m, signal) => (await ask('POST', 'music', { music: m }, signal)).key,
  listen: (key, signal) => request('GET', `music?${query({ key })}`, undefined, signal),
};

// files saved (docs/host.md: changes — of a world, {world}, or of a game and its world, {game}): the page shown anew
// as one is; a host whose plays are pinned to commits tells instead, of a game, when my play of it could continue on
// newer ones (newer(), each time it is told); a host that does not tell answers nothing
export function follow(what, newer) {
  const told = new EventSource(at(`changes?${query(what)}`));
  told.onmessage = () => location.reload();
  if (newer) told.addEventListener('newer', newer);
}
