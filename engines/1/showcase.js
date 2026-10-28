// A scene's own scenario played as a film (engine 3's showcase — outside games: the scene's page):
// a quiet bar low in the middle, as a video's — play / pause, how far it has gone and how long it is (estimated, said
// so, till the lengths of its parts are known: a line's voice once heard), and a jump to any moment by a click or a
// drag (the scene sought: stage.showcase.seek — it goes there from the beat before, unseen). Hidden while the scene has
// no showcase (its info: null). Space on the bar, focused, plays or pauses it.
//   An engine 3 scene: the bar follows what the stage says with its frames (stage.onFrame), not every frame of the page.
// Its length is an estimate till the film has been played through once (≈): while the film plays on the bar does not go
// back as the estimate grows; and at the film's first instant there is no length yet — no total and no knob till there is.
//   MooodShowcase.create({ stage, within }) — the bar, following what the stage's frames say of the showcase; low in the
// middle of the page, or of `within` (an element: a scene of two on one page).
const MooodShowcase = (() => {
  const tr = MooodI18n.part('engine1');  // (the engine's words, as the page said its language: words.js speak)
  const time = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  function create({ stage, within = null }) {
    const bar = document.createElement('div');
    bar.className = 'showcase';
    bar.hidden = true;
    bar.tabIndex = 0;
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', tr('the scene’s showing'));
    const play = document.createElement('button');
    play.type = 'button'; play.className = 'play';
    const track = document.createElement('div');
    track.className = 'track';
    track.setAttribute('role', 'slider');
    track.setAttribute('aria-label', tr('where the showing is'));
    const fill = document.createElement('div'), knob = document.createElement('div');
    fill.className = 'fill'; knob.className = 'knob';
    track.append(fill, knob);
    const clock = document.createElement('span');
    clock.className = 'time';
    bar.append(play, track, clock);
    if (within) bar.classList.add('within');
    (within || document.body).append(bar);

    // where the bar is dragged to (seconds; null: not dragged), a seek on its way (the bar holds it meanwhile)
    let dragged = null, seeking = null, info = null;
    const three = () => stage.state.engine === 3;
    // (an engine 3 scene: how far the bar stood, and at what time of the film)
    const stood = { u: 0, at: 0 };
    const toggle = () => { if (!info) return; (info.playing && !info.ended ? stage.showcase.pause() : stage.showcase.play()); };
    play.onclick = e => { e.stopPropagation(); toggle(); };
    // (space plays or pauses it — not the scene's: the page's keys stay with the bar while it is focused)
    bar.addEventListener('keydown', e => {
      if (e.key !== ' ' && e.code !== 'Space') return;
      e.preventDefault(); e.stopPropagation();
      toggle();
    });
    const at = e => { const r = track.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(1, r.width))) * (info?.length ?? 0); };
    track.addEventListener('pointerdown', e => {
      if (!info?.length) return;
      e.stopPropagation();
      track.setPointerCapture(e.pointerId);
      dragged = at(e);
      draw();
    });
    track.addEventListener('pointermove', e => { if (dragged != null) { dragged = at(e); draw(); } });
    const drop = e => {
      if (dragged == null) return;
      const to = e.type === 'pointerup' ? at(e) : null;
      dragged = null;
      if (to == null) return;
      seeking = to;
      stage.showcase.seek(to).finally(() => { seeking = null; if (three()) look(); });
    };
    track.addEventListener('pointerup', drop);
    track.addEventListener('pointercancel', drop);
    // (the scene's own gestures are on the scene, not here)
    for (const t of ['pointerdown', 'wheel']) bar.addEventListener(t, e => e.stopPropagation());

    function draw() {
      const known = info.known, length = info.length, now = dragged ?? seeking ?? info.at;
      let u = length > 0 ? Math.min(1, now / length) : 0;
      if (three()) {
        if (!known && dragged == null && seeking == null && now >= stood.at) u = Math.max(u, stood.u);
        stood.u = u; stood.at = now;
      }
      const sized = !three() || length > 0;
      bar.classList.toggle('unsized', !sized);
      fill.style.width = `${u * 100}%`;
      knob.style.left = `${u * 100}%`;
      // (estimated till its lengths are known: said so)
      clock.textContent = !sized ? time(now) : `${time(now)} / ${length == null ? '…' : `${known ? '' : '≈'}${time(length)}`}`;
      clock.title = known ? '' : tr('the length is an estimate: it becomes exact once its parts (the voices) are known');
      const playing = info.playing && !info.ended;
      play.textContent = playing ? '❚❚' : '▶';
      play.title = playing ? tr('pause (space)') : info.ended ? tr('from the start') : tr('go on (space)');
      track.setAttribute('aria-valuenow', String(Math.round(now)));
      track.setAttribute('aria-valuemax', String(Math.round(length ?? 0)));
    }
    // (drawn as it changes: its time, its length, playing — or a drag, a seek)
    const was = { at: NaN, length: NaN, known: null, playing: null, ended: null };
    function look() {
      info = stage.showcase.info;
      if (bar.hidden !== !info) bar.hidden = !info;
      if (!info) return;
      const at = dragged ?? seeking ?? info.at;
      if (at === was.at && info.length === was.length && info.known === was.known && info.playing === was.playing && info.ended === was.ended) return;
      was.at = at; was.length = info.length; was.known = info.known; was.playing = info.playing; was.ended = info.ended;
      draw();
    }
    // (looked at every frame of the page — but for an engine 3 scene: once more as the stage goes to it, then as the
    // stage says a frame of it changed; the loop begins again with a scene of another engine)
    let following = false;
    function follow() {
      following = !three();
      if (following) requestAnimationFrame(follow);
      look();
    }
    follow();
    stage.onFrame(() => { if (three()) look(); else if (!following) follow(); });
    return { bar };
  }
  return { create };
})();
