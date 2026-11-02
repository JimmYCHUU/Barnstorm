import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runQA } from '../lib/qa.js';

const YEAR = new Date().getFullYear();
const card = (o = {}) => ({
  kind: 'lot', template: 'lot-card',
  facts: { id: '2723320', make: 'SUZUKI', model: 'JIMNY', year: 2022, odometerKm: 7000, grade: '5', auctionDate: '2026-11-04', url: 'https://www.carbarn.uk/x' },
  photo: { source: 'own', w: 1024, h: 768 }, platesChecked: true, render: { overflow: [] },
  slots: { hook: 'Pocket-sized 4x4', model: '2022 Suzuki Jimny XC', feat: '4WD · heated seats', km: '7,000 km', grade: '5', pill: 'LIVE AUCTION · WED 4 NOV' },
  ...o,
});
const post = (o = {}) => ({
  id: 'p1', market: 'uk', topic: 'live-lots', plannedFor: '2026-11-02', cards: [card()],
  caption: { a: 'Four kei cars we like. #CarbarnUK #JDM', b: 'Live now on carbarn.uk', chosen: 'a' },
  counts: { fetchedAt: new Date().toISOString() }, ...o,
});
const ids = async (p, opts) => (await runQA(p, opts)).map((f) => f.id);

test('qa: a clean post has no flags', async () => {
  assert.deepEqual(await runQA(post()), []);
});

test('qa: lot-gone and fact-mismatch from refetch', async () => {
  const gone = { getLot: async () => { throw Object.assign(new Error('Lot not found'), { notFound: true }); } };
  assert.ok((await ids(post(), { refetch: true, source: gone })).includes('lot-gone'));
  const changed = { getLot: async () => ({ odometerKm: 8000, grade: '5', auctionDate: '2026-11-04' }) };
  const f = await runQA(post(), { refetch: true, source: changed });
  assert.ok(f.some((x) => x.id === 'fact-mismatch' && /8,000/.test(x.message)));
});

test('qa: fact-mismatch when a card slot disagrees with the listing', async () => {
  assert.ok((await ids(post({ cards: [card({ slots: { ...card().slots, km: '6,000 km' } })] }))).includes('fact-mismatch'));
  assert.ok((await ids(post({ cards: [card({ slots: { ...card().slots, pill: 'LIVE AUCTION · TUE 3 NOV' } })] }))).includes('fact-mismatch'));
});

test('qa: auction-past when the lot auctions on or before the post date', async () => {
  assert.ok((await ids(post({ plannedFor: '2026-11-04' }))).includes('auction-past'));
});

test('qa: overflow from the renderer', async () => {
  assert.ok((await ids(post({ cards: [card({ render: { overflow: ['hook'] } })] }))).includes('overflow'));
});

test('qa: banned-phrase in caption or card text', async () => {
  assert.ok((await ids(post({ caption: { a: 'The best kei cars this week', b: '', chosen: 'a' } }))).includes('banned-phrase'));
  assert.ok((await ids(post({ cards: [card({ slots: { ...card().slots, hook: 'Luxury on wheels' } })] }))).includes('banned-phrase'));
});

test('qa: spelling slip is a warning', async () => {
  const f = await runQA(post({ market: 'us', caption: { a: 'Four favourites', b: '', chosen: 'a' } }));
  assert.ok(f.some((x) => x.id === 'spelling' && x.severity === 'warn'));
});

test('qa: placeholder text', async () => {
  assert.ok((await ids(post({ caption: { a: 'Price {price} undefined', b: '', chosen: 'a' } }))).includes('placeholder'));
});

test('qa: auction photo warns and needs the plates tick', async () => {
  const p = post({ cards: [card({ photo: { source: 'auction', w: 1024, h: 768 }, platesChecked: false })] });
  const f = await runQA(p);
  assert.ok(f.some((x) => x.id === 'auction-photo' && x.severity === 'warn'));
  assert.ok(f.some((x) => x.id === 'plates-unchecked' && x.severity === 'error'));
});

test('qa: low-res photo', async () => {
  assert.ok((await ids(post({ cards: [card({ photo: { source: 'own', w: 640, h: 480 } })] }))).includes('low-res'));
});

test('qa: duplicate-lot when another post already uses the car', async () => {
  assert.ok((await ids(post(), { used: new Set(['2723320']) })).includes('duplicate-lot'));
});

test('qa: caption-length and hashtags', async () => {
  assert.ok((await ids(post({ caption: { a: 'x'.repeat(2201), b: '', chosen: 'a' } }))).includes('caption-length'));
  assert.ok((await ids(post({ caption: { a: '#a #b #c #d #e #f', b: '', chosen: 'a' } }))).includes('hashtags'));
});

test('qa: us-age blocks a car under 25 years old', async () => {
  const young = card({ facts: { ...card().facts, year: YEAR - 20 } });
  assert.ok((await ids(post({ market: 'us', cards: [young] }))).includes('us-age'));
});

