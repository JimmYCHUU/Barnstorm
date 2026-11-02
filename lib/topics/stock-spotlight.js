// Topic "stock-spotlight": one car from Carbarn's own stock in Japan, a hero card plus up to 3 more of its yard photos.
import { UserError } from '../errors.js';
import { pickStock, yardPhotos, heroCard, photoCard, priceLabel, asLot } from './stock.js';
import { registerCaption, hashtags } from '../text/captions.js';
import { shortName, modelName } from '../text/names.js';

export async function build({ market, params, deps, used }) {
  const list = await deps.source.getStockList(market);
  let s, yard;
  if (params.stockSlug) {
    s = list.find((x) => x.slug === params.stockSlug) || await deps.source.getStockVehicle(market, params.stockSlug);
    yard = await yardPhotos(s, deps, 4);
  } else {
    ({ s, yard } = (await pickStock(list, deps, used, { need: 4, min: 2 })) || {});
  }
  if (!s) throw new UserError(`No stock car on ${market.site} has Carbarn's own yard photos right now.`);
  if (!yard.length) throw new UserError(`${s.title} only has auction-house photos, so it cannot be posted.`);
  const cards = [heroCard(s, yard, market)];
  const tag = modelName(asLot(s)).toUpperCase();
  for (let k = 1; k < Math.min(yard.length, 4); k++) {
    cards.push(photoCard(s, yard, k, { template: 'info-card', kind: 'gallery', variant: 'gallery', stageH: 1080, igStageH: 1440, slots: { tag } }));
  }
  return { cards, params: { ...params, stockSlug: s.slug } };
}

registerCaption('stock-spotlight', (post, market) => {
  const c = post.cards[0], f = c.facts, name = shortName(f), price = priceLabel(f.price);
  const details = [f.odometerKm ? `${Number(f.odometerKm).toLocaleString('en-GB')} km` : '', f.grade ? `auction grade ${f.grade}` : ''].filter(Boolean).join(', ');
  const a = [
    `${c.slots.hook} ✨ This ${f.year} ${name} is in our stock in Japan at ${price}, shipping included${details ? `: ${details}` : ''}.`,
    market.leadFact || '',
    `Every car on ${market.site} shows its estimated landed cost before you order. Shipped RoRo to ${market.ports} 🚢`,
    `👉 ${f.url}`,
    hashtags(post, market),
  ].filter(Boolean).join('\n\n');
  const b = `In stock in Japan: ${f.year} ${name}, ${price} with shipping included 👉 ${f.url}`;
  return { a, b };
});
