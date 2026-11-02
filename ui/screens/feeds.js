// Feeds: each Page as its own Instagram profile grid, before it exists. Planned slots, built posts, stamped and published ones.
// Picking a tile opens it in the panel beside the grid: its pictures, the caption to copy, and what to do next.
import { api, esc, busy, toast, copyText, state, nice, niceDates, ago, seal, statusOf, statusChip, avatar, shortMarket, $, $$ } from '../lib.js';
import { icon } from '../icons.js';
import { newPost } from './review.js';

const KEY = 'barnstorm.page';
const remember = (k) => { try { localStorage.setItem(KEY, k); } catch { /* private window */ } };
const remembered = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const picked = {};   // per Page: the tile open in the panel

export async function render(view, marketKey) {
  const markets = state.info.markets;
  const key = markets.some((m) => m.key === marketKey) ? marketKey : (markets.some((m) => m.key === remembered()) ? remembered() : markets[0].key);
  remember(key);
  view.innerHTML = `<div class="pages">${markets.map((m) => `<a href="#/feeds/${m.key}" class="${m.key === key ? 'on' : ''}">${avatar(m.logo)}${esc(shortMarket(m.key))}<span class="cnt" data-cnt="${m.key}"></span></a>`).join('')}</div>
    <div class="feed"><div><div class="skel" style="height:96px;margin-bottom:16px"></div><div class="ig">${'<div class="tile skel"></div>'.repeat(6)}</div></div></div>`;

  const feeds = Object.fromEntries(await Promise.all(markets.map(async (m) => [m.key, await api('GET', `/api/feed/${m.key}`)])));
  for (const m of markets) {
    const s = feeds[m.key].stats, el = $(`[data-cnt="${m.key}"]`, view);
    el.innerHTML = s.toStamp || s.toFix ? `<b>${s.toStamp + s.toFix}</b> to stamp` : s.planned ? `${s.planned} planned` : '';
  }
  draw(view.querySelector('.feed'), feeds[key], view);
}

// The tile the panel opens on: the one picked before, else the next built post, else the next planned one.
function firstPick(f, today) {
  const ids = f.items.map((i) => i.id);
  if (ids.includes(picked[f.market.key])) return picked[f.market.key];
  const soon = f.items.filter((i) => i.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  return (soon.find((i) => i.kind === 'post') || soon[0] || f.items[0])?.id;
}

function draw(el, f, view) {
  const t = state.info.today, s = f.stats, m = f.market;
  const upcoming = f.items.filter((i) => i.date >= t && i.kind !== 'manual').sort((a, b) => a.date.localeCompare(b.date));
  const nextSlot = upcoming.find((i) => i.kind === 'slot');
  const sel = firstPick(f, t);
  el.innerHTML = `
    <section aria-label="${esc(m.brand)} feed">
      <div class="profile">${avatar(m.logo)}
        <div><h1>${esc(m.brand)}</h1><div class="site">${esc(m.site)} · Facebook and Instagram</div>
          <div class="stats"><span><b>${s.published}</b>published</span><span><b>${s.approved}</b>approved</span>
            <span><b>${s.toStamp + s.toFix}</b>to stamp${s.toFix ? ` (${s.toFix} need fixes)` : ''}</span><span><b>${s.planned}</b>planned</span></div></div></div>
      <div class="profile-actions">
        ${nextSlot ? `<button class="primary" data-build="${esc(nextSlot.id)}">${icon('build', 16)}Build ${esc(nice(nextSlot.date))}</button>` : ''}
        <button id="np">${icon('plus', 16)}New post</button>
        <a class="btn" href="#/plan">${icon('plan', 16)}Plan</a>
      </div>
      ${f.items.length ? `<div class="ig">${f.items.map((i) => tile(i, t, i.id === sel)).join('')}</div>`
        : `<div class="empty"><b>Nothing here yet</b><span>Propose a week on the Plan, or start a post. Planned posts appear here as placeholders, in the order Instagram will show them.</span></div>`}
    </section>
    <aside class="aside">
      <div class="panel sheet" id="sheet" aria-live="polite"></div>
      <div class="more">
        <div class="panel"><h2>Up next</h2>
          ${upcoming.length ? `<div class="list">${upcoming.slice(0, 6).map((i) => `<a href="${i.kind === 'post' ? `#/post/${encodeURIComponent(i.id)}` : '#/plan'}">
            ${dot(i)}<span>${esc(i.categoryLabel || i.topicLabel)}</span><span class="d">${esc(nice(i.date))}</span></a>`).join('')}</div>`
            : '<p class="hint">Nothing planned. Propose a week on the Plan.</p>'}
        </div>
        <div class="panel"><h2>Rotation</h2>
          <p class="hint" style="margin:0 0 8px">Next up for this Page: never posted first, then the longest ago.</p>
          <div class="tags">${f.rotation.next.map((c) => `<span class="chip ${c.kind === 'theme' ? 'st-exported' : ''}">${esc(c.label)}</span>`).join('')}</div>
          <h3>Used lately</h3>
          ${f.rotation.recent.length ? `<div class="list">${f.rotation.recent.slice(0, 6).map((r) => `<div class="li"><span>${esc(r.label)}</span><span class="d">${esc(ago(r.date))}</span></div>`).join('')}</div>`
            : '<p class="hint">Nothing yet.</p>'}
        </div>
      </div>
    </aside>`;

  const build = async (id) => {
    const p = await busy('Building from live data: reading lots, picking cars, writing, rendering Facebook and Instagram versions…', () => api('POST', `/api/plan/${encodeURIComponent(id)}/build`));
    if (p) location.hash = `#/post/${encodeURIComponent(p.id)}`;
  };
  const pick = (id) => {
    picked[m.key] = id;
    $$('[data-pick]', el).forEach((x) => { x.classList.toggle('on', x.dataset.pick === id); x.setAttribute('aria-pressed', x.dataset.pick === id); });
    sheet($('#sheet', el), f.items.find((i) => i.id === id), build);
  };
  $$('.profile-actions [data-build]', el).forEach((b) => (b.onclick = () => build(b.dataset.build)));
  $$('.tile [data-build]', el).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); build(b.dataset.build); }));
  $$('[data-pick]', el).forEach((x) => {
    x.onclick = () => pick(x.dataset.pick);
    // Ghost tiles are not buttons (they hold one), so they answer the keyboard themselves.
    if (x.getAttribute('role') === 'button') x.onkeydown = (e) => { if (e.target === x && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(x.dataset.pick); } };
  });
  $('#np', el).onclick = () => newPost({ market: m.key });
  if (sel) pick(sel); else $('#sheet', el).remove();
}

