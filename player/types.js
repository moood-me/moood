// What a file a host serves is, by its name's ending — moood's pages, a game's files (its code, data, pictures, sounds):
// the local player's and any host's (moood's studio) the same; another — bytes.
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.md': 'text/markdown', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };

export function typeOf(name) {
  const t = TYPES[/\.[^./]+$/.exec(name)?.[0].toLowerCase()] ?? 'application/octet-stream';
  return /^text\/|json$/.test(t) ? `${t}; charset=utf-8` : t;
}
