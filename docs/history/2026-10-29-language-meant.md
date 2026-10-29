# A person's language by what it means (2026-10-29)

**Why.** The pages (`i18n/words.js chosen`) and the local player (`player/home.js chosen`) took a browser's language as
its tag's first part — zh-TW became zh, none of moood's, so a browser in Traditional Chinese never got zh-hant — and
checked codes with `in` (a code like `constructor` passed). Pavel pointed at it as zh-hant came; the studio's site had
the same (fixed there).

**What.** `MooodI18n.meant(codes, tag)` (`i18n/i18n.js`): the one of moood's languages a tag means by its language and
script — `Intl.Locale(tag).maximize()`: zh-TW, zh-HK are zh-Hant (zh-hant), pt-PT and pt-BR are pt, zh-CN is zh-Hans
(none: the next tag is asked). Both `chosen` use it and `Object.hasOwn`. `test/language-meant.test.js`.
