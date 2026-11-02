// Publish API: export posting packs, publish through Meta, manage connections (values never leave the secrets file).
import path from 'node:path';
import { execFile } from 'node:child_process';
import { route, HttpError, postView } from './api.js';
import { getPost } from './store.js';
import { exportPack, postsRoot } from './publish/pack.js';
import { publish } from './publish/meta.js';
import { connectionStatus, updateSecrets } from './secrets.js';
import { market as getMarket } from './markets.js';
import { polishCaption } from './providers/claude.js';
import { checkGeminiKey, photoSettings } from './providers/gemini.js';
import { readConfig, writeConfig } from './config.js';
import { rebuildCard, recheck } from './build.js';
import { blocking } from './qa.js';

// Re-read every lot/stock car and re-run the checks; refuse with the flags if anything is red.
async function fresh(post, ctx) {
  const p = await recheck(post, ctx.deps, { refetch: true, approving: true });
  const errors = blocking(p.qa);
  if (errors.length) throw new HttpError(409, `${errors.length} problem${errors.length > 1 ? 's' : ''} found on re-check; the post is back in draft`, { qa: p.qa });
  return p;
}

const need = (c, m) => { if (!c) throw new HttpError(400, m); };
const load = (id) => { const p = getPost(id); if (!p) throw new HttpError(404, `No post "${id}"`); return p; };

route('POST', '/api/posts/([^/]+)/export', async ({ m, ctx }) => {
  const p0 = load(m[1]);
  need(['approved', 'exported', 'published'].includes(p0.status), 'Approve the post before exporting it.');
  const p = p0.status === 'published' ? p0 : await fresh(p0, ctx);
  const r = await exportPack(p);
  return { folder: r.folder, files: r.files, post: postView(r.post) };
});

route('POST', '/api/posts/([^/]+)/publish', async ({ m, body, ctx }) => {
  const platforms = (body.platforms || ['facebook', 'instagram']).filter((x) => ['facebook', 'instagram'].includes(x));
  need(platforms.length, 'Choose Facebook, Instagram or both.');
  const p0 = load(m[1]);
  need(['approved', 'exported'].includes(p0.status), 'Approve the post before publishing it.');
  const r = await publish(await fresh(p0, ctx), { platforms });
  return { mock: r.mock, facebook: r.facebook, instagram: r.instagram, log: r.log, post: postView(r.post) };
});

route('GET', '/api/connections', () => ({ ...connectionStatus(), photos: photoSettings() }));

route('PUT', '/api/connections/meta', ({ body }) => {
  getMarket(body.market);
  updateSecrets((s) => {
    s.meta = s.meta || {}; s.meta.pages = s.meta.pages || {};
    const cur = s.meta.pages[body.market] || {};
    s.meta.pages[body.market] = {
      pageId: body.pageId?.trim() || cur.pageId || '', igUserId: body.igUserId?.trim() || cur.igUserId || '',
      pageToken: body.pageToken?.trim() || cur.pageToken || '',   // blank keeps the saved token
    };
    if (body.clear) delete s.meta.pages[body.market];
    if (body.graphVersion) s.meta.graphVersion = body.graphVersion.trim();
  });
  return connectionStatus();
});

route('PUT', '/api/connections/anthropic', ({ body }) => {
  updateSecrets((s) => { if (body.clear) delete s.anthropic; else if (body.apiKey?.trim()) s.anthropic = { apiKey: body.apiKey.trim() }; });
  return connectionStatus();
});

// Gemini sharpens low-resolution photos. The key is tried against Google (a free call) before it is saved.
route('PUT', '/api/connections/gemini', async ({ body, ctx }) => {
  if (body.clear) updateSecrets((s) => { delete s.gemini; });
  else {
    const key = String(body.apiKey || '').trim();
    need(key, 'Paste the Gemini API key first.');
    await (ctx.deps.checkGeminiKey || checkGeminiKey)(key);
    updateSecrets((s) => { s.gemini = { apiKey: key }; });
  }
  return { ...connectionStatus(), photos: photoSettings() };
});

route('PUT', '/api/settings/photos', ({ body }) => {
  const cfg = readConfig('photos.json');
  if (body.sharpen != null) cfg.sharpen = body.sharpen === 'off' ? 'off' : 'auto';
  writeConfig('photos.json', cfg);
  return photoSettings();
});

// Open an exported folder in File Explorer (only folders under posts/).
route('POST', '/api/open-folder', ({ body }) => {
  const f = path.resolve(String(body.folder || ''));
  need(f.toLowerCase().startsWith(path.resolve(postsRoot()).toLowerCase() + path.sep), 'Only folders inside posts/ can be opened.');
  execFile('explorer.exe', [f]);
  return { ok: true };
});

// Optional: rewrite one caption with Claude (checked for facts and banned words), saved as a new version.
route('POST', '/api/posts/([^/]+)/polish', async ({ m, body, ctx }) => {
  const p = load(m[1]), which = body.which === 'b' ? 'b' : 'a';
  const text = await polishCaption(p.caption?.[which] || '', { market: getMarket(p.market) });
  return postView(await rebuildCard(p, 0, { caption: { [which]: text } }, ctx.deps));
});
