// Studio: one post, checked in real Facebook and Instagram frames. Every save makes a new version and re-renders only what changed.
import { api, esc, busy, toast, ask, copyText, $, $$, marketOf, shortMarket, topicName, categoryLabel, statusChip, nice, flagList, avatar } from '../lib.js';
import { icon } from '../icons.js';
import { crumbs } from '../app.js';

const ui = { id: null, sel: 0, tab: 'card', blurDraft: null, compare: null, fmt: 'ig' };
const STAGE = { 'lot-card': { square: 810, ig: 810 } };   // photo height, as in templates/lot-card.html
const SLOT_LABEL = { hook: 'Hook (big line)', model: 'Car name', feat: 'Features (for the caption, not on the picture)', km: 'Mileage chip',
  chip: 'Price (older design)', grade: 'Grade chip', pill: 'Line on the right of the bar', eyebrow: 'Small heading', title: 'Title', body: 'Body text', tag: 'Photo pill', note: 'Note', totalLabel: 'Total label', total: 'Total' };
const TABS = [['card', 'text', 'Text'], ['photo', 'image', 'Photo'], ['caption', 'caption', 'Caption'], ['history', 'history', 'History']];
const SPLIT_AT = 760;   // inspector width (px) from which the caption gets its own column instead of a tab
const chosenCaption = (post) => post.caption?.[post.caption?.chosen || 'a'] || '';

export async function render(view, id) {
  if (ui.id !== id) Object.assign(ui, { id, sel: 0, tab: 'card', blurDraft: null, compare: null });
  const post = await api('GET', `/api/posts/${encodeURIComponent(id)}`);
  draw(view, post);
}

// Caption as the network shows it before "See more".
function shortCap(text, n, more) {
  const t = String(text || '');
  if (t.length <= n) return esc(t);
  const cut = t.slice(0, n).replace(/\s+\S*$/, '');
  return `${esc(cut)}<span class="more">… ${more}</span>`;
}

function frame(post, m) {
  const cap = post.caption?.[post.caption?.chosen || 'a'] || '';
  const stamped = ['approved', 'exported', 'published'].includes(post.status)
    ? `<div class="stamp ${ui.justStamped ? 'hit' : ''}"><div>APPROVED<br>${esc(nice(post.plannedFor))}</div></div>` : '';
  const img = `<div class="preview ${ui.fmt === 'ig' ? 'p34' : ''}" id="pv"><img src="${imgs(post)[ui.sel]}?v=${post.version}" alt="Card ${ui.sel + 1}"><canvas id="cv"></canvas>${stamped}</div>`;
  const head = (sub) => `<div class="fh">${avatar(m.logo)}<div><b>${esc(m.brand)}</b><small>${sub}</small></div>${icon('dots', 20)}</div>`;
  if (ui.fmt === 'ig') {
    return `<div class="frame ig-frame">${head(esc(m.site))}${img}
      ${post.cards.length > 1 ? `<div class="dots">${post.cards.map((_, i) => `<i class="${i === ui.sel ? 'on' : ''}"></i>`).join('')}</div>` : ''}
      <div class="acts">${icon('heart', 22)}${icon('comment', 22)}${icon('share', 22)}<span style="margin-left:auto">${icon('bookmark', 22)}</span></div>
      <div class="cap"><b>${esc(m.brand)}</b> ${shortCap(cap, 125, 'more')}</div></div>`;
  }
  return `<div class="frame fb-frame">${head(`${esc(nice(post.plannedFor))} · ${icon('globe', 12)}`)}
    <div class="cap">${shortCap(cap, 180, 'See more')}</div>${img}
    <div class="acts"><span>${icon('thumb', 18)}Like</span><span>${icon('comment', 18)}Comment</span><span>${icon('share', 18)}Share</span></div></div>`;
}

