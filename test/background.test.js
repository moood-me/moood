// A game's background (play/background.js, as play/runtime.js uses it): declared while a show is under way, it sounds
// at that show's cut — where the music crossfades — over the music's crossfade; declared with none under way, at once;
// the first one comes in as a music does where none sounded; the same one again changes nothing; a show that ends
// without its cut sounds it then; a later show's declaration waits for the later cut.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBackground } from '../play/background.js';

const FADE = 4, IN = 0.3; // (music.js's)
function made() {
  const heard = [], troubles = [];
  const bg = createBackground({ fades: was => (was ? FADE : IN), trouble: e => troubles.push(e) });
  bg.on((levels, seconds) => heard.push([levels, seconds]));
  return { bg, heard, troubles };
}

test('a show\'s background sounds at its cut, with the music\'s timing — none before it', () => {
  const { bg, heard } = made();
  bg.awaits(1, { sea: 0.4, wind: 0.2 }); // (the play's first show: asked)
  assert.deepEqual(heard, []);
  bg.cut(1);                               // (its cut: the music comes in where none sounded)
  assert.deepEqual(heard, [[{ sea: 0.4, wind: 0.2 }, IN]]);
  bg.awaits(2, { clock: 0.3 });            // (the next scene asked: the sea still heard while it is made)
  bg.declare({ clock: 0.5 });              // (said meanwhile: it too waits for the cut)
  assert.equal(heard.length, 1);
  bg.cut(2);
  assert.deepEqual(heard[1], [{ clock: 0.5 }, FADE]); // (one crossfade: the sea out, the clock in)
});

test('declared with no show under way: at once; the same again — nothing; zeros are silence', () => {
  const { bg, heard } = made();
  bg.declare({ rain: 0.6 });
  bg.declare({ rain: 0.6, house: 0 });
  bg.declare({ rain: 0.2 });
  bg.declare({});
  assert.deepEqual(heard, [[{ rain: 0.6 }, IN], [{ rain: 0.2 }, FADE], [{}, FADE]]);
});

test('a show without a background of its own keeps the one declared; a show replaced waits for the later cut', () => {
  const { bg, heard } = made();
  bg.declare({ sea: 0.5 });
  bg.awaits(1);
  bg.cut(1);
  assert.equal(heard.length, 1); // (the same background: the sea goes on as it was)
  bg.awaits(2, { town: 0.4 });
  bg.awaits(3, { storm: 0.9 }); // (another show asked before the first one's cut)
  bg.cut(2);                    // (the older one ending: not the cut the background waits for)
  assert.equal(heard.length, 1);
  bg.cut(3);
  assert.deepEqual(heard[1], [{ storm: 0.9 }, FADE]);
});

test('a background that is not {bed: level} is refused', () => {
  const { bg } = made();
  assert.throws(() => bg.declare(['sea']));
  assert.throws(() => bg.declare(null));
});
