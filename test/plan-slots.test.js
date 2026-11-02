// A built slot can be cleared and built again: after a rejection, with Remove, or with Rebuild (same or another theme).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.CE_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-slots-'));
process.env.CE_POSTS = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-slots-posts-'));
const { createServer } = await import('../lib/api.js');
await import('../lib/routes.js');
const { parseCategory } = await import('../lib/sources/carbarn.js');
const { market } = await import('../lib/markets.js');
const store = await import('../lib/store.js');

const lots = parseCategory(fs.readFileSync(new URL('./fixtures/category.rsc', import.meta.url), 'utf8'), market('uk')).lots;
const deps = {
  source: {
    getCategory: async (m, slug, { page } = {}) => ({ count: lots.length, lots: page > 1 ? [] : lots }),
    getCategoryCounts: async (m, slug, dates) => ({ total: 6509, byDate: Object.fromEntries(dates.map((d) => [d, 3236])), fetchedAt: new Date().toISOString() }),
    getLot: async (m, id) => lots.find((l) => l.id === id),
    getStockList: async () => [],
  },
  cachePhoto: async () => ({ file: path.join(process.env.CE_DATA, 'p.jpg'), w: 1024, h: 768 }),
  renderCard: async (card, out) => { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, 'png'); return { overflow: [], photo: { w: 1024, h: 768 } }; },
};

let server, base;
before(async () => { server = createServer({ deps }); await new Promise((r) => server.listen(0, r)); base = `http://localhost:${server.address().port}`; });
after(() => server.close());
const call = async (method, url, body) => {
  const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json() };
};

// A UK kei-car slot dated the day before the fixture's auction, so it builds.
async function slotIn(week) {
  const slots = (await call('POST', '/api/plan/propose', { week })).body.slots;
  const slot = slots.find((s) => s.market === 'uk');
  await call('PATCH', `/api/plan/${slot.id}`, { topic: 'live-lots', params: { category: 'kei-cars' }, date: '2026-11-02' });
  return slot.id;
}
const cars = (post) => post.cards.map((c) => String(c.facts.id));
const slotOf = async (week, id) => (await call('GET', `/api/plan?week=${week}`)).body.slots.find((s) => s.id === id);
const events = () => fs.readFileSync(path.join(store.dataDir(), 'log.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

test('plan: a rejected post frees its slot, and building it again picks other cars', async () => {
  const id = await slotIn('2027-01-04');
  const first = (await call('POST', `/api/plan/${id}/build`)).body;
  await call('POST', `/api/posts/${first.id}/reject`, { reason: 'hooks too generic' });
  const slot = await slotOf('2027-01-04', id);
  assert.equal(slot.postId, undefined);
  assert.match(slot.note, /Rejected.*hooks too generic/);
  const again = await call('POST', `/api/plan/${id}/build`);
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.notEqual(again.body.id, first.id);
  assert.deepEqual(cars(again.body).filter((x) => cars(first).includes(x)), []);
  assert.equal((await slotOf('2027-01-04', id)).postId, again.body.id);
});

test('plan: Remove takes a post off its slot without counting as a rejection, and a published post stays', async () => {
  const id = await slotIn('2027-01-11');
  const post = (await call('POST', `/api/plan/${id}/build`)).body;
  const r = await call('POST', `/api/plan/${id}/remove`);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.postId, undefined);
  assert.match(r.body.note, /Removed/);
  assert.equal((await call('GET', `/api/posts/${post.id}`)).body.status, 'rejected');
  assert.ok(events().some((e) => e.type === 'removed' && e.postId === post.id));
  assert.ok(!events().some((e) => e.type === 'rejected' && e.postId === post.id), 'Learn must not read a removal as a rejection');

  const id2 = await slotIn('2027-01-18');
  const live = (await call('POST', `/api/plan/${id2}/build`)).body;
  store.savePost({ ...store.getPost(live.id), status: 'published' });
  const no = await call('POST', `/api/plan/${id2}/remove`);
  assert.equal(no.status, 409);
  assert.match(no.body.error, /already published/);
  assert.equal((await slotOf('2027-01-18', id2)).postId, live.id);
});

test('plan: Rebuild with another topic replaces the post in its slot', async () => {
  const id = await slotIn('2027-01-25');
  const first = (await call('POST', `/api/plan/${id}/build`)).body;
  const r = await call('POST', `/api/plan/${id}/rebuild`, { topic: 'lot-spotlight', params: { category: 'kei-cars' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.notEqual(r.body.id, first.id);
  assert.equal(r.body.topic, 'lot-spotlight');
  assert.ok(!cars(first).includes(cars(r.body)[0]), 'the new post uses another car');
  const slot = await slotOf('2027-01-25', id);
  assert.deepEqual([slot.postId, slot.topic], [r.body.id, 'lot-spotlight']);
  assert.equal((await call('GET', `/api/posts/${first.id}`)).body.status, 'rejected');
});

test('plan: a Rebuild that cannot build leaves the old post where it was', async () => {
  const id = await slotIn('2027-02-01');
  const first = (await call('POST', `/api/plan/${id}/build`)).body;
  const r = await call('POST', `/api/plan/${id}/rebuild`, { date: '2027-03-03' });   // no auctions listed that far ahead
  assert.equal(r.status, 422);
  const slot = await slotOf('2027-02-01', id);
  assert.deepEqual([slot.postId, slot.date], [first.id, '2026-11-02']);
  assert.equal((await call('GET', `/api/posts/${first.id}`)).body.status, 'draft');
});
