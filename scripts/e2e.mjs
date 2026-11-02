// End-to-end check against the live sites: node scripts/e2e.mjs <dataDir> <plannedFor> <topic> [market:category ...]
import { buildPost } from '../lib/build.js';
import { closeBrowser } from '../lib/render.js';
const [, , dir, plannedFor, topic, ...specs] = process.argv;
process.env.CE_DATA = dir;
for (const spec of specs) {
  const [market, category] = spec.split(':');
  const t0 = Date.now();
  try {
    const p = await buildPost({ market, topic, params: category ? { category } : {}, plannedFor });
    const errs = p.qa.filter((f) => f.severity === 'error' && f.id !== 'plates-unchecked');
    console.log(`${market} ${topic} ${category || ''}: ${p.cards.length} cards, ${((Date.now() - t0) / 1000).toFixed(0)}s, errors: ${errs.map((f) => f.message).join(' | ') || 'none'}`);
    for (const c of p.cards) console.log(`   ${c.slots.hook || c.slots.title || c.slots.tag} | ${c.slots.model || ''} | ${c.slots.feat || ''} | ${c.slots.km || c.slots.chip || ''}`);
  } catch (e) { console.log(`${market} ${topic} ${category || ''}: FAILED ${e.message}`); }
}
await closeBrowser();
