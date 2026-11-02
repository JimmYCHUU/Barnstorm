// Browser smoke test: every screen and every editor tab renders without a script error.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

process.env.CE_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-ui-'));
const { createServer } = await import('../lib/api.js');
await import('../lib/routes.js');
const { parseCategory } = await import('../lib/sources/carbarn.js');
const { market } = await import('../lib/markets.js');
const { browserPath } = await import('../lib/render.js');

const lots = parseCategory(fs.readFileSync(new URL('./fixtures/category.rsc', import.meta.url), 'utf8'), market('uk')).lots;
const png = fs.readFileSync(new URL('../assets/logos/carbarn-uk-logo.png', import.meta.url));
const deps = {
  source: {
    getCategory: async (m, slug, { page } = {}) => ({ count: lots.length, lots: page > 1 ? [] : lots }),
    getCategoryCounts: async (m, slug, dates) => ({ total: 6509, byDate: Object.fromEntries(dates.map((d) => [d, 3236])), fetchedAt: new Date().toISOString() }),
    getLot: async (m, id) => lots.find((l) => l.id === id),
    getStockList: async () => [],
  },
  cachePhoto: async () => ({ file: path.join(process.env.CE_DATA, 'p.jpg'), w: 1024, h: 768 }),
  renderCard: async (card, out) => { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, png); return { overflow: [], photo: { w: 1024, h: 768 } }; },
  // Gemini stand-in: nothing leaves the computer in tests.
  enhancePhoto: async () => { const out = path.join(process.env.CE_DATA, 'cache', 'photos', 'sharp.png'); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, png); return { file: out, w: 2048, h: 1536, model: 'stub' }; },
};

let server, base, browser, postId;
before(async () => {
  server = createServer({ deps });
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
  const res = await fetch(`${base}/api/posts`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ market: 'uk', topic: 'live-lots', params: { category: 'kei-cars' }, plannedFor: '2026-11-02' }) });
  postId = (await res.json()).id;
  browser = await chromium.launch({ executablePath: browserPath(), headless: true });
});
after(async () => { await browser?.close(); server.close(); });

async function open(hash, then, viewport = { width: 1440, height: 1000 }) {
  const ctx = await browser.newContext({ viewport });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/#/${hash}`, { waitUntil: 'networkidle' });
  if (then) await then(page);
  const text = await page.locator('#view').innerText();
  await ctx.close();
  return { errors, text };
}

for (const screen of ['feeds', 'feeds/uk', 'posts', 'plan', 'publish', 'learn', 'settings', 'today', 'review']) {
  test(`ui: ${screen} renders`, async () => {
    const r = await open(screen);
    assert.deepEqual(r.errors, []);
    assert.doesNotMatch(r.text, /Something went wrong/);
  });
}

test('ui: the post editor renders every tab and both formats', async () => {
  const r = await open(`post/${postId}`, async (page) => {
    for (const t of ['photo', 'caption', 'history', 'card']) { await page.click(`[data-tab=${t}]`); await page.waitForTimeout(150); }
    await page.click('[data-fmt=ig]'); await page.waitForTimeout(150);
    await page.click('[data-sel="1"]'); await page.waitForTimeout(150);
    await page.click('[data-tab=photo]');
    assert.equal(await page.locator('#plates').count(), 1);
  });
  assert.deepEqual(r.errors, []);
  assert.doesNotMatch(r.text, /Something went wrong/);
});

const chosenCaption = async () => { const p = await (await fetch(`${base}/api/posts/${postId}`)).json(); return p.caption[p.caption.chosen || 'a']; };
// The Windows clipboard hands line breaks back as \r\n.
const clipboard = async (page) => (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');

test('ui: a feed tile opens beside the grid, and its caption copies', async () => {
  const caption = await chosenCaption();
  const r = await open('feeds/uk', async (page) => {
    await page.click(`.tile[data-pick="${postId}"]`);
    await page.waitForSelector('#sheet [data-copy]');
    assert.equal(await page.locator(`.tile.on[data-pick="${postId}"]`).count(), 1);
    assert.equal(await page.locator('#sheet .captext').innerText(), caption);
    await page.click('#sheet [data-copy]');
    await page.waitForSelector('#sheet [data-copy].copied');
    assert.equal(await clipboard(page), caption);
  });
  assert.deepEqual(r.errors, []);
});

test('ui: a wide studio gives the caption its own column, and Copy caption copies the chosen one', async () => {
  const caption = await chosenCaption();
  const r = await open(`post/${postId}`, async (page) => {
    await page.waitForSelector('.inspector.split #captab textarea[name=a]');
    assert.equal(await page.locator('[data-tab=caption]').count(), 0);
    await page.click('#copycap');
    await page.waitForSelector('#copycap.copied');
    assert.equal(await clipboard(page), caption);
    await page.fill('#captab textarea[name=b]', 'Edited, not saved');
    await page.click('[data-copycap=b]');
    await page.waitForSelector('[data-copycap=b].copied');
    assert.equal(await clipboard(page), 'Edited, not saved');
  }, { width: 1920, height: 1080 });
  assert.deepEqual(r.errors, []);
});

test('ui: settings rotation lists categories and themes with switches', async () => {
  const r = await open('settings', async (page) => {
    await page.click('[data-t=rotation]');
    await page.waitForSelector('.rot');
    assert.ok(await page.locator('.rot').count() > 10);
    await page.click('[data-pg=ie]');
    await page.waitForSelector('[data-pg=ie].on');
  });
  assert.deepEqual(r.errors, []);
  assert.match(r.text, /Themes/);
});

test('ui: the same plate check on several cards shows as one line', async () => {
  const { flagList } = await import('../ui/lib.js');
  const msg = (n) => `Look at card ${n} for readable number plates, blur any, then tick "Plates checked".`;
  const html = flagList([1, 2, 3].map((n) => ({ severity: 'error', card: n - 1, message: msg(n) })).concat({ severity: 'warn', message: 'Something else' }));
  assert.equal((html.match(/class="flag /g) || []).length, 2);
  assert.match(html, /Look at cards 1, 2 and 3 for readable/);
});

test('ui: the Photo tab sharpens with Gemini, shows the original beside it, and can put it back', async () => {
  const r = await open(`post/${postId}`, async (page) => {
    await page.click('[data-tab=photo]');
    await page.click('[data-enhance="1"]');
    await page.waitForSelector('.compare.sharp img');
    assert.equal(await page.locator('.compare.sharp img').count(), 2);
    await page.click('[data-enhance="0"]');
    await page.waitForSelector('[data-enhance="1"]');
  });
  assert.deepEqual(r.errors, []);
});

test('ui: Settings has a place for the Gemini key and the automatic sharpening switch', async () => {
  const r = await open('settings', async (page) => {
    await page.waitForSelector('#gk');
    assert.equal(await page.locator('#gk').getAttribute('type'), 'password');
    assert.equal(await page.locator('#gauto').count(), 1);
  });
  assert.deepEqual(r.errors, []);
  assert.match(r.text, /Gemini/);
});
