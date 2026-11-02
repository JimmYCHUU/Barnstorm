// A card for one auction lot, in the approved lot-card layout.
import { photoUrl } from '../sources/carbarn.js';
import { modelName } from '../text/names.js';
import { auctionPill } from '../text/dates.js';
import { hookCandidates, featureLine, kmLabel } from '../text/hooks.js';

export const FACT_FIELDS = ['id', 'title', 'make', 'model', 'modelCode', 'year', 'auctionDate', 'auctionHouse', 'lotNumber', 'odometerKm',
  'grade', 'interiorGrade', 'exteriorGrade', 'fuel', 'engineCc', 'drive', 'transmission', 'seats', 'variant', 'regDate',
  'sellingPoints', 'equipment', 'inspectorNotes', 'repairHistory', 'photos', 'url'];

export const factsOf = (lot) => Object.fromEntries(FACT_FIELDS.map((k) => [k, lot[k] ?? null]));

// Auction photos: number=0 is the auction sheet, so the picker starts at number=1.
export const lotPhotos = (lot) => (lot.photos || []).filter((u) => !/[?&]number=0(&|$)/.test(u));

export async function makeLotCard(lot, market, categorySlug, deps, photoIndex = 0) {
  const hooks = hookCandidates(lot, market, categorySlug);
  const url = photoUrl(lotPhotos(lot)[photoIndex] || lot.mainPhoto || lot.photos[0]);
  const ph = await deps.cachePhoto(url);
  return {
    template: 'lot-card', kind: 'lot', stageH: 810, igStageH: 810,
    facts: factsOf(lot), hookOptions: hooks, featureKeys: [hooks[0]?.key].filter(Boolean),
    photo: { url, file: ph.file, w: ph.w, h: ph.h, source: 'auction', index: photoIndex },
    focus: { x: 50, y: 58 }, zoom: 1, blur: [], platesChecked: false, locked: [],
    slots: {
      hook: hooks[0]?.text || '', model: modelName(lot), feat: featureLine(lot, [hooks[0]?.key]), km: kmLabel(lot),
      grade: lot.grade ? String(lot.grade) : '', pill: `LIVE AUCTION · ${auctionPill(lot.auctionDate, market)}`,
    },
  };
}

// Within one post, give each card its own hook where an alternative exists (recomputing the features line to match).
export function varyHooks(cards) {
  const used = new Set();
  for (const c of cards) {
    if (used.has(c.slots.hook)) {
      const alt = (c.hookOptions || []).find((o) => !used.has(o.text));
      if (alt) {
        c.slots.hook = alt.text;
        c.featureKeys = [alt.key].filter(Boolean);
        c.slots.feat = featureLine(c.facts, [alt.key]);
      }
    }
    used.add(c.slots.hook);
  }
  return cards;
}
