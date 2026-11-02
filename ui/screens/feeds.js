// Feeds: each Page as its own Instagram profile grid, before it exists. Planned slots, built posts, stamped and published ones.
// Two panes of one height: the Page and its grid on the left, the picked post on the right with its pictures, caption and actions.
import { api, esc, busy, toast, copyText, state, nice, niceDates, seal, statusChip, avatar, shortMarket, $, $$ } from '../lib.js';
import { icon } from '../icons.js';
import { newPost } from './review.js';

const KEY = 'barnstorm.page';
const remember = (k) => { try { localStorage.setItem(KEY, k); } catch { /* private window */ } };
const remembered = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const picked = {};   // per Page: the tile open in the right pane
const TOPIC_ICON = { 'live-lots': 'feed', 'stock-spotlight': 'image', 'lot-spotlight': 'eye', 'how-it-works': 'info', 'market-fact': 'bolt' };

export async function render(view, marketKey) {
  const markets = state.info.markets;
  const key = markets.some((m) => m.key === marketKey) ? marketKey : (markets.some((m) => m.key === remembered()) ? remembered() : markets[0].key);
  remember(key);
  view.innerHTML = `<nav class="pages" aria-label="Pages" style="grid-template-columns:repeat(${markets.length},minmax(0,1fr))">${markets.map((m) => `<a href="#/feeds/${m.key}" class="${m.key === key ? 'on' : ''}" ${m.key === key ? 'aria-current="page"' : ''}>${avatar(m.logo)}<span class="nm">${esc(shortMarket(m.key))}</span><span class="cnt" data-cnt="${m.key}"></span></a>`).join('')}</nav>
    <div class="feed"><section class="pane"><div class="skel" style="height:100%"></div></section><section class="pane"><div class="skel" style="height:100%"></div></section></div>`;

  const feeds = Object.fromEntries(await Promise.all(markets.map(async (m) => [m.key, await api('GET', `/api/feed/${m.key}`)])));
  for (const m of markets) {
    const s = feeds[m.key].stats, el = $(`[data-cnt="${m.key}"]`, view);
    el.innerHTML = s.toStamp || s.toFix ? `<b>${s.toStamp + s.toFix}</b> to stamp` : s.planned ? `${s.planned} planned` : '';
  }
  draw(view.querySelector('.feed'), feeds[key]);
}

// The tile the right pane opens on: the one picked before, else the next built post, else the next planned one.
function firstPick(f, today) {
  if (f.items.some((i) => i.id === picked[f.market.key])) return picked[f.market.key];
  const soon = f.items.filter((i) => i.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  return (soon.find((i) => i.kind === 'post') || soon[0] || f.items[0])?.id;
}

const build = async (id) => {
  const p = await busy('Building from live data: reading lots, picking cars, writing, rendering Facebook and Instagram versions…', () => api('POST', `/api/plan/${encodeURIComponent(id)}/build`));
  if (p) location.hash = `#/post/${encodeURIComponent(p.id)}`;
};

function draw(el, f) {
  const t = state.info.today, s = f.stats, m = f.market;
  const nextSlot = f.items.filter((i) => i.kind === 'slot' && i.date > t).sort((a, b) => a.date.localeCompare(b.date))[0];
  const sel = firstPick(f, t);
  el.innerHTML = `
    <section class="pane page-pane" aria-label="${esc(m.brand)} feed">
      <header class="pane-head">${avatar(m.logo)}
        <div class="who"><h1>${esc(m.brand)}</h1>
          <div class="site">${[esc(m.site), ...[[s.published, 'published'], [s.approved, 'approved'], [s.toStamp + s.toFix, 'to stamp'], [s.planned, 'planned']]
            .filter(([n]) => n).map(([n, w]) => `<b>${n}</b> ${w}`)].join(' · ')}</div></div>
        <div class="end">${nextSlot ? `<button class="primary" data-build="${esc(nextSlot.id)}">${icon('build', 16)}Build ${esc(nice(nextSlot.date))}</button>
          <button id="np" class="icon-btn" title="New post" aria-label="New post">${icon('plus', 18)}</button>` : `<button id="np">${icon('plus', 16)}New post</button>`}</div>
      </header>
      <div class="pane-body">
        ${f.items.length ? `<div class="ig">${f.items.map((i) => tile(i, t, i.id === sel)).join('')}</div>`
          : `<div class="empty"><b>Nothing here yet</b><span>Propose a week on the Plan, or start a post. Planned posts appear here as placeholders, in the order Instagram will show them.</span></div>`}
      </div>
      <footer class="pane-foot">
        <div class="rotline"><span class="lbl">Next in rotation</span>${f.rotation.next.map((c) => `<span class="chip ${c.kind === 'theme' ? 'st-exported' : ''}">${esc(c.label)}</span>`).join('')}</div>
        <a class="btn small ghost" href="#/settings">${icon('settings', 14)}Rotation</a>
      </footer>
    </section>
    <section class="pane post-pane" id="sheet" aria-live="polite"></section>`;

  const pick = (id) => {
    picked[m.key] = id;
    $$('[data-pick]', el).forEach((x) => { x.classList.toggle('on', x.dataset.pick === id); x.setAttribute('aria-pressed', x.dataset.pick === id); });
    sheet($('#sheet', el), f.items.find((i) => i.id === id));
  };
  $$('.pane-head [data-build]', el).forEach((b) => (b.onclick = () => build(b.dataset.build)));
  $$('.tile [data-build]', el).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); build(b.dataset.build); }));
  $$('[data-pick]', el).forEach((x) => {
    x.onclick = () => pick(x.dataset.pick);
    // Planned tiles hold a Build button, so they are not buttons themselves and answer the keyboard here.
    if (x.getAttribute('role') === 'button') x.onkeydown = (e) => { if (e.target === x && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(x.dataset.pick); } };
  });
  $('#np', el).onclick = () => newPost({ market: m.key });
  if (sel) pick(sel); else emptySheet($('#sheet', el));
}