const STAMPED = { approved: 'Approved', exported: 'Exported', published: 'Published' };
// Status as a bare dot in the narrow Up next list; the word is in the tooltip and for screen readers.
const dot = (i) => { const s = statusOf(i.status, i.errors); return `<span class="sdot ${s.cls}" title="${esc(s.label)}" aria-label="${esc(s.label)}"></span>`; };

function tile(i, today, on) {
  // The picture already carries its hook, so the theme and date go in the tooltip, not over the card.
  const about = esc(`${i.categoryLabel || i.topicLabel}, ${nice(i.date)}${i.cards > 1 ? `, ${i.cards} pictures` : ''}`);
  const pick = `data-pick="${esc(i.id)}" aria-pressed="${on}"`;
  if (i.kind === 'slot') {
    // A faded preview of the card this slot will become: photo area, then the blue band with its theme.
    const past = i.date < today, what = i.categoryLabel || i.topicLabel;
    return `<div class="tile ghost ${past ? 'past' : ''} ${on ? 'on' : ''}" role="button" tabindex="0" ${pick} aria-label="${esc(what)}, planned for ${esc(nice(i.date))}">
      <div class="ph">${icon(i.topic === 'stock-spotlight' ? 'image' : i.topic === 'live-lots' ? 'feed' : 'info', 28)}
        ${past ? '' : `<button class="small build" data-build="${esc(i.id)}">${icon('build', 14)}Build</button>`}</div>
      <div class="band"><b>${esc(what)}</b><small>${what === i.topicLabel ? '' : `${esc(i.topicLabel)} · `}${esc(nice(i.date))}${past ? ' · missed' : ''}</small>
        ${i.note ? `<span class="note">${esc(niceDates(i.note))}</span>` : ''}</div></div>`;
  }
  const img = i.image ? `<img src="${esc(i.image)}" alt="" loading="lazy">` : '';
  if (i.kind === 'manual') return `<button class="tile ${on ? 'on' : ''}" ${pick} title="${about}, made by hand" aria-label="${about}, made by hand">${img}<span class="seal manual"><i></i>Posted</span></button>`;
  const mark = STAMPED[i.status] ? `<span class="sealmark ${i.status}" title="${STAMPED[i.status]}">${icon('check', 20)}</span>` : seal(i.status, i.errors);
  return `<button class="tile ${on ? 'on' : ''}" ${pick} title="${about}" aria-label="${about}">${img}${mark}</button>`;
}

