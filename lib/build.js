// Build a post from a topic, render its cards, and apply single-card edits as new versions.
import { UserError } from './errors.js';
import fs from 'node:fs';
import path from 'node:path';
import { market as getMarket, category } from './markets.js';
import { topic as getTopic } from './topics/index.js';
import { captionsFor } from './text/captions.js';
import { featureLine } from './text/hooks.js';
import { makeLotCard, lotPhotos } from './topics/lot-card.js';
import { photoUrl } from './sources/carbarn.js';
import * as source from './sources/carbarn.js';
import { cachePhoto } from './photos.js';
import { renderCard } from './render.js';
import * as store from './store.js';
import { runQA, blocking } from './qa.js';

const LIVE = ['approved', 'exported'];   // a change to one of these needs a fresh approval

export function defaultDeps() {
  return {
    source, cachePhoto, renderCard,
    qa: (post, opts = {}) => runQA(post, { ...opts, source, used: store.usedLots({ exceptId: post.id, today: post.plannedFor }) }),
  };
}

// Every card is rendered twice: square for Facebook, 3:4 for Instagram (whose profile grid crops squares).
export const FORMATS = ['square', 'ig'];

// What the renderer needs for one card in one format.
export function cardSpec(card, m, format = 'square') {
  const ig = format === 'ig';
  return { template: card.template, format, variant: card.variant, stageH: ig ? card.igStageH : card.stageH,
    market: { key: m.key, brand: m.brand, lang: m.lang, logo: m.logo },
    photo: { file: card.photo?.file, focus: card.focus, zoom: card.zoom, blur: card.blur, fit: ig ? card.igfit : undefined },
    photos: card.photos || [], slots: card.slots };
}

export const cardImage = (post, i, v = post.version, format = 'square') =>
  path.join(store.versionDir(post.id, v), format === 'ig' ? 'ig' : '', `card-${i}.png`);

async function renderVersion(post, changed, deps, reason) {
  const m = getMarket(post.market), prev = post.version;
  post.version = prev + 1;
  post.reason = reason;
  fs.mkdirSync(path.join(store.versionDir(post.id, post.version), 'ig'), { recursive: true });
  for (let i = 0; i < post.cards.length; i++) {
    const render = { ...(post.cards[i].render || {}) };
    for (const format of FORMATS) {
      const out = cardImage(post, i, post.version, format), old = cardImage(post, i, prev, format);
      if (changed === null || changed.includes(i) || !fs.existsSync(old)) {
        const r = await deps.renderCard(cardSpec(post.cards[i], m, format), out);
        render[format === 'ig' ? 'igOverflow' : 'overflow'] = r.overflow;
        if (format === 'square') render.photo = r.photo;
      } else {
        fs.copyFileSync(old, out);
      }
    }
    post.cards[i].render = render;
  }
}

async function check(post, deps) {
  const base = (post.flags || []).slice();
  if (deps.qa) return deps.qa(post, { base });
  post.cards.forEach((c, i) => (c.render?.overflow || []).forEach((o) => base.push({ id: 'overflow', severity: 'error', card: i, message: `Text "${o}" does not fit on card ${i + 1}.` })));
  return base;
}

function refreshCaption(post) {
  if (post.caption?.locked) return;
  const c = captionsFor(post, getMarket(post.market));
  post.caption = { ...c, chosen: post.caption?.chosen || 'a', locked: false };
}

export async function buildPost({ market, topic, params = {}, plannedFor }, deps = defaultDeps()) {
  const m = getMarket(market);
  const used = store.usedLots({ today: plannedFor });
  const r = await getTopic(topic).build({ market: m, params, plannedFor, deps, used });
  const p = r.params || params;
  const id = store.newId(`${plannedFor}-${market}-${topic}${p.category ? `-${p.category}` : ''}`);
  const post = {
    id, market, topic, params: p, plannedFor, status: 'draft', version: 0, createdAt: new Date().toISOString(),
    cards: r.cards, counts: r.counts || null, candidates: r.candidates || [], flags: r.flags || [], caption: null,
  };
  refreshCaption(post);
  await renderVersion(post, null, deps, 'Built');
  post.qa = await check(post, deps);
  store.savePost(post);
  store.logEvent({ type: 'created', postId: id, market, topic, params: p });
  return post;
}

const VISUAL = ['slots', 'focus', 'zoom', 'blur', 'photoIndex', 'igfit'];

