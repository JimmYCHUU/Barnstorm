// Proposes a week of posts per Page: collections rotate (never-posted first), no repeats, a market fact every few weeks.
import fs from 'node:fs';
import path from 'node:path';
import { addDays } from './text/dates.js';
import { readConfig, writeConfig } from './config.js';
import { collections } from './collections.js';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const EPOCH = '2026-01-05';   // a Monday; week numbers count from here

export function scheduleConfig() { return readConfig('schedule.json'); }
export function saveSchedule(cfg) { writeConfig('schedule.json', cfg); }

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

// A Page's collections best-first for a date: never posted, then not posted within the cooldown, then no same-day clash
// with another Page, then least recently posted, then the order in markets.json (site categories first).
export function rankCollections(m, date, history, { takenToday = new Set(), exclude = new Set(), cfg = scheduleConfig() } = {}) {
  const lastUsed = (key) => history.filter((h) => h.market === m.key && h.params?.category === key).map((h) => h.date).sort().at(-1);
  return collections(m).filter((c) => !exclude.has(c.key))
    .map((c, i) => ({ c, i, last: lastUsed(c.key) }))
    .map((x) => ({ ...x, cool: Number(!!x.last && daysBetween(x.last, date) < cfg.categoryCooldownDays), clash: Number(takenToday.has(x.c.key)) }))
    .sort((a, b) => (a.cool - b.cool) || (a.clash - b.clash) || (a.last || '').localeCompare(b.last || '') || a.i - b.i)
    .map((x) => x.c);
}

// history: [{market, date, topic, params}] of posts already made (not rejected). stockByMarket: {ie: n cars with own photos}.
export function proposeWeek(weekStart, history, markets, stockByMarket = {}, cfg = scheduleConfig()) {
  const slots = [], all = [...history];
  const factWeek = cfg.factEveryWeeks && Math.floor(daysBetween(EPOCH, weekStart) / 7) % cfg.factEveryWeeks === 0;
  const pick = (m, date) => {
    const takenToday = new Set(slots.filter((s) => s.date === date && s.params.category).map((s) => s.params.category));
    return rankCollections(m, date, all, { takenToday, cfg })[0].key;
  };

  // Pages with the fewest collections choose first, so the flexible ones can step around them.
  for (const m of [...markets].sort((a, b) => collections(a).length - collections(b).length)) {
    const pattern = cfg.perMarket?.[m.key]?.pattern || cfg.pattern;
    const days = DAYS.filter((d) => pattern[d]);
    let needsIntro = !all.some((h) => h.market === m.key && h.topic === 'how-it-works');
    for (const d of days) {
      const date = addDays(weekStart, DAYS.indexOf(d));
      if (history.some((h) => h.market === m.key && h.date === date)) continue;   // already has a post that day
      let topic = pattern[d], params = {};
      if (needsIntro) { topic = 'how-it-works'; needsIntro = false; }
      else if (factWeek && d === cfg.factDay) topic = 'market-fact';
      if (topic === 'stock-spotlight' && !(stockByMarket[m.key] > 0)) topic = 'lot-spotlight';
      if (topic === 'live-lots' || topic === 'lot-spotlight') params = { category: pick(m, date) };
      const slot = { id: `${weekStart}-${m.key}-${d}`, market: m.key, date, topic, params, status: 'proposed' };
      slots.push(slot);
      all.push({ market: m.key, date, topic, params });
    }
  }
  return slots.sort((a, b) => a.date.localeCompare(b.date) || a.market.localeCompare(b.market));
}

// ---- persistence (data/plans/<weekStart>.json) ----
export function planFile(dataDir, weekStart) { return path.join(dataDir, 'plans', `${weekStart}.json`); }

// Slots planned but not built yet, four weeks either side of `week`, as history-like entries,
// so a new proposal or suggestion rotates on from them. skipWeek leaves out `week` itself (re-proposing it).
export function plannedAround(dataDir, week, { skipWeek = false } = {}) {
  const out = [];
  for (let w = -28; w <= 28; w += 7) {
    if (skipWeek && !w) continue;
    const file = planFile(dataDir, addDays(week, w));
    if (!fs.existsSync(file)) continue;
    for (const sl of JSON.parse(fs.readFileSync(file, 'utf8')).slots || []) {
      if (sl.status !== 'dropped' && !sl.postId) out.push({ market: sl.market, date: sl.date, topic: sl.topic, params: sl.params || {}, planned: true });
    }
  }
  return out;
}