function draw(view, post, measured = false) {
  Object.assign(ui, { view, post });
  ui.sel = Math.min(ui.sel, post.cards.length - 1);
  if (ui.split && ui.tab === 'caption') ui.tab = 'card';
  const c = post.cards[ui.sel], m = marketOf(post.market);
  const errors = (post.qa || []).filter((f) => f.severity === 'error').length;
  const title = `${post.params?.category ? categoryLabel(post.market, post.params.category) : topicName(post.topic)}`;
  const dot = (i) => { const f = (post.qa || []).filter((x) => x.card === i); return f.some((x) => x.severity === 'error') ? '<span class="dot"></span>' : f.some((x) => x.severity === 'warn') ? '<span class="dot warn"></span>' : ''; };
  crumbs(`<a href="#/feeds/${esc(post.market)}">${esc(shortMarket(post.market))}</a>${icon('next', 14)}<span>${esc(title)}</span>`);
  view.innerHTML = `
    <div class="head"><div><h1>${esc(shortMarket(post.market))}: ${esc(title)}</h1>
        <div class="row" style="margin-top:6px">${statusChip(post.status, errors)}<span class="muted">${esc(topicName(post.topic))} · goes out ${nice(post.plannedFor)} · version ${post.version}${post.exportedTo ? ' · exported' : ''}${post.published ? ' · published' : ''}</span></div></div>
      <div class="row">
        <button id="recheck" title="Re-read every lot from the site and run all checks">${icon('refresh', 16)}Re-check</button>
        ${post.status === 'draft' ? `<button class="danger" id="reject">${icon('x', 16)}Reject</button><button class="primary ${errors ? 'blocked' : ''}" id="approve" aria-disabled="${errors ? 'true' : 'false'}" ${errors ? 'title="Fix the red checks first"' : ''}>${icon('stamp', 16)}${errors ? `Approve · ${errors} to fix` : 'Approve'}</button>`
          : post.status === 'published' ? '' : `<button id="reopen">${icon('back', 16)}Back to draft</button>`}
      </div></div>
    ${post.designOutdated ? `<div class="flag info redraw">${icon('refresh', 18)}<span>These pictures use an earlier card design.${['approved', 'exported'].includes(post.status) ? ' Redrawing sends the post back to draft for a new stamp.' : ''}</span>
      <button class="small" id="redraw">Redraw with the new design</button></div>` : ''}
    <div class="studio">
      <div class="film ${ui.fmt === 'ig' ? '' : 'sq'}">${imgs(post).map((src, i) => `<button class="${i === ui.sel ? 'on' : ''}" data-sel="${i}" title="Card ${i + 1}"><img src="${src}?v=${post.version}" alt="Card ${i + 1}">${dot(i)}</button>`).join('')}</div>
      <div class="stage ${ui.fmt === 'ig' ? '' : 'sq'}">
        <div class="bar"><div class="seg"><button class="${ui.fmt === 'square' ? 'on' : ''}" data-fmt="square">${icon('facebook', 16)}Facebook 1:1</button><button class="${ui.fmt === 'ig' ? 'on' : ''}" data-fmt="ig">${icon('instagram', 16)}Instagram 3:4</button></div>
          <span class="muted">Picture ${ui.sel + 1} of ${post.cards.length}</span>
          <button class="small" id="copycap" title="Copy the chosen caption, hashtags included">${icon('copy', 14)}Copy caption</button></div>
        ${frame(post, m)}
      </div>
      <div class="inspector ${ui.split ? 'split' : ''}"><div>
        <div class="checks"><h2>${icon(errors ? 'alert' : 'check', 18)}${errors ? `${errors} to fix before approval` : 'Checks'}</h2><div id="qa">${flagList(post.qa)}</div></div>
        <div class="tabs">${TABS.filter(([k]) => !(ui.split && k === 'caption')).map(([k, ic, l]) => `<button class="${k === ui.tab ? 'on' : ''}" data-tab="${k}">${icon(ic, 16)}${l}</button>`).join('')}</div>
        <div class="body" id="tab"></div></div>
        ${ui.split ? `<div class="ins-cap"><h2>${icon('caption', 18)}Caption</h2><div class="body" id="captab"></div></div>` : ''}
      </div>
    </div>`;

  // Measure once: a wide inspector moves the caption out of its tab into a column beside it.
  const split = $('.inspector', view).clientWidth >= SPLIT_AT;
  if (split !== !!ui.split && !measured) { ui.split = split; return draw(view, post, true); }

  $('#copycap', view).onclick = (e) => copyText(chosenCaption(post), e.currentTarget);
  const rd = $('#redraw', view);
  if (rd) rd.onclick = () => act(view, 'Redrawing every picture with the new design…', () => api('POST', `/api/posts/${post.id}/redraw`));
  $$('[data-fmt]', view).forEach((b) => (b.onclick = () => { ui.fmt = b.dataset.fmt; ui.blurDraft = null; draw(view, post); }));
  $$('[data-sel]', view).forEach((b) => (b.onclick = () => { ui.sel = Number(b.dataset.sel); ui.blurDraft = null; draw(view, post); }));
  $$('[data-tab]', view).forEach((b) => (b.onclick = () => { ui.tab = b.dataset.tab; draw(view, post); }));
  $$('[data-flag]', view).forEach((el) => (el.onclick = () => { const f = post.qa[Number(el.dataset.flag)]; if (f.card != null) { ui.sel = f.card; draw(view, post); } }));
  $('#recheck', view).onclick = () => act(view, 'Re-reading the listings and running every check…', () => api('POST', `/api/posts/${post.id}/recheck`));
  $('#reopen', view) && ($('#reopen', view).onclick = () => act(view, 'Reopening…', () => api('POST', `/api/posts/${post.id}/reopen`)));
  $('#reject', view) && ($('#reject', view).onclick = async () => {
    const v = await ask('Reject this post', '<label>Why? Barnstorm learns from this.<input type="text" name="reason" required placeholder="e.g. hooks too generic, wrong theme for this Page"></label>', 'Reject');
    if (v && await act(view, 'Saving…', () => api('POST', `/api/posts/${post.id}/reject`, { reason: v.reason }))) toast('Rejected. Its day on the Plan is free again: build it again there or on Feeds.');
  });
  $('#approve', view) && ($('#approve', view).onclick = async () => {
    if (errors) { $('.checks', view).scrollIntoView({ behavior: 'smooth', block: 'start' }); toast('Fix the red checks first, then approve.', true); return; }
    const r = await busy('Re-reading every lot and running the final checks…', async () => {
      try { return await api('POST', `/api/posts/${post.id}/approve`); } catch (e) {
        if (e.status === 409) { post.qa = e.data.qa; draw(view, post); toast(e.message, true); return null; }
        throw e;
      }
    });
    if (!r) return;
    ui.justStamped = true;   // the stamp drops in once; afterwards it just sits on the preview
    draw(view, r);
    ui.justStamped = false;
    toast('Stamped. It is waiting on Publish.');
  });

  const tab = $('#tab', view);
  if (ui.tab === 'card') cardTab(view, tab, post, c);
  if (ui.tab === 'photo') photoTab(view, tab, post, c);
  if (ui.tab === 'caption') captionTab(view, tab, post);
  if (ui.split) captionTab(view, $('#captab', view), post);
  if (ui.tab === 'history') historyTab(view, tab, post);
  overlay(view, post, c);
}

