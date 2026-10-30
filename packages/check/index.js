// A repository checked (scopes.js — its worlds, games and articles, where their texts come from, where their
// translations lie; extract.js — what a file says): what the repository says of itself (scopes.js), and every text
// found translated into every language its world, game or article says it is in but the source (i18n/languages.json:
// the first) — the forms its plural needs in each, the same {names} in a translation as in its text, nothing translated
// that the code no longer says; a game's data the same files in every language; an article's whole text in each. write:
// each language's file laid out anew from what the code says now — in the code's order, one entry a line, what was
// translated kept (by its text), what is new to translate empty, what the code no longer says gone (git diff shows it,
// to carry over by hand); an article is translated by hand. A scene's engine one there is (3, or 1); its music as a
// host makes it (engines/1/music.js: within LIMITS).
import { isAdvice, problem } from './problems/problems.js';
import { LANGUAGES, scopes } from './scopes.js';
import './i18n/i18n.js';
import './engines/1/music.js';

const { keyOf } = globalThis.MooodI18n;
export { LANGUAGES };
const SOURCE = LANGUAGES[0];

const names = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
// (a line's inline tags — <sigh>, <short pause> —: how its voice says it there, in English, the same in every language)
const tags = text => [...text.matchAll(/<[^<>\n]*>/g)].map(m => m[0]).sort().join(' ');
const PERSON = new Set(['voice', 'how', 'short']);
const others = text => [...new Set(names(text).split(',').filter(k => k && k !== 'n'))].join(',');  // (a plural's: all but its {n})
const formsOf = lang => new Intl.PluralRules(lang).resolvedOptions().pluralCategories;

// the scope's entries, each text once (its first place), in the code's order
function unique(entries) {
  const seen = new Map();
  for (const e of entries) {
    const key = keyOf(e.context, e.text, e.who);
    if (!seen.has(key)) seen.set(key, e);
  }
  return seen;
}

// a language's file: its entries by key (null: there is none; undefined: it is not a translation's file — its problem
// said, and it is left as it is: never laid out anew over what is in it)
async function readLang(source, path, problems) {
  const text = await source.read(path);
  if (text === null) return null;
  try {
    const data = JSON.parse(text);
    if (!Array.isArray(data?.strings ?? [])) { problems.push(problem(path, 'not-strings')); return undefined; }
    const had = new Map();
    for (const e of data.strings || []) {
      const key = keyOf(e.context, e.text, e.who);
      // (twice — a merge's, as a rule: the page's translator refuses the whole file; --write keeps one)
      if (had.has(key)) problems.push(problem(path, 'translated-twice', { text: e.text }));
      had.set(key, e);
    }
    return had;
  } catch (e) {
    problems.push(problem(path, 'json', { error: e.message }));
    return undefined;
  }
}

// one entry a line: a translator's change, an author's new text — a line each in a diff, and no two branches touch the same
function writeLang(source, path, entries) {
  return source.write(path, entries.length ? `{"strings": [\n${entries.map(e => `  ${JSON.stringify(e)}`).join(',\n')}\n]}\n` : '{"strings": []}\n');
}

// An article (article.json — its title, its date, its summary —, story.md beside it): in each language it is in but the
// source, article.<lang>.json with its title (and its summary, if it has one) and story.<lang>.md
async function article(source, a, problems) {
  const name = `${a.base}article.json`, text = p => source.read(p);
  if (!a.json) return;
  if (!a.json.title || !a.json.date) problems.push(problem(name, 'article-title'));
  if (!(await text(`${a.base}story.md`))?.trim()) problems.push(problem(`${a.base}story.md`, 'article-story'));
  for (const lang of (a.languages || []).filter(l => l !== SOURCE)) {
    const path = `${a.base}article.${lang}.json`, t = await text(path);
    let m = null;
    try { m = t === null ? null : JSON.parse(t); } catch (e) { problems.push(problem(path, 'json', { error: e.message })); continue; }
    if (!m?.title) problems.push(problem(path, t === null ? 'article-none' : 'article-no-title', { lang }));
    else if (a.json.summary && !m.summary) problems.push(problem(path, 'article-no-summary'));
    if (!(await text(`${a.base}story.${lang}.md`))?.trim()) problems.push(problem(`${a.base}story.${lang}.md`, 'article-story-lang', { lang }));
  }
}

