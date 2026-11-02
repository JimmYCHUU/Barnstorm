import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.CE_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-data-'));
const { parseCategory } = await import('../lib/sources/carbarn.js');
const { market } = await import('../lib/markets.js');
const { buildPost, rebuildCard } = await import('../lib/build.js');
const { pickLots, scoreLot } = await import('../lib/pick.js');
const store = await import('../lib/store.js');

beforeEach(() => { process.env.CE_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-data-')); });

const fx = fs.readFileSync(new URL('./fixtures/category.rsc', import.meta.url), 'utf8');
const lots = parseCategory(fx, market('uk')).lots;

function deps(list = lots) {
  const renders = [];
  return {
    renders,
    source: {
      getCategory: async (m, slug, { date, page } = {}) => ({ count: list.length, cutoffUtc: null,
        lots: page > 1 ? [] : list.filter((l) => !date || l.auctionDate === date) }),
      getCategoryCounts: async (m, slug, dates) => ({ total: 6509, byDate: Object.fromEntries(dates.map((d) => [d, d === '2026-11-03' ? 3236 : 0])), fetchedAt: new Date().toISOString() }),
      getLot: async (m, id) => ({ ...list.find((l) => l.id === id), sellingPoints: 'Smart Key, Seat Heater' }),
    },
    cachePhoto: async (url) => ({ file: path.join(process.env.CE_DATA, 'p.jpg'), w: 1024, h: 768 }),
    renderCard: async (card, out) => { renders.push(out); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, 'png'); return { overflow: [], photo: { w: 1024, h: 768 } }; },
  };
}

test('liveLots: picks 4 distinct models from the fixture', async () => {
  const post = await buildPost({ market: 'uk', topic: 'live-lots', params: { category: 'kei-cars' }, plannedFor: '2026-11-02' }, deps());
  assert.equal(post.cards.length, 4);
  assert.equal(new Set(post.cards.map((c) => `${c.facts.make} ${c.facts.model}`)).size, 4);
  assert.equal(post.version, 1);
  assert.match(post.caption.a, /^3,236 kei cars go under the hammer in Japan on Tuesday/);
  assert.ok(post.cards.every((c) => c.slots.pill.startsWith('LIVE AUCTION · TUE 3 NOV')));
});

test('liveLots: no two cards share a hook when another option exists', async () => {
  const post = await buildPost({ market: 'uk', topic: 'live-lots', params: { category: 'kei-cars' }, plannedFor: '2026-11-02' }, deps());
  const hooks = post.cards.map((c) => c.slots.hook);
  assert.equal(new Set(hooks).size, hooks.length, hooks.join(' / '));
});

test('liveLots: 2 eligible lots gives 2 cards and a few-cards warning', async () => {
  const two = [lots.find((l) => l.model === 'CARRY'), lots.find((l) => l.model === 'TAFT')];
  const post = await buildPost({ market: 'uk', topic: 'live-lots', params: { category: 'kei-cars' }, plannedFor: '2026-11-02' }, deps(two));
  assert.equal(post.cards.length, 2);
  assert.ok(post.qa.some((f) => f.id === 'few-cards' && f.severity === 'warn'));
});

test('build: lots auctioning on or before plannedFor are excluded', async () => {
  await assert.rejects(buildPost({ market: 'uk', topic: 'live-lots', params: { category: 'kei-cars' }, plannedFor: '2026-11-03' }, deps()), /No eligible lots/);
});

test('pick: excludes a lot used in the last 30 days', () => {
  const used = new Set([lots[0].id]);
  const picked = pickLots(lots, 4, { market: market('uk'), used });
  assert.ok(!picked.some((l) => l.id === lots[0].id));
  assert.ok(scoreLot(lots[0], { market: market('uk'), used }) < 0);
});

const syn = (id, make, model, grade, extra = {}) => ({ id, make, model, grade, photos: ['a', 'b', 'c'], auctionHouse: 'CAA Tokyo', year: 2025, odometerKm: 5000, ...extra });

test('pick: a varied set beats four grade-6 cars of one make', () => {
  const lots = [syn('1', 'DAIHATSU', 'MOVE', '6'), syn('2', 'DAIHATSU', 'MOVE CANBUS', '6'), syn('3', 'DAIHATSU', 'TANTO', '6'),
    syn('4', 'DAIHATSU', 'TAFT', '6'), syn('5', 'SUZUKI', 'JIMNY', '5'), syn('6', 'HONDA', 'N BOX', '4.5')];
  const makes = pickLots(lots, 4, { market: market('uk') }).map((l) => l.make);
  assert.ok(new Set(makes).size >= 3, makes.join(','));
});

test('pick: a non-Japanese make ranks below a Japanese car of slightly lower grade', () => {
  const ctx = { market: market('us') };
  assert.ok(scoreLot(syn('1', 'MERCEDES BENZ', 'SLK', '4'), ctx) < scoreLot(syn('2', 'MITSUBISHI', 'LANCER', '3.5'), ctx));
});

test('pick: a model from the hook library gets a bonus', () => {
  const ctx = { market: market('uk') };
  assert.ok(scoreLot(syn('1', 'SUZUKI', 'JIMNY', '5', { modelCode: 'JB64W' }), ctx) > scoreLot(syn('2', 'SUZUKI', 'ALTO', '5'), ctx));
});

test('store: edit creates a version, locks the slot and re-renders only that card', async () => {
  const d = deps();
  const post = await buildPost({ market: 'uk', topic: 'live-lots', params: { category: 'kei-cars' }, plannedFor: '2026-11-02' }, d);
  d.renders.length = 0;
  const next = await rebuildCard(post, 1, { slots: { hook: 'Tiny and mighty' } }, d);
  assert.equal(next.version, 2);
  assert.equal(next.cards[1].slots.hook, 'Tiny and mighty');
  assert.ok(next.cards[1].locked.includes('hook'));
  assert.equal(d.renders.length, 2);
  assert.ok(d.renders.some((r) => r.includes(`${path.sep}ig${path.sep}card-1.png`)));
  assert.ok(fs.existsSync(path.join(process.env.CE_DATA, 'posts', post.id, 'v2', 'card-0.png')));
  assert.ok(fs.existsSync(path.join(process.env.CE_DATA, 'posts', post.id, 'v2', 'ig', 'card-0.png')));
  assert.equal(store.getPost(post.id).version, 2);
  assert.equal(store.getVersion(post.id, 1).cards[1].slots.hook, post.cards[1].slots.hook);
});

test('lotSpotlight: no eligible lot gives a readable error', async () => {
  const d = deps(); d.cachePhoto = async () => ({ file: path.join(process.env.CE_DATA, 'p.jpg'), w: 500, h: 375 });
  await assert.rejects(buildPost({ market: 'uk', topic: 'lot-spotlight', params: { category: 'kei-cars' }, plannedFor: '2026-11-02' }, d),
    (e) => e.name === 'UserError' && /No eligible lots/.test(e.message));
});

test('build: editing an exported post sends it back to draft', async () => {
  const { setStatus } = await import('../lib/build.js');
  const d = deps();
  const post = await setStatus(await buildPost({ market: 'uk', topic: 'live-lots', params: { category: 'kei-cars' }, plannedFor: '2026-11-02' }, d), 'exported');
  const next = await rebuildCard(post, 0, { slots: { hook: 'Changed' } }, d);
  assert.equal(next.status, 'draft');
});

test('build: a re-check that finds errors sends an approved post back to draft', async () => {
  const { setStatus, recheck } = await import('../lib/build.js');
  const d = deps();
  const post = await setStatus(await buildPost({ market: 'uk', topic: 'live-lots', params: { category: 'kei-cars' }, plannedFor: '2026-11-02' }, d), 'approved');
  d.qa = async () => [{ id: 'lot-gone', severity: 'error', message: 'gone' }];
  assert.equal((await recheck(post, d, { refetch: true })).status, 'draft');
});

test('liveLots: a theme reads its own listing (brand/model path or filters)', async () => {
  const d = deps(), seen = [];
  const get = d.source.getCategory;
  d.source.getCategory = async (m, coll, o) => { seen.push(coll); return get(m, coll, o); };
  const post = await buildPost({ market: 'uk', topic: 'live-lots', params: { category: 'jimny' }, plannedFor: '2026-11-02' }, d);
  assert.equal(seen[0].path, 'suzuki/jimny');
  assert.equal(post.params.category, 'jimny');
});
