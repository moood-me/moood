// A repository's worlds and games as a host has them (docs/host.md): each scene put together from its files, titles in
// a language — the one assembly every host uses, reading the repository through a source of its files
// (packages/check/repository.js: list, read) and, for the files the pages are given by their content (a module's
// code, data, translation), id(path) → its content's id (git's blob sha). The local player's source is the author's
// folder, read anew for every request (server.js); the studio's — a git tree at a commit.
//   A world or a game is named as the repository has it: its path from the root ('.' the root itself).
import { readFileSync } from 'node:fs';
import { problem, say } from '../packages/check/problems/problems.js';
import { languagesOf, natural, reference, units } from '../packages/check/repository.js';
import '../i18n/i18n.js';

const { MooodI18n } = globalThis;
export const LANGUAGES = JSON.parse(readFileSync(new URL('../i18n/languages.json', import.meta.url), 'utf8'));
const SOURCE = MooodI18n.source, english = MooodI18n.translator(SOURCE);

// What the host refuses (docs/host.md): its status, its code and values — what the page says, in its own words — and
// what went wrong, for developers (detail)
export class Refusal extends Error {
  constructor(status, code, values, detail) { super(detail); Object.assign(this, { status, code, values }); }
}
const missing = (name, detail) => new Refusal(404, 'not-found', { name }, detail);
const wrong = (file, detail) => new Refusal(422, 'content', { file }, detail);  // (the repository's file is not right)

const nameOf = base => base.replace(/\/$/, '') || '.';
const SPEC = 'scene.json';

// ── its worlds, games and articles ──────────────────────────────────────────

// What the repository holds: {worlds, games, articles — [{name, base, json, languages}], problems — where they lie,
// what they say of themselves, as check finds them (packages/check/problems: {at, code, values}; json null: not read;
// languages not said rightly: none)}
export async function contents(source) {
  const { units: found, problems } = await units(source), out = { worlds: [], games: [], articles: [], problems };
  for (const u of found) {
    const l = u.json ? languagesOf(u.json, Object.keys(LANGUAGES)) : { languages: [] };
    if (l.problem) problems.push(problem(`${u.base}${u.kind}.json`, l.problem.code, l.problem.values));
    out[`${u.kind}s`].push({ name: nameOf(u.base), base: u.base, json: u.json, languages: l.languages ?? [] });
  }
  return out;
}

async function unit(source, kind, name) {
  if (!name) throw missing('', `no ${kind} asked for`);
  const u = (await contents(source))[`${kind}s`].find(x => x.name === name);
  if (!u) throw missing(name, `no ${kind} "${name}" in the repository (a folder with ${kind}.json)`);
  if (!u.json) throw wrong(`${u.base}${kind}.json`, 'not read');
  return u;
}
export const world = (source, name) => unit(source, 'world', name);
export const game = (source, name) => unit(source, 'game', name);
export const article = (source, name) => unit(source, 'article', name);

// the language asked for, if the world or the game is in it
export function speaks(u, kind, lang) {
  const not = detail => new Refusal(404, 'language', { lang: lang ?? '' }, detail);
  if (!(lang in LANGUAGES)) throw not(`lang "${lang ?? ''}": not one of moood's (${Object.keys(LANGUAGES).join(', ')})`);
  if (!u.languages.includes(lang)) throw not(`the ${kind} "${u.name}" is not in ${lang} (it is in ${u.languages.join(', ') || 'none'})`);
}

// where a game's world is, as its game.json names it: {path — in the game's repository} | {foreign: {repo, ref, path}}
// — another repository's (packages/check/repository.js reference)
export function worldAt(g) {
  const r = reference(g.json.world, g.base);
  if (r.wrong) throw wrong(`${g.base}game.json`, say(problem(`${g.base}game.json`, r.wrong.code, { field: 'world', ref: JSON.stringify(g.json.world), ...r.wrong.values }), english));
  return r;
}
// a game's world in its own repository; another repository's is the host's to find — one that reads only this
// repository (the local player: its folder) refuses it
export function worldOf(source, g) {
  const r = worldAt(g);
  if (r.foreign) throw new Refusal(501, 'elsewhere', { ref: g.json.world }, `the game's world is another repository's: this host has only the game's — lay that world beside the game and name it by its path`);
  return world(source, r.path || '.');
}

// a game's people (its bespoke/people.json: {who: {voice, how, short}} — check says what each is), {} — it has none
export async function peopleOf(source, g) {
  const path = `${g.base}bespoke/people.json`, text = await source.read(path);
  if (text == null) return {};
  let people;
  try { people = JSON.parse(text); } catch (e) { throw wrong(path, e.message); }
  if (!people || typeof people !== 'object' || Array.isArray(people)) throw wrong(path, 'not an object');
  return people;
}

