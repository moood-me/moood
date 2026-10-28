// A scene of a world, alive, at its own address (?world=<world>&scene=<folder> — none: the world's main one; ?lang=):
// the world and the scene the host's (host.js, docs/host.md), shown full-screen — its own film playing (its showcase),
// its music, its lines heard, its captions and widgets. What goes wrong is said in a corner. A host that tells of files
// saved (its world's changes) has the page shown anew as one of the world's is.
import { ask, asked, follow, lang, music, query, scene, tr, voice } from './host.js';
import { speak } from '../i18n/words.js';

const trouble = text => { const t = document.getElementById('trouble'); t.textContent = text; t.classList.add('on'); };
try {
  const world = asked.get('world');
  if (!world) throw new Error(tr('No world is asked for (?world=).'));
  follow({ world });
  const w = await ask('GET', `world?${query({ world, lang })}`);
  const folder = asked.get('scene') || w.scenes[0]?.folder;
  if (!folder) throw new Error(tr('The world has no scenes.'));
  const [s] = await Promise.all([scene(world, folder), speak(lang)]);
  document.documentElement.lang = lang;

  const canvas = document.getElementById('scene'), stage = Moood.mount(canvas), widgets = MooodWidgets.create({ canvas, stage });
  MooodShowcase.create({ stage });
  MooodSpeech.init({ stage, canvas, speak: voice, voiceless: why => trouble(tr('no voice: {why}', { why })) });
  MooodMusic.init({ ...music, silent: why => trouble(tr('no music: {why}', { why })) });
  // its words (its code's tr, what the page shows of it), its music, its state, it; then its widgets, once it is drawn
  const modules = { files: s.files, refs: s.modules, lang, strings: s.strings };
  const sceneTr = MooodI18n.translator(lang, s.strings, `the scene ${folder}`), seen = MooodI18n.shown(s.spec, sceneTr);
  document.title = [seen.title, w.title].filter(Boolean).join(' · ');
  MooodMusic.show(s.spec?.music);
  MooodState.start(s.spec, {}, { stage, modules });
  stage.show(s.spec, modules);
  stage.resetCamera();
  stage.showcase.start();
  MooodCaptions.show(seen.captions);
  await stage.seen();
  widgets.show(seen, sceneTr);
} catch (e) {
  trouble(tr('The scene could not be shown: {why}', { why: e.message || e }));
  throw e;
}
