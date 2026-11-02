// Plan: a week of posts per Page. Propose, adjust, then build each slot the day before it goes out.
import { api, esc, busy, toast, ask, state, marketName, topicName, categoryLabel, nice, niceDates, plusDays, collectionSelect, avatar, shortMarket, seal, $, $$ } from '../lib.js';
import { icon } from '../icons.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TOPIC_ICON = { 'live-lots': 'feed', 'lot-spotlight': 'eye', 'stock-spotlight': 'image', 'how-it-works': 'info', 'market-fact': 'bolt' };
let week = null;

export async function render(view) {
  const [plan, posts] = await Promise.all([api('GET', `/api/plan${week ? `?week=${week}` : ''}`), api('GET', '/api/posts')]);
  week = plan.weekStart;
  const thumbs = Object.fromEntries(posts.map((p) => [p.id, p.thumb.replace(/card-0\.png$/, 'ig/card-0.png')]));
  const dates = DAYS.map((_, i) => plusDays(week, i)), today = state.info.today, tomorrow = plusDays(today, 1);
  const todo = plan.slots.filter((s) => s.date === tomorrow && !s.postId && s.status !== 'dropped');
  const busyDay = (d) => plan.slots.some((s) => s.date === d) || (plan.existing || []).some((s) => s.date === d);
  view.innerHTML = `
    <div class="head"><div><h1>Plan</h1><p class="sub" style="margin-bottom:0">Three posts per Page a week. Categories and themes rotate: none repeats on a Page within ${esc(plan.cooldown)} days, and no two Pages share one on the same day.</p></div>
      <div class="weeknav"><button class="ghost" id="prev" aria-label="Previous week">${icon('back', 18)}</button><b>Week of ${nice(week)}</b><button class="ghost" id="next" aria-label="Next week">${icon('next', 18)}</button></div></div>
    <div class="row" style="margin-bottom:18px">
      <button class="${plan.slots.length ? '' : 'primary'}" id="propose">${icon('plan', 16)}${plan.slots.length ? 'Re-propose (keeps built posts)' : 'Propose this week'}</button>
      ${todo.length ? `<button class="primary" id="buildtm">${icon('build', 16)}Build tomorrow (${todo.length})</button>` : ''}
      <span class="hint">Build each post the day before it goes out. Auction lots change every day.</span></div>
    ${plan.slots.length || plan.existing?.length ? `<div class="week" style="grid-template-columns:112px ${dates.map((d) => (busyDay(d) ? 'minmax(0,1fr)' : 'minmax(48px,.4fr)')).join(' ')}">
      <div></div>${dates.map((d, i) => `<div class="hd ${d === today ? 'today' : ''}">${DAYS[i]} <span>${nice(d).split(' ').slice(1).join(' ')}</span></div>`).join('')}
      ${state.info.markets.map((m) => `<div class="pg">${avatar(m.logo)}<b>${esc(shortMarket(m.key))}</b></div>${dates.map((d) => {
        const slots = plan.slots.filter((s) => s.market === m.key && s.date === d);
        const made = (plan.existing || []).filter((s) => s.market === m.key && s.date === d);
        return `<div class="day ${d === today ? 'today' : ''} ${d < today ? 'past' : ''}">${made.map(madeCard).join('')}${slots.map((s) => slotCard(s, thumbs, today)).join('')}</div>`;
      }).join('')}`).join('')}</div>`
      : `<div class="empty"><b>No plan for this week yet</b><span>Propose the week: Barnstorm checks stock on all five sites and picks a different category or theme for each post.</span></div>`}`;

  $('#prev', view).onclick = () => { week = plusDays(week, -7); render(view); };
  $('#next', view).onclick = () => { week = plusDays(week, 7); render(view); };
  $('#propose', view).onclick = async () => {
    const p = await busy('Checking stock on all five sites and proposing the week…', () => api('POST', '/api/plan/propose', { week }));
    if (p) render(view);
  };
  const bt = $('#buildtm', view);
  if (bt) bt.onclick = async () => {
    let ok = 0;
    for (const [i, s] of todo.entries()) {
      if (await busy(`Building ${i + 1} of ${todo.length}: ${marketName(s.market)}, ${topicName(s.topic)}…`, () => api('POST', `/api/plan/${encodeURIComponent(s.id)}/build`))) ok++;
    }
    toast(`Built ${ok} of ${todo.length}. They're waiting for your stamp.`);
    render(view);
  };
  $$('[data-build]', view).forEach((b) => (b.onclick = async () => {
    const p = await busy('Building from live data: 20 to 60 seconds.', () => api('POST', `/api/plan/${encodeURIComponent(b.dataset.build)}/build`));
    if (p) location.hash = `#/post/${encodeURIComponent(p.id)}`;
  }));
  $$('[data-drop]', view).forEach((b) => (b.onclick = async () => {
    await api('PATCH', `/api/plan/${encodeURIComponent(b.dataset.drop)}`, { status: b.dataset.to });
    render(view);
  }));
  $$('[data-edit]', view).forEach((b) => (b.onclick = () => edit(view, plan.slots.find((s) => s.id === b.dataset.edit))));
  // A built post: build it again with other cars, or take it off the Plan.
  $$('[data-rebuild]', view).forEach((b) => (b.onclick = async () => {
    const s = plan.slots.find((x) => x.id === b.dataset.rebuild);
    if (!await ask('Build this post again', `<p class="hint" style="max-width:420px">A new ${esc(what(s))} post is built with other cars. The current one comes off the Plan once the new one is ready${stampedNote(s)}. It stays under Posts → Rejected and does not count against the theme.</p>`, 'Build again')) return;
    const p = await busy('Building a new post with other cars: 20 to 60 seconds.', () => api('POST', `/api/plan/${encodeURIComponent(s.id)}/rebuild`, {}));
    if (p) location.hash = `#/post/${encodeURIComponent(p.id)}`;
  }));
  $$('[data-remove]', view).forEach((b) => (b.onclick = async () => {
    const s = plan.slots.find((x) => x.id === b.dataset.remove);
    if (!await ask('Remove this post from the Plan', `<p class="hint" style="max-width:420px">The ${esc(what(s))} post comes off ${esc(nice(s.date))}${stampedNote(s)}, and the slot goes back to planned, ready to build again. The post stays under Posts → Rejected and does not count against the theme.</p>`, 'Remove')) return;
    if (await busy('Removing…', () => api('POST', `/api/plan/${encodeURIComponent(s.id)}/remove`))) { toast('Removed. Build the slot again when you are ready.'); render(view); }
  }));
}

