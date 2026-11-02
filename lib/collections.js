// Collections a Page can post from: the site's own Popular categories plus themed collections
// (brands, model spotlights, filters like manual gearbox). All are live-auction URLs the sites understand.
import { readConfig } from './config.js';

const fill = (s, y) => (s == null ? s : String(s).replace(/\{thisYear\}/g, y).replace(/\{lastYear\}/g, y - 1));

export function themeList({ year = new Date().getFullYear() } = {}) {
  return readConfig('collections.json').themes.map((t) => ({
    ...t, kind: 'theme', noun: fill(t.noun, year), query: fill(t.query, year), label: fill(t.label, year),
  }));
}

// Every collection this Page posts from: the site's own categories and its enabled themes.
export function collections(m) {
  const cats = m.categories.map((c) => ({ ...c, key: c.slug, kind: 'category', path: c.slug, query: '' }));
  const themes = themeList().filter((t) => (m.collections || []).includes(t.key) && !cats.some((c) => c.key === t.key));
  // Interleave site categories with themes so a Page's rotation mixes them from the start.
  const mixed = [];
  for (let i = 0; i < Math.max(cats.length, themes.length); i++) { if (cats[i]) mixed.push(cats[i]); if (themes[i]) mixed.push(themes[i]); }
  return mixed.filter((c) => !(m.disabledCollections || []).includes(c.key));
}

export function collection(m, key) {
  const c = collections(m).find((x) => x.key === key)
    || themeList().find((t) => t.key === key && (m.collections || []).includes(key));
  if (!c) throw new Error(`${m.brand} has no category or theme "${key}"`);
  return c;
}

// URL of a collection's live-auction listing, optionally for one auction day and page.
export function collectionUrl(m, c, { date, page } = {}) {
  const q = new URLSearchParams(c.query || '');
  if (date) q.set('auctionDate', date);
  if (page && page > 1) q.set('page', String(page));
  const path = c.path ? `/${c.path}` : '';
  return `${m.base}/live-auction${path}${q.size ? `?${q}` : ''}`;
}

// What captions link to: the listing without the day filter, shown without https://www.
export function collectionLink(m, c) {
  return collectionUrl(m, c).replace(/^https:\/\/www\./, '');
}
