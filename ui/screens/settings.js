// Settings: connections, rotation (categories and themes per Page), hooks, words and schedule. Saved to config/*.json (secrets to %APPDATA%).
import { api, esc, toast, state, loadInfo, nice, ago, avatar, shortMarket, $, $$ } from '../lib.js';
import { icon } from '../icons.js';

let tab = 'connections', page = null;
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const TABS = [['connections', 'Connections'], ['rotation', 'Rotation'], ['hooks', 'Hooks'], ['words', 'Words to avoid'], ['schedule', 'Schedule']];

export async function render(view) {
  const [s, conn] = await Promise.all([api('GET', '/api/settings'), api('GET', '/api/connections')]);
  view.innerHTML = `<div class="head"><div><h1>Settings</h1><p class="sub" style="margin-bottom:0">Everything Barnstorm follows. Changes apply to the next post you build.</p></div></div>
    <div class="tabbar">${TABS.map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-t="${k}">${l}</button>`).join('')}</div><div id="st" class="panel"></div>`;
  $$('[data-t]', view).forEach((b) => (b.onclick = () => { tab = b.dataset.t; render(view); }));
  await ({ connections, rotation, hooks, words, schedule })[tab]($('#st', view), s, conn, view);
}

const save = async (fn, msg = 'Saved.') => { try { await fn(); toast(msg); return true; } catch (e) { toast(e.message, true); return false; } };

function connections(el, s, conn, view) {
  el.innerHTML = `<h2>Facebook and Instagram</h2>
    <p class="hint" style="max-width:820px">Needs a Page access token with <b>pages_manage_posts</b>, <b>pages_read_engagement</b>, <b>instagram_basic</b> and <b>instagram_content_publish</b>, from a Meta app linked to each Page (Meta Business Suite → Settings → Business assets). Tokens are saved only on this PC at ${esc(conn.path)}, never in the project folder. Leave the token box empty to keep the saved one.</p>
    <table class="form"><tr><th>Page</th><th>Facebook Page ID</th><th>Instagram account ID</th><th>Page token</th><th></th></tr>
    ${state.info.markets.map((m) => { const c = conn.meta[m.key]; return `<tr data-m="${m.key}"><td><div class="row" style="flex-wrap:nowrap">${avatar(m.logo, 'sm')}<div><b>${esc(shortMarket(m.key))}</b>
        <div class="hint">${c.facebook ? 'Facebook connected' : 'Not connected'}${c.instagram ? ' · Instagram connected' : ''}</div></div></div></td>
      <td><input type="text" name="pageId" placeholder="${c.facebook ? 'saved' : 'e.g. 1234567890'}"></td>
      <td><input type="text" name="igUserId" placeholder="${c.instagram ? 'saved' : 'e.g. 1784…'}"></td>
      <td><input type="password" name="pageToken" autocomplete="off" placeholder="${c.facebook ? '•••• saved' : 'paste token'}"></td>
      <td><div class="row" style="flex-wrap:nowrap"><button class="small primary" data-save="${m.key}">Save</button>${c.facebook ? `<button class="small danger" data-clear="${m.key}">Remove</button>` : ''}</div></td></tr>`; }).join('')}</table>
    <label style="max-width:240px;margin-top:14px">Graph API version<input type="text" id="gv" value="${esc(conn.graphVersion)}"></label>
    <h2 style="margin-top:28px">Claude (optional caption polish)</h2>
    <p class="hint">With an Anthropic API key, the Caption tab gets a “Polish with Claude” button. Numbers are always checked against the listing afterwards.</p>
    <div class="row"><input type="password" id="ak" autocomplete="off" placeholder="${conn.anthropic ? '•••• saved' : 'sk-ant-…'}" style="max-width:360px">
      <button class="primary" id="saveak">Save key</button>${conn.anthropic ? '<button class="danger" id="clearak">Remove key</button>' : ''}</div>
    <h2 style="margin-top:28px">Gemini (sharpen low-resolution photos)</h2>
    <p class="hint" style="max-width:820px">Auction photos are often only 640 px wide and look soft on a card. With a Gemini API key, Barnstorm sends each photo narrower than ${conn.photos.belowWidth} px to Google's Gemini and gets back a sharper ${esc(conn.photos.imageSize)} version, for about US$0.05 a photo. The car must come back exactly as it is, so every sharpened photo is flagged for you to compare with the original before stamping, and “Use the original” puts it back. Watermarks and blurred plates are left as they are. Get a key at aistudio.google.com/apikey. It is saved only on this PC, never in the project folder.</p>
    <div class="row"><input type="password" id="gk" autocomplete="off" placeholder="${conn.gemini ? '•••• saved' : 'AIza…'}" style="max-width:360px">
      <button class="primary" id="savegk">Save key</button>${conn.gemini ? '<button class="danger" id="cleargk">Remove key</button>' : ''}</div>
    <label class="inline" style="margin-top:12px"><input type="checkbox" id="gauto" ${conn.photos.sharpen === 'auto' ? 'checked' : ''}> Sharpen soft photos automatically when a post is built. Untick to sharpen only when you press Sharpen in the studio.</label>`;
  $$('[data-save]', el).forEach((b) => (b.onclick = async () => {
    const row = b.closest('tr'), v = Object.fromEntries($$('input', row).map((i) => [i.name, i.value]));
    if (await save(() => api('PUT', '/api/connections/meta', { market: b.dataset.save, ...v, graphVersion: $('#gv', el).value }))) render(view);
  }));
  $$('[data-clear]', el).forEach((b) => (b.onclick = async () => { if (confirm('Remove this Page connection?') && await save(() => api('PUT', '/api/connections/meta', { market: b.dataset.clear, clear: true }))) render(view); }));
  $('#saveak', el).onclick = async () => { if (await save(() => api('PUT', '/api/connections/anthropic', { apiKey: $('#ak', el).value }))) render(view); };
  const ca = $('#clearak', el);
  if (ca) ca.onclick = async () => { if (await save(() => api('PUT', '/api/connections/anthropic', { clear: true }))) render(view); };
  $('#savegk', el).onclick = async () => { if (await save(() => api('PUT', '/api/connections/gemini', { apiKey: $('#gk', el).value }), 'Gemini key checked with Google and saved.')) render(view); };
  const cg = $('#cleargk', el);
  if (cg) cg.onclick = async () => { if (await save(() => api('PUT', '/api/connections/gemini', { clear: true }), 'Gemini key removed.')) render(view); };
  $('#gauto', el).onchange = (e) => save(() => api('PUT', '/api/settings/photos', { sharpen: e.target.checked ? 'auto' : 'off' }));
}

// Rotation: which categories and themes each Page draws from, when each was last posted, and the category order.
async function rotation(el, s, conn, view) {
  const markets = state.info.markets;
  if (!markets.some((m) => m.key === page)) page = markets[0].key;
  const list = await api('GET', `/api/collections/${page}?all=1`);
  const cats = list.filter((c) => c.kind === 'category'), themes = list.filter((c) => c.kind === 'theme');
  const on = list.filter((c) => c.enabled).length;
  const item = (c, i, n) => `<div class="rot ${c.enabled ? '' : 'off'}">
    <label class="switch" title="${c.enabled ? 'Switch off for this Page' : 'Switch on'}"><input type="checkbox" data-col="${esc(c.key)}" ${c.enabled ? 'checked' : ''} aria-label="${esc(c.label)}"><span></span></label>
    <div><b>${esc(c.label)}</b>${c.suggested ? '<span class="chip st-exported">Next up</span>' : ''}<small>${!c.last ? 'Never posted' : c.last > state.info.today ? `Built, goes out ${esc(nice(c.last))}` : `Last posted ${esc(nice(c.last))}, ${esc(ago(c.last))}`}${c.planned ? ` · planned ${esc(nice(c.planned))}` : ''}</small></div>
    ${n ? `<span class="ord"><button class="small ghost" data-up="${i}" ${i ? '' : 'disabled'} aria-label="Move up" title="Prefer this one">${icon('back', 14, 'up')}</button><button class="small ghost" data-down="${i}" ${i < n - 1 ? '' : 'disabled'} aria-label="Move down" title="Prefer it less">${icon('next', 14, 'down')}</button></span>` : ''}</div>`;
  el.innerHTML = `<div class="spread" style="margin-bottom:6px"><h2 style="margin:0">Rotation</h2><div class="seg">${markets.map((m) => `<button class="${m.key === page ? 'on' : ''}" data-pg="${m.key}">${esc(shortMarket(m.key))}</button>`).join('')}</div></div>
    <p class="hint" style="max-width:820px">The planner picks the one this Page has gone longest without, never-posted first. Switch off anything you don't want on this Page. ${on} of ${list.length} switched on. Themes are only offered where the site has at least 40 lots for them.</p>
    <div class="grid g2" style="margin-top:8px">
      <div><h3>Site categories <span class="muted">${cats.length}</span></h3><p class="hint" style="margin:0 0 8px">The site's Popular categories. Higher up wins a tie.</p><div class="rots">${cats.map((c, i) => item(c, i, cats.length)).join('')}</div></div>
      <div><h3>Themes <span class="muted">${themes.length}</span></h3><p class="hint" style="margin:0 0 8px">Brands, models and filters that cut across categories.</p><div class="rots">${themes.map((c) => item(c, 0, 0)).join('')}</div></div>
    </div>`;
  $$('[data-pg]', el).forEach((b) => (b.onclick = () => { page = b.dataset.pg; rotation(el, s, conn, view); }));
  $$('[data-col]', el).forEach((cb) => (cb.onchange = async () => {
    const disabled = $$('[data-col]', el).filter((x) => !x.checked).map((x) => x.dataset.col);
    await save(() => api('PUT', `/api/settings/markets/${page}/collections`, { disabled }), cb.checked ? 'Switched on.' : 'Switched off. The planner skips it on this Page.');
    await loadInfo(true);
    rotation(el, s, conn, view);
  }));
  const move = async (i, delta) => {
    const order = s.markets.markets[page].categories.map((c) => c.slug), j = i + delta;
    [order[i], order[j]] = [order[j], order[i]];
    if (await save(() => api('PUT', `/api/settings/markets/${page}/categories`, { order }))) { await loadInfo(true); render(view); }
  };
  $$('[data-up]', el).forEach((b) => (b.onclick = () => move(Number(b.dataset.up), -1)));
  $$('[data-down]', el).forEach((b) => (b.onclick = () => move(Number(b.dataset.down), 1)));
}

function hooks(el, s, conn, view) {
  const h = s.hooks;
  el.innerHTML = `<h2>Model hooks</h2><p class="hint">Used first when a car matches. Keep each one true, short (22 characters at most) and lively. {seatsWord} becomes "seven" and so on.</p>
    <table id="mh" class="form"><tr><th>Make</th><th>Model</th><th>Model code</th><th>Seats at least</th><th>Hook</th><th></th></tr>
    ${h.models.map((m, i) => row(m, i)).join('')}</table>
    <div class="row" style="margin-top:8px"><button id="addm">${icon('plus', 16)}Add model</button></div>
    <h2 style="margin-top:28px">Selling-point hooks</h2><p class="hint">Used when the auction sheet's selling points or equipment mention the pattern.</p>
    <table id="ph" class="form"><tr><th>Looks for</th><th>Hook</th></tr>${h.points.map((p, i) => `<tr><td><code>${esc(p.re)}</code>${p.make ? ` <span class="hint">(${esc(p.make)} only)</span>` : ''}</td>
      <td><input type="text" data-p="${i}" value="${esc(p.hook)}" maxlength="30"></td></tr>`).join('')}</table>
    <button class="primary" id="saveh" style="margin-top:14px">Save hooks</button>`;
  function row(m, i) {
    return `<tr data-i="${i}">${['make', 'model', 'modelCode', 'seatsMin', 'hook'].map((k) => `<td><input type="text" name="${k}" value="${esc(m[k] ?? '')}"></td>`).join('')}
      <td><button class="small ghost danger" data-rm="${i}" aria-label="Remove">${icon('x', 14)}</button></td></tr>`;
  }
  $('#addm', el).onclick = () => { $('#mh', el).insertAdjacentHTML('beforeend', row({}, Date.now())); };
  el.onclick = (e) => { const b = e.target.closest('[data-rm]'); if (b) b.closest('tr').remove(); };
  $('#saveh', el).onclick = async () => {
    const models = $$('#mh tr[data-i]', el).map((tr) => Object.fromEntries($$('input', tr).map((i) => [i.name, i.value])))
      .filter((m) => m.make || m.model || m.hook).map((m, i) => ({ ...m, key: h.models[i]?.hook === m.hook ? h.models[i]?.key : undefined }));
    const points = h.points.map((p, i) => ({ ...p, hook: $(`[data-p="${i}"]`, el).value.trim() || p.hook }));
    if (await save(() => api('PUT', '/api/settings/hooks', { models, points }))) render(view);
  };
}

function words(el, s, conn, view) {
  const rm = `<button class="small ghost danger" data-rm aria-label="Remove">${icon('x', 14)}</button>`;
  el.innerHTML = `<h2>Words and phrases to avoid</h2><p class="hint">Any of these in a picture or caption blocks approval. From the About kit, Jim's corrections and the Learn page.</p>
    <table id="nv" class="form"><tr><th>Phrase</th><th>Why</th><th></th></tr>${s.rules.never.map((n) => `<tr><td><input type="text" name="phrase" value="${esc(n.phrase)}"></td>
      <td><input type="text" name="why" value="${esc(n.why || '')}"></td><td>${rm}</td></tr>`).join('')}</table>
    <div class="row" style="margin-top:10px"><button id="addn">${icon('plus', 16)}Add phrase</button><button class="primary" id="saven">Save</button></div>`;
  el.onclick = (e) => { const b = e.target.closest('[data-rm]'); if (b) b.closest('tr').remove(); };
  $('#addn', el).onclick = () => $('#nv', el).insertAdjacentHTML('beforeend', `<tr><td><input type="text" name="phrase"></td><td><input type="text" name="why"></td><td>${rm}</td></tr>`);
  $('#saven', el).onclick = async () => {
    const never = $$('#nv tr', el).slice(1).map((tr) => Object.fromEntries($$('input', tr).map((i) => [i.name, i.value])));
    if (await save(() => api('PUT', '/api/settings/rules', { never }))) render(view);
  };
}

function schedule(el, s, conn, view) {
  const c = s.schedule, topics = state.info.topics;
  el.innerHTML = `<h2>Weekly pattern</h2><p class="hint">The same for every Page. Three posts a week per Page is 15 posts in total.</p>
    <div class="grid g4">${DAYS.map((d) => `<label>${d[0].toUpperCase() + d.slice(1)}<select name="${d}"><option value="">No post</option>${topics.map((t) => `<option value="${t.key}" ${c.pattern[d] === t.key ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select></label>`).join('')}</div>
    <div class="grid g3" style="margin-top:18px"><label>Market fact every … weeks (0 = never)<input type="text" id="fe" value="${c.factEveryWeeks}"></label>
      <label>Market fact replaces<select id="fd">${DAYS.map((d) => `<option ${d === c.factDay ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      <label>Don't repeat a category or theme for … days<input type="text" id="cd" value="${c.categoryCooldownDays}"></label></div>
    <button class="primary" id="saves" style="margin-top:14px">Save schedule</button>`;
  $('#saves', el).onclick = async () => {
    const pattern = Object.fromEntries(DAYS.map((d) => [d, $(`[name=${d}]`, el).value]));
    if (await save(() => api('PUT', '/api/settings/schedule', { pattern, factEveryWeeks: $('#fe', el).value, factDay: $('#fd', el).value, categoryCooldownDays: $('#cd', el).value }))) render(view);
  };
}
