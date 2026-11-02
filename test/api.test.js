import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.CE_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-api-'));
process.env.CE_POSTS = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-api-posts-'));
const { createServer } = await import('../lib/api.js');
await import('../lib/routes.js');
const { parseCategory } = await import('../lib/sources/carbarn.js');
const { market } = await import('../lib/markets.js');
const { runQA } = await import('../lib/qa.js');

const lots = parseCategory(fs.readFileSync(new URL('./fixtures/category.rsc', import.meta.url), 'utf8'), market('uk')).lots;
const renders = [];
const deps = {
  source: {
    getCategory: async (m, slug, { page } = {}) => ({ count: lots.length, lots: page > 1 ? [] : lots }),
    getCategoryCounts: async (m, slug, dates) => ({ total: 6509, byDate: Object.fromEntries(dates.map((d) => [d, 3236])), fetchedAt: new Date().toISOString() }),
    getLot: async (m, id) => lots.find((l) => l.id === id),
    getStockList: async () => [],
  },
  cachePhoto: async () => ({ file: path.join(process.env.CE_DATA, 'p.jpg'), w: 1024, h: 768 }),
  renderCard: async (card, out) => { renders.push(out); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, 'png'); return { overflow: [], photo: { w: 1024, h: 768 } }; },
};
deps.qa = (post, opts) => runQA(post, { ...opts, source: deps.source });

