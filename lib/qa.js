// Automatic checks on a post. Errors block approval; warnings need a glance.
import { market as getMarket } from './markets.js';
import { checkCopy } from './text/rules.js';
import { kmLabel } from './text/hooks.js';
import { auctionPill } from './text/dates.js';
import { kmSuspect } from './pick.js';
import { priceLabel } from './topics/stock.js';

const PLACEHOLDER = /\bundefined\b|\bnull\b|\bNaN\b|\{\w+\}|\bTBD\b/;
const ORDER = { error: 0, warn: 1, info: 2 };

// opts: {base: flags from the build, refetch: re-read each lot, source: {getLot}, used: Set of lot ids in other posts,
//        approving: run approval-only checks, now: Date}
export async function runQA(post, opts = {}) {
  const m = getMarket(post.market), flags = [...(opts.base || [])];
  const add = (id, severity, message, card) => flags.push({ id, severity, message, ...(card != null ? { card } : {}) });
  const year = (opts.now || new Date()).getFullYear();
  const n = (i) => `card ${i + 1}`;

  for (const [i, c] of (post.cards || []).entries()) {
    const f = c.facts || {};
    for (const o of c.render?.overflow || []) add('overflow', 'error', `The ${o} text does not fit on ${n(i)}. Shorten it.`, i);
    for (const o of c.render?.igOverflow || []) add('overflow', 'error', `The ${o} text does not fit on the Instagram version of ${n(i)}. Shorten it.`, i);

    if (c.kind === 'lot') {
      for (const k of ['km', 'pill', 'model']) if (!String(c.slots?.[k] || '').trim()) add('missing-fact', 'error', `${n(i)} has no ${k === 'km' ? 'mileage' : k}. The listing data is incomplete: swap the lot or fill it in.`, i);
      if (c.slots.km !== kmLabel(f)) add('fact-mismatch', 'error', `${n(i)} says "${c.slots.km}" but the listing says ${kmLabel(f)}.`, i);
      if (String(c.slots.grade || '') !== String(f.grade || '')) add('fact-mismatch', 'error', `${n(i)} shows grade ${c.slots.grade} but the listing says ${f.grade}.`, i);
      if (f.auctionDate && !String(c.slots.pill || '').includes(auctionPill(f.auctionDate, m))) {
        add('fact-mismatch', 'error', `${n(i)} pill should say ${auctionPill(f.auctionDate, m)}.`, i);
      }
      if (f.auctionDate && f.auctionDate <= post.plannedFor) add('auction-past', 'error', `${n(i)} auctions on ${f.auctionDate}, on or before the post date ${post.plannedFor}. Swap the lot.`, i);
      if (opts.used?.has(String(f.id))) add('duplicate-lot', 'warn', `${n(i)} (lot ${f.id}) is already in another post.`, i);
      if (kmSuspect(f, year)) add('km-suspect', 'warn', `${n(i)} reads ${kmLabel(f)} on a ${f.year} car. The site sometimes shows 1,000 km as a placeholder: check the auction sheet.`, i);
      if (m.key === 'us' && f.year > year - 25) add('us-age', 'error', `${n(i)} is a ${f.year} car: under 25 years old.`, i);
      else if (m.key === 'us' && f.year === year - 25) add('us-age', 'warn', `${n(i)} is a ${f.year} car: check its build month is 25+ years ago.`, i);
      if (m.key === 'cy' && f.year && f.year <= year - 4) add('cy-age', 'warn', `${n(i)} is a ${f.year} car, close to Cyprus's five-year limit. Check its build date.`, i);

      if (opts.refetch && opts.source && f.id) {
        try {
          const now = await opts.source.getLot(m, f.id);
          const diffs = [];
          if (now.odometerKm !== f.odometerKm) diffs.push(`km ${kmLabel(f)} → ${kmLabel(now)}`);
          if (String(now.grade) !== String(f.grade)) diffs.push(`grade ${f.grade} → ${now.grade}`);
          if (now.auctionDate !== f.auctionDate) diffs.push(`auction ${f.auctionDate} → ${now.auctionDate}`);
          if (diffs.length) add('fact-mismatch', 'error', `Listing for ${n(i)} changed: ${diffs.join(', ')}. Swap or rebuild the card.`, i);
        } catch (e) {
          if (e.notFound) add('lot-gone', 'error', `Lot ${f.id} on ${n(i)} is no longer listed. Swap it.`, i);
          else add('source-unavailable', 'error', `Could not reach ${m.site} to re-check lot ${f.id} (${e.message}). Try again shortly.`, i);
        }
      }
    }

    if (c.kind === 'stock') {
      for (const k of ['chip', 'model']) if (!String(c.slots?.[k] || '').trim()) add('missing-fact', 'error', `${n(i)} has no ${k === 'chip' ? 'price' : k}.`, i);
      if (c.slots.chip !== priceLabel(f.price)) add('fact-mismatch', 'error', `${n(i)} price says "${c.slots.chip}" but the listing says ${priceLabel(f.price)}.`, i);
      if (c.slots.feat && f.odometerKm != null && /\d km/.test(c.slots.feat) && !c.slots.feat.includes(kmLabel(f))) {
        add('fact-mismatch', 'error', `${n(i)} mileage should read ${kmLabel(f)}.`, i);
      }
    }
    if (c.kind === 'stock' && opts.refetch && opts.source?.getStockVehicle && f.slug) {
      try {
        const now = await opts.source.getStockVehicle(m, f.slug);
        if (now.status !== 'LIVE' || now.soldStatus) add('stock-gone', 'error', `${f.title || 'This stock car'} is no longer for sale (${now.soldStatus || now.status}).`, i);
        else if (priceLabel(now.price) !== priceLabel(f.price)) add('fact-mismatch', 'error', `Stock price changed: ${priceLabel(f.price)} → ${priceLabel(now.price)}. Rebuild the post.`, i);
      } catch (e) {
        if (e.notFound) add('stock-gone', 'error', `${f.title || 'This stock car'} is no longer listed.`, i);
        else add('source-unavailable', 'error', `Could not reach ${m.site} to re-check this stock car (${e.message}). Try again shortly.`, i);
      }
    }

    if (['auction', 'own'].includes(c.photo?.source) && !c.platesChecked) add('plates-unchecked', 'error', `Look at ${n(i)} for readable number plates, blur any, then tick "Plates checked".`, i);
    if (c.photo?.w && c.photo.w < 1000) add('low-res', 'warn', `${n(i)} photo is ${c.photo.w}px wide and will look soft. Sharpen it with Gemini or try another photo (Photo tab).`, i);
    if (c.photo?.enhanced) add('sharpened', 'warn', `Look at ${n(i)} beside the original photo (Photo tab): Gemini sharpened the picture, so check the car still looks exactly as it is.`, i);
    for (const [slot, text] of Object.entries(c.slots || {})) {
      if (PLACEHOLDER.test(String(text))) add('placeholder', 'error', `${n(i)} ${slot} contains placeholder text.`, i);
      for (const r of checkCopy(text, m)) flags.push(copyFlag(r, `${n(i)} ${slot}`, i));
    }
  }

  if (post.topic === 'stock-spotlight') {
    add('hero-photo', 'warn', "Check that card 1 shows the outside of the car (Carbarn's yard photos are not sorted), and that no card shows a chassis number. Swap photos in the Photo tab.", 0);
  }
  if ((post.cards || []).some((c) => c.photo?.source === 'auction')) {
    add('auction-photo', 'warn', 'Auction-house photos: auction houses ban reposting their photos on social. Confirm permission before posting.');
  }

  for (const k of ['a', 'b']) {
    const text = post.caption?.[k];
    if (!text) continue;
    const label = `Caption ${k.toUpperCase()}`;
    if (PLACEHOLDER.test(text)) add('placeholder', 'error', `${label} contains placeholder text.`);
    for (const r of checkCopy(text, m)) flags.push(copyFlag(r, label));
    if (k === (post.caption.chosen || 'a')) {
      if (text.length > 2200) add('caption-length', 'error', `${label} is ${text.length} characters; Instagram allows 2,200.`);
      const tags = (text.match(/#\w+/g) || []).length;
      if (tags > 30) add('hashtags', 'error', `${label} has ${tags} hashtags; Instagram allows 30.`);
      else if (tags > 5) add('hashtags', 'warn', `${label} has ${tags} hashtags; keep it to 5.`);
    }
  }

  if (opts.approving && post.counts?.fetchedAt) {
    const hours = ((opts.now || new Date()) - new Date(post.counts.fetchedAt)) / 3600e3;
    if (hours > 12) add('counts-stale', 'warn', `Lot counts are ${Math.round(hours)} hours old. Rebuild the caption on the day you post.`);
  }

  return dedupe(flags).sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}

function copyFlag(r, where, card) {
  const id = r.rule === 'spelling' ? 'spelling' : 'banned-phrase';
  const fix = r.suggestion ? ` Use "${r.suggestion}".` : r.why ? ` ${r.why}` : '';
  return { id, severity: r.severity, message: `${where}: "${r.phrase}".${fix}`, ...(card != null ? { card } : {}) };
}

function dedupe(flags) {
  const seen = new Set();
  return flags.filter((f) => { const k = `${f.id}|${f.card}|${f.message}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

export const blocking = (flags) => (flags || []).filter((f) => f.severity === 'error');
