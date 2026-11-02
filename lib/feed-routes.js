// Page feed API: each Page as its Instagram grid (planned slots, built posts, hand-made posts), plus its collections.
import fs from 'node:fs';
import path from 'node:path';
import { route, HttpError } from './api.js';
import { market as getMarket, loadMarkets, saveMarkets } from './markets.js';
import { collections, collection } from './collections.js';
import { rankCollections, planFile, plannedAround } from './planner.js';
import { history } from './history.js';
import { dataDir, readJson, listPosts } from './store.js';
import { postsRoot } from './publish/pack.js';
import { addDays, mondayOf, today } from './text/dates.js';
import { topic as getTopic } from './topics/index.js';

const label = (m, key) => { try { return collection(m, key).label; } catch { return key; } };

// The Instagram pictures of a hand-made post folder, in posting order (falls back to the square ones).
function manualImages(folder) {
  if (!folder) return [];
  for (const sub of ['instagram', '']) {
    const dir = path.join(postsRoot(), folder, sub);
    if (!fs.existsSync(dir)) continue;
    const pngs = fs.readdirSync(dir).filter((f) => /\.png$/i.test(f)).sort();
    if (pngs.length) return pngs.map((png) => `/posts-files/${[folder, sub, png].filter(Boolean).join('/')}`);
  }
  return [];
}

// Caption A of a hand-made post: the quoted block under "## Caption A" in its caption.md.
function manualCaption(folder) {
  let md;
  try { md = fs.readFileSync(path.join(postsRoot(), folder, 'caption.md'), 'utf8'); } catch { return ''; }
  const block = md.replace(/\r\n/g, '\n').split(/^## /m).find((s) => /^Caption A\b/.test(s));
  return (block || '').split('\n').slice(1).filter((l) => l.startsWith('>')).map((l) => l.replace(/^> ?/, '')).join('\n').trim();
}

export function feedFor(key) {
  const m = getMarket(key), t = today();
  const posts = listPosts({ market: key }).filter((p) => p.status !== 'rejected');
  const postIds = new Set(posts.map((p) => p.id));
  const slots = [];
  for (let w = -7; w <= 14; w += 7) {
    for (const s of readJson(planFile(dataDir(), mondayOf(addDays(t, w))), { slots: [] }).slots) {
      if (s.market === key && s.status !== 'dropped' && !(s.postId && postIds.has(s.postId))) slots.push(s);
    }
  }
  const items = [
    ...slots.map((s) => ({ kind: 'slot', id: s.id, date: s.date, topic: s.topic, topicLabel: getTopic(s.topic).label,
      category: s.params?.category || null, categoryLabel: s.params?.category ? label(m, s.params.category) : '', note: s.note || '', status: 'planned' })),
    ...posts.map((p) => ({ kind: 'post', id: p.id, date: p.plannedFor, topic: p.topic, topicLabel: getTopic(p.topic).label,
      category: p.params?.category || null, categoryLabel: p.params?.category ? label(m, p.params.category) : '',
      status: p.status, cards: p.cards.length, image: `/files/posts/${p.id}/v${p.version}/ig/card-0.png`,
      errors: (p.qa || []).filter((f) => f.severity === 'error').length, warnings: (p.qa || []).filter((f) => f.severity === 'warn').length })),
    ...readJson(path.join(dataDir(), 'history.json'), []).filter((h) => h.market === key).map((h, i) => {
      const images = manualImages(h.folder);
      return { kind: 'manual', id: `manual-${i}`, date: h.date, topic: h.topic, topicLabel: getTopic(h.topic).label, category: h.params?.category || null,
        categoryLabel: h.params?.category ? label(m, h.params.category) : '', status: 'manual', image: images[0] || null, images,
        caption: h.folder ? manualCaption(h.folder) : '', folder: h.folder ? path.join(postsRoot(), h.folder) : null };
    }),
  ].sort((a, b) => b.date.localeCompare(a.date) || a.kind.localeCompare(b.kind));

  const stats = {
    planned: items.filter((i) => i.kind === 'slot' && i.date >= t).length,
    toFix: items.filter((i) => i.status === 'draft' && i.errors).length,
    toStamp: items.filter((i) => i.status === 'draft' && !i.errors).length,
    approved: items.filter((i) => ['approved', 'exported'].includes(i.status)).length,
    published: items.filter((i) => ['published', 'manual'].includes(i.status)).length,
  };
  const h = history(), recent = h.filter((x) => x.market === key && x.params?.category && x.date >= addDays(t, -42))
    .sort((a, b) => b.date.localeCompare(a.date)).map((x) => ({ key: x.params.category, label: label(m, x.params.category), date: x.date }));
  const next = rankCollections(m, addDays(t, 1), [...h, ...plannedAround(dataDir(), mondayOf(t))]).slice(0, 6).map((c) => ({ key: c.key, label: c.label, kind: c.kind }));
  return { market: { key: m.key, brand: m.brand, site: m.site, logo: m.logo }, stats, items, rotation: { recent, next } };
}

route('GET', '/api/feed/([a-z]+)', ({ m }) => feedFor(m[1]));

route('GET', '/api/collections/([a-z]+)', ({ m, url }) => {
  const mk = getMarket(m[1]), date = url.searchParams.get('date') || addDays(today(), 1), h = history();
  const planned = plannedAround(dataDir(), mondayOf(date)).filter((x) => x.market === mk.key && x.date >= today());
  const best = rankCollections(mk, date, [...h, ...planned])[0]?.key, off = mk.disabledCollections || [];
  // ?all=1 also lists the ones switched off in Settings, for the Rotation tab.
  const list = url.searchParams.get('all') ? collections({ ...mk, disabledCollections: [] }) : collections(mk);
  return list.map((c) => ({
    key: c.key, label: c.label, kind: c.kind, noun: c.noun, suggested: c.key === best, enabled: !off.includes(c.key),
    planned: planned.filter((x) => x.params?.category === c.key).map((x) => x.date).sort()[0] || null,
    last: h.filter((x) => x.market === mk.key && x.params?.category === c.key).map((x) => x.date).sort().at(-1) || null,
  }));
});

route('PUT', '/api/settings/markets/([a-z]+)/collections', ({ m, body }) => {
  const cfg = loadMarkets(), mk = cfg.markets[m[1]];
  if (!mk) throw new HttpError(400, 'Unknown market');
  const valid = new Set(collections({ ...getMarket(m[1]), disabledCollections: [] }).map((c) => c.key));
  const disabled = (body.disabled || []).filter((k) => valid.has(k));
  if (disabled.length >= valid.size - 1) throw new HttpError(400, 'Keep at least two categories or themes switched on.');
  mk.disabledCollections = disabled;
  saveMarkets(cfg);
  return { disabled };
});
