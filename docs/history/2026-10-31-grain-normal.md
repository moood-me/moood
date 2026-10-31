# 2026-10-31 — движок 3: зерно в обычном наложении (`light.grainBlend`)

Ветка `engine3-grain-normal` от `main`. Повод: титул «Hope» (`moood-me/works-009-hope`, сцена `title`) переносит
холст Павла (`playground/hope/web/hope-design/Hope.dc.html`, `frame()`): там поверх всего кадра лежит плитка серого
шума 0…255 с альфой 22/255 в обычном наложении — она поднимает чёрное на ~11/255 (углы ~(18,20,23)). Зерно движка было
только overlay (`mix(c, overlay(c, n), 0.1·grain)`) и в тёмном пропадало. Павел хочет свет и эффекты как в дизайне.

Сделано: слово света `grainBlend`: `"overlay"` (по умолчанию — как было) или `"normal"` — сам шум поверх картинки с
непрозрачностью 0.1·grain (grain 0.86 ≈ 22/255 дизайна). Слово только у света, не у его looks: слово не смешивается;
`grain` looks по-прежнему смешивают. Иное слово — предупреждение, остаётся overlay.

Как: `spec.js` (`WORDS.light`), `light.js createLook` (`look.grainBlend`), `render/post.js` пишет 0/1 в
`CANVAS.GRAIN_NORMAL` (униформа canvas выросла со 128 до 144 байт), в шейдере canvas —
`mix(c, mix(ov, vec3f(n), grainNormal), grain)`: одно смешивание лишнее на пиксель, без ветвления. Документы:
`scene-format-3.md`, `contracts.md`, `architecture.md`.

Проверено: `test/grain-blend.test.js` (по умолчанию overlay; normal; чужое слово; look не трогает слово; в look слово
не берётся), `test/gpu/check.mjs`.