const STAMPED = { approved: 'Approved', exported: 'Exported', published: 'Published' };

function tile(i, today, on) {
  // The picture already carries its hook, so the theme and date go in the tooltip, not over the card.
  const about = esc(`${i.categoryLabel || i.topicLabel}, ${nice(i.date)}${i.cards > 1 ? `, ${i.cards} pictures` : ''}`);
  const pick = `data-pick="${esc(i.id)}" aria-pressed="${on}"`;
  if (i.kind === 'slot') {
    const past = i.date < today, what = i.categoryLabel || i.topicLabel;
    return `<div class="tile ghost ${past ? 'past' : ''} ${on ? 'on' : ''}" role="button" tabindex="0" ${pick} aria-label="${esc(what)}, planned for ${esc(nice(i.date))}">
      ${icon(TOPIC_ICON[i.topic] || 'feed', 24)}<b>${esc(what)}</b>
      <small>${what === i.topicLabel ? '' : `${esc(i.topicLabel)} · `}${esc(nice(i.date))}${past ? ' · missed' : ''}</small>
      ${past ? '' : `<button class="small build" data-build="${esc(i.id)}">${icon('build', 14)}Build</button>`}</div>`;
  }
  const img = i.image ? `<img src="${esc(i.image)}" alt="" loading="lazy">` : '';
  if (i.kind === 'manual') return `<button class="tile ${on ? 'on' : ''}" ${pick} title="${about}, posted by hand" aria-label="${about}, posted by hand">${img}<span class="seal manual"><i></i>Posted</span></button>`;
  const mark = STAMPED[i.status] ? `<span class="sealmark ${i.status}" title="${STAMPED[i.status]}">${icon('check', 20)}</span>` : seal(i.status, i.errors);
  return `<button class="tile ${on ? 'on' : ''}" ${pick} title="${about}" aria-label="${about}">${img}${mark}</button>`;
}

// ---- the right pane: same head, body and foot for every kind of tile ----
function frame(el, { title, meta, chip, media, words, foot }) {
  el.innerHTML = `<header class="pane-head"><div class="who"><h2>${esc(title)}</h2><div class="meta">${meta}</div></div><div class="end">${chip}</div></header>
    <div class="pane-body"><div class="media">${media}</div><div class="words">${words}</div></div>
    <footer class="pane-foot">${foot}</footer>`;
}

const pictures = (srcs, v = '') => `<img class="big" src="${esc(srcs[0])}${v}" alt="Picture 1">
  ${srcs.length > 1 ? `<div class="thumbs">${srcs.map((src, n) => `<button class="${n ? '' : 'on'}" data-big="${esc(src)}${v}" title="Picture ${n + 1}" aria-label="Show picture ${n + 1}"><img src="${esc(src)}${v}" alt=""></button>`).join('')}</div>` : ''}`;

const captionBlock = (label, text, primary) => `<div class="cap-head"><h3>${label} <span class="muted">· ${text.length} characters</span></h3>
  <button class="small ${primary ? 'primary' : ''}" data-copy>${icon('copy', 14)}Copy caption</button></div>
  <div class="captext" tabindex="0">${esc(text)}</div>`;

function wire(el, text) {
  $$('[data-big]', el).forEach((b) => (b.onclick = () => {
    $('.big', el).src = b.dataset.big;
    $$('[data-big]', el).forEach((x) => x.classList.toggle('on', x === b));
  }));
  const c = $('[data-copy]', el);
  if (c) c.onclick = (e) => copyText(text, e.currentTarget);
}