// ── translations ───────────────────────────────────────────────────────────

// a translation's file into a language (lang/<lang>.json — check lays it out): its entries; none — no file
function entries(text, path, lang) {
  if (text == null) return [];
  let data;
  try { data = JSON.parse(text); } catch (e) { throw wrong(path, e.message); }
  const found = data && typeof data === 'object' && !Array.isArray(data) ? data.strings ?? [] : null;
  if (!Array.isArray(found) || !found.every(e => e && typeof e === 'object')) throw wrong(path, 'not {"strings": [entries]}');
  try { MooodI18n.translator(lang, found, path); } catch (e) { throw wrong(path, e.message); }  // (a text translated twice)
  return found;
}
// a text in a language by its translation's file (path) — none there is the repository's fault (never the source
// shown instead)
async function translated(source, lang, path, text) {
  if (typeof text !== 'string' || !text.trim()) return '';
  if (lang === SOURCE) return text;
  const t = entries(await source.read(path), path, lang).find(e => e.text === text && !e.context && !e.who)?.translation;
  if (typeof t !== 'string' || !t) throw new Refusal(422, 'untranslated', { file: path, text }, `no ${lang} translation of "${text}"`);
  return t;
}
// a field of world.json or game.json that is read (i18n.js FIELDS: a world's title and description; a game's title,
// description, line and source — what a host's card of it says) in a language
export const worldText = (source, w, field, lang) => translated(source, lang, `${w.base}lang/${lang}.json`, w.json[field]);
export const gameText = (source, g, field, lang) => translated(source, lang, `${g.base}bespoke/lang/${lang}/strings.json`, g.json[field]);
export const worldTitle = (source, w, lang) => worldText(source, w, 'title', lang);
export const gameTitle = (source, g, lang) => gameText(source, g, 'title', lang);
// An article is translated whole, by hand (packages/check/README.md): a field of its article.json (its title, its
// summary) in a language — article.<lang>.json beside it
export async function articleText(source, a, field, lang) {
  const text = a.json[field];
  if (typeof text !== 'string' || !text.trim()) return '';
  if (lang === SOURCE) return text;
  const path = `${a.base}article.${lang}.json`, raw = await source.read(path);
  let t = null;
  if (raw != null) { try { t = JSON.parse(raw)?.[field]; } catch (e) { throw wrong(path, e.message); } }
  if (typeof t !== 'string' || !t.trim()) throw new Refusal(422, 'untranslated', { file: path, text }, `no ${lang} "${field}" of the article`);
  return t;
}
// the article in a language: {title, date, summary, story — its text (story.md; story.<lang>.md)}
export async function articleIn(source, a, lang) {
  const path = `${a.base}${lang === SOURCE ? 'story.md' : `story.${lang}.md`}`, story = await source.read(path);
  if (!story?.trim()) throw lang === SOURCE ? wrong(path, 'none') : new Refusal(422, 'untranslated', { file: path, text: a.json.title ?? '' }, `no ${lang} text of the article`);
  return { title: await articleText(source, a, 'title', lang), date: a.json.date ?? null, summary: await articleText(source, a, 'summary', lang), story };
}

// ── a world's scenes ───────────────────────────────────────────────────────

// its scenes' folders, its main one first (world.json's "main", else the first), the rest in their order
export async function folders(source, w) {
  const all = (await source.list(`${w.base}scenes/`) ?? []).filter(e => e.dir && !e.name.startsWith('.')).map(e => e.name).sort(natural);
  const main = all.includes(w.json.main) ? w.json.main : all[0];
  return main ? [main, ...all.filter(f => f !== main)] : [];
}

// GET world: {title, scenes: [{folder, title}]}
export async function worldIn(source, w, lang) {
  return {
    title: await worldTitle(source, w, lang),
    scenes: await Promise.all((await folders(source, w)).map(async folder => {
      const base = `${w.base}scenes/${folder}/`;
      let spec;
      try { spec = JSON.parse(await source.read(`${base}${SPEC}`) ?? 'null'); } catch (e) { throw wrong(`${base}${SPEC}`, e.message); }
      if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw wrong(`${base}${SPEC}`, 'none, or not an object');
      return { folder, title: await translated(source, lang, `${base}lang/${lang}.json`, spec.title) };
    })),
  };
}

