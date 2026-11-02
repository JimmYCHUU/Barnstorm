// Market (Facebook/Instagram Page) settings from config/markets.json.
import { readConfig, writeConfig } from './config.js';

let cache = null;

export function loadMarkets() {
  if (!cache) cache = readConfig('markets.json');
  return cache;
}

export function reloadMarkets() { cache = null; return loadMarkets(); }
export function saveMarkets(next) { writeConfig('markets.json', next); cache = null; }

export const MARKET_KEYS = ['ie', 'uk', 'us', 'mt', 'cy'];

export function market(key) {
  const m = loadMarkets().markets[key];
  if (!m) throw new Error(`Unknown market "${key}"`);
  return { key, ...m, base: `https://www.${m.site}` };
}

export function allMarkets() { return MARKET_KEYS.map(market); }

export function category(m, slug) {
  const c = m.categories.find((x) => x.slug === slug);
  if (!c) throw new Error(`${m.brand} has no category "${slug}"`);
  return c;
}

export function excludedHouses() { return loadMarkets().excludedHouses || []; }