async function act(view, msg, fn) {
  const p = await busy(msg, fn);
  if (p) draw(view, p);
  return p;
}
const imgs = (post) => (ui.fmt === 'ig' ? post.igImages : post.images);
const patch = (view, post, body, msg = 'Re-rendering the picture…') => act(view, msg, () => api('PATCH', `/api/posts/${post.id}`, { card: ui.sel, ...body }));

// ---- card text ----
function cardTab(view, tab, post, c) {
  const f = c.facts || {};
  const slots = Object.keys(c.slots).filter((k) => typeof c.slots[k] === 'string' && k !== 'pillTone');
  tab.innerHTML = `<form class="fields" id="slots">
    ${slots.map((k) => `<label>${esc(SLOT_LABEL[k] || k)}${(c.locked || []).includes(k) ? ' <span class="hint">(edited by you)</span>' : ''}
      ${k === 'body' ? `<textarea name="${k}" style="min-height:90px">${esc(c.slots[k])}</textarea>` : `<input type="text" name="${k}" value="${esc(c.slots[k])}">`}
      ${k === 'hook' && c.hookOptions?.length ? `<span class="row">${c.hookOptions.map((h) => `<button type="button" class="chip" data-hook="${esc(h.text)}" title="from ${esc(h.source)}">${esc(h.text)}</button>`).join('')}</span>` : ''}
    </label>`).join('')}
    <div class="row"><button class="primary">Save text</button><span class="hint">Only this picture is re-rendered, in both formats. On the picture, every word of the hook, car name and title starts with a capital.</span></div></form>
    ${f.id ? `<h3>From the listing</h3><table class="facts">
      <tr><th>Lot</th><td><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.id)} · ${esc(f.title)}</a></td></tr>
      <tr><th>Auction</th><td>${esc(f.auctionHouse || '')} · ${nice(f.auctionDate)}</td></tr>
      <tr><th>Grade</th><td>${esc(f.grade || '')}${f.interiorGrade ? ` · interior ${esc(f.interiorGrade)}` : ''}${f.exteriorGrade ? ` · exterior ${esc(f.exteriorGrade)}` : ''}</td></tr>
      <tr><th>Odometer</th><td>${f.odometerKm != null ? Number(f.odometerKm).toLocaleString('en-GB') + ' km' : ''}</td></tr>
      ${f.variant ? `<tr><th>Variant</th><td>${esc(f.variant)}</td></tr>` : ''}
      ${f.sellingPoints ? `<tr><th>Selling points</th><td>${esc(f.sellingPoints)}</td></tr>` : ''}
      ${f.equipment ? `<tr><th>Equipment</th><td>${esc(f.equipment)}</td></tr>` : ''}
      ${f.inspectorNotes ? `<tr><th>Inspector notes</th><td>${esc(f.inspectorNotes)}</td></tr>` : ''}
      ${f.price ? `<tr><th>Price</th><td>${esc(f.price.currency)} ${Number(f.price.amount).toLocaleString('en-GB')}</td></tr>` : ''}
    </table>` : ''}
    ${c.kind === 'lot' ? `<h3>Swap this car</h3><div id="cands" class="cands"><button type="button" id="loadc">${icon('swap', 16)}Show other strong lots</button></div>` : ''}`;
  $$('[data-hook]', tab).forEach((b) => (b.onclick = () => { $('[name=hook]', tab).value = b.dataset.hook; }));
  $('#slots', tab).onsubmit = (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target)), changed = {};
    for (const k of Object.keys(v)) if (v[k] !== c.slots[k]) changed[k] = v[k];
    if (!Object.keys(changed).length) return toast('Nothing changed.');
    patch(view, post, { slots: changed });
  };
  const lc = $('#loadc', tab);
  if (lc) lc.onclick = async () => {
    const list = await api('GET', `/api/posts/${post.id}/alternatives`);
    $('#cands', tab).innerHTML = list.length ? list.slice(0, 10).map((x) => `<div class="cand"><img src="${esc(x.photo.replace(/&h=\d+&w=\d+$/, '&h=150&w=200'))}" alt="" loading="lazy">
      <div><b>${esc(x.title)}</b><div class="muted">Grade ${esc(x.grade)} · ${x.odometerKm != null ? Number(x.odometerKm).toLocaleString('en-GB') + ' km' : ''} · ${nice(x.auctionDate)}</div></div>
      <button type="button" class="small" data-swap="${esc(x.id)}">Use</button></div>`).join('') : '<p class="muted">No other lots were shortlisted. Rebuild the post for fresh ones.</p>';
    $$('[data-swap]', tab).forEach((b) => (b.onclick = () => act(view, 'Swapping the car…', () => api('POST', `/api/posts/${post.id}/swap`, { card: ui.sel, lotId: b.dataset.swap }))));
  };
}

