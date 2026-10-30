// What check finds wrong, as data: a problem is {at — where (a file, a file:line, a folder), code, values — names,
// paths, texts and numbers as written} — and say(problem, tr) says it in words, in the language of the translator it
// is given (MooodI18n.translator: English for the command line; a page its own language — the translations beside
// this file, lang/<lang>.json: a browser's page loads them as any part of moood's pages, i18n/words.js). A code
// say(…) knows nothing of is said as it is.
export const problem = (at, code, values = {}) => ({ at, code, values });

// Each code's level: an error (what is wrong — every code but these) or advice (what works as it is, better written
// otherwise — said, and nothing is refused for it: check keeps it apart from the problems, its own list)
export const ADVICE = new Set(['hands-old']);
export const isAdvice = ({ code }) => ADVICE.has(code);

export function say({ code, values: v }, tr) {
  switch (code) {
    // where worlds, games and articles lie; what they say of themselves
    case 'two-kinds': return tr('{files} in one folder — a folder is one world, one game or one article', v);
    case 'json': return tr('not JSON: {error}', v);
    case 'not-object': return tr('not an object', v);
    case 'languages': return tr('"languages" — the languages it is in: a list of moood\'s ({known})', v);
    case 'languages-unknown': return tr('"languages" — {languages}: not moood\'s ({known})', v);
    case 'languages-twice': return tr('"languages" — {languages} twice', v);
    // how they name each other ({field}: "world", "about"; {ref}: as written)
    case 'ref-not-path': return tr('"{field}" {ref} — not a path', v);
    case 'ref-repository': return tr('"{field}" {ref} — {name}: not a repository (owner/name)', v);
    case 'ref-version': return tr('"{field}" {ref} — {version}: not a branch, a tag or a commit', v);
    case 'ref-path': return tr('"{field}" {ref} — {path}: not a path in the repository (. — its root)', v);
    case 'ref-neither': return tr('"{field}" {ref} — neither a path from here nor repo@ref:path', v);
    case 'ref-out': return tr('"{field}" {ref} — out of the repository', v);
    case 'world-none': return tr('"world" — the world it is played on: a path from here, or repo@ref:path', v);
    case 'world-not-there': return tr('"{field}" {ref} — no world there ({file})', v);
    case 'world-languages': return tr('"{field}" {ref} — its world is not in {languages}: a game is in a language only if its world is', v);
    case 'about-not-list': return tr('"about" — a list of the worlds, games and scenes it is about (paths from here, or repo@ref:path)', v);
    case 'about-nothing': return tr('"about" {ref} — no world, game or scene there', v);
    // the engine a scene is for
    case 'engine': return tr('"engine" {engine} — there is engine 3 (every new scene), and engine 1 (a scene that says none)', v);
    case 'engine-gone': return tr('"engine" 2 — engine 2 is gone: the scene is written anew for engine 3 ("engine": 3)', v);
    // a cast's old words for a style's hands (advice: the engine still reads them)
    case 'hands-old': return tr('{word} — an old word: write hands: "{hands}"', v);
    // a scene's music, as a host makes it (engines/1/music.js: what Lyria takes)
    case 'music-prompts': return tr('"music" — {count} descriptions that sound: {most} at most', v);
    case 'music-text': return tr('"music" — the description {n} that sounds: {length} characters, {most} at most', v);
    case 'music-range': return tr('"music".{field} {value} — {least} to {most}', v);
    case 'music-scale': return tr('"music".scale "{scale}" — one of {scales}', v);
    // the code's texts
    case 'not-javascript': return tr('does not read as JavaScript: {error}', v);
    case 'tr-not-literal': return tr('tr(…) — its text is not a literal', v);
    case 'tr-n-not-literal': return tr('tr.n(count, one, other) — its forms are not literals', v);
    case 'tr-c-not-literal': return tr('tr.c(context, text) — not literals', v);
    case 'tr-line-not-literal': return tr('tr.{name}(who, text) — not literals', v);
    case 'tr-not-own': return tr('tr.{name} — not for a world\'s or a game\'s code (tr, tr.n, tr.c, tr.line, tr.thought)', v);
    case 'tr-tag': return tr('tr`…` — call it: tr(\'…\')', v);
    case 'tr-value': return tr('tr — not a value (T = tr, f(tr)): call it where its text is written', v);
    case 'own-variable': return tr('{name} is the language\'s own name — not a variable', v);
    case 'own-function': return tr('{name} is the language\'s own name — not a function', v);
    case 'own-set': return tr('{name} is the language\'s own name — not to be set', v);
    case 'own-parameter': return tr('{name} is the language\'s own name — not a parameter', v);
    // a line someone says
    case 'person-line-not-literal': return tr('person(who).{name}(text) — not literals', v);
    case 'act-say-game': return tr('act(who, \'say\', text) — a game\'s line is b.say(who, text)', v);
    case 'act-say-not-literal': return tr('act(who, \'say\', text) — not literals', v);
    case 'line-speaker': return tr('{name}(who, text) — the text written here, its speaker not: a line is said by someone written beside it ({name}(\'who\', \'…\'))', v);
    case 'line-whose': return tr('.{name}(\'…\') — whose line it is is not written beside it: s.person(\'who\').{name}(\'…\'), or s.{name}(\'who\', \'…\')', v);
    case 'line-bare': return tr('{name}(who, text) — a text in it is not a line: write it whole here, or mark each where it is written (tr.line, tr.thought)', v);
    case 'line-kept-how': return tr('{name}(who, line, { how, spoken }) — a kept line\'s own manner and spoken words are kept with it: tr.line(who, text, { how, spoken })', v);
    case 'voice-not-literal': return tr('{name} — its voice, how are not literals', v);
    case 'how-not-literal': return tr('{name} — its how is not a literal', v);
    case 'spoken-not-literal': return tr('{name} — its spoken is not a literal', v);
    case 'voice-who': return tr('{name} — "who" is not heard: a voice is {voice, how}', v);
    case 'voice-spread': return tr('{name} — its voice is spread (…): say it whole, in literals', v);
    case 'voice-game': return tr('{name} — a game\'s line is heard in its person\'s voice (people.json): its own is { how }', v);
    // a text shown as it is (a read field, markup)
    case 'braced': return tr('"{text}" — a { name } in a text shown as it is (nothing goes into it)', v);
    case 'not-text': return tr('{field} — not a text', v);
    // translations
    case 'not-strings': return tr('not {"strings": [entries]}', v);
    case 'translated-twice': return tr('"{text}" — translated twice', v);
    case 'no-translations': return tr.n(v.count, 'none — {n} text to translate into {lang}', 'none — {n} texts to translate into {lang}', v);
    case 'untranslated': return tr('"{text}" — not translated', v);
    case 'untranslated-forms': return tr('"{text}" — not translated (its forms: {forms})', v);
    case 'no-form': return tr('"{text}" — no "{form}" form', v);
    case 'form-names': return tr('"{text}" — its "{form}" form says {{names}}, the text {{wanted}} (and { n }, or not)', v);
    case 'names': return tr('"{text}" — the translation says {{names}}, the text {{wanted}}', v);
    case 'tags': return tr('"{text}" — the translation\'s tags are {tags}, the line\'s {wanted} (heard as written, in English)', v);
    case 'unsaid': return tr('"{text}" — the code no longer says it (check --write lays the file out anew)', v);
    case 'data': return tr('its data ({files}) is not the source\'s ({wanted})', v);
    // a game's people
    case 'person-not-object': return tr('"{who}" — not {voice, how, short}', v);
    case 'person-field': return tr('"{who}".{field} — a person is {voice, how, short}', v);
    case 'person-name': return tr('"{who}".name — a person is {voice, how, short} (who they are is their voice and their manner)', v);
    case 'person-not-text': return tr('"{who}".{field} — not a text', v);
    case 'line-no-person': return tr('"{text}" — said by "{who}", no one of {people}', v);
    case 'thought-no-short': return tr('"{text}" — thought by "{who}", who has no short name ({people})', v);
    // articles
    case 'article-title': return tr('no "title" and "date"', v);
    case 'article-story': return tr('none — the article\'s text', v);
    case 'article-none': return tr('none — the article in {lang}', v);
    case 'article-no-title': return tr('no "title" — the article in {lang}', v);
    case 'article-no-summary': return tr('no "summary"', v);
    case 'article-story-lang': return tr('none — the article\'s text in {lang}', v);
    default: return code;
  }
}
