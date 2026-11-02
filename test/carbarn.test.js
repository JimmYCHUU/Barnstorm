import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extractObjects } from '../lib/util/rsc.js';
import { parseCategory, parseLot, parseStockList, fetchRsc, SourceError, photoUrl, lotUrl } from '../lib/sources/carbarn.js';
import { market } from '../lib/markets.js';

const fx = (n) => fs.readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');

test('rsc: extracts 24 vehicles from category fixture', () => {
  const ids = new Set(extractObjects(fx('category.rsc'), 'vehicle').map((v) => v.id));
  assert.equal(ids.size, 24);
});

test('carbarn: category fixture count is 3236 with cut-off time', () => {
  const c = parseCategory(fx('category.rsc'), market('uk'));
  assert.equal(c.count, 3236);
  assert.equal(c.lots.length, 24);
  assert.equal(c.cutoffUtc, '2026-11-01T22:00:00Z');
  assert.equal(c.lots[0].id, '2703737');
  assert.equal(c.lots[0].auctionDate, '2026-11-03');
});

test('carbarn: lot fixture maps the Jimny', () => {
  const l = parseLot(fx('lot.rsc'), market('uk'));
  assert.equal(l.id, '2723320');
  assert.equal(l.odometerKm, 7000);
  assert.equal(l.grade, '5');
  assert.match(l.sellingPoints, /Seat Heater/);
  assert.equal(l.regDate, '2022-04');
  assert.equal(l.seats, 4);
  assert.equal(l.interiorGrade, 'A');
  assert.equal(l.photos.length, 12);
  assert.equal(l.url, 'https://www.carbarn.uk/live-auction/suzuki/jimny/jb64w/2723320');
});

test('carbarn: stock list fixture has 8 cars with own photos split out', () => {
  const s = parseStockList(fx('stock-list.rsc'), market('ie'));
  assert.equal(s.length, 8);
  const nbox = s.find((v) => v.slug === '2021-honda-n-box-12051');
  assert.ok(nbox.ownPhotos.length > 0);
  assert.ok(nbox.ownPhotos.every((u) => u.includes('amazonaws.com/nichibo/')));
  assert.ok(nbox.auctionPhotos.every((u) => u.includes('nichibojapan.com')));
});

test('carbarn: photoUrl asks for the largest size', () => {
  assert.equal(photoUrl('https://photos.carbarn.com.au/pic/?system=auto&date=2026-11-04&auct=37&bid=74&number=1'),
    'https://photos.carbarn.com.au/pic/?system=auto&date=2026-11-04&auct=37&bid=74&number=1&h=900&w=1600');
});

test('carbarn: lotUrl builds the public lot link', () => {
  assert.equal(lotUrl(market('mt'), { id: '2718697', make: 'MAZDA', model: 'MAZDA2', modelCode: 'DJLFS' }),
    'https://www.carbarn.mt/live-auction/mazda/mazda2/djlfs/2718697');
});

test('carbarn: non-RSC response throws SourceError', async () => {
  const html = async () => new Response('<!DOCTYPE html><html></html>', { status: 200 });
  await assert.rejects(fetchRsc('https://www.carbarn.uk/x', html), SourceError);
  const down = async () => new Response('oops', { status: 503 });
  await assert.rejects(fetchRsc('https://www.carbarn.uk/x', down), /503/);
});

test('carbarn: a page for a different lot is refused as not found', () => {
  assert.throws(() => parseLot(fx('lot.rsc'), market('uk'), '9999999'), (e) => e instanceof SourceError && e.notFound === true);
  assert.equal(parseLot(fx('lot.rsc'), market('uk'), '2723320').id, '2723320');
});
