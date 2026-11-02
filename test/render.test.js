import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCard, closeBrowser } from '../lib/render.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jimnyPhoto = path.resolve(root, '../posts/carbarn-united-kingdom/2026-11-kei-cars/template/lot-2723320.jpg');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-render-'));
after(() => closeBrowser());

const uk = { key: 'uk', brand: 'Carbarn United Kingdom', lang: 'en-GB', logo: 'carbarn-uk-logo.png' };
const jimny = (slots = {}) => ({
  template: 'lot-card', market: uk,
  photo: { file: jimnyPhoto, focus: { x: 50, y: 58 }, zoom: 1, blur: [] },
  slots: { hook: 'Pocket-sized 4x4', model: '2022 Suzuki Jimny XC', feat: '4WD · heated seats · LED headlights',
    km: '7,000 km', grade: '5', pill: 'LIVE AUCTION · WED 4 NOV', ...slots },
});

const pngSize = (file) => { const b = fs.readFileSync(file); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };

test('render: lot card is 1080x1080', async () => {
  const f = path.join(out, 'a.png');
  await renderCard(jimny(), f);
  assert.deepEqual(pngSize(f), { w: 1080, h: 1080 });
});

test('render: no overflow for approved UK Jimny card', async () => {
  const r = await renderCard(jimny(), path.join(out, 'b.png'));
  assert.deepEqual(r.overflow, []);
  assert.deepEqual(r.photo, { w: 1024, h: 768 });
});

test('render: reports overflow for 40-char hook', async () => {
  const r = await renderCard(jimny({ hook: 'A very long hook that cannot fit at all!' }), path.join(out, 'c.png'));
  assert.ok(r.overflow.includes('hook'), JSON.stringify(r.overflow));
});

test('render: reports overflow when features run into the km pill', async () => {
  const r = await renderCard(jimny({ feat: 'Electric roof · Recaro seats · Bilstein suspension · MOMO wheel' }), path.join(out, 'd.png'));
  assert.ok(r.overflow.includes('feat'), JSON.stringify(r.overflow));
});

test('render: Instagram version is 1080x1440 with no overflow', async () => {
  const f = path.join(out, 'ig.png');
  const r = await renderCard({ ...jimny(), format: 'ig' }, f);
  assert.deepEqual(pngSize(f), { w: 1080, h: 1440 });
  assert.deepEqual(r.overflow, []);
});

test('render: Instagram contain-fit shows the whole photo', async () => {
  const r = await renderCard({ ...jimny(), format: 'ig', photo: { ...jimny().photo, fit: 'contain' } }, path.join(out, 'ig2.png'));
  assert.deepEqual(r.overflow, []);
  assert.equal(r.fit, 'contain');
});
