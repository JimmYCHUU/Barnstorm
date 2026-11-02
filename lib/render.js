// Renders card specs to 1080x1080 PNGs by driving the installed Chrome through playwright-core.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const TEMPLATES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../templates');

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  path.join(process.env.LOCALAPPDATA || '', 'ms-playwright/chromium-1234/chrome-win64/chrome.exe'),
];

let browserPromise = null;

export function browserPath() {
  const found = [process.env.CE_BROWSER, ...BROWSERS].find((p) => p && fs.existsSync(p));
  if (!found) throw new Error('No Chrome or Edge found. Install Google Chrome, or set CE_BROWSER to a Chromium-based browser.');
  return found;
}

function browser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({ executablePath: browserPath(), headless: true, args: ['--allow-file-access-from-files'] })
      .catch((e) => { browserPromise = null; throw e; });
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (browserPromise) { const b = await browserPromise.catch(() => null); browserPromise = null; if (b) await b.close(); }
}

// Crop a PNG (e.g. a 3:4 Instagram card to 4:5 for API upload).
export async function cropPng(input, output, clip) {
  const size = await import('./photos.js').then((p) => p.imageSize(fs.readFileSync(input)));
  const page = await (await browser()).newPage({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1 });
  try {
    await page.goto(pathToFileURL(input).href);
    await page.screenshot({ path: output, type: 'png', clip });
  } finally {
    await page.close();
  }
}

// card: {template, format:'square'|'ig', market, photo:{file, focus, zoom, blur, fit}, slots}. Returns {overflow:[names], photo:{w,h}, fit}.
export async function renderCard(card, outPath) {
  const H = card.format === 'ig' ? 1440 : 1080;
  const page = await (await browser()).newPage({ viewport: { width: 1080, height: H }, deviceScaleFactor: 1 });
  try {
    await page.goto(pathToFileURL(path.join(TEMPLATES, `${card.template}.html`)).href);
    const spec = { ...card, photo: { ...card.photo, src: card.photo?.file ? pathToFileURL(card.photo.file).href : '' },
      photos: (card.photos || []).map((p) => ({ ...p, src: pathToFileURL(p.file).href })) };
    if (card.format === 'ig') await page.evaluate(() => document.documentElement.classList.add('ig'));
    await page.evaluate((c) => window.draw(c), spec);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
    const overflow = await page.evaluate(() => window.measure());
    const photo = await page.evaluate(() => window.__photo || { w: 0, h: 0 });
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await page.screenshot({ path: outPath, type: 'png', clip: { x: 0, y: 0, width: 1080, height: H } });
    return { overflow, photo: { w: photo.w, h: photo.h }, fit: photo.fit };
  } finally {
    await page.close();
  }
}
