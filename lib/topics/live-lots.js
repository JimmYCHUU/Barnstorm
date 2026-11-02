// Topic "live-lots": N lot cards from one category, auctioning in the days after the post goes out.
import { UserError } from '../errors.js';
import { collection } from '../collections.js';
import { addDays } from '../text/dates.js';
import { pickLots, scoreLot } from '../pick.js';
import { makeLotCard, lotPhotos, varyHooks } from './lot-card.js';
import { photoUrl } from '../sources/carbarn.js';

const DAYS_AHEAD = 4, PAGES_PER_DAY = 2, DETAIL = 12;

export async function findLots({ market, coll, plannedFor, deps, used, want }) {
  const dates = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(plannedFor, i + 1));
  const seen = new Map();
  for (const date of dates) {
    for (let page = 1; page <= PAGES_PER_DAY; page++) {
      const r = await deps.source.getCategory(market, coll, { date, page });
      const before = seen.size;
      for (const l of r.lots) if (l.auctionDate > plannedFor) seen.set(l.id, l);
      if (seen.size === before) break;
    }
  }
  const listed = [...seen.values()];
  if (!listed.length) throw new UserError(`No eligible lots in ${coll.label} auctioning ${dates[0]} to ${dates.at(-1)}`);

  // Full detail (selling points, grades) and photo size for a strong but varied shortlist, 4 lots at a time.
  const top = pickLots(listed, DETAIL, { used });
  const detailed = [], photoWidth = {};
  for (let i = 0; i < top.length; i += 4) {
    await Promise.all(top.slice(i, i + 4).map(async (l) => {
      try {
        const full = await deps.source.getLot(market, l.id);
        const first = lotPhotos(full)[0];
        if (first) photoWidth[full.id] = (await deps.cachePhoto(photoUrl(first))).w;
        detailed.push(full);
      } catch { /* lot withdrawn mid-build: skip it */ }
    }));
  }
  const picked = pickLots(detailed, want, { used, photoWidth });
  const pickedIds = new Set(picked.map((l) => l.id));
  const candidates = detailed.filter((l) => !pickedIds.has(l.id))
    .map((l) => ({ id: l.id, title: l.title, grade: l.grade, auctionDate: l.auctionDate, odometerKm: l.odometerKm, photo: photoUrl(lotPhotos(l)[0] || ''), score: scoreLot(l, { used, photoWidth }) }))
    .sort((a, b) => b.score - a.score);
  return { picked, candidates, dates };
}

export async function build({ market, params, plannedFor, deps, used, want = 4 }) {
  const cat = collection(market, params.category);
  const { picked, candidates, dates } = await findLots({ market, coll: cat, plannedFor, deps, used, want });
  if (!picked.length) throw new UserError(`No eligible lots in ${cat.label} auctioning ${dates[0]} to ${dates.at(-1)}`);
  picked.sort((a, b) => a.auctionDate.localeCompare(b.auctionDate));
  const cards = [];
  for (const lot of picked) cards.push(await makeLotCard(lot, market, cat.key, deps));
  varyHooks(cards);
  const counts = await deps.source.getCategoryCounts(market, cat, [...new Set(picked.map((l) => l.auctionDate))]);
  counts.firstDate = picked[0].auctionDate;
  const flags = picked.length < want
    ? [{ id: 'few-cards', severity: 'warn', message: `Only ${picked.length} eligible lot${picked.length > 1 ? 's' : ''} found (wanted ${want}).` }] : [];
  return { cards, counts, candidates, flags };
}