// ---- photo, crop, blur, plates ----
const photoOptions = (c) => c.photoOptions || (c.facts?.photos || []).filter((u) => !/[?&]number=0(&|$)/.test(u));
const thumbUrl = (u) => (u.includes('photos.carbarn.com.au') ? `${u.replace(/&h=\d+|&w=\d+/g, '')}&h=150&w=200` : u);

function photoTab(view, tab, post, c) {
  if (!c.photo?.file) { tab.innerHTML = '<p class="muted">This card has no photo.</p>'; return; }
  const opts = photoOptions(c), blur = ui.blurDraft || c.blur || [];
  tab.innerHTML = `
    <label class="inline"><input type="checkbox" id="plates" ${c.platesChecked ? 'checked' : ''}> Plates checked: no readable number plate on this card</label>
    <p class="hint">${c.photo.source === 'auction' ? 'Auction-house photo: plates are usually blurred already, but not always.' : 'Carbarn\'s own yard photo (rights-safe), but its plates are not blurred.'} Look at the preview, blur anything readable, then tick.</p>
    ${sharpness(post, c)}
    <h3>Blur boxes</h3>
    <div class="row"><button type="button" id="drawb">${ui.blurDraft ? 'Stop drawing' : 'Draw a blur box'}</button>
      ${ui.blurDraft ? '<button type="button" class="primary" id="saveb">Save blur boxes</button>' : ''}
      <span class="hint">${blur.length} box${blur.length === 1 ? '' : 'es'}</span></div>
    ${ui.blurDraft ? '<p class="hint">Click the four corners of the plate on the preview, following its slant. Right-click takes back the last corner. Add as many boxes as you need, then save.</p>' : ''}
    ${blur.map((b, i) => `<div class="row"><span class="muted">Box ${i + 1}</span><button type="button" class="small danger" data-rmb="${i}">Remove</button></div>`).join('')}
    <h3>Crop</h3>
    <div class="grid g3"><label>Left / right<input type="range" min="0" max="100" value="${c.focus?.x ?? 50}" id="fx"></label>
      <label>Up / down<input type="range" min="0" max="100" value="${c.focus?.y ?? 50}" id="fy"></label>
      <label>Zoom<input type="range" min="1" max="2" step="0.05" value="${c.zoom || 1}" id="zm"></label></div>
    <button type="button" id="crop">Apply crop</button>
    <label class="inline" style="margin-top:10px"><input type="checkbox" id="igfit" ${c.igfit === 'contain' ? 'checked' : ''}> Instagram: show the whole photo (for tightly framed shots)</label>
    ${opts.length > 1 ? `<h3>Choose another photo</h3><div class="photos">${opts.map((u, i) => `<button type="button" class="${i === (c.photo.index ?? 0) ? 'on' : ''}" data-ph="${i}"><img src="${esc(thumbUrl(u))}" alt="Photo ${i + 1}" loading="lazy"></button>`).join('')}</div>` : ''}
    <p class="hint" style="margin-top:12px">Photo ${c.photo.w}×${c.photo.h}px${c.photo.w < 1000 ? ' (low resolution: it will look soft)' : ''}.</p>`;
  const pl = $('#plates', tab);
  $$('[data-enhance]', tab).forEach((b) => (b.onclick = () => patch(view, post, { enhance: b.dataset.enhance === '1' },
    b.dataset.enhance === '1' ? 'Sharpening the photo with Gemini: 10 to 30 seconds…' : 'Putting the original photo back…')));
  if (pl) pl.onchange = () => patch(view, post, { platesChecked: pl.checked }, 'Saving…');
  $('#drawb', tab).onclick = () => { ui.blurDraft = ui.blurDraft ? null : [...(c.blur || [])]; draw(view, post); };
  const sb = $('#saveb', tab);
  if (sb) sb.onclick = async () => { const boxes = ui.blurDraft; ui.blurDraft = null; await patch(view, post, { blur: boxes }); };
  $$('[data-rmb]', tab).forEach((b) => (b.onclick = () => {
    const boxes = [...blur]; boxes.splice(Number(b.dataset.rmb), 1);
    if (ui.blurDraft) { ui.blurDraft = boxes; draw(view, post); } else patch(view, post, { blur: boxes });
  }));
  $('#igfit', tab).onchange = (e) => { ui.fmt = 'ig'; patch(view, post, { igfit: e.target.checked ? 'contain' : 'cover' }); };
  $('#crop', tab).onclick = () => patch(view, post, { focus: { x: Number($('#fx', tab).value), y: Number($('#fy', tab).value) }, zoom: Number($('#zm', tab).value) });
  $$('[data-ph]', tab).forEach((b) => (b.onclick = () => patch(view, post, { photoIndex: Number(b.dataset.ph) }, 'Loading the photo and re-rendering…')));
}

