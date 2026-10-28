// Lines said in the scene — whatever runs the game has someone say them: a line appears over the
// one who says it (following it as the viewer walks: stage.screenOf; the narrator's low in the
// middle), and is heard in its voice (the host's, docs/host.md: speak — made once, kept for good); words and voice come together.
// What the voice says is the line as written, its inline tags too (<sigh>, <short pause> — how it is said there); what is
// shown is the line without them (shown()).
// A host that makes no voices (it refuses with no-voices) is asked once: the page is told so once, the lines go on unheard.
// Lines are said one after another, one read at a time: as a line appears, the bubbles of the lines before it give way
// (fade out at once — a viewer reads the line said now), and bubbles never lie over each other. While a line is heard its bubble glimmers; a bubble keeps a ▶
// to hear it again, and the page is told (the "moood:speech" event: {id, text, on, duration — the voice's seconds, as it
// begins}) so it can light the line up elsewhere too, and know how long it will be heard. While someone is about to speak — the one who answers thinking, the
// voice being made — a "…" glimmers over them (thinking()). While an engine 3 scene stands (the play paused, nobody
// watching it: the stage's onPause — or its story waits for a cut: onStory) the voice heard waits and none begins: they go on with it. Over an engine 3 scene
// the bubbles are placed as the stage says a frame of it (onFrame), with the page's other layers — and looked at when
// one of them is to fade or go —, not every frame of the page. The line heard may be sped up (hurry(): the play page's ⏭).
const MooodSpeech = (() => {
  const tr = MooodI18n.part('engine1');  // (the engine's words, as the page said its language: words.js speak)
  let stage = null, canvas = null, layer = null, voiceless = null, speak = null, raf = 0, queue = Promise.resolve();
  let mute = false; // the host makes no voices
  // what of the page lies over the frame's edges (its bar over the scene — the page says which; none: a page with
  // nothing over the scene, a render) and the boxes they cover (CSS px; null: to be read)
  let over = [], edges = null;
  // who says it: an element ('dv'), over its point (e.at) or a point it names ('dv#mouth') — one
  // speaker, one bubble, wherever it is put
  const bubbles = new Map(); // element id → { el, text, until, pending, gone: giving way to a newer line, at: where it is put ('dv#mouth'), w, h: its size (CSS px; NaN: to be measured) }
  const waiting = new Map(); // element id → how many things it is about to say
  const speaker = ref => String(ref).split('#')[0];
  let current = null; // the voice being heard right now
  // the voice begun last: how it is let go ({ a, done, timer } — timer: if it never says it ended); whether an engine 3
  // scene stands now (the stage's onPause); when the bubbles over an engine 3 scene are next looked at (a timer)
  // (story: an engine 3 scene's story waits for a cut — the stage's onStory: the voices wait with it, 2.4)
  let guard = null, standing = false, story = false, due = 0;
  const three = () => stage.state.engine === 3;
  let said = 0;       // lines said before the player last spoke up: those not begun yet are dropped
  const NARRATOR = 'narrator';
  MooodVolume.on((kind, v) => { if (kind === 'voice' && current) current.volume = v; });

  function init(opts) {
    // voiceless(why): a line couldn't be voiced (why — in the page's language); speak({text, voice, how}, signal): a
    // promise of the line's voice (its recording's URL) — a refusal an Error in the page's language, its code with it;
    // over: the page's elements over the frame's edges
    ({ stage, canvas, voiceless, speak, over = [] } = opts);
    // (their boxes read again as one of them changes its size — a button shown, the bar wrapped — or the window does)
    const watch = new ResizeObserver(() => { edges = null; look(); });
    for (const el of over) watch.observe(el);
    layer = document.createElement('div');
    layer.id = 'speech';
    canvas.after(layer);
    stage.onPause(stands);
    stage.onStory?.(waits);
    // (an engine 3 scene's frame: the bubbles placed with the page's other layers — over a scene of another engine
    // the page's own frames place them, and one is always asked for while there are bubbles)
    stage.onFrame(() => { if (bubbles.size && !raf) place(); });
  }

  const told = (id, text, on, duration = null) => dispatchEvent(new CustomEvent('moood:speech', { detail: { id, text, on, duration } }));

  // a line's voice, loaded and ready to play (made by `speak` once — kept for good); null if it can't
  // be, or not in time — then the line is shown without it, and the lines after it aren't held up
  const MAKING = 45000, LOADING = 15000;
  async function voiced(text, voice, how) {
    if (mute) return null;
    try {
      const a = new Audio(await speak({ text, voice, how }, AbortSignal.timeout(MAKING)));
      await new Promise((ok, fail) => {
        const late = setTimeout(() => fail(new Error(tr('the voice took too long to load'))), LOADING);
        a.oncanplaythrough = () => { clearTimeout(late); ok(); };
        a.onerror = () => { clearTimeout(late); fail(new Error(tr('the voice would not load'))); };
        a.load();
      });
      return a;
    } catch (err) {
      (window.__mooodErrors = window.__mooodErrors || []).push(`speech: ${err.detail || err.message || err}`);
      globalThis.MooodSeen?.say('speech', { failed: String(err.detail || err.message || err).slice(0, 200) });
      if (err.code === 'no-voices') { if (mute) return null; mute = true; }
      // (the host's refusal and the page's own words are the page's language; a request that never reached it is not)
      voiceless?.(err.name === 'TimeoutError' ? tr('the voice was too late') : err instanceof TypeError ? tr('the voice could not be asked for') : err.message);
      return null;
    }
  }

  // plays a line's voice, the bubble glimmering; resolves when it has been heard. A voice the browser would not play
  // (no gesture on the site yet) is a line not heard: nothing is told of it (no "moood:speech"), the bubble stays as
  // for a line with no voice, and whoever waits for the line times it as it is read
  async function hear(ref, text, a, bubble) {
    const id = speaker(ref);
    current = a;
    a.volume = MooodVolume.get('voice');
    const g = { a, done: null, timer: 0, heard: false, id, text, bubble };
    // (an engine 3 scene standing: its voice begins as the scene goes on — stands; over a scene of another engine
    // nothing holds a voice)
    try { await new Promise(done => { a.onended = a.onerror = done; a.currentTime = 0; g.done = done; guard = g; if (!((standing || story) && three())) sound(g); }); }
    finally {
      clearTimeout(g.timer);
      if (current === a) current = null;
      if (g.heard) { bubble?.el.classList.remove('speaking'); told(id, text, false); }
    }
  }
  // a voice plays — from its beginning, or on from where it stood (an audio that never says it ended — a stalled
  // stream — is let go after its length: what is left of it). Begun, the line is heard: the bubble glimmers and the page is
  // told (once); refused by the browser, it is let go unheard
  function sound(g) {
    clearTimeout(g.timer);
    g.a.play().then(() => {
      if (g.heard) return;
      g.heard = true;
      g.bubble?.el.classList.add('speaking'); told(g.id, g.text, true, Number.isFinite(g.a.duration) ? g.a.duration : null);
    }, g.done);
    g.timer = setTimeout(g.done, ((g.a.duration || 30) - g.a.currentTime) * 1000 + 3000);
  }

  // the line being heard sped up (the page's ⏭: heard faster, not cut): smoothly to HURRIED times as fast, the voice at
  // its own pitch; → whether there was one to hurry (none heard now, or the one heard hurried already: false)
  const HURRIED = 2.5, HURRYING = 400; // ×; ms it takes to get there
  let hurried = null; // the voice sped up
  function hurry() {
    const a = current;
    if (!a || guard?.a !== a || !guard.heard || hurried === a) return false;
    hurried = a;
    a.preservesPitch = true;
    const t0 = performance.now();
    const ramp = () => {
      const u = Math.min(1, (performance.now() - t0) / HURRYING);
      a.playbackRate = 1 + (HURRIED - 1) * u;
      if (u < 1 && current === a) requestAnimationFrame(ramp);
    };
    ramp();
    return true;
  }

  // one line no longer to be said (the scene's director has let it go: replaced, cancelled): not said if it has not
  // begun; its voice stopped and its words gone if it is being said
  const lines = new WeakMap();
  function unsay(line) {
    const st = lines.get(line);
    if (!st) return;
    st.dropped = true;
    if (st.audio && current === st.audio) { current.pause(); current.onended(); }
    if (st.bubble) { st.bubble.until = performance.now(); look(); }
  }

  // hushed (the game goes on past its lines): the voice being heard stops (its words stay on screen), and what was
  // still to be said is dropped
  function hush() {
    said++;
    if (!current) return;
    current.pause();
    current.onended();
  }

  function bubbleFor(ref, text, voice, how, words = text) {
    const id = speaker(ref), old = bubbles.get(id);
    if (old) { old.el.remove(); bubbles.delete(id); } // (the new one the newest: placed first)
    const el = document.createElement('div');
    el.className = id === NARRATOR ? 'bubble narrator' : 'bubble';
    const p = document.createElement('p');
    p.textContent = text;
    el.append(p);
    if (voice) {
      const again = document.createElement('button');
      again.type = 'button'; again.textContent = '▶'; again.title = tr('again');
      again.onclick = () => replay(ref, words, voice, how);
      el.append(again);
    }
    layer.append(el);
    const b = { el, text, until: Infinity, pending: false, gone: false, at: ref, w: NaN, h: NaN };
    bubbles.set(id, b);
    if (!raf) raf = requestAnimationFrame(place);
    return b;
  }

  // A bubble stands over its speaker's point — its middle across, its bottom there — kept inside the window, a margin
  // from its sides and its top (a speaker at the frame's edge, or high in it: the bubble stays whole on the screen,
  // as near to them as it can), and off what the page has over the frame's edges (its bar: a bubble under it goes down
  // below it — init's over). Bubbles do not lie over each other: the newest line stands where it is put, an older
  // one that would cover it moves up over it — or, with no room above, down under it; a "…" gives way to the lines. Its size is read once, the first time it is placed (its text is set when it is made;
  // a new line is a new bubble) and again only when the window is resized — no layout is read each frame
  const MARGIN = 8, GAP = 6;
  addEventListener('resize', () => { for (const b of bubbles.values()) b.w = NaN; edges = null; });
  function place() {
    raf = 0;
    edges ??= over.map(el => el.getBoundingClientRect()).filter(r => r.width && r.height).map(r => ({ l: r.left, r: r.right, t: r.top, b: r.bottom }));
    const now = performance.now(), W = innerWidth, H = innerHeight, taken = [...edges]; // taken: the boxes placed ({l, r, t, b}), the page's over the edges first
    for (const [id, b] of [...bubbles].reverse().sort((x, y) => x[1].pending - y[1].pending)) {
      if (now > b.until) { b.el.remove(); bubbles.delete(id); if (waiting.has(id)) pend(waiting.get(id).at); continue; }
      const at = id === NARRATOR ? [W / 2, H * 0.86] : stage.screenOf(b.at, 0.25, true);
      b.el.style.visibility = at ? '' : 'hidden';
      if (at) {
        if (b.w !== b.w) { b.w = b.el.offsetWidth; b.h = b.el.offsetHeight; }
        const l = Math.round(Math.max(MARGIN, Math.min(W - MARGIN - b.w, at[0] - b.w / 2))), y = Math.max(MARGIN + b.h, Math.min(H - MARGIN, at[1]));
        const bottom = clear(b.gone ? edges : taken, l, l + b.w, y, b.h, H);
        if (!b.gone) taken.push({ l, r: l + b.w, t: bottom - b.h, b: bottom });
        b.el.style.transform = `translate(${l}px, ${Math.round(bottom - b.h)}px)`;
      }
      b.el.classList.toggle('fading', now > b.until - 1200);
    }
    if (!bubbles.size) return;
    if (!three()) { raf = requestAnimationFrame(place); return; }
    // an engine 3 scene: placed again as the stage says a frame (init) — a scene at rest says none, so they are
    // looked at too in the moment the next of them begins to fade, or goes
    clearTimeout(due);
    let next = Infinity;
    for (const b of bubbles.values()) for (const t of [b.until - 1200, b.until]) if (t >= now && t < next) next = t;
    if (next < Infinity) due = setTimeout(look, next - now + 1);
  }
  // where a bubble's bottom goes, l…r across and h high, wanted at y, so it covers none of the boxes taken (a bubble
  // giving way: none of the page's over the edges): up over
  // the ones in its way while it stays in the window, else down under them; neither — where it was wanted
  function clear(taken, l, r, y, h, H) {
    const hit = bottom => taken.find(o => o.l < r + GAP && l < o.r + GAP && o.t < bottom + GAP && bottom - h < o.b + GAP);
    for (const dir of [-1, 1]) {
      let bottom = y, o;
      while ((o = hit(bottom))) bottom = dir < 0 ? o.t - GAP : o.b + GAP + h;
      if (bottom - h >= MARGIN && bottom <= H - MARGIN) return bottom;
    }
    return y;
  }
  // a line appears (id: who says it): the bubbles of the lines before it give way — fade out now, quickly, and take no
  // room (a "…" over one about to speak stays: it is not a line)
  const GIVING = 300; // ms
  function giveWay(id) {
    const now = performance.now();
    for (const [k, b] of bubbles) if (k !== id && !b.pending && !b.gone) { b.gone = true; b.until = Math.min(b.until, now + GIVING); b.el.classList.add('giving'); }
  }
  // the bubbles looked at in the page's next frame — a new one put in its place, one whose time has changed (over a
  // scene of engine 1 that frame is asked for already, whenever there are bubbles)
  function look() { if (bubbles.size && !raf) raf = requestAnimationFrame(place); }

  // someone is about to speak (on) — or no longer (off): a glimmering "…" over them meanwhile
  function pend(ref) {
    const b = bubbleFor(ref, '…');
    b.pending = true;
    b.el.classList.add('pending');
  }
  function thinking(ref, on) {
    const id = speaker(ref), n = (waiting.get(id)?.n || 0) + (on ? 1 : -1);
    if (n > 0) waiting.set(id, { n, at: ref }); else waiting.delete(id);
    const b = bubbles.get(id);
    if (n > 0 && (!b || b.until !== Infinity)) pend(ref);
    if (n <= 0 && b?.pending) { b.el.remove(); bubbles.delete(id); }
  }

  // id: who says it (an element of the scene; 'id#name' — over a point it names); voice/how: heard
  // in that voice (its name), that way (the manner: "quietly, with a smile"); shown: what is
  // shown of it, if not the line itself (a thought, framed) — inline tags are never shown. A line with
  // a voice appears when it can be heard — its words and its voice together; its voice is made while
  // the lines before it are said.
  function say(id, words, { voice, how, shown: what } = {}) {
    words = String(words || '').trim();
    const text = shown(what ?? words);
    if (!text) return Promise.resolve();
    const ready = voice ? voiced(words, voice, how) : Promise.resolve(null);
    const turn = said, st = { dropped: false, audio: null, bubble: null };
    const line = queue.then(async () => {
      if (turn !== said || st.dropped) return;
      if (voice) thinking(id, true);
      const a = await ready;
      if (voice) thinking(id, false);
      if (st.dropped) return;
      const b = st.bubble = bubbleFor(id, text, voice, how, words);
      giveWay(speaker(id));
      const t0 = performance.now();
      st.audio = a;
      if (a) await hear(id, text, a, b);
      // a line stays a while to be read: longer for a longer line, at least after it was heard (not one let go)
      b.until = st.dropped ? performance.now() : Math.max(performance.now() + 2500, t0 + 1500 + text.length * 60);
      look();
    });
    lines.set(line, st);
    queue = line.catch(() => {});
    return line;
  }

  async function replay(id, words, voice, how) {
    const a = await voiced(words, voice, how);
    if (!a) return;
    const b = bubbles.get(speaker(id));
    if (b) { b.until = Infinity; b.gone = false; b.el.classList.remove('giving', 'fading'); }
    await hear(id, b?.text ?? shown(words), a, b);
    if (b) { b.until = performance.now() + 2500; look(); }
  }

  // a line as it is shown: without its inline tags (<sigh>), a space where each was
  function shown(line) {
    return String(line || '').replace(/[ \t]*<[^<>\n]*>[ \t]*/g, ' ').trim();
  }

  // whether lines are said here (init done: the page has a place for them)
  const active = () => !!layer;

  // the play paused: the voice heard now waits (its words stay), and goes on when it isn't (going on, it ends an
  // engine 3 scene's standing too — of one the stage left for another engine's while the play was paused: nobody else
  // says that it goes on)
  function pause(on) {
    if (!on) standing = false;
    if (!current) return;
    if (on) current.pause(); else current.play().catch(() => {});
  }
  // an engine 3 scene stands (the stage's onPause: the play paused, nobody watching it, a layer of the site over it):
  // the voice heard waits where it is, one that would begin waits to begin — and goes on, begins, as the scene does
  function stands(on) { const was = standing || story; standing = on; held(was); }
  // … its story waits for a cut that is not ready (the stage's onStory): the same, the voices alone
  function waits(on) { const was = standing || story; story = on; held(was); }
  function held(was) {
    const on = standing || story;
    if (on === was || guard?.a !== current) return;
    if (on) { current.pause(); clearTimeout(guard.timer); } else sound(guard);
  }

  return { init, say, unsay, replay, thinking, hush, hurry, active, pause, shown };
})();