// changes: {slots?, focus?, zoom?, blur?, photoIndex?, platesChecked?, caption?:{a?,b?,chosen?}}
export async function rebuildCard(post, i, changes, deps = defaultDeps()) {
  post = structuredClone(post);
  const card = post.cards[i], before = structuredClone(card), beforeCaption = structuredClone(post.caption);
  if (!card && (changes.slots || changes.photoIndex != null)) throw new Error(`Card ${i + 1} does not exist`);
  if (changes.slots) {
    Object.assign(card.slots, changes.slots);
    card.locked = [...new Set([...(card.locked || []), ...Object.keys(changes.slots)])];
  }
  if (changes.focus) card.focus = changes.focus;
  if (changes.zoom != null) card.zoom = changes.zoom;
  if (changes.blur) card.blur = changes.blur;
  if (changes.igfit) card.igfit = changes.igfit === 'contain' ? 'contain' : undefined;
  if (changes.platesChecked != null) card.platesChecked = !!changes.platesChecked;
  if (changes.photoIndex != null) {
    const opts = card.photoOptions || lotPhotos(card.facts);
    if (!opts[changes.photoIndex]) throw new Error(`Photo ${changes.photoIndex + 1} does not exist`);
    const url = photoUrl(opts[changes.photoIndex]);
    const ph = await deps.cachePhoto(url);
    Object.assign(card, { photo: { ...card.photo, url, file: ph.file, w: ph.w, h: ph.h, index: changes.photoIndex }, blur: [], platesChecked: false });
  }
  if (changes.caption) {
    post.caption = { ...post.caption, ...changes.caption };
    if (changes.caption.a != null || changes.caption.b != null) post.caption.locked = true;
  } else refreshCaption(post);
  const visual = card && VISUAL.some((k) => changes[k] != null);
  await renderVersion(post, visual ? [i] : [], deps, describe(changes, i));
  post.qa = await check(post, deps);
  if (LIVE.includes(post.status)) post.status = 'draft';
  store.savePost(post);
  const oldHook = before?.hookOptions?.find((h) => h.text === before.slots?.hook);
  store.logEvent({ type: 'edited', postId: post.id, market: post.market, topic: post.topic, card: i, changes, before: card ? pick(before, changes) : null,
    car: card?.facts ? { make: card.facts.make, model: card.facts.model, modelCode: card.facts.modelCode } : null,
    hookSource: oldHook?.source || null, hookKey: oldHook?.key || null,
    ...(changes.caption ? { beforeCaption: { a: beforeCaption?.a, b: beforeCaption?.b } } : {}) });
  return post;
}

// Replace card i with another lot (from post.candidates or any lot id).
export async function swapLot(post, i, lotId, deps = defaultDeps()) {
  post = structuredClone(post);
  const m = getMarket(post.market);
  const lot = await deps.source.getLot(m, lotId);
  if (lot.auctionDate <= post.plannedFor) throw new UserError(`Lot ${lotId} auctions on ${lot.auctionDate}, not after ${post.plannedFor}`);
  const old = post.cards[i];
  post.cards[i] = await makeLotCard(lot, m, post.params.category, deps);
  post.candidates = (post.candidates || []).filter((c) => c.id !== lotId);
  refreshCaption(post);
  await renderVersion(post, [i], deps, `Swapped card ${i + 1} to lot ${lotId}`);
  post.qa = await check(post, deps);
  if (LIVE.includes(post.status)) post.status = 'draft';
  store.savePost(post);
  store.logEvent({ type: 'swapped', postId: post.id, market: post.market, card: i, from: old?.facts?.id, to: lotId });
  return post;
}

// Re-read today's lot counts and rewrite the caption (unlocks a hand-edited caption).
export async function refreshCounts(post, deps = defaultDeps()) {
  post = structuredClone(post);
  if (post.topic === 'live-lots') {
    const m = getMarket(post.market);
    const dates = [...new Set(post.cards.map((c) => c.facts.auctionDate))].sort();
    post.counts = { ...(await deps.source.getCategoryCounts(m, post.params.category, dates)), firstDate: dates[0] };
  }
  post.caption = { ...post.caption, locked: false };
  refreshCaption(post);
  await renderVersion(post, [], deps, 'Refreshed counts and caption');
  if (LIVE.includes(post.status)) post.status = 'draft';
  post.qa = await check(post, deps);
  store.savePost(post);
  return post;
}

export async function setStatus(post, status, extra = {}, deps = defaultDeps()) {
  post = structuredClone(post);
  post.status = status;
  Object.assign(post, extra);
  store.savePost(post);
  return post;
}

export async function recheck(post, deps = defaultDeps(), opts = {}) {
  post = structuredClone(post);
  post.qa = deps.qa ? await deps.qa(post, { base: post.flags || [], ...opts }) : await check(post, deps);
  if (LIVE.includes(post.status) && blocking(post.qa).length) post.status = 'draft';
  store.savePost(post);
  return post;
}

function describe(ch, i) {
  const parts = [];
  if (ch.slots) parts.push(`card ${i + 1}: ${Object.keys(ch.slots).join(', ')}`);
  if (ch.photoIndex != null) parts.push(`card ${i + 1}: photo ${ch.photoIndex + 1}`);
  if (ch.focus || ch.zoom != null) parts.push(`card ${i + 1}: crop`);
  if (ch.blur) parts.push(`card ${i + 1}: blur boxes`);
  if (ch.platesChecked != null) parts.push(`card ${i + 1}: plates checked`);
  if (ch.caption) parts.push('caption');
  return parts.join('; ') || 'Edit';
}

function pick(card, changes) {
  const o = {};
  if (changes.slots) o.slots = Object.fromEntries(Object.keys(changes.slots).map((k) => [k, card.slots[k]]));
  return o;
}

export { featureLine, category };
