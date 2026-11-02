import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { modelName } from '../lib/text/names.js';
import { auctionPill, dayName } from '../lib/text/dates.js';
import { hookCandidates, featureLine, kmLabel } from '../lib/text/hooks.js';
import { parseCategory, parseLot } from '../lib/sources/carbarn.js';
import { market } from '../lib/markets.js';

const fx = (n) => fs.readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const lot = (o) => ({ make: '', model: '', modelCode: '', variant: null, sellingPoints: null, equipment: null, seats: 5,
  fuel: 'Petrol', drive: '2WD', transmission: 'Automatic', engineCc: 1500, grade: '4.5', ...o });

test('names: Jimny keeps short variant', () => {
  assert.equal(modelName(lot({ title: '2022 SUZUKI JIMNY', make: 'SUZUKI', model: 'JIMNY', year: 2022, variant: 'XC 4WD' })), '2022 Suzuki Jimny XC');
});
test('names: Mazda2 drops the repeated make', () => {
  assert.equal(modelName(lot({ title: '2025 MAZDA MAZDA2', make: 'MAZDA', model: 'MAZDA2', year: 2025, variant: '15 BD I SELECTION' })), '2025 Mazda2 15 BD');
});
test('names: R32 shows GT-R', () => {
  assert.equal(modelName(lot({ title: '1994 NISSAN SKYLINE', make: 'NISSAN', model: 'SKYLINE', modelCode: 'BNR32', year: 1994, variant: 'GT-R 4WD' })), '1994 Nissan Skyline GT-R');
});
test('names: N BOX becomes N-Box and base grade is dropped', () => {
  assert.equal(modelName(lot({ title: '2025 HONDA N BOX', make: 'HONDA', model: 'N BOX', year: 2025, variant: 'BASE GRADE' })), '2025 Honda N-Box');
});
test('names: vowel-less model codes stay upper case', () => {
  assert.equal(modelName(lot({ title: '1998 MERCEDES BENZ SLK', make: 'MERCEDES BENZ', model: 'SLK', year: 1998 })), '1998 Mercedes-Benz SLK');
});
test('names: Lancer Evolution variant reads Evo IV', () => {
  assert.equal(modelName(lot({ title: '1997 MITSUBISHI LANCER', make: 'MITSUBISHI', model: 'LANCER', year: 1997, variant: 'GSR EVOLUTION 4 4WD' })), '1997 Mitsubishi Lancer Evo IV');
});
test('names: messy feed variants are cleaned or dropped', () => {
  const n = (variant, model = 'SERENA', make = 'NISSAN', year = 2019) => modelName(lot({ title: `${year} ${make} ${model}`, make, model, year, variant }));
  assert.equal(n('E-POWER HIGHWAY STAR V'), '2019 Nissan Serena e-Power');
  assert.equal(n('EX*BLACK EDITION', 'CR-V', 'HONDA', 2021), '2021 Honda CR-V');
  assert.equal(n('20S BLACK TONE EDITION', 'CX-5', 'MAZDA', 2026), '2026 Mazda CX-5 20S');
  assert.doesNotMatch(n('T PREMIUM', 'DELICA MINI', 'MITSUBISHI', 2025), /premium/i);
});
test('names: never longer than 30 characters', () => {
  for (const l of parseCategory(fx('category.rsc'), market('uk')).lots) assert.ok(modelName(l).length <= 30, modelName(l));
});

test('dates: US pill is TUE NOV 3, UK pill is TUE 3 NOV', () => {
  assert.equal(auctionPill('2026-11-03', market('us')), 'TUE NOV 3');
  assert.equal(auctionPill('2026-11-03', market('uk')), 'TUE 3 NOV');
  assert.equal(dayName('2026-11-03'), 'Tuesday');
});

test('hooks: BNR32 gives "The original Godzilla" first', () => {
  const h = hookCandidates(lot({ make: 'NISSAN', model: 'SKYLINE', modelCode: 'BNR32', variant: 'GT-R 4WD', year: 1994 }), market('us'), 'sports');
  assert.equal(h[0].text, 'The original Godzilla');
  assert.equal(h[0].source, 'model-library');
});
test('hooks: Raize with selling point "One owner" offers "Just one owner"', () => {
  const h = hookCandidates(lot({ make: 'TOYOTA', model: 'RAIZE', fuel: 'Hybrid', sellingPoints: 'One owner, Genuine 9-inch DA / Full segment TV, BSM / Front and rear drive recorder, Panoramic view monitor' }), market('cy'), 'hybrid');
  assert.ok(h.some((x) => x.text === 'Just one owner'), JSON.stringify(h));
});
test('hooks: a seven-seat Sienta gets its approved hook', () => {
  const h = hookCandidates(lot({ make: 'TOYOTA', model: 'SIENTA', seats: 7 }), market('ie'), 'family-7-seaters');
  assert.equal(h[0].text, 'Small car, seven seats');
});
test('hooks: every candidate <= 22 chars and at most 3', () => {
  const lots = [...parseCategory(fx('category.rsc'), market('uk')).lots, parseLot(fx('lot.rsc'), market('uk'))];
  for (const l of lots) {
    const h = hookCandidates(l, market('uk'), 'kei-cars');
    assert.ok(h.length >= 1 && h.length <= 3);
    for (const x of h) assert.ok(x.text.length <= 22, x.text);
  }
});

