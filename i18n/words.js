// A part of moood's pages (a folder of them: play/, scene/, an engine) in a language: its texts' translations lie beside
// its code (lang/<lang>.json — check lays them out), read once a page.
//   words(base, lang) → its translator (i18n.js: tr, tr.n, tr.c) — base: the part's folder (a URL: new URL('./',
//   import.meta.url) of a module in it); the source language and the pseudo-language need no file.
import './i18n.js';

const { MooodI18n } = globalThis;

export async function words(base, lang) {
  if (lang === MooodI18n.source || lang === MooodI18n.PSEUDO) return MooodI18n.translator(lang, [], String(base));
  const r = await fetch(new URL(`lang/${lang}.json`, base));
  if (!r.ok) throw new Error(`${base}: no ${lang} translation (${r.status})`);
  return MooodI18n.translator(lang, (await r.json()).strings || [], String(base));
}

// The engines' words (MooodI18n.part('engine1'), part('engine3') — each its folder's lang/: engines/1, engines/3) in the
// page's language, before they are asked for.
export async function speak(lang) {
  for (const n of [1, 3]) MooodI18n.said(`engine${n}`, await words(new URL(`../engines/${n}/`, import.meta.url), lang));
}

// The languages moood speaks ({code: {name — in itself, locale}}, the source language first: languages.json).
export const languages = async () => (await fetch(new URL('./languages.json', import.meta.url))).json();

// The language a page without one in its address is shown in, as this browser has it: the person's choice (the cookie
// a switch of language sets — their profile's, once they sign in; the pseudo-language too, set by hand), else what the
// browser asks for, else the source.
export function chosen(list) {
  const cookie = /(?:^|;\s*)lang=([^;]+)/.exec(document.cookie)?.[1];
  if (cookie in list || cookie === MooodI18n.PSEUDO) return cookie;
  for (const l of navigator.languages || []) if (l.toLowerCase().split('-')[0] in list) return l.toLowerCase().split('-')[0];
  return MooodI18n.source;
}