let server, base;
before(async () => {
  server = createServer({ deps });
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

const call = async (method, url, body) => {
  const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json() };
};

let id;
test('api: create then get returns cards with image links', async () => {
  const c = await call('POST', '/api/posts', { market: 'uk', topic: 'live-lots', params: { category: 'kei-cars' }, plannedFor: '2026-11-02' });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  id = c.body.id;
  const g = await call('GET', `/api/posts/${id}`);
  assert.equal(g.body.cards.length, 4);
  assert.equal(g.body.igImages[0], `/files/posts/${id}/v1/ig/card-0.png`);
  assert.match(g.body.images[0], new RegExp(`^/files/posts/${id}/v1/card-0\\.png$`));
});

test('api: approve with an error flag returns 409', async () => {
  const r = await call('POST', `/api/posts/${id}/approve`);
  assert.equal(r.status, 409);
  assert.ok(r.body.qa.some((f) => f.id === 'plates-unchecked'));
});

test('api: patch hook re-renders only that card', async () => {
  renders.length = 0;
  const r = await call('PATCH', `/api/posts/${id}`, { card: 2, slots: { hook: 'Tiny and mighty' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.cards[2].slots.hook, 'Tiny and mighty');
  assert.equal(renders.length, 2);
});

test('api: approve succeeds once plates are checked', async () => {
  for (let i = 0; i < 4; i++) await call('PATCH', `/api/posts/${id}`, { card: i, platesChecked: true });
  const r = await call('POST', `/api/posts/${id}/approve`);
  assert.equal(r.status, 200, JSON.stringify(r.body.qa));
  assert.equal(r.body.status, 'approved');
});

test('api: reject needs a reason', async () => {
  assert.equal((await call('POST', `/api/posts/${id}/reject`, {})).status, 400);
  assert.equal((await call('POST', `/api/posts/${id}/reject`, { reason: 'Too many Daihatsus' })).body.status, 'rejected');
});

test('api: files route refuses paths outside data', async () => {
  const res = await fetch(`${base}/files/..%2F..%2Fpackage.json`);
  assert.equal(res.status, 404);
});

test('api: unknown post is 404', async () => {
  assert.equal((await call('GET', '/api/posts/nope')).status, 404);
});

test('api: propose a week, then build a slot into a linked post', async () => {
  const p = await call('POST', '/api/plan/propose', { week: '2026-11-09' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(p.body.slots.length, 15);
  const slot = p.body.slots.find((s) => s.market === 'uk' && s.date === '2026-11-11');
  assert.equal(slot.topic, 'lot-spotlight');   // no stock with own photos in this test
  assert.equal(p.body.slots.find((s) => s.market === 'uk' && s.date === '2026-11-09').topic, 'how-it-works');   // no history yet
  await call('PATCH', `/api/plan/${slot.id}`, { topic: 'live-lots', params: { category: 'kei-cars' } });
  const none = await call('POST', `/api/plan/${slot.id}/build`);
  assert.equal(none.status, 422);   // fixture lots auction on 3 Nov, before this slot
  assert.match(none.body.error, /No eligible lots/);
  await call('PATCH', `/api/plan/${slot.id}`, { date: '2026-11-02' });
  const b = await call('POST', `/api/plan/${slot.id}/build`);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  const g = await call('GET', '/api/plan?week=2026-11-09');
  const linked = g.body.slots.find((s) => s.id === slot.id);
  assert.equal(linked.postId, b.body.id);
  assert.equal(linked.status, 'built');
});

test('api: requests from another website are refused', async () => {
  const r1 = await fetch(base + '/api/posts', { method: 'POST', headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' }, body: '{}' });
  assert.equal(r1.status, 403);
  const r2 = await fetch(base + '/api/posts', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://evil.example' }, body: '{}' });
  assert.equal(r2.status, 403);
});

test('api: a malformed post date is refused', async () => {
  const r = await call('POST', '/api/posts', { market: 'uk', topic: 'live-lots', params: { category: 'kei-cars' }, plannedFor: '2026-11-02/../../x' });
  assert.equal(r.status, 400);
});

test('api: a published post cannot go back to draft', async () => {
  const c = await call('POST', '/api/posts', { market: 'uk', topic: 'live-lots', params: { category: 'kei-cars' }, plannedFor: '2026-11-02' });
  const { getPost, savePost } = await import('../lib/store.js');
  savePost({ ...getPost(c.body.id), status: 'published' });
  assert.equal((await call('POST', '/api/posts/' + c.body.id + '/reopen')).status, 409);
});

test('api: publishing re-reads the lots and refuses when one is gone', async () => {
  const c = await call('POST', '/api/posts', { market: 'uk', topic: 'live-lots', params: { category: 'kei-cars' }, plannedFor: '2026-11-02' });
  for (let i = 0; i < c.body.cards.length; i++) await call('PATCH', '/api/posts/' + c.body.id, { card: i, platesChecked: true });
  assert.equal((await call('POST', '/api/posts/' + c.body.id + '/approve')).status, 200);
  const keep = deps.source.getLot;
  deps.source.getLot = async () => { throw Object.assign(new Error('Lot not found'), { notFound: true }); };
  const r = await call('POST', '/api/posts/' + c.body.id + '/publish', { platforms: ['facebook'] });
  deps.source.getLot = keep;
  assert.equal(r.status, 409);
  assert.equal((await call('GET', '/api/posts/' + c.body.id)).body.status, 'draft');
});

test('api: proposing the next week rotates on from the week already planned', async () => {
  const a = (await call('POST', '/api/plan/propose', { week: '2026-11-23' })).body.slots;
  const b = (await call('POST', '/api/plan/propose', { week: '2026-11-30' })).body.slots;
  for (const mk of ['uk', 'ie', 'us']) {
    const both = [...a, ...b].filter((x) => x.market === mk);
    assert.ok(both.filter((x) => x.topic === 'how-it-works').length <= 1, mk + ': intro repeated');
    const cats = both.filter((x) => x.params?.category).map((x) => x.params.category);
    assert.equal(new Set(cats).size, cats.length, mk + ': ' + cats.join(','));
  }
  const c = (await call('GET', '/api/collections/uk?date=2026-11-24')).body;
  const planned = new Set([...a, ...b].filter((x) => x.market === 'uk' && x.params?.category).map((x) => x.params.category));
  assert.ok(c.some((x) => x.planned && planned.has(x.key)));
  assert.ok(!planned.has(c.find((x) => x.suggested).key), 'suggestion is already planned');
});

test('api: building a far-off slot too early says when to build it, without trying other themes', async () => {
  const p = await call('POST', '/api/plan/propose', { week: '2026-12-07' });
  const slot = p.body.slots.find((s) => s.market === 'uk' && s.topic === 'live-lots');
  const keep = deps.source.getCategory, asked = new Set();
  deps.source.getCategory = async (m, coll, o) => { asked.add(coll.key); return { count: 0, lots: [] }; };
  const b = await call('POST', '/api/plan/' + slot.id + '/build');
  deps.source.getCategory = keep;
  assert.equal(b.status, 422);
  assert.match(b.body.error, /day before it goes out/);
  assert.equal(asked.size, 1);
});

test('api: a post made outside the plan moves any planned slot that would repeat its theme too soon', async () => {
  const p = (await call('POST', '/api/plan/propose', { week: '2026-11-16' })).body.slots;
  const slot = p.find((x) => x.market === 'uk' && x.params?.category);
  const theme = slot.params.category;
  const made = await call('POST', '/api/posts', { market: 'uk', topic: 'live-lots', params: { category: theme }, plannedFor: '2026-11-02' });
  assert.equal(made.status, 200, JSON.stringify(made.body));
  const after = (await call('GET', '/api/plan?week=2026-11-16')).body.slots.find((x) => x.id === slot.id);
  assert.notEqual(after.params.category, theme);
  assert.match(after.note, /Changed from/);
});

test('api: opening a plan moves any slot that already repeats a recent post on its Page', async () => {
  const p = (await call('POST', '/api/plan/propose', { week: '2026-12-14' })).body.slots;
  const slot = p.find((x) => x.market === 'ie' && x.params?.category);
  const { dataDir, writeJson, readJson } = await import('../lib/store.js');
  const file = path.join(dataDir(), 'history.json'), keep = readJson(file, []);
  writeJson(file, [...keep, { market: 'ie', date: addDaysIso(slot.date, -3), topic: 'live-lots', params: { category: slot.params.category }, lotIds: [] }]);
  const after = (await call('GET', '/api/plan?week=2026-12-14')).body.slots.find((x) => x.id === slot.id);
  writeJson(file, keep);
  assert.notEqual(after.params.category, slot.params.category);
  assert.match(after.note, /Changed from/);
});
const addDaysIso = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);

test('api: a planned theme with no lots falls back to the next fresh collection', async () => {
  const p = await call('POST', '/api/plan/propose', { week: '2026-10-26' });
  const slot = p.body.slots.find((s) => s.market === 'uk' && s.date === '2026-10-30');
  await call('PATCH', '/api/plan/' + slot.id, { topic: 'live-lots', params: { category: 'convertibles' }, date: '2026-11-02' });
  const keep = deps.source.getCategory;
  deps.source.getCategory = async (m, coll, o) => (coll.key === 'convertibles' ? { count: 0, lots: [] } : keep(m, coll, o));
  const b = await call('POST', '/api/plan/' + slot.id + '/build');
  deps.source.getCategory = keep;
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.notEqual(b.body.params.category, 'convertibles');
  const g = await call('GET', '/api/plan?week=2026-10-26');
  const s2 = g.body.slots.find((s) => s.id === slot.id);
  assert.match(s2.note, /Convertibles/);
});

test('api: a Page feed lists planned slots, built posts and hand-made posts, newest first', async () => {
  const { dataDir, writeJson } = await import('../lib/store.js');
  writeJson(path.join(dataDir(), 'history.json'), [{ market: 'uk', date: '2026-10-20', topic: 'live-lots', params: { category: 'kei-cars' }, folder: 'carbarn-united-kingdom/x', lotIds: [] }]);
  const r = await call('GET', '/api/feed/uk');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const kinds = new Set(r.body.items.map((i) => i.kind));
  assert.ok(kinds.has('post') && kinds.has('manual'), [...kinds].join(','));
  const dates = r.body.items.map((i) => i.date);
  assert.deepEqual(dates, [...dates].sort().reverse());
  const post = r.body.items.find((i) => i.kind === 'post');
  assert.match(post.image, /\/ig\/card-0\.png$/);
  assert.ok(r.body.stats && typeof r.body.stats.toStamp === 'number');
  assert.ok(r.body.rotation.next.length >= 3);
});

test('api: a hand-made post in the feed carries its pictures and Caption A from caption.md', async () => {
  const { dataDir, writeJson } = await import('../lib/store.js');
  const dir = path.join(process.env.CE_POSTS, 'carbarn-united-kingdom', 'hand');
  fs.mkdirSync(path.join(dir, 'instagram'), { recursive: true });
  for (const f of ['2-b.png', '1-a.png']) fs.writeFileSync(path.join(dir, 'instagram', f), 'png');
  fs.writeFileSync(path.join(dir, 'caption.md'), '# Title\n\nUpload in this order.\n\n## Caption A\n> 3,236 kei cars on Tuesday 🇯🇵\n>\n> 👉 carbarn.uk/live-auction/kei-cars\n\n## Caption B\n> Short one\n');
  writeJson(path.join(dataDir(), 'history.json'), [{ market: 'uk', date: '2026-10-21', topic: 'live-lots', params: { category: 'kei-cars' }, folder: 'carbarn-united-kingdom/hand', lotIds: [] }]);
  const r = await call('GET', '/api/feed/uk');
  const hand = r.body.items.find((i) => i.kind === 'manual');
  assert.deepEqual(hand.images, ['/posts-files/carbarn-united-kingdom/hand/instagram/1-a.png', '/posts-files/carbarn-united-kingdom/hand/instagram/2-b.png']);
  assert.equal(hand.image, hand.images[0]);
  assert.equal(hand.caption, '3,236 kei cars on Tuesday 🇯🇵\n\n👉 carbarn.uk/live-auction/kei-cars');
  assert.equal(hand.folder, dir);
});

test('api: collections for a Page come with last-posted dates and a suggestion', async () => {
  const r = await call('GET', '/api/collections/uk?date=2026-11-06');
  assert.equal(r.status, 200);
  assert.ok(r.body.length > 10);
  assert.equal(r.body.filter((c) => c.suggested).length, 1);
  assert.ok(r.body.some((c) => c.kind === 'theme') && r.body.some((c) => c.kind === 'category'));
});

test('api: state names every category and theme for each Page', async () => {
  const r = await call('GET', '/api/state');
  const uk = r.body.markets.find((m) => m.key === 'uk');
  assert.equal(uk.labels['land-cruiser'], 'Land Cruiser');
  assert.ok(uk.labels['kei-cars']);
});

test('api: hand-made post images are served from the posts folder, nothing outside it', async () => {
  const dir = path.join(process.env.CE_POSTS, 'carbarn-united-kingdom', 'x', 'instagram');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '1-a.png'), 'png');
  assert.equal((await fetch(`${base}/posts-files/carbarn-united-kingdom/x/instagram/1-a.png`)).status, 200);
  assert.equal((await fetch(`${base}/posts-files/..%2F..%2Fpackage.json`)).status, 404);
});

test('api: a theme switched off in Settings is never planned', async () => {
  const cfgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-cfg-'));
  for (const f of fs.readdirSync(new URL('../config/', import.meta.url))) fs.copyFileSync(new URL(`../config/${f}`, import.meta.url), path.join(cfgDir, f));
  process.env.CE_CONFIG = cfgDir;
  const { reloadMarkets } = await import('../lib/markets.js');
  reloadMarkets();
  const r = await call('PUT', '/api/settings/markets/uk/collections', { disabled: ['toyota', 'kei-cars'] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const c = await call('GET', '/api/collections/uk?date=2026-11-06');
  assert.ok(!c.body.some((x) => x.key === 'toyota' || x.key === 'kei-cars'));
  const all = await call('GET', '/api/collections/uk?all=1');
  assert.equal(all.body.find((x) => x.key === 'toyota').enabled, false);
  assert.equal(all.body.find((x) => x.key === 'nissan').enabled, true);
  delete process.env.CE_CONFIG;
  reloadMarkets();
});

test('api: a Gemini key is tried with Google before it is saved, and never sent back', async () => {
  const was = process.env.CE_SECRETS;
  process.env.CE_SECRETS = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ce-api-sec-')), 'secrets.json');
  try {
    deps.checkGeminiKey = async (key) => { if (key !== 'good-key') throw Object.assign(new Error('Google says the Gemini key is not valid'), { name: 'UserError' }); };
    const bad = await call('PUT', '/api/connections/gemini', { apiKey: 'bad-key' });
    assert.notEqual(bad.status, 200);
    assert.match(bad.body.error, /not valid/);
    assert.equal((await call('GET', '/api/connections')).body.gemini, false);
    const ok = await call('PUT', '/api/connections/gemini', { apiKey: ' good-key ' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.gemini, true);
    assert.doesNotMatch(JSON.stringify(ok.body), /good-key/);
    assert.equal(JSON.parse(fs.readFileSync(process.env.CE_SECRETS, 'utf8')).gemini.apiKey, 'good-key');
    assert.equal(ok.body.photos.model, 'gemini-nano-banana-2.1');
  } finally {
    delete deps.checkGeminiKey;
    if (was) process.env.CE_SECRETS = was; else delete process.env.CE_SECRETS;
  }
});
