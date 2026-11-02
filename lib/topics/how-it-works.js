// Topic "how-it-works": cover plus 3 steps, wording approved for Ireland on 1 Nov 2026, with each market's ports.
import { UserError } from '../errors.js';
import { rankStock, yardPhotos, photoCard } from './stock.js';
import { registerCaption, hashtags } from '../text/captions.js';

export function steps(m) {
  return [
    { variant: 'cover', stageH: 640, igStageH: 740, slots: { tag: `SHIPS TO ${m.portsShort}`, eyebrow: `Meet ${m.brand}`, title: `Japan's car auctions, open to ${m.buyers}`,
      body: `Live auction lots and Carbarn's own stock in Japan, with the estimated landed cost shown before you commit.` } },
    { variant: 'step', stageH: 620, igStageH: 800, slots: { eyebrow: 'Step 1 of 3', title: 'Pick your car',
      body: `Browse live Japanese auction lots, updated daily, or Carbarn's own stock. Every car shows its auction grade, auction sheet and estimated landed cost.` } },
    { variant: 'step', stageH: 620, igStageH: 800, slots: { eyebrow: 'Step 2 of 3', title: 'We inspect, then we bid',
      body: 'Our team in Japan checks the car and sends you real photos. We bid only after you approve, and never above your limit.' } },
    { variant: 'step', stageH: 620, igStageH: 800, slots: { eyebrow: 'Step 3 of 3', title: 'Invoiced only if you win',
      body: `Win and we invoice, then ship RoRo to ${m.ports}. Lose and your deposit is refunded or moved to your next car.` } },
  ];
}

// One yard photo per card, from different stock cars where possible.
export async function ownPhotoCards(market, specs, deps, used) {
  const sets = [];
  for (const s of rankStock(await deps.source.getStockList(market), used).slice(0, specs.length + 4)) {
    const yard = await yardPhotos(s, deps, 2);
    if (yard.length) sets.push({ s, yard });
    if (sets.length === specs.length) break;
  }
  if (!sets.length) throw new UserError(`No stock car on ${market.site} has Carbarn's own yard photos to illustrate this post`);
  return specs.map((spec, i) => {
    const { s, yard } = sets[i % sets.length];
    return photoCard(s, yard, Math.floor(i / sets.length), { template: 'info-card', kind: 'info', ...spec });
  });
}

export async function build({ market, deps }) {
  return { cards: await ownPhotoCards(market, steps(market), deps, new Set()) };
}

registerCaption('how-it-works', (post, m) => {
  const a = [
    `${m.hello} 👋 ${m.brand} opens Japan's car auctions to ${m.buyers}.`,
    ['How it works:',
      '1️⃣ Pick a car from thousands of live Japanese auction lots, updated daily, or from Carbarn\'s own stock in Japan.',
      '2️⃣ Our team in Japan inspects it and sends you real photos. We only bid after you approve, and never above your limit.',
      `3️⃣ You're invoiced only if your bid wins, and we ship RoRo to ${m.ports}. If you don't win, your refundable deposit comes back or moves to your next car.`].join('\n'),
    m.leadFact || '',
    `👉 ${m.site}`,
    hashtags({ cards: [] }, m),
  ].filter(Boolean).join('\n\n');
  const b = `New here? Swipe to see how ${m.brand} works: pick a car, we inspect and bid, and you're invoiced only if you win 👉 ${m.site}`;
  return { a, b };
});
