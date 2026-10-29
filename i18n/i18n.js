// Languages: one rule for every text a person reads or hears. The source
// language is English (MooodI18n.source — languages.json's first, as the services and check read it); the text is
// written where it is used, as a literal —
//   tr('The sea is still asleep.')                 a text
//   tr('Hello, {name}', { name })                  with what goes into it ({name}: from the object)
//   tr.n(count, '{n} hour', '{n} hours')           as many as count ({n} — count): the forms are the source
//                                                  language's one and other; a translation has its own language's
//                                                  (Intl.PluralRules: one, few, many, other…)
//   tr.c('the toy, not the real one', 'Ship')      the same text meaning another thing (its context — to the
//                                                  translator too)
//   tr.said(who, text)                             a line someone says (say, think) in the language: who tells apart
//                                                  what is the same text in the source but not in another (the
//                                                  runtime's: say and think say it so)
//   tr.line(who, text, {how, spoken}), tr.thought(…)  a line kept to be said later (a list of answers, an ending's
//                                                  lines) — aloud (say) or thought (think): {text — it as written,
//                                                  how — its own manner (English, never translated), or ''; spoken —
//                                                  what its voice says instead of it, as written (never translated),
//                                                  or null} — say/think translate it; marked so that it is found, and
//                                                  how it is heard (gettext's N_)
// — and a translation of it, in a language's file, is found by it: no translation is an error (fail-fast), never
// the source shown instead. The source language itself needs no file. A file's entries (check writes them):
//   {"text": "…", "plural"?: "…", "context"?: "…", "who"?: "…", "translation": "…" | {"one": "…", "few": "…", …},
//    "where"?: "…", "note"?: "…"}
// The pseudo-language (PSEUDO) is every text of the source made strange but readable: a page in it shows at once
// what is not through tr — it reads as plain English.
// A classic script: it sets globalThis.MooodI18n (a page's script, a worker's importScripts, a module's import).
(() => {
  const PSEUDO = 'qps';
  // (gettext's: context, then the text; a line's — whose it is, then the text, apart from any context)
  const SEP = '\u0004', WHO = '\u0005';
  const keyOf = (context, text, who) => (who ? `${who}${WHO}${text}` : context ? `${context}${SEP}${text}` : text);
  // (a line kept: tr.line, tr.thought — said later, by say/think)
  const kept = (who, text, { how = '', spoken = null } = {}) => ({ text, how, spoken });

  // what goes into a text: {name} — params.name (none given — an error: a text says what it needs)
  function fill(text, params, where) {
    return text.replace(/\{(\w+)\}/g, (_, name) => {
      if (!params || !(name in params)) throw new Error(`${where}: "${text}" needs {${name}}`);
      return String(params[name]);
    });
  }

  const ACCENTS = { a: 'á', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'î', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ',
    n: 'ñ', o: 'ö', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ţ', u: 'û', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž', A: 'Å', B: 'Ɓ',
    C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Î', J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ', N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Ǫ',
    R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Û', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž' };
  // a source text made strange: its letters accented (not what goes into it, {name}), a third longer, in brackets
  function pseudo(text) {
    const strange = text.split(/(\{\w+\})/).map((part, i) => (i % 2 ? part : part.replace(/[A-Za-z]/g, c => ACCENTS[c]))).join('');
    return `⟦${strange}${'~'.repeat(Math.ceil(text.length / 3))}⟧`;
  }

  // A language's translator: lang — its code; entries — its files' entries, all of what the text comes from (a scene's
  // with its modules'); where — what is translated (said in an error). The source language and the pseudo-language
  // need no entries.
  function translator(lang, entries = [], where = 'text') {
    const source = lang === MooodI18n.source, strange = lang === PSEUDO;
    const found = new Map();
    for (const e of entries) {
      const key = keyOf(e.context, e.text, e.who);
      if (found.has(key)) throw new Error(`${where}: "${e.text}" is translated twice`);
      found.set(key, e.translation);
    }
    const rules = new Intl.PluralRules(source || strange ? MooodI18n.source : lang);
    const lookup = (context, text, who) => {
      const t = found.get(keyOf(context, text, who));
      if (t == null || t === '') throw new Error(`${where}: no ${lang} translation of "${text}"${who || context ? ` (${who || context})` : ''}`);
      return t;
    };
    const one = (context, text, params, who) => {
      if (source) return fill(text, params, where);
      if (strange) return fill(pseudo(text), params, where);
      const t = lookup(context, text, who);
      if (typeof t !== 'string') throw new Error(`${where}: the ${lang} translation of "${text}" is not one text`);
      return fill(t, params, where);
    };
    const tr = (text, params) => one(null, text, params);
    tr.c = (context, text, params) => one(context, text, params);
    tr.said = (who, text) => one(null, text, null, who);
    tr.line = tr.thought = kept;
    tr.n = (count, singular, plural, params) => {
      const all = { n: count, ...params }, form = rules.select(count);
      if (source) return fill(form === 'one' ? singular : plural, all, where);
      if (strange) return fill(pseudo(form === 'one' ? singular : plural), all, where);
      const t = lookup(null, singular);
      if (typeof t !== 'object' || !t[form]) throw new Error(`${where}: no ${lang} "${form}" form of "${singular}"`);
      return fill(t[form], all, where);
    };
    tr.lang = lang;
    return tr;
  }

  // What of a JSON file is read or heard — translated (check finds them; a page shows them translated): by the file's
  // name, [path] (a.b: b of a; a[].b: b of each of a's; *.b: b of each of an object's values)
  const FIELDS = {
    'scene.json': ['title', 'description', 'caption', 'captions[].text'],
    'world.json': ['title', 'description'],
    'game.json': ['title', 'description', 'line', 'source'],
    'people.json': ['*.short'],
  };

  // A widget's markup (or a page's): its texts — between tags (not a script's or a style's: a script is code; not a
  // page's head: what a page is called its code says), and the attributes that are read (TEXTUAL) — each said once,
  // its spaces as one; and the markup with each text translated (tr).
  const TEXTUAL = /(\s(?:title|alt|placeholder|aria-label)=)("[^"]*"|'[^']*')/g;
  // (each stretch of markup as if between two tags: a text it begins or ends with is one too)
  function walkMarkup(html, fn) {
    return html.split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<head\b[\s\S]*?<\/head>|<!--[\s\S]*?-->)/i).map((part, i) => (i % 2 ? part
      : `>${part}<`.replace(/(>)([^<]+)(<)/g, (m, a, text, b) => (/\p{L}/u.test(text) ? a + fn(text) + b : m))
        .replace(TEXTUAL, (m, a, quoted) => (/\p{L}/u.test(quoted) ? a + quoted[0] + fn(quoted.slice(1, -1)) + quoted[0] : m)).slice(1, -1))).join('');
  }
  const clean = text => text.replace(/\s+/g, ' ').trim();
  function markupTexts(html) {
    const out = [];
    walkMarkup(html, text => { out.push(clean(text)); return text; });
    return out;
  }
  // (the spaces round a text kept: it is laid out as it was)
  const markup = (html, tr) => walkMarkup(html, text => text.replace(/^(\s*)[\s\S]*?(\s*)$/, (m, a, b) => a + tr(clean(text)) + b));

  // A scene's spec as a page shows it: what of it is read translated (FIELDS: its title, caption, captions; its
  // widgets' markup) — for the page only: the engine is given the spec as it is written. (Its elements' names are the
  // artist's: written in the source language, not translated.)
  function shown(spec, tr) {
    if (!spec || typeof spec !== 'object') return spec;
    const t = v => (typeof v === 'string' && v.trim() ? tr(v) : v), list = v => (Array.isArray(v) ? v : null);
    return { ...spec, title: t(spec.title), description: t(spec.description), caption: t(spec.caption),
      captions: list(spec.captions)?.map(c => (c && typeof c === 'object' ? { ...c, text: t(c.text) } : c)) ?? spec.captions,
      widgets: list(spec.widgets)?.map(w => (w && typeof w.html === 'string' ? { ...w, html: markup(w.html, tr) } : w)) ?? spec.widgets };
  }

  // A scene's code (its lib, an element's, a script, a widget's — a text) made into a function of params with `tr` — the
  // translator of its texts — in reach: tr is the language's, not a parameter the code is called with.
  const bind = (tr, params, body) => new Function('tr', `return function (${params}) {\n${body}\n};`)(tr);

  // The words of a part of moood's pages that a page loads as plain scripts (an engine: engine1, engine3): part(name)
  // — its tr, the language the page said (said(name, tr) — words.js speak; tr.lang: that language); a text asked before
  // that is an error.
  const parts = {};
  const part = name => {
    const said = () => parts[name] ?? (() => { throw new Error(`${name}: its words asked before the page said its language`); })();
    const tr = Object.assign((...a) => said()(...a), { n: (...a) => said().n(...a), c: (...a) => said().c(...a), line: kept, thought: kept });
    return Object.defineProperty(tr, 'lang', { get: () => said().lang });
  };
  const said = (name, tr) => { parts[name] = tr; };

  // The one of `codes` (moood's languages: languages.json's keys) a person's language tag (BCP 47: a browser's, a
  // system's) means — by its language and script, both maximized: zh-TW and zh-HK are zh-Hant, so zh-hant; pt-PT and
  // pt-BR are pt; zh-CN is zh-Hans, none of ours —, or null (none, or not a tag).
  const meant = (codes, tag) => {
    let want;
    try { want = new Intl.Locale(tag).maximize(); } catch { return null; }
    return codes.find(c => { const m = new Intl.Locale(c).maximize(); return m.language === want.language && m.script === want.script; }) ?? null;
  };

  const MooodI18n = { source: 'en', PSEUDO, keyOf, translator, FIELDS, markupTexts, markup, shown, bind, part, said, meant };
  globalThis.MooodI18n ??= MooodI18n;  // (loaded twice — a page's script and a module's import: one, the first)
})();
