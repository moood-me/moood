// The player's own page: what the folder holds — its worlds with their scenes, its games — in a language, each
// linked to the pages that show it (scene/, play/); and what is wrong with where they lie or what they say (as check
// finds it, said in the page's language: packages/check/problems). Its words are translated beside it
// (lang/<lang>.json — check lays them out). Shown anew as a file of the folder is saved (changes).
import { readFileSync } from 'node:fs';
import { say } from '../packages/check/problems/problems.js';
import { contents, gameTitle, LANGUAGES, Refusal, worldIn, worldOf, worldTitle } from './folder.js';
import '../i18n/i18n.js';

const { MooodI18n } = globalThis;
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const link = (href, text) => `<a href="${esc(href)}">${esc(text)}</a>`;
const query = o => new URLSearchParams(o).toString();

// the language the page is in: ?lang=, else the person's choice (the cookie the pages read too), else what the
// browser asks for, else the source
export function chosen(asked, cookie, accept) {
  if (Object.hasOwn(LANGUAGES, asked)) return asked;
  const c = /(?:^|;\s*)lang=([^;]+)/.exec(cookie ?? '')?.[1];
  if (Object.hasOwn(LANGUAGES, c)) return c;
  for (const tag of (accept ?? '').split(',')) { const m = MooodI18n.meant(Object.keys(LANGUAGES), tag.split(';')[0].trim()); if (m) return m; }
  return MooodI18n.source;
}

// the words of a folder of moood's (its lang/<lang>.json beside its code) in a language
function words(folder, lang) {
  const found = lang === MooodI18n.source ? [] : JSON.parse(readFileSync(new URL(`lang/${lang}.json`, folder), 'utf8')).strings;
  return MooodI18n.translator(lang, found, String(folder));
}

// what is shown, or why not — the folder's refusal (any other failure is the player's own: thrown)
const said = async fn => {
  try { return { ok: await fn() }; } catch (e) { if (e instanceof Refusal) return { trouble: e }; throw e; }
};

