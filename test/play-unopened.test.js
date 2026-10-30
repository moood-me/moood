// The play page's bar is there from the start and stays when the play cannot be opened (play/play.js): ← back (the
// host's page the page was opened with, docs/host.md), ↺; what kept it from being opened said in the middle with what
// can be done — and a play the host cannot open in the page's language, its game at a newer version (changes: newer),
// is offered to move there (continue). The page in node, on stand-ins of the DOM, the host and EventSource.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ORIGIN = 'https://site.test';
// an element as play.js uses one
class El {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.hidden = false; this.classList = new Set(); }
  append(...n) { this.children.push(...n); }
  prepend(...n) { this.children.unshift(...n); }
  replaceChildren(...n) { this.children = n; }
  get lastChild() { return this.children.at(-1); }
  // (what the calm bar uses, play/bar.js: its presses, its holds, its slides and fades — laid out nowhere, seen at once)
  addEventListener() {}
  contains(n) { return all(this).includes(n); }
  setAttribute(k, v) { this[`@${k}`] = String(v); }
  getAttribute(k) { return this[`@${k}`] ?? null; }
  removeAttribute(k) { delete this[`@${k}`]; }
  get offsetLeft() { return 0; }
  animate() { return { cancel() {}, finished: Promise.resolve() }; }
}
const all = el => [el, ...el.children.flatMap(c => (c instanceof El ? all(c) : []))];
const text = el => all(el).map(e => e.textContent ?? '').join(' ');

// the page opened (play.js run anew), the host answering as answers says: → what it asked, the stream it follows
async function opened(answers, run) {
  const asked = [], streams = [], trouble = new El('div');
  const page = { reloaded: 0 };
  Object.assign(globalThis, {
    document: {
      cookie: '', title: '', body: new El('body'), documentElement: new El('html'),
      querySelector: s => ({ 'meta[name="moood-host"]': { content: '/api/' },
        'meta[name="moood-page"]': { content: 'game=lamp&lang=uk&back=/uk/games/lamp' } })[s] ?? null,
      getElementById: id => (id === 'trouble' ? trouble : null),
      createElement: tag => new El(tag),
    },
    location: { href: `${ORIGIN}/uk/play/lamp`, origin: ORIGIN, search: '', reload: () => page.reloaded++ },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    getComputedStyle: () => ({ transform: 'none', opacity: '1' }),
    confirm: () => true,
    EventSource: class { constructor(url) { this.url = url; this.on = {}; streams.push(this); } addEventListener(t, fn) { this.on[t] = fn; } close() { this.closed = true; } },
    fetch: async (url, o = {}) => {
      const u = new URL(url);
      if (u.protocol === 'file:') return new Response(await readFile(u));
      const key = `${o.method ?? 'GET'} ${u.pathname.slice('/api/'.length)}`;
      asked.push(key);
      const a = answers[key];
      if (!a) throw new TypeError('Failed to fetch');
      return a.status === 204 ? new Response(null, { status: 204 }) : Response.json(a.body, { status: a.status ?? 200 });
    },
  });
  globalThis.window = globalThis;
  const failed = await import(`../play/play.js?${run}`).then(() => null, e => e);
  const bar = document.body.children.find(e => e.className === 'bar'), unopened = document.body.children.find(e => e.id === 'unopened');
  return { asked, streams, page, failed, bar, unopened };
}

test('GET play refused: the bar stays — back, ↺ —, and the move to the new version offered in place of the refusal', async () => {
  const p = await opened({ 'POST play': { body: { id: 'p1' } }, 'GET play': { status: 404, body: { code: 'language', values: { lang: 'uk' } } },
    'POST continue': { status: 204 } }, 1);
  assert.equal(p.failed?.code, 'language');
  const [back, again, onward] = p.bar.children;
  assert.deepEqual([back.tagName, back.href, back.hidden], ['A', `${ORIGIN}/uk/games/lamp`, false], 'back to the host\'s page of the game');
  assert.deepEqual([again.id, again.hidden, onward.hidden], ['restart', false, true]);
  assert.equal(p.unopened.hidden, false);
  assert.match(text(p.unopened), /Партію не вдалося відкрити/);
  // (the host tells of a newer version: the move offered instead, the stream let go)
  const [stream] = p.streams;
  assert.equal(stream.url, `${ORIGIN}/api/changes?game=lamp`);
  stream.on.newer();
  assert.equal(stream.closed, true);
  assert.equal(onward.hidden, false);
  assert.match(text(p.unopened), /попередній версії гри/);
  const acts = p.unopened.lastChild.children;
  assert.deepEqual(acts.map(a => a.textContent), ['Продовжити на новій версії', 'Почати заново', 'До гри']);
  await acts[0].onclick();
  assert.deepEqual(p.asked, ['POST play', 'GET play', 'POST continue']);
  assert.equal(p.page.reloaded, 1, 'shown anew, on the new version');
});

test('the host not reached: the bar there all the same — back from the page\'s query, ↺ opens the page anew', async () => {
  const p = await opened({}, 2);
  assert.ok(p.failed);
  const [back, again] = p.bar.children;
  assert.deepEqual([back.href, back.hidden, again.hidden], [`${ORIGIN}/uk/games/lamp`, false, false]);
  assert.match(text(p.unopened), /Партію не вдалося відкрити/);
  assert.deepEqual(p.unopened.lastChild.children.map(a => a.textContent), ['Почати заново', 'До гри']);
  again.onclick();
  await new Promise(r => setImmediate(r));
  assert.equal(p.page.reloaded, 1);
});
