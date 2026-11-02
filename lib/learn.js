// Learns from what Jim changes: repeated hook rewrites, phrases he keeps deleting, categories he keeps rejecting.
// Suggestions are only proposals; nothing changes until he accepts one.
import crypto from 'node:crypto';
import path from 'node:path';
import { dataDir, readJson, writeJson } from './store.js';
import { hookConfig, saveHooks } from './text/hooks.js';
import { rulesConfig, saveRules } from './text/rules.js';
import { loadMarkets, saveMarkets } from './markets.js';

const MIN_HOOK = 2, MIN_PHRASE = 3, MIN_REJECT = 2;
const TRIM = new Set(['is', 'are', 'was', 'were', 'and', 'but', 'so', 'that', 'which', 'it', 'its', 'also', 'just']);

const stateFile = () => path.join(dataDir(), 'learn.json');
export function learnState() { return readJson(stateFile(), { applied: [], dismissed: [] }); }
const saveState = (s) => writeJson(stateFile(), s);
const evId = (e) => e.id || e.ts;
const sid = (kind, proposal) => crypto.createHash('sha1').update(kind + JSON.stringify(proposal)).digest('hex').slice(0, 12);
const mode = (xs) => { const c = {}; xs.forEach((x) => (c[x] = (c[x] || 0) + 1)); return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; };

// Words removed from `before` to get `after` (longest common subsequence on words), as contiguous spans.
export function removedSpans(before, after) {
  const a = String(before || '').split(/\s+/).filter(Boolean), b = String(after || '').split(/\s+/).filter(Boolean);
  const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const spans = []; let cur = [];
  for (let i = 0, j = 0; i < a.length;) {
    if (j < b.length && a[i] === b[j]) { if (cur.length) spans.push(cur); cur = []; i++; j++; }
    else if (j < b.length && L[i][j + 1] >= L[i + 1][j]) j++;
    else { cur.push(a[i]); i++; }
  }
  if (cur.length) spans.push(cur);
  return spans.map((ws) => {
    const w = ws.map((x) => x.replace(/[.,!?;:]+$/, ''));
    while (w.length && TRIM.has(w[0].toLowerCase())) w.shift();
    while (w.length && TRIM.has(w.at(-1).toLowerCase())) w.pop();
    return w.join(' ').toLowerCase();
  }).filter((p) => p && p.split(' ').length <= 6 && !/\d|#|https?:/.test(p) && /[a-z]/.test(p));
}

export function suggestRules(events, state = { applied: [], dismissed: [] }) {
  const out = [];
  const push = (kind, proposal, evidence, why) => out.push({ id: sid(kind, proposal), kind, proposal, evidence, why });

  // 1. Hooks from the library or a selling-point rule that Jim rewrites again and again.
  const groups = new Map();
  for (const e of events.filter((x) => x.type === 'edited' && x.changes?.slots?.hook != null && x.before?.slots?.hook)) {
    if (!['model-library', 'selling-points'].includes(e.hookSource)) continue;
    const k = `${e.hookSource}|${e.before.slots.hook}|${e.hookSource === 'model-library' ? `${e.car?.make} ${e.car?.model}` : ''}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  for (const list of groups.values()) {
    if (list.length < MIN_HOOK) continue;
    const e = list[0], to = mode(list.map((x) => x.changes.slots.hook));
    if (e.hookSource === 'model-library') {
      push('hook-library', { from: e.before.slots.hook, to, make: e.car?.make, model: e.car?.model, modelCode: e.car?.modelCode || null }, list.map(evId),
        `You changed "${e.before.slots.hook}" ${list.length} times on ${e.car?.make} ${e.car?.model} cards.`);
    } else {
      push('hook-rule', { from: e.before.slots.hook, to, key: e.hookKey }, list.map(evId), `You changed the "${e.before.slots.hook}" hook ${list.length} times.`);
    }
  }

  // 2. Phrases deleted from captions again and again.
  const phrases = new Map();
  for (const e of events.filter((x) => x.type === 'edited' && x.changes?.caption && x.beforeCaption)) {
    const seen = new Set();
    for (const k of ['a', 'b']) {
      if (e.changes.caption[k] == null) continue;
      for (const p of removedSpans(e.beforeCaption[k], e.changes.caption[k])) seen.add(p);
    }
    for (const p of seen) { if (!phrases.has(p)) phrases.set(p, []); phrases.get(p).push(evId(e)); }
  }
  const never = new Set(rulesConfig().never.map((n) => n.phrase.toLowerCase()));
  for (const [p, ids] of phrases) {
    if (ids.length >= MIN_PHRASE && !never.has(p)) push('never-phrase', { phrase: p }, ids, `You deleted "${p}" from ${ids.length} captions.`);
  }

  // 3. Categories rejected again and again on one Page.
  const rej = new Map();
  for (const e of events.filter((x) => x.type === 'rejected' && x.params?.category)) {
    const k = `${e.market}|${e.params.category}`;
    if (!rej.has(k)) rej.set(k, []);
    rej.get(k).push(e);
  }
  const mk = loadMarkets().markets;
  for (const [k, list] of rej) {
    const [market, category] = k.split('|');
    if (list.length < MIN_REJECT || mk[market]?.categories.at(-1)?.slug === category) continue;
    push('category-weight', { market, category, action: 'move-last' }, list.map(evId),
      `${list.length} ${category} posts were rejected on this Page${list[0].reason ? ` (e.g. "${list[0].reason}")` : ''}. Plan it less often.`);
  }

  const hidden = new Set([...(state.applied || []), ...(state.dismissed || [])]);
  return out.filter((s) => !hidden.has(s.id));
}

export function applySuggestion(s) {
  const p = s.proposal;
  if (s.kind === 'hook-library') {
    const cfg = hookConfig();
    const hit = cfg.models.find((m) => m.make === p.make && m.model === p.model && m.hook === p.from);
    if (hit) hit.hook = p.to; else cfg.models.push({ make: p.make, model: p.model, hook: p.to });
    saveHooks(cfg);
  } else if (s.kind === 'hook-rule') {
    const cfg = hookConfig();
    for (const r of cfg.points) if (r.hook === p.from && (!p.key || r.key === p.key)) r.hook = p.to;
    saveHooks(cfg);
  } else if (s.kind === 'never-phrase') {
    const cfg = rulesConfig();
    cfg.never.push({ phrase: p.phrase, why: 'Learned: you removed it from several captions.' });
    saveRules(cfg);
  } else if (s.kind === 'category-weight') {
    const cfg = loadMarkets(), cats = cfg.markets[p.market].categories, i = cats.findIndex((c) => c.slug === p.category);
    if (i >= 0) cats.push(...cats.splice(i, 1));
    saveMarkets(cfg);
  } else throw new Error(`Unknown suggestion kind ${s.kind}`);
  const st = learnState(); st.applied.push(s.id); saveState(st);
}

export function dismissSuggestion(id) { const st = learnState(); st.dismissed.push(id); saveState(st); }
