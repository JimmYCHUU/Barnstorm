// Small helpers shared by every screen.
import { icon } from './icons.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const state = { info: null };

export async function api(method, url, body) {
  const res = await fetch(url, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || `HTTP ${res.status}`); e.status = res.status; e.data = data; throw e; }
  return data;
}

export async function loadInfo(force = false) {
  if (!state.info || force) state.info = await api('GET', '/api/state');
  return state.info;
}

let toastTimer;
export function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = `show${err ? ' err' : ''}`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = ''), err ? 6500 : 3200);
}

// Copy text to the clipboard; the button that did it says "Copied" for a moment.
export async function copyText(text, btn, what = 'Caption') {
  try { await navigator.clipboard.writeText(text); } catch {
    const t = Object.assign(document.createElement('textarea'), { value: text });
    t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select();
    const ok = document.execCommand('copy'); t.remove();
    if (!ok) return toast('Could not copy. Select the text and press Ctrl+C.', true);
  }
  if (btn && !btn.classList.contains('copied')) {
    const was = btn.innerHTML;
    btn.classList.add('copied'); btn.innerHTML = `${icon('check', 14)}Copied`;
    setTimeout(() => { btn.innerHTML = was; btn.classList.remove('copied'); }, 1600);
  }
  toast(`${what} copied. Paste it into Facebook or Instagram.`);
}

// Run fn behind a "working" overlay; shows the error and returns null on failure.
export async function busy(message, fn) {
  const el = document.createElement('div');
  el.className = 'busy'; el.innerHTML = `<div><div class="spin"></div>${esc(message)}</div>`;
  document.body.appendChild(el);
  try { return await fn(); } catch (e) { toast(e.message, true); return null; } finally { el.remove(); }
}

export function marketOf(key) { return state.info?.markets.find((m) => m.key === key); }
export function marketName(key) { return marketOf(key)?.brand || key; }
export function shortMarket(key) { return marketName(key).replace(/^Carbarn /, ''); }
export function topicName(key) { return state.info?.topics.find((t) => t.key === key)?.label || key; }
export function categoryLabel(mkey, key) {
  return marketOf(mkey)?.labels?.[key] || (key || '').replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

// One status vocabulary everywhere: planned, to stamp, needs fixes, approved, exported, published, posted by hand.
export function statusOf(status, errors = 0) {
  if (status === 'draft') return errors ? { cls: 'fix', label: 'Needs fixes' } : { cls: 'draft', label: 'To stamp' };
  return { planned: { cls: 'planned', label: 'Planned' }, approved: { cls: 'approved', label: 'Approved' }, exported: { cls: 'exported', label: 'Exported' },
    published: { cls: 'published', label: 'Published' }, manual: { cls: 'manual', label: 'Posted by hand' }, rejected: { cls: 'rejected', label: 'Rejected' } }[status]
    || { cls: 'planned', label: status };
}
export const seal = (status, errors) => { const s = statusOf(status, errors); return `<span class="seal ${s.cls}"><i></i>${esc(s.label)}</span>`; };
export const statusChip = (status, errors) => { const s = statusOf(status, errors); return `<span class="chip st-${s.cls}"><i></i>${esc(s.label)}</span>`; };
export const avatar = (logo, cls = '') => `<span class="av ${cls}"><img src="/assets/logos/${esc(logo)}" alt=""></span>`;

export function flagList(flags) {
  if (!flags?.length) return `<div class="flag info">${icon('check', 18)}<span>All clear: every check passed.</span></div>`;
  // The same "look at card N" check on several cards reads as one line.
  const groups = new Map();
  flags.forEach((f, i) => {
    const n = /^Look at card (\d+) /.exec(f.message)?.[1], key = n ? f.severity + f.message.replace(n, '#') : i;
    if (!groups.has(key)) groups.set(key, { f, i, cards: [] });
    if (n) groups.get(key).cards.push(n);
  });
  return [...groups.values()].map(({ f, i, cards }) => {
    const msg = cards.length > 1 ? f.message.replace(/^Look at card \d+ /, `Look at cards ${cards.slice(0, -1).join(', ')} and ${cards.at(-1)} `) : f.message;
    return `<div class="flag ${f.severity}${f.card != null ? ' clickable' : ''}" data-flag="${i}">
    ${icon(f.severity === 'error' ? 'alert' : f.severity === 'warn' ? 'info' : 'check', 18)}<span>${esc(msg)}</span></div>`;
  }).join('');
}

export function ask(title, html, okLabel = 'OK') {
  const d = $('#dlg');
  d.innerHTML = `<form method="dialog" class="fields"><h2>${esc(title)}</h2>${html}
    <div class="row" style="justify-content:flex-end"><button value="cancel" formnovalidate>Cancel</button><button value="ok" class="primary">${esc(okLabel)}</button></div></form>`;
  d.showModal();
  return new Promise((resolve) => {
    d.addEventListener('close', () => {
      if (d.returnValue !== 'ok') return resolve(null);
      resolve(Object.fromEntries(new FormData(d.querySelector('form'))));
    }, { once: true });
  });
}

export function plusDays(date, n) { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function nice(date) {
  if (!date) return '';
  return new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}
// Server notes carry ISO dates; show them the way the rest of the app does.
export const niceDates = (text) => String(text || '').replace(/\b\d{4}-\d{2}-\d{2}\b/g, (d) => nice(d));
export function ago(date) {
  if (!date) return 'never';
  const d = Math.round((Date.parse(state.info?.today || new Date().toISOString().slice(0, 10)) - Date.parse(date)) / 864e5);
  return d <= 0 ? (d === 0 ? 'today' : d === -1 ? 'tomorrow' : `in ${-d} days`) : d === 1 ? 'yesterday' : `${d} days ago`;
}

// Category or theme picker with last-posted dates, suggested first. Returns a <select> element HTML.
export async function collectionSelect(market, date, current) {
  const list = await api('GET', `/api/collections/${market}?date=${date}`);
  const pick = current || list.find((c) => c.suggested)?.key;
  const opt = (c) => `<option value="${esc(c.key)}" ${c.key === pick ? 'selected' : ''}>${esc(c.label)}${c.suggested ? ' (suggested)' : ''} · ${c.planned ? `planned ${esc(nice(c.planned))}` : c.last ? `last ${esc(nice(c.last))}` : 'never posted'}</option>`;
  return `<select name="category"><optgroup label="Site categories">${list.filter((c) => c.kind === 'category').map(opt).join('')}</optgroup>
    <optgroup label="Themes">${list.filter((c) => c.kind === 'theme').map(opt).join('')}</optgroup></select>`;
}