// The engine a scene says (scene.json's "engine"): 3 — every new scene's; none (or 1) — the old one's. Engine 2 is gone.
function engine(spec, at) {
  const e = spec?.engine;
  if (e === undefined || e === 1 || e === 3) return [];
  return [problem(at, e === 2 ? 'engine-gone' : 'engine', { engine: JSON.stringify(e) })];
}

// A scene's music (scene.json's "music") as its page asks a host for it (MooodMusic.asked: the descriptions that sound,
// the settings) — what a host making it with Lyria takes (LIMITS), or the problems of what it does not
function music(spec, at) {
  const { LIMITS } = globalThis.MooodMusic, m = globalThis.MooodMusic.asked(spec?.music), out = [];
  if (!m) return out;
  if (m.prompts.length > LIMITS.prompts) out.push(problem(at, 'music-prompts', { count: m.prompts.length, most: LIMITS.prompts }));
  m.prompts.forEach((p, i) => { if (p.text.length > LIMITS.text) out.push(problem(at, 'music-text', { n: i + 1, length: p.text.length, most: LIMITS.text })); });
  for (const [field, [least, most]] of Object.entries(LIMITS.ranges)) {
    if (field in m.config && !(m.config[field] >= least && m.config[field] <= most)) out.push(problem(at, 'music-range', { field, value: m.config[field], least, most }));
  }
  if ('scale' in m.config && !LIMITS.scales.includes(m.config.scale)) out.push(problem(at, 'music-scale', { scale: m.config.scale, scales: LIMITS.scales.join(', ') }));
  return out;
}

