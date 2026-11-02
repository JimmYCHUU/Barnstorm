// Scores auction lots and picks a varied set for one post.
import { excludedHouses } from './markets.js';
import { hookConfig } from './text/hooks.js';

const JAPANESE = new Set(['TOYOTA', 'NISSAN', 'HONDA', 'MAZDA', 'MITSUBISHI', 'SUBARU', 'SUZUKI', 'DAIHATSU', 'LEXUS', 'ISUZU',
  'HINO', 'MITSUOKA', 'INFINITI', 'ACURA', 'EUNOS', 'AUTOZAM', 'UD']);
const family = (l) => String(l.model || '').split(/[\s-]/)[0];
const inLibrary = (l) => hookConfig().models.some((r) => r.make === String(l.make).toUpperCase()
  && r.model === String(l.model).toUpperCase() && (!r.modelCode || r.modelCode === String(l.modelCode).toUpperCase()));

const GRADE = { S: 6, 6: 6, 5: 5, 4.5: 4.5, 4: 4, 3.5: 3, 3: 2, R: 1.5, RA: 1 };
const LETTER = { A: 1.5, B: 0.5 };

export function kmSuspect(lot, year = new Date().getFullYear()) {
  return lot.odometerKm != null && lot.odometerKm <= 1000 && lot.year && lot.year < year - 1;
}

// Higher is better; negative means "do not use".
export function scoreLot(lot, ctx = {}) {
  if (ctx.used?.has(String(lot.id))) return -100;
  if (excludedHouses().some((h) => String(lot.auctionHouse || '').toUpperCase().startsWith(h))) return -100;
  if (ctx.photoWidth?.[lot.id] != null && ctx.photoWidth[lot.id] < 600) return -100;
  if (/^R/i.test(String(lot.grade ?? '').trim())) return -100;   // R and RA: repair history, never posted (Jim, 2 Nov 2026)
  let s = (GRADE[lot.grade] ?? 0) * 2;
  s += (LETTER[lot.interiorGrade] || 0) + (LETTER[lot.exteriorGrade] || 0);
  if (lot.sellingPoints) s += 2;
  if ((lot.photos || []).length >= 3) s += 0.5;
  if ((lot.photos || []).length >= 8) s += 0.5;
  if (ctx.photoWidth?.[lot.id] >= 1000) s += 1.5;
  if (kmSuspect(lot)) s -= 3;
  if (!JAPANESE.has(String(lot.make).toUpperCase())) s -= 4;
  if (inLibrary(lot)) s += 3;
  if (lot.repairHistory) s -= 1;
  return s;
}

// Greedy pick with variety: each repeat of a make costs 4, each repeat of a model family (MOVE, MOVE CANBUS) costs 6.
export function pickLots(lots, n, ctx = {}) {
  const pool = lots.map((l) => ({ l, s: scoreLot(l, ctx) })).filter((x) => x.s >= 0);
  const out = [];
  while (out.length < n && pool.length) {
    let best = -1, bestScore = -Infinity;
    pool.forEach((x, i) => {
      const adj = x.s - 4 * out.filter((o) => o.make === x.l.make).length - 6 * out.filter((o) => o.make === x.l.make && family(o) === family(x.l)).length;
      if (adj > bestScore) { bestScore = adj; best = i; }
    });
    out.push(pool.splice(best, 1)[0].l);
  }
  return out;
}
