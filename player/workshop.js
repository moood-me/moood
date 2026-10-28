// moood's workshop as the local player takes from it (docs/host.md: The workshop): where a deployment of moood makes
// voices and music and keeps them by key. MOOOD_WORKSHOP — its studio's address; MOOOD_TOKEN — a person's token made on
// their profile there. Without the token only what is made already is taken (what is not: refused unmade); with it, what
// is not made yet is made under that person's quota there.
import { Refusal } from './folder.js';

// url: the workshop's studio (its origin); token: a person's there, or null
export function workshop(url, token) {
  // (the token goes only with what makes: speech.speak, music.track — what is read by key needs none)
  const auth = token ? { authorization: `Bearer ${token}` } : {};
  // an operation of the workshop's (POST /workshop/<name> {args}) → its answer; its refusal — as it said it
  async function op(name, args) {
    let r;
    try {
      r = await fetch(`${url}/workshop/${name}`, { method: 'POST', headers: { 'content-type': 'application/json', ...auth }, body: JSON.stringify({ args }) });
    } catch (e) {
      throw new Refusal(502, 'failed', {}, `the workshop at ${url} did not answer: ${e.message}`);
    }
    const o = await r.json().catch(() => null);
    if (r.ok) return o;
    if (r.status === 401) throw new Refusal(502, 'failed', {}, `the workshop at ${url} does not take MOOOD_TOKEN: made on your profile there, revoked or ended`);
    throw new Refusal(r.status, o?.code ?? 'failed', o?.values ?? {}, o?.detail ?? `the workshop at ${url} answered ${r.status}`);
  }
  const unmade = what => new Refusal(404, 'unmade', {}, `${what} is not made yet — the workshop at ${url} makes it with a person's token (MOOOD_TOKEN)`);

  return {
    url,
    // a line's voice (docs/host.md: speak — {text, voice, how}) → its key
    async speak(asked) {
      if (token) return (await op('speech.speak', asked)).key;
      const k = await op('speech.key', asked);
      if (!k.kept) throw unmade('This voice');
      return k.key;
    },
    // a scene's music (docs/host.md: music — {prompts, config}) → its track's key: recorded, or being recorded
    async track(music) {
      if (token) return (await op('music.track', { music })).key;
      const k = await op('music.key', { music });
      if (!k.whole && !k.making) throw unmade('This music');
      return k.key;
    },
    // what a key names (speech/<key>, music/<key> — its recording's stream), read (init: {signal, headers — a range})
    // → the workshop's answer (a Response); by key, by anyone: no token
    read: (path, init = {}) => fetch(`${url}/workshop/${path}`, init),
  };
}
