// Carbarn's own stock in Japan: picking cars and photos that are rights-safe.
// The stock photo server mixes two kinds: auction-house shots re-hosted at auction sizes (1024x768, 640x480: turntable
// and booth photos) and Carbarn's own phone photos from the yard (1600x1200, portrait, ...). Only the second kind is used.
import { modelName } from '../text/names.js';
import { hookCandidates, featureLine, kmLabel } from '../text/hooks.js';

const SYMBOL = { EUR: '€', GBP: '£', USD: '$' };
const GRADES = new Set(['S', '6', '5', '4.5', '4', '3.5', '3', '2', '1', 'R', 'RA']);
const AUCTION_SIZES = new Set(['1024x768', '640x480', '800x600']);

export const priceLabel = (p) => (p ? `${SYMBOL[p.currency] || p.currency + ' '}${Number(p.amount).toLocaleString('en-GB')}` : '');
export const validGrade = (g) => (GRADES.has(String(g ?? '')) ? String(g) : '');
export const isYardSize = (w, h) => !AUCTION_SIZES.has(`${w}x${h}`) && Math.max(w, h) >= 900;

// Stock objects shaped like lots, so the hook and feature writers work on them.
export function asLot(s) {
  return { ...s, sellingPoints: (s.features || []).join(', '), equipment: '', odometerKm: s.odometerKm || null,
    title: s.title?.replace(/\s+(Petrol|Hybrid|Diesel|Electric)$/i, '') };
}

export const stockFacts = (s) => ({
  id: `stock-${s.id}`, slug: s.slug, title: asLot(s).title, make: s.make, model: s.model, modelCode: s.modelCode, year: s.year,
  variant: s.variant, odometerKm: s.odometerKm || null, grade: validGrade(s.grade), seats: s.seats, fuel: s.fuel, drive: s.drive,
  transmission: s.transmission, engineCc: s.engineCc, price: s.price, url: s.url, features: s.features || [],
});

const live = (s) => s.status === 'LIVE' && !s.soldStatus && s.ownPhotos.length > 0 && s.price;
const WORKHORSE = /truck|camroad|elf|foster|rodeo|carry|hijet|dutro|canter|titan|atlas/i;

// Cheap pre-score from listing data: plenty of photos, a real grade, cars before trucks, newer first.
export function rankStock(list, used = new Set()) {
  const score = (s) => Math.min(s.ownPhotos.length, 8) / 2 + (Number(validGrade(s.grade)) || 0) + (WORKHORSE.test(s.title) ? 0 : 3)
    + Math.max(0, (s.year || 0) - (new Date().getFullYear() - 10)) / 3;
  return list.filter((s) => live(s) && !used.has(`stock-${s.id}`)).sort((a, b) => score(b) - score(a));
}

// Download photos in order until `need` yard photos are found (auction-size shots are skipped).
export async function yardPhotos(s, deps, need = 4, maxScan = 14) {
  const out = [];
  for (const url of s.ownPhotos.slice(0, maxScan)) {
    try {
      const ph = await deps.cachePhoto(url);
      if (isYardSize(ph.w, ph.h)) out.push({ url, file: ph.file, w: ph.w, h: ph.h });
    } catch { /* missing photo: skip */ }
    if (out.length >= need) break;
  }
  return [...out.filter((p) => p.w >= p.h), ...out.filter((p) => p.w < p.h)];   // landscape first: it fills a card best
}

// First ranked car that has at least `min` yard photos, with those photos.
export async function pickStock(list, deps, used, { need = 4, min = 1, tries = 6 } = {}) {
  for (const s of rankStock(list, used).slice(0, tries)) {
    const yard = await yardPhotos(s, deps, need);
    if (yard.length >= min) return { s, yard };
  }
  return null;
}

export function photoCard(s, yard, k, extra) {
  const p = yard[k] || yard[0];
  return {
    facts: stockFacts(s), photoOptions: yard.map((y) => y.url),
    photo: { url: p.url, file: p.file, w: p.w, h: p.h, source: 'own', index: yard.indexOf(p) },
    focus: { x: 50, y: 55 }, zoom: 1, blur: [], platesChecked: false, locked: [], ...extra,
  };
}

export function heroCard(s, yard, market) {
  const lot = asLot(s), hooks = hookCandidates(lot, market, null);
  const items = ['Shipping included', kmLabel(lot), ...featureLine(lot, [hooks[0]?.key]).split(' · ').map((x) => (/^[A-Z][a-z]/.test(x) ? x[0].toLowerCase() + x.slice(1) : x))]
    .filter((x) => x && x !== '0 km');
  const feat = items.reduce((acc, it) => (acc.length < 3 && [...acc, it].join(' · ').length <= 44 ? [...acc, it] : acc), []).join(' · ');
  return photoCard(s, yard, 0, {
    template: 'lot-card', kind: 'stock', stageH: 810, igStageH: 810, hookOptions: hooks, featureKeys: [hooks[0]?.key].filter(Boolean),
    // No price on the picture (Jim, 2 Nov 2026): the price is in the caption.
    slots: { hook: hooks[0]?.text || '', model: modelName(lot), feat, km: lot.odometerKm ? kmLabel(lot) : '', grade: validGrade(s.grade),
      pill: 'IN STOCK IN JAPAN', pillTone: 'stock' },
  });
}
