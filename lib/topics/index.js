// Topic registry: each topic builds cards (and optional counts/candidates/flags) from live data.
import * as liveLots from './live-lots.js';
import * as lotSpotlight from './lot-spotlight.js';
import * as stockSpotlight from './stock-spotlight.js';
import * as howItWorks from './how-it-works.js';
import * as marketFact from './market-fact.js';

const TOPICS = {
  'live-lots': { label: 'Live lots', build: liveLots.build, photos: 'auction' },
  'lot-spotlight': { label: 'Lot spotlight', build: lotSpotlight.build, photos: 'auction' },
  'stock-spotlight': { label: 'Stock car', build: stockSpotlight.build, photos: 'own' },
  'how-it-works': { label: 'How it works', build: howItWorks.build, photos: 'own' },
  'market-fact': { label: 'Market fact', build: marketFact.build, photos: 'own' },
};

export function registerTopic(key, def) { TOPICS[key] = def; }
export function topic(key) {
  const t = TOPICS[key];
  if (!t) throw new Error(`Unknown topic "${key}"`);
  return t;
}
export function topicList() { return Object.entries(TOPICS).map(([key, t]) => ({ key, label: t.label, photos: t.photos })); }
