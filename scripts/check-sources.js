// Live smoke check of every market's data source: node scripts/check-sources.js
import { allMarkets } from '../lib/markets.js';
import { getCategory, getLot, getStockList } from '../lib/sources/carbarn.js';

for (const m of allMarkets()) {
  try {
    const cat = await getCategory(m, m.categories[0].slug);
    const lot = await getLot(m, cat.lots[0].id);
    const stock = await getStockList(m);
    console.log(`${m.key}: ${m.categories[0].slug} ${cat.count} lots, cut-off ${cat.cutoffUtc}; lot ${lot.id} ${lot.title} ${lot.odometerKm} km grade ${lot.grade} reg ${lot.regDate} sp=${!!lot.sellingPoints}; stock ${stock.length} (${stock.filter((s) => s.ownPhotos.length).length} with own photos)`);
  } catch (e) { console.log(`${m.key}: FAILED ${e.message}`); }
}