// ---- the panel beside the grid ----
async function sheet(el, i, build) {
  const what = i.categoryLabel || i.topicLabel, sub = what === i.topicLabel ? '' : `${esc(i.topicLabel)} · `;
  if (i.kind === 'slot') {
    const past = i.date < state.info.today;
    el.innerHTML = `<div class="sh-head"><div><h2>${esc(what)}</h2><span class="muted">${sub}planned for ${esc(nice(i.date))}</span></div>${statusChip('planned')}</div>
      <p class="hint">${past ? 'This day has passed without a post.' : 'Not built yet. Build it the day before it goes out: Barnstorm reads that day\'s auction lots, picks the cars and writes the caption.'}</p>
      ${i.note ? `<p class="flag warn">${icon('info', 18)}<span>${esc(niceDates(i.note))}</span></p>` : ''}
      <div class="row">${past ? '' : `<button class="primary" data-sbuild>${icon('build', 16)}Build</button>`}<a class="btn" href="#/plan">${icon('plan', 16)}Change on the Plan</a></div>`;
    const b = $('[data-sbuild]', el);
    if (b) b.onclick = () => build(i.id);
    return;
  }
  if (i.kind === 'manual') {
    el.innerHTML = `<div class="sh-head"><div><h2>${esc(what)}</h2><span class="muted">${sub}posted ${esc(nice(i.date))}</span></div>${statusChip('manual')}</div>
      <p class="hint">Made by hand before Barnstorm, so its caption lives in the post's own folder. It counts in the rotation, so this theme rests for a while.</p>`;
    return;
  }
  el.innerHTML = '<div class="skel" style="height:320px"></div>';
  const p = await api('GET', `/api/posts/${encodeURIComponent(i.id)}`).catch((e) => { toast(e.message, true); return null; });
  if (!p || !el.isConnected) return;
  const chosen = p.caption?.chosen || 'a', cap = p.caption?.[chosen] || '';
  const ready = ['approved', 'exported', 'published'].includes(p.status);
  const errors = (p.qa || []).filter((x) => x.severity === 'error').length;
  const open = `<a class="btn ${ready ? '' : 'primary'}" href="#/post/${encodeURIComponent(p.id)}">${icon('eye', 16)}${ready ? 'Open in studio' : 'Check and stamp'}</a>`;
  el.innerHTML = `<div class="sh-head"><div><h2>${esc(what)}</h2><span class="muted">${sub}goes out ${esc(nice(p.plannedFor))} · ${p.cards.length} picture${p.cards.length > 1 ? 's' : ''}</span></div>${statusChip(p.status, errors)}</div>
    <div class="strip">${p.igImages.map((src, n) => `<a href="#/post/${encodeURIComponent(p.id)}" title="Picture ${n + 1}"><img src="${esc(src)}?v=${p.version}" alt="Picture ${n + 1}" loading="lazy"></a>`).join('')}</div>
    <div class="cap-head"><h3>Caption ${chosen.toUpperCase()} <span class="muted">· ${cap.length} characters</span></h3>
      <button class="small ${ready ? 'primary' : ''}" data-scopy>${icon('copy', 14)}Copy caption</button></div>
    <div class="captext" tabindex="0">${esc(cap)}</div>
    ${ready ? '' : `<p class="hint">Not stamped yet${errors ? `, and ${errors} check${errors > 1 ? 's' : ''} to fix` : ''}. Check it in the studio before it goes out.</p>`}
    <div class="row">${open}${ready && p.status !== 'published' ? `<button data-sexport>${icon('folder', 16)}${p.exportedTo ? 'Export again' : 'Export pack'}</button>` : ''}</div>`;
  $('[data-scopy]', el).onclick = (e) => copyText(cap, e.currentTarget);
  const ex = $('[data-sexport]', el);
  if (ex) ex.onclick = async () => {
    const r = await busy('Writing the posting pack…', () => api('POST', `/api/posts/${encodeURIComponent(p.id)}/export`));
    if (r) { toast(`Saved to ${r.folder}`); sheet(el, i, build); }
  };
}
