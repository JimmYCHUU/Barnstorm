import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captionsFor } from '../lib/text/captions.js';
import { checkCopy } from '../lib/text/rules.js';
import { market, MARKET_KEYS } from '../lib/markets.js';

const card = (make, model, feat, hook = 'Pocket-sized 4x4') => ({
  facts: { make, model, title: `2022 ${make} ${model}`, year: 2022, odometerKm: 7000, grade: '5', auctionDate: '2026-11-03' },
  slots: { hook, model: `2022 ${make} ${model}`, feat, km: '7,000 km' }, featureKeys: [],
});
const livePost = (m) => ({
  market: m, topic: 'live-lots', plannedFor: '2026-11-02',
  params: { category: market(m).categories[0].slug },
  counts: { total: 6509, byDate: { '2026-11-03': 3236, '2026-11-04': 1147 }, firstDate: '2026-11-03' },
  cards: [card('SUZUKI', 'JIMNY', '4WD · heated seats · LED headlights'), card('DAIHATSU', 'COPEN', 'Electric roof · Recaro seats · manual'),
    card('DAIHATSU', 'TAFT', 'Sunroof · alloy wheels · 4 seats'), card('MITSUBISHI', 'DELICA MINI', 'Turbo · 4WD · 4 seats')],
});

test('captions: US A carries the 25-year wording', () => {
  const c = captionsFor(livePost('us'), market('us'));
  assert.match(c.a, /at least 25 years old, counted from its build month/);
  assert.match(c.a, /^3,236 JDM sports cars go under the hammer in Japan on Tuesday/);
});

test('captions: no caption contains a banned phrase for any market', () => {
  for (const k of MARKET_KEYS) {
    const c = captionsFor(livePost(k), market(k));
    for (const t of [c.a, c.b]) assert.deepEqual(checkCopy(t, market(k)).filter((x) => x.severity === 'error'), [], `${k}: ${t}`);
  }
});

test('captions: US uses "favorites", UK uses "favourites"', () => {
  assert.match(captionsFor(livePost('us'), market('us')).b, /Swipe for four favorites/);
  assert.match(captionsFor(livePost('uk'), market('uk')).b, /favourites/);
});

test('captions: names the four cars with a detail and the category link', () => {
  const a = captionsFor(livePost('uk'), market('uk')).a;
  assert.match(a, /Four we'd look at first: a Suzuki Jimny with heated seats, a Daihatsu Copen with an electric roof, a Daihatsu Taft with a sunroof and a Mitsubishi Delica Mini\./);
  assert.match(a, /carbarn\.uk\/live-auction\/kei-cars/);
  assert.match(a, /Shipped RoRo to Southampton or Portbury/);
});

test('captions: at most 5 hashtags', () => {
  for (const k of MARKET_KEYS) assert.ok((captionsFor(livePost(k), market(k)).a.match(/#\w+/g) || []).length <= 5);
});

test('rules: "this week" flagged as error', () => {
  assert.equal(checkCopy('Lots going under the hammer this week', market('uk'))[0].severity, 'error');
});

test('rules: IE "people mover" flagged with the right term', () => {
  const r = checkCopy('400 people movers live today', market('ie'));
  assert.equal(r[0].rule, 'term');
  assert.equal(r[0].suggestion, 'people carriers');
});

test('rules: JEVIC only allowed for Malta, COF never for Malta', () => {
  assert.equal(checkCopy('JEVIC certificate arranged', market('uk')).length, 1);
  assert.equal(checkCopy('JEVIC certificate arranged', market('mt')).length, 0);
  assert.equal(checkCopy('COF arranged', market('mt')).length, 1);
});

test('rules: "best" flagged but "bestseller" is not', () => {
  assert.equal(checkCopy('the best car', market('uk')).length, 1);
  assert.equal(checkCopy('a bestseller', market('uk')).length, 0);
});

test('rules: spelling slip is a warning', () => {
  const r = checkCopy('four favourites', market('us'));
  assert.equal(r[0].severity, 'warn');
  assert.equal(r[0].suggestion, 'favorites');
});

test('captions: a themed collection uses its own noun, link and hashtag', () => {
  const p = { ...livePost('uk'), params: { category: 'manual' } };
  const c = captionsFor(p, market('uk'));
  assert.match(c.a, /^3,236 manual-gearbox cars go under the hammer in Japan on Tuesday/);
  assert.match(c.a, /carbarn\.uk\/live-auction\?transmission=Manual/);
  assert.match(c.a, /#SaveTheManuals/);
});