const what = (s) => s.params?.category ? categoryLabel(s.market, s.params.category) : topicName(s.topic);
// The title is the theme; the topic goes in the line under it (left out when the title already says it).
const title = (s) => `<b>${esc(what(s))}</b>${what(s) === topicName(s.topic) ? '' : `<span class="tp">${icon(TOPIC_ICON[s.topic] || 'feed', 14)}${esc(topicName(s.topic))}</span>`}`;

function madeCard(s) {
  return `<div class="slot made">${title(s)}
    ${s.postId ? `<a href="#/post/${encodeURIComponent(s.postId)}">Already made</a>` : '<span class="muted">Posted by hand</span>'}</div>`;
}

const stampedNote = (s) => (['approved', 'exported'].includes(s.postStatus) ? ` (it was already stamped${s.postStatus === 'exported' ? ' and exported' : ''})` : '');

function slotCard(s, thumbs, today) {
  if (s.postId) {
    const fixed = s.postStatus === 'published';
    return `<div class="slot built"><a class="bt" href="#/post/${encodeURIComponent(s.postId)}">${thumbs[s.postId] ? `<img class="thumb" src="${esc(thumbs[s.postId])}" alt="" loading="lazy">` : '<span class="thumb"></span>'}
        <span class="bi">${title(s)}${seal(s.postStatus || 'draft')}</span></a>
      ${s.note ? `<span class="note">${esc(niceDates(s.note))}</span>` : ''}
      ${fixed ? '' : `<span class="acts"><button class="small" data-rebuild="${esc(s.id)}" title="Build it again with the same theme and other cars">${icon('refresh', 14)}Rebuild</button>
        <button class="small ghost" data-edit="${esc(s.id)}" title="Rebuild with another topic, theme or date" aria-label="Change and rebuild">${icon('swap', 15)}</button>
        <button class="small ghost" data-remove="${esc(s.id)}" title="Take this post off the Plan" aria-label="Remove">${icon('x', 15)}</button></span>`}</div>`;
  }
  if (s.status === 'dropped') {
    return `<div class="slot dropped">${title(s)}<button class="small" data-drop="${esc(s.id)}" data-to="proposed">Restore</button></div>`;
  }
  return `<div class="slot">${title(s)}${s.note ? `<span class="note">${esc(niceDates(s.note))}</span>` : ''}
    ${s.date < today ? '<span class="muted">Missed</span>' : `<span class="acts"><button class="small" data-build="${esc(s.id)}">${icon('build', 14)}Build</button>
      <button class="small ghost" data-edit="${esc(s.id)}" title="Change topic, theme or date" aria-label="Change">${icon('swap', 15)}</button>
      <button class="small ghost" data-drop="${esc(s.id)}" data-to="dropped" title="Drop this post" aria-label="Drop">${icon('x', 15)}</button></span>`}</div>`;
}

