// A span of seconds in a page's words — what moood's pages and its hosts' pages say of a quota and of waiting
// (the scene page's words: lang/<lang>.json). spans(lang) → span(seconds, exact): exactly (a quota's window — in the
// largest unit it is a whole number of), or about (how long until — in the largest unit it is two of, rounded up).
import { words } from '../i18n/words.js';

export async function spans(lang) {
  const tr = await words(new URL('./', import.meta.url), lang);
  return (s, exact) => {
    const fits = unit => (exact ? s % unit === 0 : s >= 2 * unit), n = unit => Math.ceil(s / unit);
    if (fits(86400)) return tr.n(n(86400), '{n} day', '{n} days');
    if (fits(3600)) return tr.n(n(3600), '{n} hour', '{n} hours');
    if (fits(60)) return tr.n(n(60), '{n} minute', '{n} minutes');
    return tr.n(s, '{n} second', '{n} seconds');
  };
}
