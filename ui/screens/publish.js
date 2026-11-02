// Publish: approved posts become posting packs (for Meta Business Suite) or go straight out through the Graph API.
import { api, esc, busy, toast, copyText, state, marketName, shortMarket, topicName, categoryLabel, nice, avatar, statusChip, $$ } from '../lib.js';
import { icon } from '../icons.js';

export async function render(view) {
  const [posts, conn] = await Promise.all([api('GET', '/api/posts'), api('GET', '/api/connections')]);
  const by = (st) => posts.filter((p) => p.status === st).sort((a, b) => a.plannedFor.localeCompare(b.plannedFor));
  const anyLive = state.info.markets.some((m) => conn.meta[m.key].facebook);
  view.innerHTML = `
    <div class="head"><div><h1>Publish</h1><p class="sub" style="margin-bottom:0">Stamped posts only. Export a posting pack to upload or schedule in Meta Business Suite, or publish directly once a Page is connected.</p></div>
      <a class="btn" href="#/settings">${icon('settings', 16)}Connections</a></div>
    <div class="conns">${state.info.markets.map((m) => { const c = conn.meta[m.key]; return `<div class="conn">${avatar(m.logo)}<b>${esc(shortMarket(m.key))}</b>
      <span class="${c.facebook ? 'on' : ''}" title="Facebook ${c.facebook ? 'connected' : 'not connected'}">${icon('facebook', 16)}</span>
      <span class="${c.instagram ? 'on' : ''}" title="Instagram ${c.instagram ? 'connected' : 'not connected'}">${icon('instagram', 16)}</span></div>`; }).join('')}</div>
    ${anyLive ? '' : `<div class="flag info">${icon('info', 18)}<span>No Page is connected yet, so “Publish” runs as a rehearsal: it records exactly what would be sent, and nothing goes out. Export a posting pack to post by hand.</span></div>`}
    ${section('Ready to post', by('approved'), conn, 'Stamp a post in the studio and it lands here.')}
    ${section('Exported', by('exported'), conn, 'Posting packs you have exported show here until they go out.')}
    ${section('Published', by('published').reverse(), conn, 'Nothing published from Barnstorm yet.')}`;

  $$('[data-export]', view).forEach((b) => (b.onclick = async () => {
    const r = await busy('Writing the posting pack…', () => api('POST', `/api/posts/${encodeURIComponent(b.dataset.export)}/export`));
    if (r) { toast(`Saved to ${r.folder}`); render(view); }
  }));
  $$('[data-open]', view).forEach((b) => (b.onclick = () => api('POST', '/api/open-folder', { folder: b.dataset.open }).catch((e) => toast(e.message, true))));
  $$('[data-copy]', view).forEach((b) => (b.onclick = async () => {
    const p = await api('GET', `/api/posts/${encodeURIComponent(b.dataset.copy)}`);
    copyText(p.caption[p.caption.chosen || 'a'], b);
  }));
  $$('[data-publish]', view).forEach((b) => (b.onclick = async () => {
    const id = b.dataset.publish, row = b.closest('.pub');
    const platforms = $$('input[name=pf]:checked', row).map((x) => x.value);
    if (!platforms.length) return toast('Tick Facebook, Instagram or both.', true);
    const live = b.dataset.live === '1';
    if (live && !confirm(`Publish now to ${platforms.join(' and ')}? This posts publicly on the ${marketName(b.dataset.market)} Page.`)) return;
    const r = await busy(live ? 'Publishing…' : 'Rehearsing the publish (nothing is sent)…', () => api('POST', `/api/posts/${encodeURIComponent(id)}/publish`, { platforms }));
    if (r) { toast(r.mock ? `Rehearsal done. Log: ${r.log}` : 'Published.'); render(view); }
  }));
}

function section(title, list, conn, none) {
  return `<section class="pubs"><h2>${esc(title)} <span class="muted">${list.length}</span></h2>
    ${list.length ? `<div class="panel flush">${list.map((p) => row(p, conn)).join('')}</div>` : `<p class="hint">${esc(none)}</p>`}</section>`;
}

function row(p, conn) {
  const c = conn.meta[p.market], live = c.facebook ? '1' : '0';
  return `<div class="pub">
    <a href="#/post/${encodeURIComponent(p.id)}" class="pt"><img src="${esc(p.thumb.replace(/card-0\.png$/, 'ig/card-0.png'))}" alt="" loading="lazy"></a>
    <div class="pi"><div class="row">${statusChip(p.status)}<b>${esc(shortMarket(p.market))} · ${esc(p.params?.category ? categoryLabel(p.market, p.params.category) : topicName(p.topic))}</b></div>
      <span class="muted">${esc(topicName(p.topic))} · goes out ${nice(p.plannedFor)} · ${p.cards} picture${p.cards > 1 ? 's' : ''}</span>
      ${p.exportedTo ? `<span class="hint">${icon('folder', 14)} ${esc(p.exportedTo)}</span>` : ''}
      ${p.published ? `<span class="hint">Facebook ${esc(p.published.facebook?.id || '–')} · Instagram ${esc(p.published.instagram?.id || '–')}</span>` : ''}</div>
    <div class="pa">
      <div class="row">
        <button class="small" data-copy="${esc(p.id)}">${icon('copy', 14)}Copy caption</button>
        <button class="small" data-export="${esc(p.id)}">${icon('folder', 14)}${p.exportedTo ? 'Export again' : 'Export pack'}</button>
        ${p.exportedTo ? `<button class="small ghost" data-open="${esc(p.exportedTo)}">${icon('external', 14)}Open folder</button>` : ''}
      </div>
      ${p.status !== 'published' ? `<div class="row">
        <label class="inline"><input type="checkbox" name="pf" value="facebook" checked> Facebook</label>
        <label class="inline"><input type="checkbox" name="pf" value="instagram" ${c.instagram || live === '0' ? 'checked' : ''}> Instagram</label>
        <button class="small ${live === '1' ? 'primary' : ''}" data-publish="${esc(p.id)}" data-market="${esc(p.market)}" data-live="${live}">${icon('publish', 14)}${live === '1' ? 'Publish now' : 'Rehearse'}</button></div>` : ''}
    </div></div>`;
}
