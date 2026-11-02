// Topic "lot-spotlight": one standout lot, either named (params.lotId) or the best in a category.
import { UserError } from '../errors.js';
import { collection } from '../collections.js';
import { findLots } from './live-lots.js';
import { makeLotCard } from './lot-card.js';

export async function build({ market, params, plannedFor, deps, used }) {
  const slug = params.category || market.categories[0].slug;
  if (params.lotId) {
    const lot = await deps.source.getLot(market, params.lotId);
    if (lot.auctionDate <= plannedFor) throw new UserError(`Lot ${lot.id} auctions on ${lot.auctionDate}, not after ${plannedFor}`);
    return { cards: [await makeLotCard(lot, market, slug, deps)], params: { ...params, category: slug } };
  }
  const coll = collection(market, slug);
  const { picked, candidates, dates } = await findLots({ market, coll, plannedFor, deps, used, want: 1 });
  if (!picked.length) throw new UserError(`No eligible lots in ${coll.label} auctioning ${dates[0]} to ${dates.at(-1)}`);
  return { cards: [await makeLotCard(picked[0], market, slug, deps)], candidates, params: { ...params, category: slug } };
}
