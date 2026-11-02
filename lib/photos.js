// Download-once photo cache with JPEG/PNG size reading (no image library needed).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { dataDir } from './store.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

export function imageSize(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

export async function cachePhoto(url, fetchFn = fetch) {
  const dir = path.join(dataDir(), 'cache', 'photos');
  const file = path.join(dir, crypto.createHash('sha1').update(url).digest('hex') + (/\.png(\?|$)/i.test(url) ? '.png' : '.jpg'));
  if (!fs.existsSync(file)) {
    const res = await fetchFn(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(40000) });
    if (!res.ok) throw new Error(`Photo download failed: HTTP ${res.status} (${url})`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!imageSize(buf)) throw new Error(`Not an image: ${url}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, buf);
  }
  const size = imageSize(fs.readFileSync(file)) || { w: 0, h: 0 };
  return { file, ...size };
}