test('hooks: featureLine never exceeds 44 chars', () => {
  const lots = [...parseCategory(fx('category.rsc'), market('uk')).lots, parseLot(fx('lot.rsc'), market('uk'))];
  for (const l of lots) {
    const f = featureLine(l, []);
    assert.ok(f.length > 0 && f.length <= 44, `${l.title}: ${f}`);
  }
});
test('hooks: featureLine for the Jimny reads like the approved card', () => {
  assert.equal(featureLine(parseLot(fx('lot.rsc'), market('uk')), []), '4WD · heated seats · LED headlights');
});
test('hooks: featureLine skips the feature already in the hook', () => {
  const taft = lot({ make: 'DAIHATSU', model: 'TAFT', engineCc: 660, equipment: 'PS P 2 airbag ABS AW SR written guarantee' });
  const h = hookCandidates(taft, market('uk'), 'kei-cars')[0];
  assert.equal(h.text, 'Look up: glass roof');
  assert.doesNotMatch(featureLine(taft, [h.key]), /roof/i);
});
test('hooks: "Type R" hook only for Hondas', () => {
  const subaru = hookCandidates(lot({ make: 'SUBARU', model: 'LEGACY TOURING WAGON', variant: 'TS TYPE R' }), market('us'), 'sports');
  assert.ok(!subaru.some((h) => /Type R/.test(h.text)), JSON.stringify(subaru));
  const honda = hookCandidates(lot({ make: 'HONDA', model: 'INTEGRA', variant: 'TYPE R' }), market('us'), 'sports');
  assert.equal(honda[0].text, 'A genuine Type R');
});
test('hooks: Figaro features show turbo and leather seat covers, not the roof again', () => {
  const figaro = lot({ make: 'NISSAN', model: 'FIGARO', variant: 'OPEN TOP TURBO', engineCc: 1000, seats: 4,
    sellingPoints: 'Open top (Opening/closing OK during import), Genuine leather seat covers, Interior partial reupholstering completed' });
  const h = hookCandidates(figaro, market('us'), 'sports')[0];
  assert.equal(featureLine(figaro, [h.key]), 'Turbo · leather seat covers · 1.0 petrol');
  assert.equal(featureLine(figaro, []), 'Open top · turbo · leather seat covers');
});
test('hooks: kmLabel formats with thousands separator', () => {
  assert.equal(kmLabel({ odometerKm: 155000 }), '155,000 km');
});

test('dates: today() uses the local calendar date', async () => {
  const { today } = await import('../lib/text/dates.js');
  const d = new Date(2026, 10, 2, 1, 0);   // 1 am on 2 Nov, local time
  assert.equal(today(d), '2026-11-02');
});

test('case: every word on a picture starts with a capital, and nothing else changes', async () => {
  const { capitalWords } = await import('../lib/text/case.js');
  const cases = [
    ['Room for seven', 'Room For Seven'],
    ['Pocket-sized 4x4', 'Pocket-Sized 4x4'],
    ['4WD · alloy wheels · 2.5 diesel', '4WD · Alloy Wheels · 2.5 Diesel'],
    ['Look up: glass roof', 'Look Up: Glass Roof'],
    ["Japan's car auctions, open to UK buyers", "Japan's Car Auctions, Open To UK Buyers"],
    ['6-speed manual · 660cc · low km', '6-Speed Manual · 660cc · Low km'],
    ['A-grade inside and out', 'A-Grade Inside And Out'],
    ['"the original" Godzilla', '"The Original" Godzilla'],
    ['hybrid AWD · 8 seats', 'Hybrid AWD · 8 Seats'],
    ['', ''],
  ];
  for (const [from, to] of cases) assert.equal(capitalWords(from), to, from);
});

test('case: captions turn card capitals back into a sentence, keeping short forms and brands', async () => {
  const { sentenceWords } = await import('../lib/text/case.js');
  assert.equal(sentenceWords('Alloy Wheels'), 'alloy wheels');
  assert.equal(sentenceWords('Sat Nav & TV'), 'sat nav & TV');
  assert.equal(sentenceWords('4WD · 6-Speed Manual · Leather Seats'), '4WD · 6-speed manual · leather seats');
  assert.equal(sentenceWords('Recaro Seats', /^Recaro/), 'Recaro seats');
  const { carList } = await import('../lib/text/captions.js');
  const card = (make, model, feat) => ({ facts: { make, model, year: 1994 }, slots: { feat } });
  assert.match(carList([card('TOYOTA', 'CARINA ED', 'Alloy Wheels · 2.0 Petrol · Automatic')]), /with alloy wheels$/);
});