// A repository read through its source (repository.js) → {problems: [{at, code, values}] (problems/problems.js) — what is
// wrong, advice: [{at, code, values}] — what works, better written otherwise (problems.js: ADVICE), scopes: [{name, kind, languages, entries,
// said}]} — said: the lines heard (who, text, said: 'say' | 'think', voice? — a scene's, how?, spoken? — a game's line's own); write — each language's file laid out
// anew (a source that writes: a folder)
export async function check(source, { write = false } = {}) {
  const all = await scopes(source), problems = [...all.problems], out = [];
  for (const a of all.articles) await article(source, a, problems);
  for (const s of all.scopes) {
    problems.push(...s.problems);
    if (s.kind === 'scene') {
      const at = `${s.name}/scene.json`;
      let spec = null;
      try { spec = JSON.parse(await source.read(at)); } catch { /* (none, or not JSON: said by its fields) */ }
      problems.push(...engine(spec, at), ...music(spec, at));
    }
    const targets = s.languages.filter(l => l !== SOURCE);
    const found = unique(s.entries);
    // (the lines heard: each way it is heard once — a text said aloud and thought is one to translate, two to voice)
    const heard = new Map(s.entries.filter(e => e.said).map(e => [JSON.stringify([e.who, e.text, e.said, e.voice ?? null, e.how ?? '', e.spoken ?? null]), e]));
    out.push({ name: s.name, kind: s.kind, languages: s.languages, entries: [...found.values()], said: [...heard.values()] });
    for (const lang of targets) {
      const path = s.file(lang), had = await readLang(source, path, problems);
      if (had === undefined) continue;
      if (write) {
        if (!found.size && !had) continue;
        await writeLang(source, path, [...found.entries()].map(([key, e]) => {
          const was = had?.get(key);
          const empty = e.plural ? Object.fromEntries(formsOf(lang).map(f => [f, ''])) : '';
          return { text: e.text, ...(e.plural ? { plural: e.plural } : {}), ...(e.context ? { context: e.context } : {}),
            ...(e.who ? { who: e.who } : {}), translation: was?.translation ?? empty, where: e.where, ...(was?.note ? { note: was.note } : {}) };
        }));
        continue;
      }
      if (!found.size && !had) continue;
      if (!had) { problems.push(problem(path, 'no-translations', { count: found.size, lang })); continue; }
      for (const [key, e] of found) {
        // (what: the text, and whose it is or its context — what tells it apart)
        const t = had.get(key)?.translation, what = { text: e.text, ...(e.who ? { who: e.who } : e.context ? { context: e.context } : {}) };
        if (e.plural) {
          if (!t || typeof t !== 'object') { problems.push(problem(path, 'untranslated-forms', { ...what, forms: formsOf(lang).join(', ') })); continue; }
          for (const f of formsOf(lang)) {
            if (!t[f]) problems.push(problem(path, 'no-form', { ...what, form: f }));
            // (a form says {n} or not, as its language counts — 21 час, an hour: the others, as the text's forms do)
            else if (others(t[f]) !== others(`${e.text} ${e.plural}`)) problems.push(problem(path, 'form-names', { ...what, form: f, names: others(t[f]), wanted: others(`${e.text} ${e.plural}`) }));
          }
        } else if (!t || typeof t !== 'string') problems.push(problem(path, 'untranslated', what));
        else if (names(t) !== names(e.text)) problems.push(problem(path, 'names', { ...what, names: names(t), wanted: names(e.text) }));
        else if (e.said && tags(t) !== tags(e.text)) problems.push(problem(path, 'tags', { ...what, tags: tags(t) || '—', wanted: tags(e.text) || '—' }));
      }
      for (const [key, e] of had) if (!found.has(key)) problems.push(problem(path, 'unsaid', { text: e.text }));
    }
    // a game's people (bespoke/people.json: {who: {voice — its name, how — the manner it lasts, short — what the player
    // reads them as}}) and its lines: each said by one of them, a thought by one with a short name (it is shown with it)
    if (s.people) {
      let people = {};
      try { people = JSON.parse(await source.read(s.people)) ?? {}; } catch { /* (none, or not JSON: said by its field) */ }
      for (const [who, p] of Object.entries(people)) {
        if (!p || typeof p !== 'object' || Array.isArray(p)) { problems.push(problem(s.people, 'person-not-object', { who })); continue; }
        for (const [k, v] of Object.entries(p)) {
          if (!PERSON.has(k)) problems.push(k === 'name' ? problem(s.people, 'person-name', { who }) : problem(s.people, 'person-field', { who, field: k }));
          else if (typeof v !== 'string') problems.push(problem(s.people, 'person-not-text', { who, field: k }));
        }
      }
      for (const e of found.values()) {
        if (!e.said) continue;
        const at = `${e.where}:${e.line}`;
        if (!people[e.who]) problems.push(problem(at, 'line-no-person', { text: e.text, who: e.who, people: s.people }));
        else if (e.said === 'think' && !people[e.who].short) problems.push(problem(at, 'thought-no-short', { text: e.text, who: e.who, people: s.people }));
      }
    }
    // a game's data: the same files in every language, the source's
    if (s.data) {
      const list = async lang => ((await source.list(`${s.data(lang)}/`)) ?? []).filter(e => e.name !== 'strings.json').map(e => e.name).sort().join(', ');
      const own = await list(SOURCE);
      for (const lang of targets) {
        const theirs = await list(lang);
        if (theirs !== own) problems.push(problem(s.data(lang), 'data', { files: theirs || '—', wanted: own || '—' }));
      }
    }
  }
  return { problems: problems.filter(p => !isAdvice(p)), advice: problems.filter(isAdvice), scopes: out };
}
