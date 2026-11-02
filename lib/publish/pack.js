// Posting pack: the approved pictures and captions in posts/<Page>/<date>-<topic>/, the same layout as the hand-made posts.
// Square files are for Facebook; instagram/ holds the 3:4 versions so nothing is cut off on the Instagram grid.
import fs from 'node:fs';
import path from 'node:path';
import { market as getMarket } from '../markets.js';
import { collection } from '../collections.js';
import { readConfig } from '../config.js';
import { topic as getTopic } from '../topics/index.js';
import * as store from '../store.js';
import { cardImage } from '../build.js';
import { shortDate } from '../text/dates.js';

export function postsRoot() { return process.env.CE_POSTS || path.resolve(store.projectRoot(), '..', 'posts'); }

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function fileNames(post) {
  return post.cards.map((c, i) => {
    const name = c.facts?.make ? `${c.facts.make} ${c.facts.model}` : c.slots?.title || c.slots?.eyebrow || post.topic;
    return `${i + 1}-${slug(name).slice(0, 40)}.png`;
  });
}

function captionMd(post, m, names) {
  const t = getTopic(post.topic), cat = post.params?.category ? collection(m, post.params.category).label : '';
  const chosen = post.caption?.chosen || 'a';
  const quote = (s) => String(s || '').split('\n').map((l) => `> ${l}`.trimEnd()).join('\n');
  const auctionDays = [...new Set(post.cards.map((c) => c.facts?.auctionDate).filter(Boolean))].sort().map((d) => shortDate(d, m));
  const links = post.cards.map((c, i) => (c.facts?.url ? `| ${i + 1} | ${c.slots?.model || c.facts.title || ''} | ${c.facts.url} |` : null)).filter(Boolean);
  const notes = (post.qa || []).filter((f) => f.severity !== 'error').map((f) => `- ${f.message}`);
  return [
    `# ${m.brand}: ${t.label}${cat ? ` · ${cat}` : ''}`, '',
    'Upload as one multi-photo post (Facebook) or carousel (Instagram), in this order:',
    ...names.map((n, i) => `${i + 1}. \`${n}\``), '',
    'Facebook: the square files in this folder. Instagram: the files in `instagram/` (3:4, so the profile grid shows the whole picture).', '',
    `Post on **${shortDate(post.plannedFor, m)}**.${auctionDays.length ? ` These lots go to auction on ${auctionDays.join(' and ')}. Refresh the count on ${m.site} on the day you post.` : ''}`, '',
    `## Caption ${chosen.toUpperCase()} (chosen)`, quote(post.caption?.[chosen]), '',
    `## Caption ${chosen === 'a' ? 'B' : 'A'}`, quote(post.caption?.[chosen === 'a' ? 'b' : 'a']), '',
    ...(links.length ? ['## Cars', '| Card | Car | Listing |', '|---|---|---|', ...links, ''] : []),
    ...(notes.length ? ['## Check before posting', ...notes, ''] : []),
    `Made with ${readConfig('app.json').name}: post ${post.id}, version ${post.version}.`, '',
  ].join('\n');
}

export async function exportPack(post) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(post.plannedFor)) throw new Error('Post date is not a plain date');
  const m = getMarket(post.market);
  const base = path.join(postsRoot(), m.folder, `${post.plannedFor}-${post.topic}${post.params?.category ? `-${post.params.category}` : ''}`);
  let folder = base, n = 2;
  // Re-export into our own folder; never touch a folder someone else made.
  while (fs.existsSync(folder) && store.readJson(path.join(folder, '.engine.json'))?.postId !== post.id) folder = `${base}-${n++}`;
  fs.mkdirSync(path.join(folder, 'instagram'), { recursive: true });
  const names = fileNames(post);
  names.forEach((name, i) => {
    fs.copyFileSync(cardImage(post, i, post.version, 'square'), path.join(folder, name));
    fs.copyFileSync(cardImage(post, i, post.version, 'ig'), path.join(folder, 'instagram', name));
  });
  fs.writeFileSync(path.join(folder, 'caption.md'), captionMd(post, m, names));
  fs.writeFileSync(path.join(folder, '.engine.json'), JSON.stringify({ postId: post.id, version: post.version, exportedAt: new Date().toISOString() }, null, 2));
  const saved = structuredClone(post);
  if (saved.status === 'approved') saved.status = 'exported';
  saved.exportedTo = folder;
  store.savePost(saved);
  store.logEvent({ type: 'exported', postId: post.id, market: post.market, folder });
  return { folder, files: names, post: saved };
}
