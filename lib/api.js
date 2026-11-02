// HTTP API and static files for the review studio.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { allMarkets, market as getMarket } from './markets.js';
import { topicList } from './topics/index.js';
import * as store from './store.js';
import { buildPost, rebuildCard, swapLot, recheck, setStatus, refreshCounts, defaultDeps, redraw, DESIGN } from './build.js';
import { blocking } from './qa.js';
import { SourceError } from './sources/carbarn.js';
import { today } from './text/dates.js';
import { readConfig } from './config.js';
import { collections } from './collections.js';

// The exported and hand-made posts folder (read-only here). Same rule as publish/pack.js.
const postsDir = () => process.env.CE_POSTS || path.resolve(store.projectRoot(), '..', 'posts');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8' };

export class HttpError extends Error { constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; } }

const routes = [];
export const hooks = { afterBuild: [] };
export function route(method, pattern, handler) { routes.push({ method, re: new RegExp(`^${pattern}$`), handler }); }

const need = (cond, msg) => { if (!cond) throw new HttpError(400, msg); };
export const DATE = /^\d{4}-\d{2}-\d{2}$/;
function loadPost(id) { const p = store.getPost(id); if (!p) throw new HttpError(404, `No post "${id}"`); return p; }

const fileUrl = (file) => {
  const rel = file && path.relative(store.dataDir(), file);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? `/files/${rel.split(path.sep).join('/')}` : null;
};

export function postView(p) {
  const sharpened = p.cards.map((c) => (c.photo?.enhanced ? { now: fileUrl(c.photo.file), original: fileUrl(c.photo.original?.file) } : null));
  const designOutdated = (p.design || 1) < DESIGN && !['published', 'rejected'].includes(p.status);
  return { ...p, sharpened, designOutdated, images: p.cards.map((_, i) => `/files/posts/${p.id}/v${p.version}/card-${i}.png`),
    igImages: p.cards.map((_, i) => `/files/posts/${p.id}/v${p.version}/ig/card-${i}.png`), versions: store.listVersions(p.id) };
}
export function postSummary(p) {
  const qa = p.qa || [];
  return { id: p.id, market: p.market, topic: p.topic, params: p.params, plannedFor: p.plannedFor, status: p.status, version: p.version,
    updatedAt: p.updatedAt, cards: p.cards.length, hook: p.cards[0]?.slots?.hook, thumb: `/files/posts/${p.id}/v${p.version}/card-0.png`,
    errors: qa.filter((f) => f.severity === 'error').length, warnings: qa.filter((f) => f.severity === 'warn').length,
    published: p.published || null, exportedTo: p.exportedTo || null };
}

// ---- routes ----
route('GET', '/api/state', ({ ctx }) => {
  const posts = store.listPosts();
  const counts = {};
  for (const p of posts) counts[p.status] = (counts[p.status] || 0) + 1;
  const markets = allMarkets().map((m) => ({ ...m, labels: Object.fromEntries(collections({ ...m, disabledCollections: [] }).map((c) => [c.key, c.label])) }));
  return { app: readConfig('app.json'), markets, topics: topicList(), counts, today: today(), ...(ctx.state ? ctx.state() : {}) };
});

route('GET', '/api/posts', ({ url }) => store.listPosts({ status: url.searchParams.get('status') || undefined, market: url.searchParams.get('market') || undefined }).map(postSummary));

route('POST', '/api/posts', async ({ body, ctx }) => {
  need(body.market && body.topic && body.plannedFor, 'market, topic and plannedFor are required');
  need(DATE.test(body.plannedFor), 'plannedFor must be a date like 2026-11-04');
  getMarket(body.market);
  const post = await buildPost({ market: body.market, topic: body.topic, params: body.params || {}, plannedFor: body.plannedFor }, ctx.deps);
  for (const h of hooks.afterBuild) await h(post, body);
  return postView(post);
});

route('GET', '/api/posts/([^/]+)', ({ m }) => postView(loadPost(m[1])));

route('PATCH', '/api/posts/([^/]+)', async ({ m, body, ctx }) => {
  const p = loadPost(m[1]);
  need(body.card != null || body.caption, 'card or caption is required');
  return postView(await rebuildCard(p, body.card ?? 0, body, ctx.deps));
});

route('POST', '/api/posts/([^/]+)/redraw', async ({ m, ctx }) => {
  const p = loadPost(m[1]);
  if (p.status === 'published') throw new HttpError(409, 'This post is already published, so its pictures stay as they went out.');
  return postView(await redraw(p, ctx.deps));
});

