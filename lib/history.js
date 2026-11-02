// What has already been posted (or is queued): seed history from before the engine plus every non-rejected post.
import fs from 'node:fs';
import path from 'node:path';
import { dataDir, readJson, listPosts } from './store.js';

import { configPath } from './config.js';

// First run: copy the hand-made posts of 1 Nov 2026 into data/history.json so their categories and cars are not repeated.
export function ensureSeed() {
  const f = path.join(dataDir(), 'history.json');
  if (!fs.existsSync(f)) { fs.mkdirSync(dataDir(), { recursive: true }); fs.copyFileSync(configPath('seed-history.json'), f); return; }
  // Histories seeded before hand-made entries carried their folder: fill it in so their pictures show on Feeds.
  const seed = readJson(configPath('seed-history.json'), []), h = readJson(f, []);
  let changed = false;
  for (const e of h) {
    const s = !e.folder && !e.postId && seed.find((x) => x.market === e.market && x.date === e.date && x.params?.category === e.params?.category);
    if (s?.folder) { e.folder = s.folder; e.note = s.note; changed = true; }
  }
  if (changed) fs.writeFileSync(f, JSON.stringify(h, null, 2));
}

export function history() {
  const seed = readJson(path.join(dataDir(), 'history.json'), []);
  const posts = listPosts().filter((p) => p.status !== 'rejected')
    .map((p) => ({ postId: p.id, market: p.market, date: p.plannedFor, topic: p.topic, params: p.params, lotIds: p.cards.map((c) => c.facts?.id).filter(Boolean) }));
  return [...seed, ...posts];
}
