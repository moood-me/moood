// A person's language tag to one of moood's languages by what it means (i18n.js meant; the player's chosen).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../i18n/i18n.js';
import { chosen } from '../player/home.js';

const { meant } = globalThis.MooodI18n;
const ours = ['en', 'ru', 'uk', 'de', 'es', 'ja', 'be', 'fr', 'zh-hant', 'pt', 'pl', 'ko'];

test('a tag means one of ours by its language and script', () => {
  assert.equal(meant(ours, 'zh-TW'), 'zh-hant');
  assert.equal(meant(ours, 'zh-Hant-HK'), 'zh-hant');
  assert.equal(meant(ours, 'zh-CN'), null);
  assert.equal(meant(ours, 'pt-PT'), 'pt');
  assert.equal(meant(ours, 'en-GB'), 'en');
  assert.equal(meant(ours, 'not a tag'), null);
});

test('the player: the first of what the browser asks for that moood speaks', () => {
  assert.equal(chosen(null, '', 'zh-CN,zh-TW;q=0.8,en;q=0.5'), 'zh-hant');
  assert.equal(chosen('toString', 'lang=constructor', ''), 'en');
});
