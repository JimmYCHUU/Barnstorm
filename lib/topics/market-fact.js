// Topic "market-fact": one card with the market's approved lead fact (25-year rule, SVA/JEVIC, five-year limit…).
import { ownPhotoCards } from './how-it-works.js';
import { registerCaption, hashtags } from '../text/captions.js';

export async function build({ market, deps, used }) {
  const spec = { variant: 'fact', stageH: 620, igStageH: 800, slots: { eyebrow: 'Good to know', title: market.fact.title, body: market.fact.body } };
  return { cards: await ownPhotoCards(market, [spec], deps, used) };
}

registerCaption('market-fact', (post, m) => {
  const c = post.cards[0];
  const a = [`${c.slots.title} ✅ ${c.slots.body}`, `👉 ${m.site}`, hashtags({ cards: [] }, m)].join('\n\n');
  const b = `Good to know: ${c.slots.body} 👉 ${m.site}`;
  return { a, b };
});
