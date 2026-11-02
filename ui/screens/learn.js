// Learn: what Barnstorm noticed from your edits and rejections, and the activity log.
import { api, esc, toast, marketName, shortMarket, $$ } from '../lib.js';
import { icon } from '../icons.js';

const KIND = { 'hook-library': 'Hook for a model', 'hook-rule': 'Hook rule', 'never-phrase': 'Phrase to avoid', 'category-weight': 'Category' };
const EVENT = { created: 'Built', approved: 'Stamped', rejected: 'Rejected', removed: 'Removed from the Plan', edited: 'Edited', exported: 'Exported', published: 'Published', 'publish-mock': 'Rehearsed a publish', reopened: 'Reopened', swapped: 'Swapped a car', rechecked: 'Re-checked' };

export async function render(view, data) {
  const d = data || await api('GET', '/api/learn');
  const stats = Object.entries(d.stats);
  view.innerHTML = `
    <div class="head"><div><h1>Learn</h1><p class="sub" style="margin-bottom:0">Barnstorm watches what you change and reject, and suggests rule updates. Nothing changes until you accept.</p></div></div>
    <section class="pubs"><h2>Suggestions <span class="muted">${d.suggestions.length}</span></h2>
    ${d.suggestions.length ? `<div class="panel flush">${d.suggestions.map((s) => `<div class="sug">
      <div><span class="chip">${esc(KIND[s.kind] || s.kind)}</span><b>${esc(describe(s))}</b><span class="muted">${esc(s.why)}</span></div>
      <div class="row"><button class="small ghost" data-dismiss="${s.id}">Dismiss</button><button class="small primary" data-apply="${s.id}">${icon('check', 14)}Accept</button></div></div>`).join('')}</div>`
      : '<p class="hint">No suggestions yet. They appear after you edit or reject a few posts the same way.</p>'}</section>
    <div class="grid g2">
      <div class="panel"><h2>By Page</h2>
        ${stats.length ? `<table><tr><th>Page</th><th>Built</th><th>Stamped</th><th>Rejected</th><th>Published</th></tr>
        ${stats.map(([k, s]) => `<tr><td><b>${esc(shortMarket(k))}</b></td><td>${s.built}</td><td>${s.approved}</td><td>${s.rejected}</td><td>${s.published}</td></tr>`).join('')}</table>` : '<p class="hint">No posts yet.</p>'}
        <h3>Most edited</h3><div class="tags">${Object.entries(d.edits).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span class="chip">${esc(k)} · ${n}</span>`).join('') || '<span class="hint">Nothing edited yet.</span>'}</div></div>
      <div class="panel"><h2>Recent rejections</h2>${d.rejections.length ? `<table>${d.rejections.map((e) => `<tr><td><b>${esc(shortMarket(e.market))}</b></td><td>${esc(e.reason || '')}</td></tr>`).join('')}</table>` : '<p class="hint">None. Rejections, with your reason, teach Barnstorm what to avoid.</p>'}</div>
    </div>
    <section class="pubs" style="margin-top:24px"><h2>Activity</h2>
      ${d.recent.length ? `<div class="panel flush"><table>${d.recent.map((e) => `<tr><td class="muted" style="white-space:nowrap">${new Date(e.ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td><td><b>${esc(EVENT[e.type] || e.type)}</b></td><td>${esc(e.market ? marketName(e.market) : '')}</td>
      <td>${e.postId ? `<a href="#/post/${encodeURIComponent(e.postId)}">Open post</a>` : ''}</td></tr>`).join('')}</table></div>` : '<p class="hint">Nothing yet.</p>'}</section>`;
  $$('[data-apply]', view).forEach((b) => (b.onclick = async () => { render(view, await api('POST', `/api/learn/${b.dataset.apply}/apply`)); toast('Rule updated.'); }));
  $$('[data-dismiss]', view).forEach((b) => (b.onclick = async () => render(view, await api('POST', `/api/learn/${b.dataset.dismiss}/dismiss`))));
}

function describe(s) {
  const p = s.proposal;
  if (s.kind === 'hook-library') return `${p.make} ${p.model}: “${p.from}” → “${p.to}”`;
  if (s.kind === 'hook-rule') return `“${p.from}” → “${p.to}”`;
  if (s.kind === 'never-phrase') return `Never write “${p.phrase}”`;
  if (s.kind === 'category-weight') return `${marketName(p.market)}: plan ${p.category} last`;
  return JSON.stringify(p);
}