// A scene's folder: scene.json is the spec without what lies in files of its own (TOP — the scene's; IN — of each of
// its elements and widgets, by its id; a film, what moves an element each frame and its shader are engine 3's);
// lang/<lang>.json is its translation, not the spec's. A file nothing names is an error; so is an engine there is
// none of. Files and folders whose names begin with a dot (an editor's, the system's) are not the scene's.

const ID = /^(?!\.)[\p{L}\p{N}_.-]{1,64}$/u;
const TOP = engine3 => ({ script: 'script.js', ...(engine3 && { showcase: 'showcase.js' }), lib: 'lib.js', relief: 'relief.js', notes: 'notes.md' });
const IN = engine3 => ({
  objects: { code: 'elements/{id}.js', script: 'elements/{id}.script.js', ...(engine3 && { animate: 'elements/{id}.animate.js', shader: 'elements/{id}.wgsl' }) },
  widgets: { html: 'widgets/{id}.html' },
});

// the files under a folder (ending in /) — its hidden ones not —, by their path from it → their text
async function filesUnder(source, dir, prefix = '') {
  const found = await Promise.all((await source.list(`${dir}${prefix}`) ?? []).filter(x => !x.name.startsWith('.')).map(async e =>
    (e.dir ? [...await filesUnder(source, dir, `${prefix}${e.name}/`)] : [[`${prefix}${e.name}`, await source.read(`${dir}${prefix}${e.name}`)]])));
  return new Map(found.flat());
}

// the spec the folder's files make
function specOf(files, where) {
  if (!files.has(SPEC)) throw wrong(`${where}${SPEC}`, 'none');
  let spec;
  try { spec = JSON.parse(files.get(SPEC)); } catch (e) { throw wrong(`${where}${SPEC}`, e.message); }
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw wrong(`${where}${SPEC}`, 'not an object');
  if (spec.engine !== undefined && spec.engine !== 1 && spec.engine !== 3) throw wrong(`${where}${SPEC}`, `"engine" ${JSON.stringify(spec.engine)} — there is engine 3, and engine 1 (none said)`);
  const used = new Set([SPEC]);
  for (const lang of Object.keys(LANGUAGES).filter(l => l !== SOURCE)) {
    const name = `lang/${lang}.json`;
    if (files.has(name)) { entries(files.get(name), `${where}${name}`, lang); used.add(name); }
  }
  const take = (o, key, name) => { if (files.has(name)) { o[key] = files.get(name).replace(/\n+$/, ''); used.add(name); } };
  for (const [key, name] of Object.entries(TOP(spec.engine === 3))) take(spec, key, name);
  for (const [key, fields] of Object.entries(IN(spec.engine === 3))) {
    for (const item of Array.isArray(spec[key]) ? spec[key] : []) {
      if (!item || typeof item !== 'object' || !ID.test(String(item.id ?? ''))) continue;
      for (const [field, path] of Object.entries(fields)) take(item, field, path.replace('{id}', item.id));
    }
  }
  const extra = [...files.keys()].filter(f => !used.has(f)).sort();
  if (extra.length) throw wrong(`${where}${extra[0]}`, `files no element or widget of ${SPEC} names: ${extra.join(', ')}`);
  return spec;
}

// a scene of the world put together: {spec, base — its folder in the repository, files — its files' texts}
export async function sceneOf(source, w, folder) {
  if (!folder || !(await folders(source, w)).includes(folder)) throw missing(folder ?? '', `no scene "${folder ?? ''}" in the world "${w.name}" (its scenes/<folder>)`);
  const base = `${w.base}scenes/${folder}/`, files = await filesUnder(source, base);
  return { spec: specOf(files, base), base, files };
}
// GET scene: {spec, title, strings, modules} — and files, the host's address of the world's files by their id
export async function sceneIn(source, w, folder, lang) {
  const { spec, base, files } = await sceneOf(source, w, folder);
  const strings = lang === SOURCE ? [] : entries(files.get(`lang/${lang}.json`) ?? null, `${base}lang/${lang}.json`, lang);
  const names = [...new Set((Array.isArray(spec.modules) ? spec.modules : []).filter(n => typeof n === 'string'))].sort();
  const modules = Object.fromEntries(await Promise.all(names.map(async n => {
    const at = ID.test(n) ? `${w.base}modules/${n}` : null;  // (a name that is no file's is no module of the world)
    const [code, data, strings] = at ? await Promise.all([source.id(`${at}.js`), source.id(`${at}.data.json`), lang !== SOURCE ? source.id(`${at}.${lang}.json`) : null]) : [null, null, null];
    return [n, { code, data, strings }];
  })));
  return { spec, title: await translated(source, lang, `${base}lang/${lang}.json`, spec.title), strings, modules };
}
