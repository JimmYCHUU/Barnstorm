// Captions in the style approved on 1 Nov 2026: option A (count for the first auction day) and B (live right now).
import { collection, collectionLink } from '../collections.js';
import { dayName } from './dates.js';
import { shortName } from './names.js';
import { spell } from './rules.js';
import { sentenceWords } from './case.js';

const NUM = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
const SPEC = /^(4WD|AWD|hybrid( AWD)?|turbo|manual|\d-speed manual|automatic|\d+ seats|660cc|\d\.\d \w+)$/i;
const PROPER = /^(Recaro|MOMO|ADVAN|BBS|Bilstein|LED|TRD|Modellista|Mugen|Nismo|JBL|Bose)/;

const n = (x) => Number(x).toLocaleString('en-GB');
const article = (w) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
const joinAnd = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

// "with heated seats" / "with an electric roof" from the card's features line, skipping plain specs.
function detail(feat) {
  const item = String(feat || '').split(' · ').map((s) => s.trim()).find((s) => s && !SPEC.test(s));
  if (!item) return '';
  const w = sentenceWords(item, PROPER);   // "Alloy Wheels" or "alloy wheels" both read "alloy wheels"; 4WD, TV and Recaro keep theirs
  const plural = /s$/.test(w) || /^sat nav/.test(w);
  return ` with ${plural ? '' : article(w) + ' '}${w}`;
}

export function carList(cards) {
  return joinAnd(cards.map((c) => { const name = shortName(c.facts); return `${article(name)} ${name}${detail(c.slots.feat)}`; }));
}

export function hashtags(post, market, extra = []) {
  const first = post.cards?.[0]?.facts;
  const carTag = first ? `#${shortName(first).replace(/[^A-Za-z0-9]/g, '')}` : null;
  return [...new Set([...market.hashtags, ...extra, carTag].filter(Boolean))].slice(0, 5).join(' ');
}

export function depositLine(market) {
  return `Pick one and our team in Japan inspects it before we bid. Refundable card deposit, and no bid goes in without your approval. Shipped RoRo to ${market.ports} 🚢`;
}

function liveLots(post, market) {
  const cat = collection(market, post.params.category), first = post.counts.firstDate;
  const lead = market.leadFact ? ` ${market.leadFact}` : '';
  const link = collectionLink(market, cat);
  const count = post.cards.length;
  const a = [
    `${n(post.counts.byDate[first])} ${cat.noun} go under the hammer in Japan on ${dayName(first)} ${cat.emoji}${lead}`,
    `${NUM[count] || count} we'd look at first: ${carList(post.cards)}.`,
    depositLine(market),
    `👉 ${link}`,
    hashtags(post, market, [cat.tag]),
  ].join('\n\n');
  const b = [
    `${cat.emoji} ${n(post.counts.total)} ${cat.noun} are live on ${market.site} right now, straight from Japan's auctions. Swipe for ${(NUM[count] || String(count)).toLowerCase()} ${spell('favourites', market)} 👉`,
    `Every lot comes with its auction grade and auction sheet. See them all: ${link}`,
  ].join('\n\n');
  return { a, b };
}

function lotSpotlight(post, market) {
  const c = post.cards[0], f = c.facts, name = shortName(f);
  const lead = market.leadFact ? `\n\n${market.leadFact}` : '';
  const a = [
    `${c.slots.hook} 👀 This ${f.year} ${name} goes under the hammer in Japan on ${dayName(f.auctionDate)}: ${sentenceWords(c.slots.feat, PROPER)}, ${c.slots.km}, auction grade ${f.grade}.${lead}`,
    'Want it? Our team in Japan inspects it before we bid. Refundable card deposit, and no bid goes in without your approval.',
    `👉 ${f.url}`,
    hashtags(post, market),
  ].join('\n\n');
  const b = `${c.slots.hook}: ${f.year} ${name}, auction grade ${f.grade}, live on ${market.site} until ${dayName(f.auctionDate)} 👉 ${f.url}`;
  return { a, b };
}

const BUILDERS = { 'live-lots': liveLots, 'lot-spotlight': lotSpotlight };

export function registerCaption(topic, fn) { BUILDERS[topic] = fn; }

export function captionsFor(post, market) {
  const fn = BUILDERS[post.topic];
  if (!fn) throw new Error(`No caption writer for topic "${post.topic}"`);
  return fn(post, market);
}