test('qa: cy-age warns near the five-year limit', async () => {
  const old = card({ facts: { ...card().facts, year: YEAR - 4 } });
  assert.ok((await ids(post({ market: 'cy', cards: [old] }))).includes('cy-age'));
});

test('qa: counts-stale only when approving', async () => {
  const p = post({ counts: { fetchedAt: new Date(Date.now() - 13 * 3600e3).toISOString() } });
  assert.ok(!(await ids(p)).includes('counts-stale'));
  assert.ok((await ids(p, { approving: true })).includes('counts-stale'));
});

test('qa: few-cards passes through from the build', async () => {
  assert.ok((await ids(post(), { base: [{ id: 'few-cards', severity: 'warn', message: 'Only 2' }] })).includes('few-cards'));
});

test('qa: km-suspect on a 1,000 km older car', async () => {
  const c = card({ facts: { ...card().facts, odometerKm: 1000, year: 2018 }, slots: { ...card().slots, km: '1,000 km' } });
  assert.ok((await ids(post({ cards: [c] }))).includes('km-suspect'));
});

const stockCard = (o = {}) => ({
  kind: 'stock', template: 'lot-card', render: { overflow: [] }, platesChecked: true,
  facts: { id: 'stock-12669', slug: '2021-honda-n-box-12051', year: 2021, odometerKm: 14000, price: { amount: 8400, currency: 'GBP' } },
  photo: { source: 'own', w: 1200, h: 900 },
  slots: { hook: 'Big box, small car', model: '2021 Honda N-Box', feat: 'Shipping included · 14,000 km', chip: '£8,400', grade: '4.5', pill: 'IN STOCK IN JAPAN' }, ...o,
});

test('qa: own photos also need the plates tick, without the rights warning', async () => {
  const f = await runQA(post({ cards: [card({ photo: { source: 'own', w: 1200, h: 900 }, platesChecked: false })] }));
  assert.ok(f.some((x) => x.id === 'plates-unchecked'));
  assert.ok(!f.some((x) => x.id === 'auction-photo'));
});

test('qa: stock price on the card must match the listing', async () => {
  assert.deepEqual(await ids(post({ topic: 'stock-spotlight', cards: [stockCard()] })), ['hero-photo']);
  assert.ok((await ids(post({ topic: 'stock-spotlight', cards: [stockCard({ slots: { ...stockCard().slots, chip: '£8,000' } })] }))).includes('fact-mismatch'));
});

test('qa: stock-gone when the stock car is sold or removed', async () => {
  const sold = { getStockVehicle: async () => ({ status: 'SOLD', price: { amount: 8400, currency: 'GBP' } }) };
  assert.ok((await ids(post({ topic: 'stock-spotlight', cards: [stockCard()] }), { refetch: true, source: sold })).includes('stock-gone'));
  const repriced = { getStockVehicle: async () => ({ status: 'LIVE', price: { amount: 7900, currency: 'GBP' } }) };
  assert.ok((await ids(post({ topic: 'stock-spotlight', cards: [stockCard()] }), { refetch: true, source: repriced })).includes('fact-mismatch'));
});

test('qa: overflow on the Instagram version is an error too', async () => {
  const f = await runQA(post({ cards: [card({ render: { overflow: [], igOverflow: ['bar'] } })] }));
  assert.ok(f.some((x) => x.id === 'overflow' && /Instagram/.test(x.message)));
});

test('qa: stock posts ask for a look at the hero photo', async () => {
  const f = await runQA(post({ topic: 'stock-spotlight', cards: [stockCard()] }));
  assert.ok(f.some((x) => x.id === 'hero-photo' && x.severity === 'warn'));
});

test('qa: an empty km, pill or model is a missing-fact error', async () => {
  const c = card({ facts: { ...card().facts, odometerKm: null }, slots: { ...card().slots, km: '' } });
  assert.ok((await ids(post({ cards: [c] }))).includes('missing-fact'));
});

test('qa: an unreachable site is not reported as a withdrawn lot', async () => {
  const down = { getLot: async () => { throw new Error('timeout'); } };
  const f = await ids(post(), { refetch: true, source: down });
  assert.ok(f.includes('source-unavailable'));
  assert.ok(!f.includes('lot-gone'));
});

test('qa: a photo sharpened by Gemini is flagged to compare with the original, and is no longer soft', async () => {
  const f = await runQA(post({ cards: [card({ photo: { source: 'auction', w: 2048, h: 1536, original: { w: 640, h: 480 }, enhanced: { model: 'm' } } })] }));
  assert.ok(f.some((x) => x.id === 'sharpened') && !f.some((x) => x.id === 'low-res'), f.map((x) => x.id).join(','));
  assert.match(f.find((x) => x.id === 'sharpened').message, /^Look at card 1 beside the original photo/);
  assert.match((await runQA(post({ cards: [card({ photo: { source: 'own', w: 640, h: 480 } })] })))[0].message, /Sharpen it with Gemini/);
});
