// Posts: every post Barnstorm has built, as Instagram tiles, plus "New post".
import { api, esc, busy, state, shortMarket, topicName, categoryLabel, statusChip, nice, plusDays, collectionSelect, $, $$ } from '../lib.js';
import { icon } from '../icons.js';

const FILTERS = [['open', 'Open'], ['draft', 'To stamp'], ['approved', 'Approved'], ['exported', 'Exported'], ['published', 'Published'], ['rejected', 'Rejected'], ['all', 'All']];

export async function render(view) {
  const posts = await api('GET', '/api/posts');
  let filter = 'open';
  try { filter = sessionStorage.getItem('postsFilter') || 'open'; } catch { /* ignore */ }
  const shown = posts.filter((p) => filter === 'all' || (filter === 'open' ? ['draft', 'approved'].includes(p.status) : p.status === filter));
  view.innerHTML = `
    <div class="head"><div><h1>Posts</h1><p class="sub" style="margin-bottom:0">Everything Barnstorm has built. Open one to check it in Facebook and Instagram frames and stamp it.</p></div>
      <button class="primary" id="new">${icon('plus', 16)}New post</button></div>
    <div class="filters seg">${FILTERS.map(([f, l]) => `<button class="${f === filter ? 'on' : ''}" data-f="${f}">${l} <span class="muted">${count(posts, f)}</span></button>`).join('')}</div>
    ${shown.length ? `<div class="posts">${shown.map(card).join('')}</div>`
      : `<div class="empty"><b>No posts in this view</b><span>Build tomorrow's posts from the top bar, or start one with “New post”.</span></div>`}`;
  $$('[data-f]', view).forEach((b) => (b.onclick = () => { try { sessionStorage.setItem('postsFilter', b.dataset.f); } catch { /* ignore */ } render(view); }));
  $('#new', view).onclick = () => newPost();
}

const count = (posts, f) => posts.filter((p) => f === 'all' || (f === 'open' ? ['draft', 'approved'].includes(p.status) : p.status === f)).length;

const card = (p) => `<a class="post" href="#/post/${encodeURIComponent(p.id)}">
  <img src="${esc(p.thumb.replace(/card-0\.png$/, 'ig/card-0.png'))}" alt="" loading="lazy">
  <div class="meta"><div class="spread">${statusChip(p.status, p.errors)}<span class="muted">${nice(p.plannedFor)}</span></div>
    <b>${esc(shortMarket(p.market))} · ${esc(p.params?.category ? categoryLabel(p.market, p.params.category) : topicName(p.topic))}</b>
    <span class="muted">${esc(topicName(p.topic))} · ${p.cards} picture${p.cards > 1 ? 's' : ''}${p.warnings ? ` · ${p.warnings} to check` : ''}</span></div></a>`;

// Build a post now. Also used from Feeds.
export async function newPost(preset = {}) {
  const { markets, topics, today } = state.info;
  const d = $('#dlg');
  const mk = preset.market || markets[0].key, date = preset.plannedFor || plusDays(today, 1);
  d.innerHTML = `<form method="dialog" class="fields" id="np"><h2>New post</h2>
    <label>Page<select name="market">${markets.map((m) => `<option value="${m.key}" ${m.key === mk ? 'selected' : ''}>${esc(m.brand)}</option>`).join('')}</select></label>
    <label>Topic<select name="topic">${topics.map((t) => `<option value="${t.key}" ${t.key === (preset.topic || 'live-lots') ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select></label>
    <label id="catrow">Category or theme<span id="catsel"></span><span class="hint">The suggestion is the one this Page has gone longest without.</span></label>
    <label id="lotrow">Lot number (optional)<input type="text" name="lotId" placeholder="e.g. 2723320"><span class="hint">Leave empty to let Barnstorm pick the strongest lot.</span></label>
    <label>Post date<input type="date" name="plannedFor" value="${date}"><span class="hint">Lots must auction after this date. Build the day before you post.</span></label>
    <div class="row" style="justify-content:flex-end"><button value="cancel" formnovalidate>Cancel</button><button value="ok" class="primary">${icon('build', 16)}Build</button></div></form>`;
  const f = $('#np', d);
  const sync = async () => {
    const t = f.topic.value, lots = ['live-lots', 'lot-spotlight'].includes(t);
    $('#catrow', d).style.display = lots ? '' : 'none';
    $('#lotrow', d).style.display = t === 'lot-spotlight' ? '' : 'none';
    if (lots) $('#catsel', d).innerHTML = await collectionSelect(f.market.value, f.plannedFor.value, preset.category);
  };
  f.market.onchange = sync; f.topic.onchange = sync; f.plannedFor.onchange = sync;
  await sync();
  d.showModal();
  const ok = await new Promise((r) => d.addEventListener('close', () => r(d.returnValue === 'ok'), { once: true }));
  if (!ok) return null;
  const v = Object.fromEntries(new FormData(f));
  const params = {};
  if (['live-lots', 'lot-spotlight'].includes(v.topic)) params.category = v.category;
  if (v.topic === 'lot-spotlight' && v.lotId) params.lotId = v.lotId.trim();
  const post = await busy('Building: reading live lots, picking cars, writing and rendering both formats. This takes 20 to 60 seconds.',
    () => api('POST', '/api/posts', { market: v.market, topic: v.topic, plannedFor: v.plannedFor, params, slotId: preset.slotId }));
  if (post) location.hash = `#/post/${encodeURIComponent(post.id)}`;
  return post;
}
