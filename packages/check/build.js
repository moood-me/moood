// What moood's runtime and engines read, into the package — the same languages, the same keys, the same voices:
// i18n/ (i18n.js, languages.json); how a game's line is heard (play/voices.js) and the play's own words a thought is
// shown in (play/lang/) as play/; what a scene's music asks a host for (engines/1/music.js).
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const from = p => fileURLToPath(new URL(`../../${p}`, import.meta.url)), to = p => fileURLToPath(new URL(`./${p}`, import.meta.url));
for (const d of ['i18n', 'play', 'engines']) rmSync(to(d), { recursive: true, force: true });
cpSync(from('i18n/'), to('i18n/'), { recursive: true });
mkdirSync(to('play'));
cpSync(from('play/voices.js'), to('play/voices.js'));
cpSync(from('play/lang/'), to('play/lang/'), { recursive: true });
mkdirSync(to('engines/1'), { recursive: true });
cpSync(from('engines/1/music.js'), to('engines/1/music.js'));
console.log('i18n, play and the music copied');
