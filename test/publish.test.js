import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ce-pub-'));
beforeEach(() => { process.env.CE_DATA = tmp(); process.env.CE_POSTS = tmp(); process.env.CE_SECRETS = path.join(tmp(), 'secrets.json'); });

const { exportPack } = await import('../lib/publish/pack.js');
const { publish } = await import('../lib/publish/meta.js');
const { secretsPath, writeSecrets, connectionStatus } = await import('../lib/secrets.js');
const store = await import('../lib/store.js');

// A saved, rendered 4-card post (PNG files are stand-ins).
function savedPost(status = 'approved') {
  const id = store.newId('2026-11-04-uk-live-lots-kei-cars');
  const cards = ['SUZUKI JIMNY', 'DAIHATSU COPEN', 'DAIHATSU TAFT', 'MITSUBISHI DELICA MINI'].map((t, i) => ({
    kind: 'lot', facts: { id: String(100 + i), make: t.split(' ')[0], model: t.split(' ').slice(1).join(' '), url: `https://www.carbarn.uk/live-auction/x/x/x/${100 + i}` },
    slots: { model: `2022 ${t}`, hook: 'Hook' }, photo: { source: 'auction' } }));
  const post = { id, market: 'uk', topic: 'live-lots', params: { category: 'kei-cars' }, plannedFor: '2026-11-04', status, version: 1, cards,
    caption: { a: 'Caption A #CarbarnUK', b: 'Caption B', chosen: 'a' }, qa: [{ id: 'auction-photo', severity: 'warn', message: 'Auction-house photos…' }] };
  for (const sub of ['', 'ig']) {
    fs.mkdirSync(path.join(store.versionDir(id, 1), sub), { recursive: true });
    cards.forEach((_, i) => fs.writeFileSync(path.join(store.versionDir(id, 1), sub, `card-${i}.png`), `png${sub}${i}`));
  }
  return store.savePost(post);
}

