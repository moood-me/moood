// A game's line with words spoken instead of it (say(who, text, {spoken})): the line is shown, translated as any line;
// its voice says the spoken words as written, the same in every language — check finds them, lists them as heard,
// and says what is wrong with them.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { check } from '../packages/check/index.js';
import { fromCode } from '../packages/check/extract.js';
import { lines } from '../packages/check/lines.js';
import { folder } from '../packages/check/repository.js';
import '../i18n/i18n.js';

const FIXTURE = fileURLToPath(new URL('./fixture/', import.meta.url)), made = [];
after(() => { for (const d of made) rmSync(d, { recursive: true, force: true }); });
const game = code => fromCode(code, 'game.js', true, true);
const codes = r => r.problems.map(p => p.code);

test('a line said with spoken words: found with them, and its manner', () => {
  const { entries, problems } = game(`b.say('mom', 'Hold it. Quiet.', { spoken: '拿着。<short pause> 别出声。', how: 'softly' });`);
  assert.deepEqual(problems, []);
  assert.deepEqual(entries.map(({ who, text, said, how, spoken }) => ({ who, text, said, how, spoken })),
    [{ who: 'mom', text: 'Hold it. Quiet.', said: 'say', how: 'softly', spoken: '拿着。<short pause> 别出声。' }]);
});

test('a kept line keeps its spoken words; a thought may have them too', () => {
  const { entries, problems } = game(`const a = tr.line('mom', 'Tiger.', { spoken: '老虎。' }); b.think('mom', 'Tiger…', { spoken: '老虎……' });`);
  assert.deepEqual(problems, []);
  assert.deepEqual(entries.map(e => [e.said, e.text, e.spoken]), [['say', 'Tiger.', '老虎。'], ['think', 'Tiger…', '老虎……']]);
  assert.deepEqual(globalThis.MooodI18n.translator('en').line('mom', 'Tiger.', { spoken: '老虎。' }), { text: 'Tiger.', how: '', spoken: '老虎。' });
  assert.deepEqual(globalThis.MooodI18n.translator('en').line('mom', 'Tiger.'), { text: 'Tiger.', how: '', spoken: null });
});

test('spoken words not a literal; a kept line given them where it is said', () => {
  assert.deepEqual(codes(game(`b.say('mom', 'Hold it.', { spoken: words });`)), ['spoken-not-literal']);
  assert.deepEqual(codes(game(`b.say('mom', kept, { spoken: '拿着。' });`)), ['line-kept-how']);
});

test("a scene's line takes no spoken words: only a game's", () => {
  const { entries } = fromCode(`say('mom', 'Hold it.', { voice: 'Kore', spoken: '拿着。' });`, 'script.js', true, false);
  assert.equal(entries[0].spoken, undefined);
});

test('heard: the spoken words in every language, the line translated; the same line with other words — two voices', async () => {
  const d = mkdtempSync(join(tmpdir(), 'moood-')); made.push(d);
  cpSync(FIXTURE, d, { recursive: true });
  const b = join(d, 'evening/bespoke');
  writeFileSync(join(b, 'people.json'), JSON.stringify({ mom: { voice: 'Kore', how: 'warm' } }));
  writeFileSync(join(b, 'game.js'), `export default async function (b) {
  await b.say('mom', 'Tiger.', { spoken: '老虎。' });
  await b.say('mom', 'Tiger.', { spoken: '老虎！', how: 'delighted' });
  await b.say('mom', 'Tiger.');
}
`);
  const ru = join(b, 'lang/ru/strings.json');
  await check(folder(d), { write: true });
  const before = await check(folder(d));
  assert.deepEqual(before.problems.map(p => [p.code, p.values.text]), [['untranslated', 'Tiger.']]);
  writeFileSync(ru, JSON.stringify({ strings: [
    { text: 'An evening', translation: 'Вечер' }, { text: 'An evening by the lamp.', translation: 'Вечер у лампы.' },
    { text: 'Tiger.', who: 'mom', translation: 'Тигр.' },
  ] }));
  const report = await check(folder(d));
  assert.deepEqual(report.problems, []);
  const heard = (await lines(folder(d), report)).filter(l => l.scope.startsWith('evening')).map(l => [l.lang, l.text, l.how]).sort();
  assert.deepEqual(heard, [
    ['en', 'Tiger.', 'warm'], ['en', '老虎。', 'warm'], ['en', '老虎！', 'warm; delighted'],
    ['ru', 'Тигр.', 'warm'], ['ru', '老虎。', 'warm'], ['ru', '老虎！', 'warm; delighted'],
  ]);
});
