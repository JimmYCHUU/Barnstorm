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

test('render: reports overflow for a car name far too long for the bar', async () => {
  const r = await renderCard(jimny({ model: '2019 Toyota Alphard Hybrid Executive Lounge S Package Black Edition' }), path.join(out, 'c.png'));
  assert.ok(r.overflow.includes('model'), JSON.stringify(r.overflow));
});

test('render: reports overflow when the line on the right runs into the chips even when set smaller', async () => {
  const r = await renderCard(jimny({ pill: 'Live Auction · Wednesday 4 November At The USS Tokyo Auction Hall' }), path.join(out, 'd.png'));
  assert.ok(r.overflow.includes('when'), JSON.stringify(r.overflow));
});

test('render: the hook is drawn; no features line, price or web address on the picture', async () => {
  const html = fs.readFileSync(path.join(root, 'templates/lot-card.html'), 'utf8');
  assert.match(html, /s\.hook/);
  assert.doesNotMatch(html, /s\.feat|s\.chip|www\.|carbarn\.\w/);
});

test('render: reports a hook that needs a third line on Instagram', async () => {
  const r = await renderCard({ ...jimny({ hook: 'Room For The Whole Family And Every Bag They Could Ever Want To Bring' }), format: 'ig' }, path.join(out, 'f.png'));
  assert.ok(r.overflow.includes('hook'), JSON.stringify(r.overflow));
  assert.equal(r.overflow.filter((o) => o === 'hook').length, 1, 'reported once');
});

test('render: a 4:3 photo shows whole on both formats, nothing cut off', async () => {
  for (const format of ['square', 'ig']) {
    const r = await renderCard({ ...jimny(), format }, path.join(out, `whole-${format}.png`));
    assert.deepEqual(r.photo, { w: 1024, h: 768 });
    assert.deepEqual(r.drawn, { left: 0, top: 0, width: 1080, height: 810 }, format);
  }
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

test('render: a car name a little too long is set smaller instead of failing (Instagram)', async () => {
  const r = await renderCard({ ...jimny({ model: '1995 Mazda Bongo Brawny Van V', km: '206,000 km' }), format: 'ig' }, path.join(out, 'long-model.png'));
  assert.deepEqual(r.overflow, []);
});

test('render: a four-corner blur box blurs only inside its corners', async () => {
  const { chromium } = await import('playwright-core');
  const { browserPath } = await import('../lib/render.js');
  const { pathToFileURL } = await import('node:url');
  const b = await chromium.launch({ executablePath: browserPath(), headless: true, args: ['--allow-file-access-from-files'] });
  try {
    const page = await b.newPage({ viewport: { width: 1080, height: 1080 } });
    await page.goto(pathToFileURL(path.join(root, 'templates/lot-card.html')).href);
    const card = jimny();
    const blur = [{ x: 10, y: 60, w: 20, h: 10, pts: [{ x: 10, y: 62 }, { x: 30, y: 60 }, { x: 30, y: 70 }, { x: 10, y: 68 }] }, { x: 50, y: 50, w: 10, h: 5 }];
    await page.evaluate((c) => window.draw(c), { ...card, photo: { ...card.photo, src: pathToFileURL(card.photo.file).href, blur } });
    await page.waitForFunction(() => window.__ready === true);
    const clips = await page.$$eval('.blur', (els) => els.map((e) => e.style.clipPath));
    assert.equal(clips[0], 'polygon(0% 20%, 100% 0%, 100% 100%, 0% 80%)');
    assert.equal(clips[1], '', 'an older box stays a plain box');
  } finally { await b.close(); }
});