test('pack: writes 4 square PNGs, 4 Instagram PNGs and caption.md with lot links', async () => {
  const p = savedPost();
  const r = await exportPack(p);
  const files = fs.readdirSync(r.folder).sort();
  assert.deepEqual(files, ['.engine.json', '1-suzuki-jimny.png', '2-daihatsu-copen.png', '3-daihatsu-taft.png', '4-mitsubishi-delica-mini.png', 'caption.md', 'instagram']);
  assert.equal(fs.readdirSync(path.join(r.folder, 'instagram')).length, 4);
  const md = fs.readFileSync(path.join(r.folder, 'caption.md'), 'utf8');
  assert.match(md, /Caption A #CarbarnUK/);
  assert.match(md, /carbarn\.uk\/live-auction\/x\/x\/x\/100/);
  assert.equal(path.relative(process.env.CE_POSTS, r.folder), path.join('carbarn-united-kingdom', '2026-11-04-live-lots-kei-cars'));
  assert.equal(store.getPost(p.id).status, 'exported');
});

test('pack: never overwrites a folder the engine did not make', async () => {
  fs.mkdirSync(path.join(process.env.CE_POSTS, 'carbarn-united-kingdom', '2026-11-04-live-lots-kei-cars'), { recursive: true });
  const r = await exportPack(savedPost());
  assert.match(r.folder, /2026-11-04-live-lots-kei-cars-2$/);
});

test('publish: refuses a post that is not approved', async () => {
  await assert.rejects(publish(savedPost('draft'), { platforms: ['facebook'] }), /approve/i);
});

test('publish: without a Page token it runs as a mock and records every call', async () => {
  const r = await publish(savedPost(), { platforms: ['facebook', 'instagram'] }, { crop: async (i, o) => fs.copyFileSync(i, o) });
  assert.equal(r.mock, true);
  const calls = JSON.parse(fs.readFileSync(r.log, 'utf8')).calls;
  assert.equal(calls.filter((c) => c.step === 'facebook-photo').length, 4);
  assert.equal(calls.filter((c) => c.step === 'facebook-feed').length, 1);
  assert.equal(calls.filter((c) => c.step === 'instagram-item').length, 4);
  assert.ok(calls.some((c) => c.step === 'instagram-carousel'));
  assert.ok(calls.some((c) => c.step === 'instagram-publish'));
});

test('publish: with a token it sends the Graph API sequence and stores the post ids', async () => {
  writeSecrets({ meta: { graphVersion: 'v23.0', pages: { uk: { pageId: 'PAGE', pageToken: 'TOKEN', igUserId: 'IGU' } } } });
  const sent = [];
  let n = 0;
  const fakeFetch = async (url, opts = {}) => {
    sent.push({ url, method: opts.method || 'GET', body: opts.body });
    const u = String(url);
    const json = u.includes('/photos') ? { id: `ph${n++}` } : u.includes('/feed') ? { id: 'PAGE_post1' }
      : /fields=images/.test(u) ? { images: [{ source: `https://cdn.example/${n}.png` }] } : /fields=status_code/.test(u) ? { status_code: 'FINISHED' }
      : u.includes('/media_publish') ? { id: 'ig_media_1' } : u.includes('/media') ? { id: `c${n++}` } : {};
    return new Response(JSON.stringify(json), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const r = await publish(savedPost(), { platforms: ['facebook', 'instagram'] }, { fetch: fakeFetch, crop: async (i, o) => fs.copyFileSync(i, o), pollMs: 1 });
  assert.equal(r.mock, false);
  assert.equal(r.facebook.id, 'PAGE_post1');
  assert.equal(r.instagram.id, 'ig_media_1');
  const feed = sent.find((s) => String(s.url).includes('/PAGE/feed'));
  assert.equal(new URLSearchParams(feed.body).get('attached_media[3]'), '{"media_fbid":"ph3"}');
  assert.ok(sent.every((s) => String(s.url).startsWith('https://graph.facebook.com/v23.0/')));
});

test('secrets: never written inside the project folder', () => {
  process.env.CE_SECRETS = path.join(store.projectRoot(), 'secrets.json');
  assert.throws(() => writeSecrets({ a: 1 }), /outside the project/);
  assert.ok(!fs.existsSync(path.join(store.projectRoot(), 'secrets.json')));
});

test('secrets: status says what is connected without exposing tokens', () => {
  writeSecrets({ meta: { pages: { ie: { pageId: '1', pageToken: 'SECRET', igUserId: '2' } } }, anthropic: { apiKey: 'sk-SECRET' } });
  const s = connectionStatus();
  assert.equal(s.meta.ie.facebook, true);
  assert.equal(s.meta.uk.facebook, false);
  assert.equal(s.anthropic, true);
  assert.doesNotMatch(JSON.stringify(s), /SECRET/);
  assert.ok(secretsPath().endsWith('secrets.json'));
});

test('publish: refuses a post with blocking QA flags', async () => {
  const p = savedPost();
  p.qa = [{ id: 'lot-gone', severity: 'error', message: 'gone' }];
  await assert.rejects(publish(p, { platforms: ['facebook'] }, { crop: async (i, o) => fs.copyFileSync(i, o) }), /fix/i);
});

test('publish: a failed Instagram leg keeps the Facebook result and never posts twice', async () => {
  writeSecrets({ meta: { graphVersion: 'v23.0', pages: { uk: { pageId: 'PAGE', pageToken: 'TOKEN', igUserId: 'IGU' } } } });
  let feeds = 0, n = 0, igDown = true;
  const f = async (url) => {
    const u = String(url);
    if (u.includes('/feed')) feeds++;
    if (igDown && u.includes('/IGU/media')) return new Response(JSON.stringify({ error: { message: 'IG is down' } }), { status: 500 });
    const json = u.includes('/photos') ? { id: 'ph' + n++ } : u.includes('/feed') ? { id: 'PAGE_post1' }
      : /fields=images/.test(u) ? { images: [{ source: 'https://cdn.example/x.png' }] }
      : /fields=status_code/.test(u) ? { status_code: 'FINISHED' } : u.includes('/media_publish') ? { id: 'ig_media_1' }
      : u.includes('/media') ? { id: 'c' + n++ } : {};
    return new Response(JSON.stringify(json), { status: 200 });
  };
  const crop = async (i, o) => fs.copyFileSync(i, o);
  const p = savedPost();
  await assert.rejects(publish(p, { platforms: ['facebook', 'instagram'] }, { fetch: f, crop, pollMs: 1 }), /IG is down/);
  const saved = store.getPost(p.id);
  assert.equal(saved.published.facebook.id, 'PAGE_post1');
  igDown = false;
  const r = await publish(saved, { platforms: ['facebook', 'instagram'] }, { fetch: f, crop, pollMs: 1 });
  assert.equal(feeds, 1);
  assert.equal(r.instagram.id, 'ig_media_1');
  assert.equal(r.facebook.id, 'PAGE_post1');
});
