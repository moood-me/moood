// What a repository holds, where its texts come from and where their translations lie. A repository is a folder: every
// folder in it (at any depth, the root too) with world.json is a world, with game.json a game, with article.json an
// article — as many as it has, mixed; a folder that is one is not searched further (its scenes/, modules/, bespoke/ are
// its own), and one with two of these files is wrong. Each says its languages (`"languages": [...]`, moood's:
// i18n/languages.json) and is checked in those, and only those; a game names its world by a path from its own folder,
// or `repo@ref:path` for another repository (only its form is checked here: nothing is fetched), and is in a language
// only if its world is; an article names the worlds, games and scenes it is about (`"about": [...]`) the same way
// (repository.js).
//   The scopes: a world's (world.json → lang/<lang>.json), each of its scenes' (scenes/<folder>: scene.json, its code,
// its widgets' markup → scenes/<folder>/lang/<lang>.json), each of its modules' (modules/<name>.js →
// modules/<name>.<lang>.json); a game's (game.json, bespoke/people.json, bespoke/'s code → bespoke/lang/<lang>/strings.json;
// its data by language: bespoke/lang/<lang>/<name>.json, the source language's too). An article is translated whole
// (index.js). A folder with no world, game or article in it is a folder of moood's own pages (its code and pages →
// lang/<lang>.json), in every language moood has.
import { readFileSync } from 'node:fs';
import { FIELDS, fromCode, fromJson, fromMarkup } from './extract.js';
import { problem } from './problems/problems.js';
import { languagesOf, natural, reference, scenePath, units } from './repository.js';

export const LANGUAGES = Object.keys(JSON.parse(readFileSync(new URL('./i18n/languages.json', import.meta.url), 'utf8')));

// the files under a folder of the source ('.' the root), by their path from its root, in natural order; skip — a path
// left out
async function filesUnder(source, folder, skip = () => false) {
  const walk = async dir => {
    const entries = await source.list(dir) ?? [];
    return (await Promise.all(entries.map(e => (e.dir ? walk(`${dir}${e.name}/`) : [`${dir}${e.name}`])))).flat();
  };
  return (await walk(folder === '.' ? '' : `${folder.replace(/\/$/, '')}/`)).filter(p => !skip(p)).sort(natural);
}
// whether a file is there
const there = async (source, path) => await source.read(path) !== null;

// what the files of a scope say: {entries, problems} — own: a world's or a game's (extract.js fromCode); game: a game's
async function read(source, files, own, game) {
  const entries = [], problems = [];
  for (const f of files) {
    const text = await source.read(f), name = f.split('/').pop();
    const r = name in FIELDS ? fromJson(text, f, FIELDS[name])
      : /\.(m?js)$/.test(f) ? fromCode(text, f, own, game)
        : /\.html$/.test(f) ? fromMarkup(text, f, own, game) : null;
    if (r) { entries.push(...r.entries); problems.push(...r.problems); }
  }
  return { entries, problems };
}

// a world's, game's or article's languages as it says them (null: not said rightly — the problem said: repository.js)
function languages(u, problems) {
  if (!u.json) return null;
  const l = languagesOf(u.json, LANGUAGES);
  if (l.problem) problems.push(problem(`${u.base}${u.kind}.json`, l.problem.code, l.problem.values));
  return l.languages ?? null;
}
// what is wrong with a reference (repository.js: its wrong), as a problem of the file that makes it
const misnamed = (name, field, ref, w) => problem(name, w.code, { field, ref: JSON.stringify(ref), ...w.values });

