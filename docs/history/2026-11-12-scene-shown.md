# A scene page in a frame says when the scene is drawn (2026-11-12)

**Why.** The studio's viewer (moood-me/studio, docs/history/2026-11-12-scene-viewer.md) grows a scene's picture to nearly
the whole window and plays the scene page in a frame inside it: the picture stays over the frame until the scene has
drawn itself, then gives way — as the old studio's viewer did with its frame page (`moood:shown`). Pavel asked for it.

**How.** `scene/scene.js`: once the stage has drawn the scene (`stage.seen()`), a page in another page's frame posts
`{moood: 'shown'}` to its parent, to the same origin — beside `{moood: 'waits'}` (stage.js, engines/3/page.js).
`docs/host.md` «In a frame» says it.
