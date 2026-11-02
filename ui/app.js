// Barnstorm workspace: shell (top bar, rail), hash router, and the "tomorrow" build bar.
import { $, $$, esc, api, busy, toast, loadInfo, state, plusDays, nice, marketName, topicName } from './lib.js';
import { icon } from './icons.js';
import * as feeds from './screens/feeds.js';
import * as posts from './screens/review.js';
import * as post from './screens/post.js';
import * as plan from './screens/plan.js';
import * as publish from './screens/publish.js';
import * as learn from './screens/learn.js';
import * as settings from './screens/settings.js';

const SCREENS = { feeds, posts, post, plan, publish, learn, settings, today: feeds, review: posts };
const NAV = [['feeds', 'feed', 'Feeds'], ['plan', 'plan', 'Plan'], ['posts', 'posts', 'Posts'], ['publish', 'publish', 'Publish'], ['learn', 'learn', 'Learn'], ['settings', 'settings', 'Settings']];

function shell(info) {
  document.title = info.app?.name || 'Barnstorm';
  $('#appname').textContent = (info.app?.name || 'Barnstorm').toUpperCase();
  const c = info.counts || {};
  const badge = { posts: c.draft || 0, publish: c.approved || 0 };
  $('#nav').innerHTML = NAV.map(([k, ic, l]) => `<a href="#/${k}" data-nav="${k}">${icon(ic)}<span>${l}</span>${badge[k] ? `<b class="n">${badge[k]}</b>` : ''}</a>`).join('');
  $('#foot').innerHTML = `${icon('stamp', 18)}<span>Nothing goes out without your stamp.</span>`;
}

// "Tomorrow" bar: tomorrow's planned slots that still need building, with one button to build them all.
export async function refreshTomorrow() {
  const el = $('#tomorrow'), t = plusDays(state.info.today, 1);
  const [p, posts] = await Promise.all([api('GET', '/api/plan').catch(() => null), api('GET', '/api/posts').catch(() => [])]);
  const todo = (p?.slots || []).filter((s) => s.date === t && !s.postId && s.status !== 'dropped');
  const toStamp = posts.filter((x) => x.plannedFor === t && x.status === 'draft').length;
  if (!p?.slots?.length && !toStamp) { el.innerHTML = `<span class="muted">No plan for this week yet</span><a class="btn small" href="#/plan">${icon('plan', 16)}Plan the week</a>`; return; }
  if (!todo.length) {
    el.innerHTML = toStamp ? `<span>Tomorrow, ${nice(t)}: <b>${toStamp} to stamp</b></span><a class="btn small" href="#/posts">${icon('stamp', 16)}Stamp them</a>`
      : `<span class="muted">${icon('check', 16)}</span><span>Tomorrow (${nice(t)}) is built and stamped</span>`;
    return;
  }
  el.innerHTML = `<span>Tomorrow, ${nice(t)}: <b>${todo.length} to build</b></span><button class="primary" id="buildtm">${icon('build', 16)}Build tomorrow</button>`;
  $('#buildtm').onclick = async () => {
    let ok = 0;
    for (const [i, s] of todo.entries()) {
      const r = await busy(`Building ${i + 1} of ${todo.length}: ${marketName(s.market)}, ${topicName(s.topic)}. Reading live lots, picking cars, rendering both formats…`,
        () => api('POST', `/api/plan/${encodeURIComponent(s.id)}/build`));
      if (r) ok++;
    }
    toast(`Built ${ok} of ${todo.length}. They're waiting for your stamp.`);
    await loadInfo(true); go();
  };
}

export function crumbs(html) { $('#crumbs').innerHTML = html || ''; }

async function go() {
  const [name = 'feeds', ...args] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const screen = SCREENS[name] || feeds;
  const navKey = name === 'post' ? 'posts' : name === 'today' ? 'feeds' : name === 'review' ? 'posts' : name;
  const view = $('#view');
  try {
    const info = await loadInfo(true);
    shell(info);
    $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.nav === navKey));
    crumbs('');
    refreshTomorrow();
    await screen.render(view, ...args);
  } catch (e) {
    view.innerHTML = `<div class="empty"><b>Something went wrong</b><span>${esc(e.message)}</span><a href="#/feeds">Back to Feeds</a></div>`;
    toast(e.message, true);
  }
}

window.addEventListener('hashchange', go);
window.addEventListener('barnstorm:refresh', go);
go();