// A repository's (or a pages' folder's), read through its source (repository.js): its scopes — [{name, kind, languages
// — the ones it is checked in, files, file(lang) — where its translation lies, data(lang) — the folder of its data by
// language and people — its people.json (a game's)}] —, its articles ([{base, json, languages}]) and what is wrong with
// the repository itself: where its worlds, games and articles lie, what they say of themselves and of each other
// (problems/problems.js)
export async function scopes(source) {
  const out = [], articles = [];
  const { units: found, problems } = await units(source);
  if (!found.length && !problems.length) {
    // (a folder of pages: its code, its pages; not a library's bundle built into it, *.min.js)
    out.push({ name: '.', kind: 'front', languages: LANGUAGES, files: (await filesUnder(source, '.', p => p.startsWith('lang/') || p.includes('node_modules/') || p.endsWith('.min.js')))
      .filter(p => /\.(m?js|html)$/.test(p) || p.split('/').pop() in FIELDS),
      file: lang => `lang/${lang}.json` });
  }
  const worlds = new Map();  // a world's folder ('' the root; no ending /) → its languages (null: not said rightly)
  for (const u of found) if (u.kind === 'world') worlds.set(u.base.replace(/\/$/, ''), languages(u, problems));
  for (const u of found) {
    const b = u.base, name = `${b}${u.kind}.json`;
    if (u.kind === 'article') {
      articles.push({ ...u, languages: languages(u, problems) });
      // what it is about: worlds, games, scenes — paths from its folder, or repo@ref:path
      const about = u.json?.about ?? [];
      if (!Array.isArray(about)) problems.push(problem(name, 'about-not-list'));
      else for (const a of about) {
        const r = reference(a, b);
        if (r.wrong) { problems.push(misnamed(name, 'about', a, r.wrong)); continue; }
        if (r.foreign) continue;
        const of = scenePath(r.path), scene = of && worlds.has(of.world) && await there(source, `${r.path}/scene.json`);
        if (!scene && !found.some(f => f.kind !== 'article' && f.base === (r.path ? `${r.path}/` : ''))) problems.push(problem(name, 'about-nothing', { ref: JSON.stringify(a) }));
      }
    } else if (u.kind === 'world') {
      const said = worlds.get(b.replace(/\/$/, '')) ?? [];
      out.push({ name, kind: 'world', languages: said, files: [name], file: lang => `${b}lang/${lang}.json` });
      for (const folder of ((await source.list(`${b}scenes/`)) ?? []).filter(e => e.dir).map(e => e.name).sort(natural)) {
        const base = `${b}scenes/${folder}`;
        out.push({ name: base, kind: 'scene', languages: said, files: (await filesUnder(source, base, p => p.startsWith(`${base}/lang/`))).filter(p => /\.(js|html)$/.test(p) || p.endsWith('/scene.json')),
          file: lang => `${base}/lang/${lang}.json` });
      }
      for (const m of (await filesUnder(source, `${b}modules`)).filter(p => /^modules\/[^/]+\.js$/.test(p.slice(b.length)))) {
        const base = m.slice(0, -3);
        out.push({ name: base, kind: 'module', languages: said, files: [m], file: lang => `${base}.${lang}.json` });
      }
    } else {
      const said = languages(u, problems);
      // its world: there, and in every language the game is in
      if (u.json) {
        const w = reference(u.json.world, b), at = { field: 'world', ref: JSON.stringify(u.json.world) };
        if (u.json.world === undefined) problems.push(problem(name, 'world-none'));
        else if (w.wrong) problems.push(misnamed(name, 'world', u.json.world, w.wrong));
        else if (!w.foreign && !worlds.has(w.path)) problems.push(problem(name, 'world-not-there', { ...at, file: `${w.path ? `${w.path}/` : ''}world.json` }));
        else if (!w.foreign) {
          const l = worlds.get(w.path), missing = l && said ? said.filter(x => !l.includes(x)) : [];
          if (missing.length) problems.push(problem(name, 'world-languages', { ...at, languages: missing.join(', ') }));
        }
      }
      const skip = p => p.startsWith(`${b}bespoke/lang/`);
      out.push({ name, kind: 'game', languages: said ?? [],
        files: [name, ...(await filesUnder(source, `${b}bespoke`, skip)).filter(p => /\.(m?js|html)$/.test(p) || p === `${b}bespoke/people.json`)],
        file: lang => `${b}bespoke/lang/${lang}/strings.json`, data: lang => `${b}bespoke/lang/${lang}`, people: `${b}bespoke/people.json` });
    }
  }
  return { problems, articles, scopes: await Promise.all(out.map(async s => ({ ...s, ...await read(source, s.files, s.kind !== 'front', s.kind === 'game') }))) };
}
