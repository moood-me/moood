// The plays, kept outside the author's folder — in the data folder (MOOOD_DATA), a file each: {id, folder — the
// author's folder it was begun in, game — the game's name there, save — what the game keeps of it}. One play a game
// of a folder: "my play" of it; begun anew, the old one is gone.
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function plays(data) {
  const dir = join(data, 'plays');
  mkdirSync(dir, { recursive: true });
  const file = id => join(dir, `${id}.json`);
  const write = p => { writeFileSync(`${file(p.id)}.new`, JSON.stringify(p)); renameSync(`${file(p.id)}.new`, file(p.id)); };
  const get = id => (ID.test(id ?? '') && existsSync(file(id)) ? JSON.parse(readFileSync(file(id), 'utf8')) : null);
  return {
    get,
    // my play of the game, if there is one
    mine: (folder, game) => readdirSync(dir).filter(f => f.endsWith('.json')).map(f => get(f.slice(0, -5)))
      .find(p => p?.folder === folder && p.game === game) ?? null,
    begin(folder, game) {
      const p = { id: randomUUID(), folder, game, save: {} };
      write(p);
      return p;
    },
    keep: (p, save) => write({ ...p, save }),
    end: p => rmSync(file(p.id), { force: true }),
  };
}