// Gemini sharpening: the button, or the sharpened photo beside its original to compare.
function sharpness(post, c) {
  if (!c.photo.enhanced) {
    return `<h3>Sharpness</h3><div class="row"><button type="button" data-enhance="1">${icon('bolt', 16)}Sharpen with Gemini</button>
      <span class="hint">${c.photo.w < 1000 ? `This photo is ${c.photo.w}px wide and will look soft. ` : ''}Sends it to Google's Gemini, about US$0.05. The car must stay exactly as it is.</span></div>`;
  }
  const s = post.sharpened?.[ui.sel], o = c.photo.original;
  return `<h3>Sharpened by Gemini</h3>
    <p class="hint">From ${o.w}×${o.h} to ${c.photo.w}×${c.photo.h}. Compare the two: the car must look exactly as it is, with nothing added, removed or repaired. Then look at the plates again.</p>
    ${s?.original && s?.now ? `<div class="compare sharp"><figure><a href="${esc(s.original)}" target="_blank" rel="noopener"><img src="${esc(s.original)}" alt="Original photo"></a><figcaption>Original</figcaption></figure>
      <figure><a href="${esc(s.now)}" target="_blank" rel="noopener"><img src="${esc(s.now)}" alt="Sharpened photo"></a><figcaption>Sharpened (click to open full size)</figcaption></figure></div>` : ''}
    <button type="button" data-enhance="0">${icon('back', 16)}Use the original</button>`;
}

