// Publishes an approved post to its Facebook Page (multi-photo post) and Instagram account (carousel)
// through Meta's Graph API. Without a Page token it runs as a mock and records the exact calls it would make.
import fs from 'node:fs';
import path from 'node:path';
import { market as getMarket } from '../markets.js';
import { readSecrets } from '../secrets.js';
import { UserError } from '../errors.js';
import * as store from '../store.js';
import { cardImage } from '../build.js';
import { cropPng } from '../render.js';
import { blocking } from '../qa.js';

// Instagram's API takes 4:5 at the tallest; the 3:4 cards keep 64px clear at top and bottom, so a 4:5 trim loses nothing.
const toFourFive = (input, output) => cropPng(input, output, { x: 0, y: 45, width: 1080, height: 1350 });

export async function publish(post, { platforms = ['facebook', 'instagram'] } = {}, deps = {}) {
  if (!['approved', 'exported'].includes(post.status)) throw new UserError('Approve the post before publishing it.');
  if (blocking(post.qa).length) throw new UserError('Fix the red checks before publishing.');
  const m = getMarket(post.market), secrets = readSecrets(), page = secrets.meta?.pages?.[m.key] || {};
  const G = `https://graph.facebook.com/${secrets.meta?.graphVersion || 'v23.0'}`;
  const mock = deps.mock || !page.pageToken;
  const fetchFn = deps.fetch || fetch, crop = deps.crop || toFourFive, pollMs = deps.pollMs ?? 3000;
  const token = page.pageToken, caption = post.caption?.[post.caption?.chosen || 'a'] || '';
  const calls = [];
  let fake = 0;

  async function call(step, method, url, fields = {}, file = null) {
    calls.push({ step, method, url, fields: { ...fields, ...(fields.access_token ? { access_token: '***' } : {}) }, file });
    if (mock) {
      fake++;
      return step === 'instagram-url' ? { images: [{ source: `https://example.invalid/mock-${fake}.png` }] }
        : step === 'instagram-status' ? { status_code: 'FINISHED' } : { id: `mock-${step}-${fake}` };
    }
    let res;
    if (method === 'GET') {
      res = await fetchFn(`${url}${url.includes('?') ? '&' : '?'}${new URLSearchParams(fields)}`);
    } else if (file) {
      const form = new FormData();
      for (const [k, v] of Object.entries(fields)) form.append(k, v);
      form.append('source', new Blob([fs.readFileSync(file)], { type: 'image/png' }), path.basename(file));
      res = await fetchFn(url, { method, body: form });
    } else {
      res = await fetchFn(url, { method, body: new URLSearchParams(fields) });
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new UserError(`Meta refused the ${step} step: ${json.error?.message || `HTTP ${res.status}`}`);
    return json;
  }

  const auth = mock ? {} : { access_token: token };
  const done = mock ? {} : post.published || {};          // platforms that already went out are never sent again
  const result = { mock, facebook: done.facebook || null, instagram: done.instagram || null };
  const saved = structuredClone(post);
  const log = path.join(store.dataDir(), 'publish-log', `${post.id}-${Date.now()}${mock ? '-mock' : ''}.json`);
  const keep = () => {
    store.writeJson(log, { postId: post.id, market: m.key, mock, at: new Date().toISOString(), calls, result });
    if (!mock) { saved.published = { ...(saved.published || {}), ...result, at: new Date().toISOString() }; store.savePost(saved); }
  };
  try {

  if (platforms.includes('facebook') && !result.facebook) {
    const ids = [];
    for (let i = 0; i < post.cards.length; i++) {
      ids.push((await call('facebook-photo', 'POST', `${G}/${page.pageId || 'PAGE_ID'}/photos`, { published: 'false', ...auth }, cardImage(post, i, post.version, 'square'))).id);
    }
    const media = Object.fromEntries(ids.map((id, i) => [`attached_media[${i}]`, JSON.stringify({ media_fbid: id })]));
    result.facebook = { id: (await call('facebook-feed', 'POST', `${G}/${page.pageId || 'PAGE_ID'}/feed`, { message: caption, ...media, ...auth })).id };
    keep();
  }

  if (platforms.includes('instagram') && !result.instagram) {
    if (!mock && !page.igUserId) throw new UserError(`No Instagram account is connected for ${m.brand}.`);
    const ig = page.igUserId || 'IG_USER_ID', single = post.cards.length === 1, items = [];
    const tmp = path.join(store.dataDir(), 'publish-tmp', post.id);
    fs.mkdirSync(tmp, { recursive: true });
    for (let i = 0; i < post.cards.length; i++) {
      const fourFive = path.join(tmp, `card-${i}-4x5.png`);
      await crop(cardImage(post, i, post.version, 'ig'), fourFive);
      // Instagram needs a public image URL: stage the picture as an unpublished Page photo and use its CDN address.
      const staged = await call('instagram-stage', 'POST', `${G}/${page.pageId || 'PAGE_ID'}/photos`, { published: 'false', temporary: 'true', ...auth }, fourFive);
      const img = await call('instagram-url', 'GET', `${G}/${staged.id}`, { fields: 'images', ...auth });
      const fields = single ? { image_url: img.images[0].source, caption, ...auth } : { image_url: img.images[0].source, is_carousel_item: 'true', ...auth };
      items.push((await call('instagram-item', 'POST', `${G}/${ig}/media`, fields)).id);
    }
    const container = single ? items[0]
      : (await call('instagram-carousel', 'POST', `${G}/${ig}/media`, { media_type: 'CAROUSEL', children: items.join(','), caption, ...auth })).id;
    for (let tries = 0; ; tries++) {
      const s = await call('instagram-status', 'GET', `${G}/${container}`, { fields: 'status_code', ...auth });
      if (s.status_code === 'FINISHED') break;
      if (s.status_code === 'ERROR' || tries > 20) throw new UserError('Instagram could not process the pictures. Try again later.');
      await new Promise((r) => setTimeout(r, pollMs));
    }
    result.instagram = { id: (await call('instagram-publish', 'POST', `${G}/${ig}/media_publish`, { creation_id: container, ...auth })).id };
  }
  } catch (e) {
    keep();   // record what did go out, so a retry never posts it twice
    throw e;
  }

  keep();
  if (mock) { saved.publishedMock = { at: new Date().toISOString(), log }; store.savePost(saved); }
  else if (platforms.every((p) => result[p])) { saved.status = 'published'; store.savePost(saved); }
  store.logEvent({ type: mock ? 'publish-mock' : 'published', postId: post.id, market: m.key, platforms, result });
  return { ...result, log, post: saved };
}
