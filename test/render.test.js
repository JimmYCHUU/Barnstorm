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

test('render: reports a hook too long for its chip on the photo', async () => {
  for (const format of ['square', 'ig']) {
    const r = await renderCard({ ...jimny({ hook: 'Room For The Whole Family, The Dog And Every Bag They Could Ever Want To Bring Along' }), format }, path.join(out, `f-${format}.png`));
    assert.deepEqual(r.overflow, ['hook'], format);
  }
});

test('render: Facebook fills the photo area as the template does; Instagram shows the whole photo in the middle, never zoomed in', async () => {
  const sq = await renderCard({ ...jimny(), format: 'square' }, path.join(out, 'same-square.png'));
  assert.deepEqual(sq.drawn, { left: -60, top: 0, width: 1200, height: 900 });
  const ig = await renderCard({ ...jimny(), format: 'ig' }, path.join(out, 'same-ig.png'));
  assert.deepEqual(ig.photo, { w: 1024, h: 768 });
  assert.deepEqual(ig.drawn, { left: 0, top: 195, width: 1080, height: 810 }, 'equal blurred bands of 195 px above and below');
});

test('render: "show the whole photo" puts the whole of it in the middle on Facebook too', async () => {
  const r = await renderCard({ ...jimny(), format: 'square', photo: { ...jimny().photo, fit: 'contain' } }, path.join(out, 'whole-square.png'));
  assert.deepEqual(r.drawn, { left: 0, top: 45, width: 1080, height: 810 });
});

test('render: the logo and the hook on Instagram sit in the bands, off the car and clear of a 4:5 trim; the green dot is not clipped', async () => {
  const { chromium } = await import('playwright-core');
  const { browserPath } = await import('../lib/render.js');
  const { pathToFileURL } = await import('node:url');
  const b = await chromium.launch({ executablePath: browserPath(), headless: true, args: ['--allow-file-access-from-files'] });
  try {
    for (const ig of [false, true]) {
      const page = await b.newPage({ viewport: { width: 1080, height: ig ? 1440 : 1080 } });
      await page.goto(pathToFileURL(path.join(root, 'templates/lot-card.html')).href);
      if (ig) await page.evaluate(() => document.documentElement.classList.add('ig'));
      const card = jimny();
      await page.evaluate((c) => window.draw(c), { ...card, photo: { ...card.photo, src: pathToFileURL(card.photo.file).href } });
      await page.waitForFunction(() => window.__ready === true);
      const box = (sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left }; });
      assert.ok(await page.evaluate(() => [...document.fonts].some((f) => f.family.includes('Manrope') && f.status === 'loaded')), 'Manrope loads from the bundled file');
      for (const sel of ['.model', '.tag', '.when', '.hook']) assert.match(await page.$eval(sel, (e) => getComputedStyle(e).fontFamily), /^"?Manrope/, sel);
      assert.equal(await page.$eval('.brand', (e) => getComputedStyle(e).backgroundColor), 'rgba(0, 0, 0, 0)', 'the wordmark has no plate');
      const dot = await box('.when i'), line = await box('.when');
      assert.ok(dot.left - 5 >= line.left, `the dot's 5 px glow fits inside its line (${ig ? 'ig' : 'square'})`);
      if (ig) {
        assert.equal(await page.$('img.back'), null, 'no blurred copy behind the photo');
        assert.equal(await page.$eval('.photo', (e) => getComputedStyle(e).backgroundColor), 'rgb(6, 29, 51)', 'Carbarn navy bands');
        const car = await box('img.car'), logo = await box('.brand'), hook = await box('.hook'), model = await box('.model'), chips = await box('.tag');
        assert.ok(logo.top >= 45 && logo.bottom <= car.top, JSON.stringify({ logo, car }));
        assert.ok(hook.top >= car.bottom && hook.bottom <= 1200, JSON.stringify({ hook, car }));
        assert.ok(model.top > 1200 && chips.bottom <= 1440 - 45, JSON.stringify({ model, chips }));
      }
      await page.close();
    }
  } finally { await b.close(); }
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

test('render: the logo takes the top corner away from detail (the car, an auction label) and the hook the other side; a choice made by hand wins', async () => {
  const { chromium } = await import('playwright-core');
  const { browserPath } = await import('../lib/render.js');
  const b = await chromium.launch({ executablePath: browserPath(), headless: true });
  const photo = async (busyX, tall = 150) => {   // a plain grey 1024x768 photo, with fine stripes `tall` px high in the top corners at busyX
    const page = await b.newPage();
    const url = await page.evaluate(([xs, h]) => {
      const c = Object.assign(document.createElement('canvas'), { width: 1024, height: 768 }), g = c.getContext('2d');
      g.fillStyle = '#b8bec6'; g.fillRect(0, 0, 1024, 768);
      for (const x of xs) for (let i = 0; i < 300; i += 6) { g.fillStyle = '#20262e'; g.fillRect(x + i, 0, 3, h); }
      return c.toDataURL('image/png');
    }, [[busyX].flat().filter((x) => x != null), tall]);
    await page.close();
    const f = path.join(out, `side-${[busyX].flat().join('-')}-${tall}.png`);
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
    return f;
  };
  try {
    const card = (file, side) => ({ ...jimny(), side, photo: { file, focus: { x: 50, y: 58 }, zoom: 1, blur: [] } });
    const busyRight = await photo(700), busyLeft = await photo(0), plain = await photo(null);
    assert.equal((await renderCard(card(busyRight), path.join(out, 's1.png'))).side, 'left');
    assert.equal((await renderCard({ ...card(busyRight), format: 'ig' }, path.join(out, 's1ig.png'))).side, 'left', 'Instagram follows the same corner');
    assert.equal((await renderCard(card(busyLeft), path.join(out, 's2.png'))).side, 'right');
    assert.equal((await renderCard(card(plain), path.join(out, 's3.png'))).side, 'right', 'top right when both corners are plain');
    assert.equal((await renderCard(card(busyRight, 'right'), path.join(out, 's4.png'))).side, 'right', 'a choice made by hand wins');
    const labels = await renderCard(card(await photo([0, 700], 80)), path.join(out, 's5.png'));   // auction labels in both top corners
    assert.deepEqual([labels.side, labels.low], ['right', true], 'below the labels when both top corners are busy');
    assert.equal((await renderCard(card(busyRight), path.join(out, 's6.png'))).low, false);
  } finally { await b.close(); }
});