// the page of the folder (root) the player reads through its source
export async function home(source, root, lang) {
  const tr = words(new URL('./', import.meta.url), lang), { worlds, games, problems } = await contents(source);
  // what check finds wrong, in the page's language
  const wrong = words(new URL('../packages/check/problems/', import.meta.url), lang);
  // a refusal in the page's words (docs/host.md: Refusals)
  const refused = ({ code, values: v }) => {
    switch (code) {
      case 'untranslated': return tr('“{text}” is not translated ({file}).', { text: v.text, file: v.file });
      case 'content': return tr('{file} is not right: check says what is wrong.', { file: v.file });
      case 'elsewhere': return tr('Its world {ref} is in another repository: lay it beside the game and name it by its path.', { ref: v.ref });
      case 'not-found': return tr('There is no “{name}” here.', { name: v.name });
      default: return tr('It cannot be shown ({code}).', { code });
    }
  };
  const trouble = e => `<p class="trouble">${esc(refused(e))}</p>`;
  // (in no language: its "languages" are not said rightly — check says so, below)
  const elsewhere = u => (u.languages.length ? `<p class="other">${esc(tr('Not in this language. It is in:'))} ${u.languages.map(l => link(`?${query({ lang: l })}`, LANGUAGES[l].name)).join(', ')}</p>` : '');
  const head = (u, title) => `<h3><code>${esc(u.name)}</code>${title.ok ? ` ${esc(title.ok)}` : ''}</h3>${title.trouble ? trouble(title.trouble) : ''}`;

  const world = async w => {
    if (!w.json) return '';
    if (!w.languages.includes(lang)) return `<li>${head(w, {})}${elsewhere(w)}</li>`;
    const shown = await said(() => worldIn(source, w, lang));
    if (shown.trouble) return `<li>${head(w, await said(() => worldTitle(source, w, lang)))}${trouble(shown.trouble)}</li>`;
    const scenes = shown.ok.scenes.map((s, i) => `<li>${link(`scene/?${query({ world: w.name, scene: s.folder, lang })}`, s.title || s.folder)}
      <code>${esc(s.folder)}</code>${i === 0 ? ` <span class="main">${esc(tr('the main scene'))}</span>` : ''}</li>`);
    return `<li>${head(w, { ok: shown.ok.title })}${scenes.length ? `<ul>${scenes.join('')}</ul>` : `<p class="other">${esc(tr('No scenes yet.'))}</p>`}</li>`;
  };

  const game = async g => {
    if (!g.json) return '';
    if (!g.languages.includes(lang)) return `<li>${head(g, {})}${elsewhere(g)}</li>`;
    const title = await said(() => gameTitle(source, g, lang)), on = await said(() => worldOf(source, g));
    const where = on.ok ? `<p class="other">${esc(tr('Played on the world {world}', { world: on.ok.name }))}</p>` : trouble(on.trouble);
    return `<li>${head(g, title)}${where}${on.ok ? `<p>${link(`play/?${query({ game: g.name, lang })}`, tr('Play'))}</p>` : ''}</li>`;
  };

  const languages = Object.entries(LANGUAGES).map(([l, { name }]) => (l === lang ? `<b>${esc(name)}</b>` : link(`?${query({ lang: l })}`, name))).join(' · ');
  const nothing = !worlds.length && !games.length;
  return `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(tr('moood — the local player'))}</title>
<style>
  :root { color-scheme: light dark; --ink: #222; --quiet: #777; --bad: #b3261e; --line: #ddd; --bg: #fafaf8; }
  @media (prefers-color-scheme: dark) { :root { --ink: #e8e6e3; --quiet: #9a9a9a; --bad: #f2b8b5; --line: #3a3a3a; --bg: #161616; } }
  body { margin: 0 auto; max-width: 52rem; padding: 1.5rem 1rem 3rem; font: 16px/1.5 system-ui, sans-serif; color: var(--ink); background: var(--bg); }
  header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .5rem 1rem; align-items: baseline; border-bottom: 1px solid var(--line); }
  h1 { font-size: 1.3rem; margin: 0 0 .5rem; } h2 { font-size: 1.1rem; margin: 2rem 0 .5rem; } h3 { font-size: 1rem; margin: 0; font-weight: 600; }
  ul { padding-left: 1.2rem; } li { margin: .3rem 0; } section > ul > li { margin: 1rem 0; list-style: none; } section > ul { padding: 0; }
  code { font-size: .85em; color: var(--quiet); margin-right: .4rem; overflow-wrap: anywhere; } h3 code { margin-right: .6rem; }
  p { margin: .2rem 0; } .other, .main { color: var(--quiet); } .main { font-size: .85em; } .trouble { color: var(--bad); white-space: pre-wrap; overflow-wrap: anywhere; }
  a { color: inherit; }
</style>
</head>
<body>
<header><h1>${esc(tr('moood — the local player'))}</h1><nav>${languages}</nav></header>
<p class="other"><code>${esc(root)}</code></p>
${nothing && !problems.length ? `<p>${esc(tr('No worlds or games in this folder: a world is a folder with world.json, a game one with game.json, at any depth.'))}</p>` : ''}
${worlds.length ? `<section><h2>${esc(tr('Worlds'))}</h2><ul>${(await Promise.all(worlds.map(world))).join('')}</ul></section>` : ''}
${games.length ? `<section><h2>${esc(tr('Games'))}</h2><ul>${(await Promise.all(games.map(game))).join('')}</ul></section>` : ''}
${problems.length ? `<section><h2>${esc(tr('What check finds wrong'))}</h2><ul>${problems.map(p => `<li class="trouble"><code>${esc(p.at)}</code> ${esc(say(p, wrong))}</li>`).join('')}</ul></section>` : ''}
<script>new EventSource('api/changes').onmessage = () => location.reload();</script>
</body>
</html>
`;
}