// Photo placement, mirrored from templates/shared.js, to map preview pixels to image percentages.
function placement(c) {
  const ig = ui.fmt === 'ig', W = 1080, nw = c.photo.w, nh = c.photo.h;
  const H = STAGE[c.template]?.[ig ? 'ig' : 'square'] || (ig ? c.igStageH : c.stageH) || 736, contain = ig && c.igfit === 'contain';
  const s = contain ? Math.min(W / nw, H / nh) : Math.max(W / nw, H / nh) * Math.max(1, c.zoom || 1), dw = nw * s, dh = nh * s;
  return { H, dw, dh, left: contain ? (W - dw) / 2 : -(dw - W) * (c.focus?.x ?? 50) / 100, top: contain ? H - dh : -(dh - H) * (c.focus?.y ?? 50) / 100 };
}

// Plates are seldom square to the camera, so a blur box is drawn by clicking its four corners (Jim, 2 Nov 2026).
// Kept in % of the photo: the corners (pts) and the box around them (x, y, w, h), which older boxes have alone.
// The corners are put in order around their middle, so any click order makes a plain four-sided shape.
function quad(pts) {
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length, my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const ring = [...pts].sort((a, b) => Math.atan2(a.y - my, a.x - mx) - Math.atan2(b.y - my, b.x - mx));
  const xs = ring.map((p) => p.x), ys = ring.map((p) => p.y), x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, pts: ring };
}
const corners = (b) => b.pts || [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }];

function overlay(view, post, c) {
  const pv = $('#pv', view), cv = $('#cv', view);
  if (!c.photo?.w) return;
  const size = pv.clientWidth, k = size / 1080, tall = ui.fmt === 'ig' ? size * 4 / 3 : size;
  cv.width = size; cv.height = tall;
  const g = cv.getContext('2d'), P = placement(c);
  const boxes = ui.blurDraft || (ui.tab === 'photo' ? c.blur || [] : []);
  const toPx = (p) => [(P.left + p.x / 100 * P.dw) * k, (P.top + p.y / 100 * P.dh) * k];
  const pct = (v) => Math.min(100, Math.max(0, v));
  const toPhoto = ([x, y]) => ({ x: pct((x / k - P.left) / P.dw * 100), y: pct((Math.min(y / k, P.H) - P.top) / P.dh * 100) });
  const clicks = [];   // corners clicked so far, in preview pixels
  const shape = (pts, close) => { g.beginPath(); pts.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y))); if (close) g.closePath(); };
  const paint = (pointer) => {
    g.clearRect(0, 0, size, tall);
    g.setLineDash([6, 4]); g.lineWidth = 2; g.strokeStyle = '#0473EA'; g.fillStyle = 'rgba(4,115,234,.15)';
    for (const b of boxes) { shape(corners(b).map(toPx), true); g.fill(); g.stroke(); }
    if (!clicks.length) return;
    g.setLineDash([]); g.strokeStyle = g.fillStyle = '#c62828';
    shape(pointer ? [...clicks, pointer] : clicks, false); g.stroke();
    for (const [x, y] of clicks) { g.beginPath(); g.arc(x, y, 4, 0, 2 * Math.PI); g.fill(); }
  };
  paint();
  pv.classList.toggle('drawing', !!ui.blurDraft);
  cv.onmousedown = cv.onmousemove = cv.oncontextmenu = null;
  if (!ui.blurDraft) return;
  const at = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.onmousemove = (e) => paint(at(e));
  cv.oncontextmenu = (e) => { e.preventDefault(); clicks.pop(); paint(at(e)); };   // right-click takes back the last corner
  cv.onmousedown = (e) => {
    if (e.button !== 0) return;
    clicks.push(at(e));
    if (clicks.length < 4) return paint(at(e));
    const xs = clicks.map((p) => p[0]), ys = clicks.map((p) => p[1]);
    if (Math.max(...xs) - Math.min(...xs) < 4 || Math.max(...ys) - Math.min(...ys) < 4) { clicks.length = 0; return paint(); }
    boxes.push(quad(clicks.map(toPhoto)));
    draw(view, post);   // ui.blurDraft is `boxes`, so the new box stays; this refreshes the count and Save button
  };
}

