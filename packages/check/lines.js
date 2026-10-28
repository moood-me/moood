// The lines heard, as they are heard in each language their world or game is in — what their voices are made of (a
// check of a repository asks which are missing): [{scope, lang, who, said, text, voice, how}] — scope: whose line it
// is (a game's, a scene's, a module's: check's name of it); text: what the voice says, its inline tags with it
// (<sigh>). A game's: said by its people, in the manner they last in and the line's own (play/voices.js — the
// runtime's own rule); a scene's or a module's: said with
// their voice ({voice, how} — speech.js asks for it so), a line with none is not heard. A line with no translation is
// left out (check says so). The repository is read through its source (repository.js).
import { heard } from './play/voices.js';
import './i18n/i18n.js';
import { scopes } from './scopes.js';

const { translator } = globalThis.MooodI18n;

// a JSON file of the source (none, or not JSON: empty — check says what is wrong with it)
async function json(source, path, empty) {
  try { return JSON.parse(await source.read(path) ?? 'null') ?? empty; } catch { return empty; }
}

export async function lines(source, report) {
  const found = new Map((await scopes(source)).scopes.map(s => [s.name, s])), out = [];
  for (const r of report.scopes) {
    const s = found.get(r.name);
    if (s.kind === 'game') out.push(...await gameLines(source, s, r));
    else for (const lang of s.languages) {
      const tr = translator(lang, (await json(source, s.file(lang), {})).strings || [], s.name);
      for (const e of r.said.filter(x => x.voice)) {
        try { out.push({ scope: s.name, lang, who: e.who, said: e.said, text: tr.said(e.who, e.text), voice: e.voice.voice, how: e.voice.how ?? '' }); }
        catch { /* (untranslated: check says so) */ }
      }
    }
  }
  return out;
}

async function gameLines(source, s, r) {
  if (!r.said.length) return [];
  const people = await json(source, s.people, {}), out = [];
  for (const lang of s.languages) {
    const tr = translator(lang, (await json(source, s.file(lang), {})).strings || [], 'the game');
    for (const e of r.said) {
      const p = people[e.who];
      if (!p?.voice) continue;  // (no one so, or one with no voice: check says the first)
      try { out.push({ scope: s.name, lang, who: e.who, said: e.said, ...heard(p, e.said, tr.said(e.who, e.text), e.how) }); }
      catch { /* (untranslated: check says so) */ }
    }
  }
  return out;
}
