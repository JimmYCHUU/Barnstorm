import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { parseStockList, isOwnPhoto } = await import('../lib/sources/carbarn.js');
const { market } = await import('../lib/markets.js');
const { buildPost } = await import('../lib/build.js');

beforeEach(() => { process.env.CE_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-topics-')); });

const stock = parseStockList(fs.readFileSync(new URL('./fixtures/stock-list.rsc', import.meta.url), 'utf8'), market('uk'));
const deps = () => ({
  source: { getStockList: async () => stock, getStockVehicle: async (m, slug) => stock.find((s) => s.slug === slug) },
  cachePhoto: async (url) => ({ file: path.join(process.env.CE_DATA, 'p.jpg'), w: 1200, h: 900 }),
  renderCard: async (card, out) => { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, 'png'); return { overflow: [], photo: { w: 1200, h: 900 } }; },
});

test('photos: own yard photos are told apart from auction photos', () => {
  assert.equal(isOwnPhoto('https://s3-ap-southeast-2.amazonaws.com/nichibo/735989_a4914a7fec.jpg'), true);
  assert.equal(isOwnPhoto('https://www.nichibojapan.com/AuctionPictures/stock/735989F.jpg'), false);
  assert.equal(isOwnPhoto('https://photos.carbarn.com.au/pic/?system=auto&number=1'), false);
});

test('stock: own photos only, mileage on the picture and the price only in the caption, gallery cards after the hero', async () => {
  const p = await buildPost({ market: 'uk', topic: 'stock-spotlight', params: { stockSlug: '2021-honda-n-box-12051' }, plannedFor: '2026-11-04' }, deps());
  assert.ok(p.cards.length >= 2 && p.cards.length <= 4);
  assert.ok(p.cards.every((c) => c.photo.source === 'own' && c.photo.url.includes('amazonaws.com/nichibo/')));
  assert.equal(p.cards[0].slots.chip, undefined);
  assert.equal(p.cards[0].slots.km, '14,000 km');
  assert.equal(p.cards[0].slots.pill, 'IN STOCK IN JAPAN');
  assert.match(p.cards[0].slots.feat, /^Shipping included · 14,000 km/);
  assert.match(p.caption.a, /£8,400, shipping included/);
});

test('stock: auction-size shots on the stock server are skipped for yard photos', async () => {
  const d = deps();
  let n = 0;
  const seen = new Map();
  d.cachePhoto = async (url) => {
    if (!seen.has(url)) seen.set(url, n++ < 4 ? { w: 1024, h: 768 } : { w: 1600, h: 1200 });
    return { file: path.join(process.env.CE_DATA, 'p.jpg'), ...seen.get(url) };
  };
  const p = await buildPost({ market: 'uk', topic: 'stock-spotlight', params: { stockSlug: '2021-honda-n-box-12051' }, plannedFor: '2026-11-04' }, d);
  const nbox = stock.find((s) => s.slug === '2021-honda-n-box-12051');
  assert.equal(p.cards[0].photo.url, nbox.ownPhotos[4]);
  assert.ok(p.cards.every((c) => c.photo.w === 1600));
  assert.ok(p.cards[0].photoOptions.length >= 1 && !p.cards[0].photoOptions.some((u) => [...seen.entries()].find(([k, v]) => k === u && v.w === 1024)));
});

test('stock: odd grades are hidden and 0 km is not printed', async () => {
  const odd = stock.map((s) => (s.slug === '2021-honda-n-box-12051' ? { ...s, grade: '9', odometerKm: 0 } : s));
  const d = deps(); d.source.getStockList = async () => odd;
  const p = await buildPost({ market: 'uk', topic: 'stock-spotlight', params: { stockSlug: '2021-honda-n-box-12051' }, plannedFor: '2026-11-04' }, d);
  assert.equal(p.cards[0].slots.grade, '');
  assert.equal(p.cards[0].slots.km, '');
  assert.doesNotMatch(p.cards[0].slots.feat, /0 km/);
  assert.doesNotMatch(p.caption.a, /\b0 km|grade 9/);
});

test('stock: picks a car with own photos when no slug is given', async () => {
  const p = await buildPost({ market: 'uk', topic: 'stock-spotlight', params: {}, plannedFor: '2026-11-04' }, deps());
  assert.ok(p.params.stockSlug);
  assert.notEqual(p.params.stockSlug, '2021-honda-fit-12015');   // only 1 own photo
});

test('how-it-works: 4 cards, ports from the market', async () => {
  const p = await buildPost({ market: 'uk', topic: 'how-it-works', params: {}, plannedFor: '2026-11-04' }, deps());
  assert.equal(p.cards.length, 4);
  assert.match(p.cards[3].slots.body, /Southampton or Portbury/);
  assert.match(p.cards[0].slots.title, /UK buyers/);
  assert.ok(p.cards.every((c) => c.photo.source === 'own'));
});

test('market-fact: US card text equals the approved 25-year wording', async () => {
  const p = await buildPost({ market: 'us', topic: 'market-fact', params: {}, plannedFor: '2026-11-04' }, deps());
  assert.equal(p.cards.length, 1);
  assert.equal(p.cards[0].slots.body, 'Every car we list for the US is at least 25 years old, counted from its build month.');
});

test('stock: landscape yard photos come before portrait ones', async () => {
  const { yardPhotos } = await import('../lib/topics/stock.js');
  const sizes = [{ w: 900, h: 1200 }, { w: 1600, h: 1200 }];
  let i = 0;
  const d = { cachePhoto: async () => ({ file: 'x', ...sizes[i++ % 2] }) };
  const y = await yardPhotos({ ownPhotos: ['a', 'b'] }, d, 2);
  assert.deepEqual(y.map((p) => p.url), ['b', 'a']);
});

test('stock: acronyms in the features line keep their capitals', async () => {
  const awd = stock.map((s) => (s.slug === '2021-honda-n-box-12051' ? { ...s, drive: '4WD', fuel: 'Hybrid' } : s));
  const d = deps(); d.source.getStockList = async () => awd;
  const p = await buildPost({ market: 'uk', topic: 'stock-spotlight', params: { stockSlug: '2021-honda-n-box-12051' }, plannedFor: '2026-11-04' }, d);
  assert.match(p.cards[0].slots.feat, /hybrid AWD/);
});