// ---- caption ----
function captionTab(view, tab, post) {
  const cap = post.caption || {};
  tab.innerHTML = `<form class="fields" id="capf">
    ${cap.locked ? '<p class="hint">You edited this caption, so the engine will not rewrite it. Use “Rewrite from today\'s data” to start fresh.</p>' : ''}
    ${['a', 'b'].map((k) => `<label><span class="capl"><span class="row"><input type="radio" name="chosen" value="${k}" ${cap.chosen === k ? 'checked' : ''}> Caption ${k.toUpperCase()} ${k === 'a' ? '(count for the first auction day)' : '(short, live right now)'}</span>
        <button type="button" class="small" data-copycap="${k}" title="Copy this caption as it is in the box">${icon('copy', 14)}Copy</button></span>
      <textarea name="${k}">${esc(cap[k] || '')}</textarea><span class="hint" data-len="${k}">${(cap[k] || '').length} characters</span></label>`).join('')}
    <div class="row"><button class="primary">Save caption</button><button type="button" id="rewrite">Rewrite from today's data</button>
      <button type="button" id="polish" title="Needs an Anthropic API key in Settings">Polish the chosen caption with Claude</button></div></form>`;
  $$('[data-copycap]', tab).forEach((b) => (b.onclick = (e) => { e.preventDefault(); copyText($(`textarea[name=${b.dataset.copycap}]`, tab).value, b, `Caption ${b.dataset.copycap.toUpperCase()}`); }));
  $$('textarea', tab).forEach((t) => (t.oninput = () => { $(`[data-len=${t.name}]`, tab).textContent = `${t.value.length} characters`; }));
  $('#capf', tab).onsubmit = (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target));
    const caption = { chosen: v.chosen };
    if (v.a !== cap.a) caption.a = v.a;
    if (v.b !== cap.b) caption.b = v.b;
    act(view, 'Saving…', () => api('PATCH', `/api/posts/${post.id}`, { caption }));
  };
  $('#rewrite', tab).onclick = () => act(view, 'Reading today\'s counts and rewriting…', () => api('POST', `/api/posts/${post.id}/refresh-counts`));
  $('#polish', tab).onclick = () => act(view, 'Polishing the caption with Claude, then checking every number and link…',
    () => api('POST', `/api/posts/${post.id}/polish`, { which: $('[name=chosen]:checked', tab)?.value || 'a' }));
}

// Crossing the width where the caption gets its own column redraws the studio (on a resize, never while typing).
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const ins = ui.view && $('.inspector', ui.view);
    if (ins && (ins.clientWidth >= SPLIT_AT) !== !!ui.split) draw(ui.view, ui.post);
  }, 200);
});

// ---- history ----
async function historyTab(view, tab, post) {
  tab.innerHTML = `<table><tr><th>Version</th><th>Change</th><th>When</th><th></th></tr>
    ${[...post.versions].reverse().map((v) => `<tr><td>v${v.version}</td><td>${esc(v.reason || '')}</td><td class="muted">${v.updatedAt ? new Date(v.updatedAt).toLocaleString('en-GB') : ''}</td>
      <td>${v.version !== post.version ? `<button class="small" data-cmp="${v.version}">Compare</button>` : '<span class="chip">current</span>'}</td></tr>`).join('')}</table>
    <div id="cmp" style="margin-top:16px"></div>`;
  $$('[data-cmp]', tab).forEach((b) => (b.onclick = async () => {
    const old = await api('GET', `/api/posts/${post.id}/versions/${b.dataset.cmp}`);
    $('#cmp', tab).innerHTML = old.cards.map((_, i) => `<div class="compare" style="margin-bottom:12px">
      <div><h3>v${old.version} · card ${i + 1}</h3><img src="${old.images[i]}" alt=""></div>
      <div><h3>now · card ${i + 1}</h3><img src="${post.images[i] || ''}?v=${post.version}" alt=""></div></div>`).join('')
      + `<div class="compare"><div><h3>v${old.version} caption</h3><pre>${esc(old.caption?.[old.caption?.chosen || 'a'] || '')}</pre></div><div><h3>now</h3><pre>${esc(post.caption?.[post.caption?.chosen || 'a'] || '')}</pre></div></div>`;
  }));
}
