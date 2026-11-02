// JSON-file store under data/: posts with numbered versions, plans, the event log and the photo cache.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const localToday = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

export function dataDir() { return process.env.CE_DATA || path.join(ROOT, 'data'); }
export function projectRoot() { return ROOT; }

const postsDir = () => path.join(dataDir(), 'posts');
export const postDir = (id) => path.join(postsDir(), id);
export const versionDir = (id, v) => path.join(postDir(id), `v${v}`);

export function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

export function listPosts({ status, market } = {}) {
  if (!fs.existsSync(postsDir())) return [];
  return fs.readdirSync(postsDir())
    .map((id) => readJson(path.join(postDir(id), 'post.json')))
    .filter((p) => p && (!status || [].concat(status).includes(p.status)) && (!market || p.market === market))
    .sort((a, b) => (b.plannedFor || '').localeCompare(a.plannedFor || '') || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export function getPost(id) { return readJson(path.join(postDir(id), 'post.json')); }
export function getVersion(id, v) { return readJson(path.join(versionDir(id, v), 'post.json')); }

export function newId(base) {
  const clean = base.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  let id = clean, n = 2;
  while (fs.existsSync(postDir(id))) id = `${clean}-${n++}`;
  fs.mkdirSync(postDir(id), { recursive: true });
  return id;
}

// Writes the current post and a snapshot for its version (the version's PNGs are already in place).
export function savePost(post) {
  post.updatedAt = new Date().toISOString();
  writeJson(path.join(versionDir(post.id, post.version), 'post.json'), post);
  writeJson(path.join(postDir(post.id), 'post.json'), post);
  return post;
}

export function listVersions(id) {
  if (!fs.existsSync(postDir(id))) return [];
  return fs.readdirSync(postDir(id)).filter((d) => /^v\d+$/.test(d)).map((d) => Number(d.slice(1))).sort((a, b) => a - b)
    .map((v) => { const p = getVersion(id, v); return { version: v, updatedAt: p?.updatedAt, reason: p?.reason || '' }; });
}

// Lot ids already featured in a live (not rejected) post planned within the last `sinceDays`.
export function usedLots({ sinceDays = 30, exceptId = null, today = localToday() } = {}) {
  const from = new Date(Date.parse(today) - sinceDays * 864e5).toISOString().slice(0, 10);
  const ids = new Set();
  for (const p of listPosts()) {
    if (p.id === exceptId || p.status === 'rejected' || (p.plannedFor || '') < from) continue;
    for (const c of p.cards || []) if (c.facts?.id) ids.add(String(c.facts.id));
  }
  for (const s of readJson(path.join(dataDir(), 'history.json'), [])) {   // seed history: hand-made posts
    if ((s.date || '') >= from) for (const id of s.lotIds || []) ids.add(String(id));
  }
  return ids;
}

export function logEvent(e) {
  fs.mkdirSync(dataDir(), { recursive: true });
  const ev = { id: crypto.randomUUID(), ts: new Date().toISOString(), ...e };
  fs.appendFileSync(path.join(dataDir(), 'log.jsonl'), JSON.stringify(ev) + '\n');
  return ev;
}

export function readLog() {
  const f = path.join(dataDir(), 'log.jsonl');
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
