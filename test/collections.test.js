import { test } from 'node:test';
import assert from 'node:assert/strict';
import { market } from '../lib/markets.js';
import { collection, collections, collectionUrl, themeList } from '../lib/collections.js';

test('collections: site categories and themes share one shape', () => {
  const kei = collection(market('uk'), 'kei-cars');
  assert.equal(kei.label, 'Kei Cars');
  assert.equal(collectionUrl(market('uk'), kei), 'https://www.carbarn.uk/live-auction/kei-cars');
  const manual = themeList().find((t) => t.key === 'manual');
  assert.equal(collectionUrl(market('uk'), manual, { date: '2026-11-04', page: 2 }), 'https://www.carbarn.uk/live-auction?transmission=Manual&auctionDate=2026-11-04&page=2');
  const jimny = themeList().find((t) => t.key === 'jimny');
  assert.equal(collectionUrl(market('uk'), jimny), 'https://www.carbarn.uk/live-auction/suzuki/jimny');
});

test('collections: year placeholders are filled in', () => {
  const nn = themeList({ year: 2026 }).find((t) => t.key === 'nearly-new');
  assert.equal(nn.query, 'yearFrom=2025');
  assert.equal(nn.noun, 'cars from 2025 on');
});

test('collections: a Page offers its site categories plus its enabled themes, without duplicates', () => {
  const list = collections(market('uk'));
  assert.ok(list.some((c) => c.key === 'kei-cars' && c.kind === 'category'));
  assert.equal(new Set(list.map((c) => c.key)).size, list.length);
  assert.ok(list.every((c) => c.label && c.noun));
});

test('collections: an unknown key for a Page throws a readable error', () => {
  assert.throws(() => collection(market('cy'), 'jdm-classics-nope'), /has no category or theme/);
});