route('POST', '/api/posts/([^/]+)/swap', async ({ m, body, ctx }) => {
  need(body.card != null && body.lotId, 'card and lotId are required');
  return postView(await swapLot(loadPost(m[1]), body.card, String(body.lotId), ctx.deps));
});

route('GET', '/api/posts/([^/]+)/alternatives', ({ m }) => loadPost(m[1]).candidates || []);

route('POST', '/api/posts/([^/]+)/recheck', async ({ m, ctx }) => postView(await recheck(loadPost(m[1]), ctx.deps, { refetch: true })));

route('POST', '/api/posts/([^/]+)/refresh-counts', async ({ m, ctx }) => postView(await refreshCounts(loadPost(m[1]), ctx.deps)));

route('POST', '/api/posts/([^/]+)/approve', async ({ m, ctx }) => {
  const p = await recheck(loadPost(m[1]), ctx.deps, { refetch: true, approving: true });
  const errors = blocking(p.qa);
  if (errors.length) throw new HttpError(409, `${errors.length} problem${errors.length > 1 ? 's' : ''} to fix before approval`, { qa: p.qa });
  const done = await setStatus(p, 'approved', { approvedAt: new Date().toISOString() });
  store.logEvent({ type: 'approved', postId: p.id, market: p.market, topic: p.topic, params: p.params, version: p.version });
  return postView(done);
});

route('POST', '/api/posts/([^/]+)/reject', async ({ m, body }) => {
  need(body.reason && String(body.reason).trim(), 'Give a reason so the engine can learn from it');
  const p = await setStatus(loadPost(m[1]), 'rejected', { rejectedAt: new Date().toISOString(), rejectReason: body.reason });
  store.logEvent({ type: 'rejected', postId: p.id, market: p.market, topic: p.topic, params: p.params, reason: body.reason });
  return postView(p);
});

route('POST', '/api/posts/([^/]+)/reopen', async ({ m }) => {
  const p = loadPost(m[1]);
  if (p.status === 'published') throw new HttpError(409, 'This post is already published. Build a new post instead of re-approving it.');
  return postView(await setStatus(p, 'draft'));
});

route('GET', '/api/posts/([^/]+)/versions/(\\d+)', ({ m }) => {
  const v = store.getVersion(m[1], Number(m[2]));
  if (!v) throw new HttpError(404, 'No such version');
  return { ...v, images: v.cards.map((_, i) => `/files/posts/${v.id}/v${v.version}/card-${i}.png`) };
});

route('GET', '/api/log', ({ url }) => store.readLog().slice(-Number(url.searchParams.get('limit') || 200)).reverse());

// ---- static ----
function serveFile(res, root, rel) {
  const file = path.resolve(root, '.' + path.sep + rel);
  if (!file.startsWith(path.resolve(root) + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found');
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

async function readBody(req) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 2e6) throw new HttpError(413, 'Request too large'); chunks.push(c); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'Body must be JSON'); }
}

// ctx: {deps, state?() -> extra state fields, onBuilt?(post, body)}
export function createServer(ctx = {}) {
  ctx.deps = ctx.deps || defaultDeps();
  const root = store.projectRoot();
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const p = decodeURIComponent(url.pathname);
    try {
      if (p.startsWith('/api/')) {
        // Only this app's own pages may change anything (a browser marks requests from other websites).
        const site = req.headers['sec-fetch-site'], origin = req.headers.origin;
        if (req.method !== 'GET' && ((site && !['same-origin', 'none'].includes(site)) || (origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)))) {
          throw new HttpError(403, 'Requests from other websites are not allowed.');
        }
        const r = routes.find((x) => x.method === req.method && x.re.test(p));
        if (!r) throw new HttpError(404, 'Unknown API route');
        const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : {};
        const out = await r.handler({ m: p.match(r.re), url, body, ctx, req });
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify(out ?? {}));
      }
      if (p.startsWith('/files/')) return serveFile(res, store.dataDir(), p.slice(7));
      if (p.startsWith('/posts-files/')) return serveFile(res, postsDir(), p.slice(13));
      if (p.startsWith('/assets/')) return serveFile(res, path.join(root, 'assets'), p.slice(8));
      if (p === '/' || p === '/index.html') return serveFile(res, path.join(root, 'ui'), 'index.html');
      if (p.startsWith('/ui/')) return serveFile(res, path.join(root, 'ui'), p.slice(4));
      res.writeHead(404, { 'content-type': 'text/plain' }); res.end('Not found');
    } catch (e) {
      const status = e.status || (e instanceof SourceError ? 502 : e.name === 'UserError' ? 422 : 500);
      if (status === 500) console.error(e);
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: e.message, ...(e.extra || {}) }));
    }
  });
}