// Change a slot's topic, theme or date. On a built slot this builds the new post and takes the old one off.
async function edit(view, s) {
  const m = state.info.markets.find((x) => x.key === s.market), d = $('#dlg'), built = !!s.postId;
  d.innerHTML = `<form method="dialog" class="fields" id="ef"><h2>${esc(m.brand)}: ${built ? 'rebuild with something else' : 'change this post'}</h2>
    ${built ? `<p class="hint" style="max-width:420px">A new post is built with what you choose here. The current one comes off the Plan once the new one is ready${stampedNote(s)}.</p>` : ''}
    <label>Topic<select name="topic">${state.info.topics.map((t) => `<option value="${t.key}" ${t.key === s.topic ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select></label>
    <label id="catrow">Category or theme<span id="catsel"></span><span class="hint">Used by live lots and lot spotlight. Each one shows when this Page last posted it.</span></label>
    <label>Post date<input type="date" name="date" value="${s.date}"></label>
    <div class="row" style="justify-content:flex-end"><button value="cancel" formnovalidate>Cancel</button><button value="ok" class="primary">${built ? 'Rebuild' : 'Save'}</button></div></form>`;
  const f = $('#ef', d);
  const sync = async () => {
    const lots = ['live-lots', 'lot-spotlight'].includes(f.topic.value);
    $('#catrow', d).style.display = lots ? '' : 'none';
    if (lots) $('#catsel', d).innerHTML = await collectionSelect(s.market, f.date.value, s.params?.category);
  };
  f.topic.onchange = sync; f.date.onchange = sync;
  await sync();
  d.showModal();
  const ok = await new Promise((r) => d.addEventListener('close', () => r(d.returnValue === 'ok'), { once: true }));
  if (!ok) return;
  const v = Object.fromEntries(new FormData(f));
  const params = ['live-lots', 'lot-spotlight'].includes(v.topic) ? { category: v.category } : {};
  if (built) {
    const p = await busy('Building the new post: 20 to 60 seconds.', () => api('POST', `/api/plan/${encodeURIComponent(s.id)}/rebuild`, { topic: v.topic, params, date: v.date }));
    if (p) location.hash = `#/post/${encodeURIComponent(p.id)}`;
    return;
  }
  await busy('Saving…', () => api('PATCH', `/api/plan/${encodeURIComponent(s.id)}`, { topic: v.topic, params, date: v.date, status: 'accepted' }));
  render(view);
}
