// Build a post from a topic, render its cards, and apply single-card edits as new versions.
import { UserError } from './errors.js';
import fs from 'node:fs';
import path from 'node:path';
import { market as getMarket, category } from './markets.js';
import { topic as getTopic } from './topics/index.js';
import { captionsFor } from './text/captions.js';
import { featureLine } from './text/hooks.js';
import { capitalWords } from './text/case.js';
import { makeLotCard, lotPhotos } from './topics/lot-card.js';
import { photoUrl } from './sources/carbarn.js';
import * as source from './sources/carbarn.js';
import { cachePhoto } from './photos.js';
import { enhancePhoto, autoSharpen, photoSettings } from './providers/gemini.js';
import { renderCard } from './render.js';
import * as store from './store.js';
import { runQA, blocking } from './qa.js';

const LIVE = ['approved', 'exported'];   // a change to one of these needs a fresh approval

export function defaultDeps() {
  return {
    source, cachePhoto, renderCard, enhancePhoto,
    qa: (post, opts = {}) => runQA(post, { ...opts, source, used: store.usedLots({ exceptId: post.id, today: post.plannedFor }) }),
  };
}

// Every card is rendered twice: square for Facebook, 3:4 for Instagram (whose profile grid crops squares).
export const FORMATS = ['square', 'ig'];

// The lines on a picture whose every word starts with a capital: the big hook, the features line and an info card's title.
// Applied when a card is made or edited, so the Text tab shows what the picture shows, and again when it is drawn.
const CAPITALS = ['hook', 'feat', 'title'];
const capitalSlots = (slots = {}) => ({ ...slots, ...Object.fromEntries(CAPITALS.filter((k) => typeof slots[k] === 'string').map((k) => [k, capitalWords(slots[k])])) });
function capitalize(card) {
  if (!card) return card;
  card.slots = capitalSlots(card.slots);
  if (card.hookOptions) card.hookOptions = card.hookOptions.map((h) => ({ ...h, text: capitalWords(h.text) }));
  return card;
}

// What the renderer needs for one card in one format.
export function cardSpec(card, m, format = 'square') {
  const ig = format === 'ig';
  return { template: card.template, format, variant: card.variant, stageH: ig ? card.igStageH : card.stageH,
    market: { key: m.key, brand: m.brand, lang: m.lang, logo: m.logo },
    photo: { file: card.photo?.file, focus: card.focus, zoom: card.zoom, blur: card.blur, fit: ig ? card.igfit : undefined },
    photos: card.photos || [], slots: capitalSlots(card.slots) };
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

// ---- sharpening: photos narrower than photos.json's belowWidth go through Gemini when a key is set and "sharpen" is "auto".
// The original is kept on the card (photo.original) so "Use the original" can put it back; the plates must be looked at again.
const soft = (card) => card.photo?.file && card.photo.w && card.photo.w < photoSettings().belowWidth && !card.photo.enhanced && !card.noSharpen;
const canAuto = (deps) => !!deps.enhancePhoto && autoSharpen();
const dropFailed = (post, i) => { post.flags = (post.flags || []).filter((f) => !(f.id === 'sharpen-failed' && f.card === i)); };

async function sharpen(card, deps) {
  const out = await deps.enhancePhoto(card.photo.file, { w: card.photo.w, h: card.photo.h });
  const original = card.photo.original || { file: card.photo.file, w: card.photo.w, h: card.photo.h };
  card.photo = { ...card.photo, file: out.file, w: out.w, h: out.h, original, enhanced: { model: out.model, at: new Date().toISOString() } };
  card.platesChecked = false;
  delete card.noSharpen;
}

// On a build or a new photo a failure never stops the post: the original is used and the post says why.
async function autoSharpenCard(post, i, deps) {
  dropFailed(post, i);
  try { await sharpen(post.cards[i], deps); } catch (e) {
    post.flags.push({ id: 'sharpen-failed', severity: 'warn', card: i, message: `Gemini could not sharpen card ${i + 1}'s photo, so the original is used. ${e.message}` });
  }
}

// avoid: cars of a post taken off this slot, kept out of the new one unless nothing else is listed.
export async function buildPost({ market, topic, params = {}, plannedFor, avoid = [] }, deps = defaultDeps()) {
  const m = getMarket(market);
  const used = store.usedLots({ today: plannedFor });
  const run = (u) => getTopic(topic).build({ market: m, params, plannedFor, deps, used: u });
  let r;
  try { r = await run(avoid.length ? new Set([...used, ...avoid.map(String)]) : used); } catch (e) {
    if (!avoid.length || e.name !== 'UserError' || !/No eligible lots/.test(e.message)) throw e;
    r = await run(used);
  }
  r.cards.forEach(capitalize);
  const p = r.params || params;
  const id = store.newId(`${plannedFor}-${market}-${topic}${p.category ? `-${p.category}` : ''}`);
  const post = {
    id, market, topic, params: p, plannedFor, status: 'draft', version: 0, createdAt: new Date().toISOString(),
    cards: r.cards, counts: r.counts || null, candidates: r.candidates || [], flags: r.flags || [], caption: null,
  };
  if (canAuto(deps)) await Promise.all(post.cards.map((c, i) => (soft(c) ? autoSharpenCard(post, i, deps) : null)));
  refreshCaption(post);
  await renderVersion(post, null, deps, 'Built');
  post.qa = await check(post, deps);
  store.savePost(post);
  store.logEvent({ type: 'created', postId: id, market, topic, params: p });
  return post;
}

const VISUAL = ['slots', 'focus', 'zoom', 'blur', 'photoIndex', 'igfit', 'enhance'];

// changes: {slots?, focus?, zoom?, blur?, photoIndex?, enhance?, platesChecked?, caption?:{a?,b?,chosen?}}
export async function rebuildCard(post, i, changes, deps = defaultDeps()) {
  post = structuredClone(post);
  const card = post.cards[i], before = structuredClone(card), beforeCaption = structuredClone(post.caption);
  if (!card && (changes.slots || changes.photoIndex != null)) throw new Error(`Card ${i + 1} does not exist`);
  if (changes.slots) {
    Object.assign(card.slots, changes.slots);
    capitalize(card);
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
    const { original, enhanced, ...photo } = card.photo || {};
    Object.assign(card, { photo: { ...photo, url, file: ph.file, w: ph.w, h: ph.h, index: changes.photoIndex }, blur: [], platesChecked: false });
    delete card.noSharpen;
    if (canAuto(deps) && soft(card)) await autoSharpenCard(post, i, deps);
  }
  if (changes.enhance === true && card?.photo?.file && !card.photo.enhanced) {
    if (!deps.enhancePhoto) throw new UserError('Photo sharpening is not available here.');
    await sharpen(card, deps);   // pressed by hand: a failure is shown, not hidden
    dropFailed(post, i);
  }
  if (changes.enhance === false && card?.photo?.original) {
    const { original, enhanced, ...photo } = card.photo;
    card.photo = { ...photo, file: original.file, w: original.w, h: original.h };
    card.noSharpen = true;
    card.platesChecked = false;
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
  post.cards[i] = capitalize(await makeLotCard(lot, m, post.params.category, deps));
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
  if (ch.enhance != null) parts.push(`card ${i + 1}: ${ch.enhance ? 'photo sharpened with Gemini' : 'original photo'}`);
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
