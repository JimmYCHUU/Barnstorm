import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proposeWeek } from '../lib/planner.js';
import { allMarkets, market } from '../lib/markets.js';

const markets = allMarkets();
const week = '2026-11-09';
const seed = [
  { market: 'ie', date: '2026-11-02', topic: 'live-lots', params: { category: 'family-7-seaters' } },
  { market: 'uk', date: '2026-11-02', topic: 'live-lots', params: { category: 'kei-cars' } },
  { market: 'us', date: '2026-11-02', topic: 'live-lots', params: { category: 'sports' } },
  { market: 'mt', date: '2026-11-02', topic: 'live-lots', params: { category: 'city-hatchbacks' } },
  { market: 'cy', date: '2026-11-02', topic: 'live-lots', params: { category: 'hybrid' } },
  ...['ie', 'uk', 'us', 'mt', 'cy'].map((market) => ({ market, date: '2026-11-03', topic: 'how-it-works', params: {} })),
];
const stock = { ie: 20, uk: 30, us: 5, mt: 25, cy: 12 };

test('planner: 15 slots, Mon/Wed/Fri for each of 5 Pages', () => {
  const s = proposeWeek(week, seed, markets, stock);
  assert.equal(s.length, 15);
  assert.deepEqual([...new Set(s.map((x) => x.date))].sort(), ['2026-11-09', '2026-11-11', '2026-11-13']);
});

test('planner: no category repeated on a Page within 14 days', () => {
  const s = proposeWeek(week, seed, markets, stock);
  const uk = s.filter((x) => x.market === 'uk' && x.params.category).map((x) => x.params.category);
  assert.ok(!uk.includes('kei-cars'), uk.join(','));
  assert.equal(new Set(uk).size, uk.length);
});

test('planner: no two Pages share a category on the same day', () => {
  const s = proposeWeek(week, seed, markets, stock);
  for (const d of new Set(s.map((x) => x.date))) {
    const cats = s.filter((x) => x.date === d && x.params.category).map((x) => x.params.category);
    assert.equal(new Set(cats).size, cats.length, `${d}: ${cats.join(',')}`);
  }
});

test('planner: a Page that has never had how-it-works gets it first', () => {
  const s = proposeWeek(week, seed.filter((h) => !(h.market === 'mt' && h.topic === 'how-it-works')), markets, stock);
  const mt = s.filter((x) => x.market === 'mt').sort((a, b) => a.date.localeCompare(b.date));
  assert.equal(mt[0].topic, 'how-it-works');
});

test('planner: Wednesday falls back to lot-spotlight without own-photo stock', () => {
  const s = proposeWeek(week, seed, markets, { ...stock, us: 0 });
  const wed = s.find((x) => x.market === 'us' && x.date === '2026-11-11');
  assert.equal(wed.topic, 'lot-spotlight');
  assert.ok(wed.params.category);
  assert.equal(s.find((x) => x.market === 'uk' && x.date === '2026-11-11').topic, 'stock-spotlight');
});

test('planner: a market fact goes out every third week', () => {
  const s = proposeWeek('2026-11-16', seed, markets, stock);
  assert.ok(s.some((x) => x.topic === 'market-fact'));
});

test('planner: no Page repeats a category within 14 days while a fresh one exists', () => {
  const s = proposeWeek('2026-11-02', seed, markets, stock);
  for (const x of s.filter((y) => y.params.category)) {
    const used = seed.filter((h) => h.market === x.market && h.params.category === x.params.category);
    assert.ok(!used.length, `${x.market} ${x.date} re-used ${x.params.category}`);
  }
});

test('planner: a day that already has a post for a Page is left alone', () => {
  const s = proposeWeek('2026-11-02', seed, markets, stock);
  assert.ok(!s.some((x) => x.date === '2026-11-02'), 'Mon 2 Nov already has the hand-made posts');
  assert.equal(s.length, 10);
});

test('planner: Pages rotate through themes, not only the site categories', () => {
  let history = [...seed];
  const keys = [];
  for (const w of ['2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']) {
    const s = proposeWeek(w, history, markets, stock);
    history = [...history, ...s];
    for (const x of s.filter((y) => y.market === 'uk' && y.params.category)) keys.push([x.date, x.params.category]);
  }
  assert.ok(keys.length >= 6);
  assert.equal(new Set(keys.map((k) => k[1])).size, keys.length, keys.map((k) => k[1]).join(','));   // nothing repeats in four weeks
  assert.ok(keys.some(([, k]) => !market('uk').categories.some((c) => c.slug === k)), 'themes are used, not only site categories');
  for (const [d, k] of keys) {
    const again = keys.filter(([d2, k2]) => k2 === k && d2 !== d && Math.abs(Date.parse(d2) - Date.parse(d)) < 21 * 864e5);
    assert.equal(again.length, 0, `${k} repeated within 21 days`);
  }
});

test('planner: never-posted collections come before ones posted long ago', () => {
  const old = [{ market: 'uk', date: '2026-08-01', topic: 'live-lots', params: { category: 'people-carriers' } }, ...seed];
  const s = proposeWeek(week, old, markets, stock);
  assert.ok(!s.some((x) => x.market === 'uk' && x.params.category === 'people-carriers'));
});
