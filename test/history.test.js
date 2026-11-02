// History seeding: hand-made posts from before Barnstorm.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.CE_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-hist-'));
const { ensureSeed } = await import('../lib/history.js');
const seed = JSON.parse(fs.readFileSync(new URL('../config/seed-history.json', import.meta.url), 'utf8'));

test('history: an older seeded history gets the hand-made folders filled in, nothing else touched', () => {
  const f = path.join(process.env.CE_DATA, 'history.json');
  const old = seed.map(({ folder, note, ...rest }) => rest);
  old.push({ market: 'uk', date: '2026-11-03', topic: 'live-lots', params: { category: 'manual' }, lotIds: [] });
  fs.writeFileSync(f, JSON.stringify(old));
  ensureSeed();
  const now = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(now.length, old.length);
  for (const s of seed) assert.equal(now.find((h) => h.market === s.market && h.date === s.date).folder, s.folder);
  assert.equal(now.at(-1).folder, undefined);
});
