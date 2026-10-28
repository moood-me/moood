# moood — документы для авторов миров и игр

С чего начать: [worlds/principles.md](worlds/principles.md) — что важно и чего не делать никогда; потом
[worlds/README.md](worlds/README.md) — как устроен мир и как в нём работать; потом язык сцены движка 3 —
[worlds/scene-format-3.md](worlds/scene-format-3.md). Игра — с [games/README.md](games/README.md) и
[games/games.md](games/games.md); её сценарий — с [writing/README.md](writing/README.md).

Агент работает через MCP студии moood — `studio.<хост>/mcp` (Streamable HTTP; подключается по OAuth — человек
разрешает его на странице студии: claude.ai — «Add custom connector» с этим адресом; Claude Code — `claude mcp add
--transport http moood https://studio.<хост>/mcp`, потом `/mcp` → Authenticate; или с токеном, который человек делает
у себя в профиле студии, «Агенты» → «Токены»: `--header "Authorization: Bearer <токен>"`): читает репозитории, миры и
игры, рисует и замеряет сцены, проверяет, делает движения и голоса — от имени человека, с его правами и квотами;
`guide` отдаёт эти документы.

## worlds/ — миры и сцены

- [README.md](worlds/README.md) — мир и его репозиторий, модули, как работать, тексты и языки, как смотреть на работу, движки.
- [principles.md](worlds/principles.md) — принципы: что важно, как работать, какой должна быть сцена и игра, ловушки.
- [scene-format-3.md](worlds/scene-format-3.md) — язык сцены движка 3 (каждая новая сцена).
- [scene-format-1.md](worlds/scene-format-1.md) — язык старого движка (сцена без `"engine"`).
- [people.md](worlds/people.md) — люди в сцене и каст мира; картинки — в `people/`.
- [motion.md](worlds/motion.md) — движения людей, сделанные моделью, и как человек может выглядеть.
- [2026-10-14-kak-delat-stseny.md](worlds/2026-10-14-kak-delat-stseny.md) — уроки: как делать сцену (движок 3).
- [2026-10-05-khrizalidy-films.md](worlds/2026-10-05-khrizalidy-films.md) — уроки сцен-фильмов «Хризалид» (старый движок).

## games/ — bespoke-игры

- [README.md](games/README.md) — репозиторий игры и инструменты, звуки, пауза, ⏭ и ☰.
- [games.md](games/games.md) — как строится игра: главы и шаги, карта партии, сохранение, переигровки, ⏭, автор, затемнения.
- [minigames.md](games/minigames.md) — мини-игры: механика из сюжета, фраза плашки, API.
- [miniux/language.md](games/miniux/language.md) — язык мини-игр: метки, жесты, отклики, плашка, звуки, стиль.
- [miniux/wishes.md](games/miniux/wishes.md) — жалобы и пожелания, из которых вырос язык (номера П, М, Н).
- [miniux/playground.md](games/miniux/playground.md) — площадка `miniux`: каждый жест и часть рамки по отдельности.
- [2026-10-05-khrizalidy-bespoke.md](games/2026-10-05-khrizalidy-bespoke.md) — уроки bespoke-игры «Хризалиды».
- [2026-10-05-khrizalidy-kino-game.md](games/2026-10-05-khrizalidy-kino-game.md) — уроки игры по сценам-фильмам «Хризалиды — кино».
- [padenie-doma-asherov.md](games/padenie-doma-asherov.md) — уроки «Падения дома Ашеров».
- [2026-10-16-stati-kak-delalos.md](games/2026-10-16-stati-kak-delalos.md) — как писать статью «Как делалось» об игре или мире.

## writing/ — сценарий игры

- [README.md](writing/README.md) — обзор документов о сценарии.
- [game-stages.md](writing/game-stages.md) — стадии написания игры.
- [drama-principles.md](writing/drama-principles.md) — принципы драмы.
- [grey-choices.md](writing/grey-choices.md) — серые выборы, порыв и характер, библия персонажа, реестры ветки.
- [scenario-reviews.md](writing/scenario-reviews.md) — ревью сценария: группы А, Б, В, Г.
- [stage1-protocol.md](writing/stage1-protocol.md) — как крутится ревью стадии 1: круги, задания автору и ревьюерам.
- [2026-10-13-scenarij-igry.md](writing/2026-10-13-scenarij-igry.md) — исходные правила сценария (история, частью устарело).

## Остальное

- [host.md](host.md) — что страницы сцены и партии ждут от того, кто их показывает (плеер, студия, сайт).
- [../player/README.md](../player/README.md) — локальный плеер: миры и игры из папки на диске (docker или node).
- [engine3/](engine3/README.md) — документы разработки движка 3: устройство, стыки, план (тому, кто меняет движок).
- [history/](history/) — что сделано в этом репозитории и как.
