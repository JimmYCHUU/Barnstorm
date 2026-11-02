// Live check: how many lots each themed collection has on each Page's site.
// node scripts/check-collections.js [--write]   (--write stores themes with >= 40 lots in markets.json "collections")
import { allMarkets, loadMarkets, saveMarkets } from '../lib/markets.js';
import { themeList, collectionUrl } from '../lib/collections.js';
import { fetchRsc } from '../lib/sources/carbarn.js';
import { firstNumber } from '../lib/util/rsc.js';

const MIN = 40, write = process.argv.includes('--write');
const result = {};
for (const m of allMarkets()) {
  result[m.key] = [];
  const counts = [];
  for (const t of themeList()) {
    let n = 0;
    try { n = firstNumber(await fetchRsc(collectionUrl(m, t)), 'vehicleCount') ?? 0; } catch { n = -1; }
    counts.push(`${t.key}:${n}`);
    if (n >= MIN) result[m.key].push(t.key);
  }
  console.log(`${m.key} (${result[m.key].length} themes): ${counts.join(' ')}`);
}
if (write) {
  const cfg = loadMarkets();
  for (const [k, keys] of Object.entries(result)) cfg.markets[k].collections = keys;
  saveMarkets(cfg);
  console.log('markets.json updated');
}