async function sheet(el, i) {
  const what = i.categoryLabel || i.topicLabel, sub = what === i.topicLabel ? '' : `${esc(i.topicLabel)} · `;
  if (i.kind === 'slot') {
    const past = i.date < state.info.today;
    frame(el, {
      title: what, meta: `${sub}planned for ${esc(nice(i.date))}`, chip: statusChip('planned'),
      media: `<div class="ghostcard">${icon(TOPIC_ICON[i.topic] || 'feed', 32)}<b>${esc(what)}</b><small>${esc(nice(i.date))}</small></div>`,
      words: `<div class="cap-head"><h3>Caption</h3></div>
        <div class="captext none">${past ? 'This day passed without a post.' : `Written when it's built: Barnstorm reads that day's auction lots${i.categoryLabel ? ` for ${esc(what)}` : ''}, picks the cars and writes the caption.`}</div>
        ${i.note ? `<div class="flag warn">${icon('info', 18)}<span>${esc(niceDates(i.note))}</span></div>` : ''}`,
      foot: `${past ? '' : `<button class="primary" data-sbuild>${icon('build', 16)}Build</button>`}<a class="btn" href="#/plan">${icon('plan', 16)}Change on the Plan</a>
        <span class="hint">Build it the day before it goes out.</span>`,
    });
    const b = $('[data-sbuild]', el);
    if (b) b.onclick = () => build(i.id);
    return;
  }
  if (i.kind === 'manual') {
    frame(el, {
      title: what, meta: `${sub}posted ${esc(nice(i.date))}`, chip: statusChip('manual'),
      media: i.images?.length ? pictures(i.images) : '<div class="ghostcard"><small>No pictures found in its folder</small></div>',
      words: i.caption ? captionBlock('Caption A', i.caption, false) : '<div class="cap-head"><h3>Caption</h3></div><div class="captext none">No caption.md in this post\'s folder.</div>',
      foot: `${i.folder ? `<button data-open>${icon('folder', 16)}Open folder</button>` : ''}<span class="hint">Made by hand before Barnstorm. It counts in the rotation.</span>`,
    });
    wire(el, i.caption || '');
    const o = $('[data-open]', el);
    if (o) o.onclick = () => api('POST', '/api/open-folder', { folder: i.folder }).catch((e) => toast(e.message, true));
    return;
  }
  // A built post: the head is known now, the pictures and caption arrive with the post.
  frame(el, { title: what, meta: `${sub}goes out ${esc(nice(i.date))}`, chip: statusChip(i.status, i.errors),
    media: '<div class="skel big"></div>', words: '<div class="skel" style="height:100%"></div>', foot: '' });
  const p = await api('GET', `/api/posts/${encodeURIComponent(i.id)}`).catch((e) => { toast(e.message, true); return null; });
  if (!p || !el.isConnected || picked[p.market] !== i.id) return;
  const chosen = p.caption?.chosen || 'a', cap = p.caption?.[chosen] || '';
  const ready = ['approved', 'exported', 'published'].includes(p.status);
  const errors = (p.qa || []).filter((x) => x.severity === 'error').length;
  frame(el, {
    title: what, meta: `${sub}goes out ${esc(nice(p.plannedFor))} · ${p.cards.length} picture${p.cards.length > 1 ? 's' : ''}`, chip: statusChip(p.status, errors),
    media: pictures(p.igImages, `?v=${p.version}`),
    words: captionBlock(`Caption ${chosen.toUpperCase()}`, cap, ready),
    foot: `<a class="btn ${ready ? '' : 'primary'}" href="#/post/${encodeURIComponent(p.id)}">${icon(ready ? 'eye' : 'stamp', 16)}${ready ? 'Open in studio' : 'Check and stamp'}</a>
      ${ready && p.status !== 'published' ? `<button data-sexport>${icon('folder', 16)}${p.exportedTo ? 'Export again' : 'Export pack'}</button>` : ''}
      <span class="hint">${ready ? (p.exportedTo ? 'Exported. Copy the caption, then upload the pictures.' : 'Stamped and ready to post.') : `Not stamped yet${errors ? `: ${errors} check${errors > 1 ? 's' : ''} to fix first` : ''}.`}</span>`,
  });
  wire(el, cap);
  const ex = $('[data-sexport]', el);
  if (ex) ex.onclick = async () => {
    const r = await busy('Writing the posting pack…', () => api('POST', `/api/posts/${encodeURIComponent(p.id)}/export`));
    if (r) { toast(`Saved to ${r.folder}`); sheet(el, i); }
  };
}

function emptySheet(el) {
  frame(el, { title: 'Nothing picked', meta: 'This Page has no posts yet', chip: '',
    media: '<div class="ghostcard"><small>No post</small></div>',
    words: '<div class="captext none">Propose a week on the Plan: each Page gets three posts a week, and each one shows up here, ready to build.</div>',
    foot: `<a class="btn primary" href="#/plan">${icon('plan', 16)}Go to the Plan</a>` });
}
