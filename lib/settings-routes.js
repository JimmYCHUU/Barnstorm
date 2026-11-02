// Settings and Learn API: edit hooks, word rules, schedule and category order; review learned suggestions.
import { route, HttpError } from './api.js';
import { hookConfig, saveHooks } from './text/hooks.js';
import { rulesConfig, saveRules } from './text/rules.js';
import { scheduleConfig, saveSchedule } from './planner.js';
import { loadMarkets, saveMarkets } from './markets.js';
import { topicList } from './topics/index.js';
import { readLog, listPosts } from './store.js';
import { suggestRules, applySuggestion, dismissSuggestion, learnState } from './learn.js';

const bad = (m) => { throw new HttpError(400, m); };

route('GET', '/api/settings', () => ({ hooks: hookConfig(), rules: rulesConfig(), schedule: scheduleConfig(), markets: loadMarkets() }));

route('PUT', '/api/settings/hooks', ({ body }) => {
  const cfg = hookConfig();
  if (body.models) {
    for (const m of body.models) {
      if (!m.make || !m.model || !m.hook) bad('Every model hook needs a make, a model and a hook.');
      if (m.hook.replace('{seatsWord}', 'seven').length > 22) bad(`"${m.hook}" is longer than 22 characters.`);
    }
    cfg.models = body.models.map((m) => Object.fromEntries(Object.entries({ make: m.make.toUpperCase().trim(), model: m.model.toUpperCase().trim(),
      modelCode: m.modelCode?.toUpperCase().trim() || undefined, seatsMin: Number(m.seatsMin) || undefined, hook: m.hook.trim(), key: m.key || undefined })
      .filter(([, v]) => v !== undefined)));
  }
  if (body.points) {
    for (const p of body.points) {
      try { new RegExp(p.re, 'i'); } catch { bad(`Pattern for "${p.hook}" is not valid.`); }
      if (p.hook.replace('{1}', 'Modellista').length > 22) bad(`"${p.hook}" is longer than 22 characters.`);
    }
    cfg.points = body.points;
  }
  saveHooks(cfg);
  return hookConfig();
});

route('PUT', '/api/settings/rules', ({ body }) => {
  if (!Array.isArray(body.never)) bad('never must be a list');
  const cfg = rulesConfig();
  cfg.never = body.never.filter((n) => n.phrase?.trim()).map((n) => ({ phrase: n.phrase.trim(), why: n.why?.trim() || 'Added in Settings.' }));
  saveRules(cfg);
  return rulesConfig();
});

route('PUT', '/api/settings/schedule', ({ body }) => {
  const topics = new Set(topicList().map((t) => t.key)), cfg = scheduleConfig();
  const pattern = Object.fromEntries(Object.entries(body.pattern || {}).filter(([, v]) => v));
  for (const v of Object.values(pattern)) if (!topics.has(v)) bad(`Unknown topic ${v}`);
  if (!Object.keys(pattern).length) bad('Choose at least one posting day.');
  Object.assign(cfg, { pattern, factEveryWeeks: Number(body.factEveryWeeks) || 0, factDay: body.factDay || cfg.factDay,
    categoryCooldownDays: Math.max(0, Number(body.categoryCooldownDays) || 14) });
  saveSchedule(cfg);
  return scheduleConfig();
});

route('PUT', '/api/settings/markets/([a-z]+)/categories', ({ m, body }) => {
  const cfg = loadMarkets(), mk = cfg.markets[m[1]];
  if (!mk) bad('Unknown market');
  const order = body.order || [];
  if (order.length !== mk.categories.length || !order.every((s) => mk.categories.some((c) => c.slug === s))) bad('The order must list every category once.');
  mk.categories = order.map((s) => mk.categories.find((c) => c.slug === s));
  saveMarkets(cfg);
  return mk.categories;
});

function learnView() {
  const log = readLog(), posts = listPosts();
  const stats = {};
  for (const p of posts) {
    const s = (stats[p.market] = stats[p.market] || { built: 0, approved: 0, rejected: 0, published: 0 });
    s.built++;
    if (['approved', 'exported', 'published'].includes(p.status)) s.approved++;
    if (p.status === 'rejected') s.rejected++;
    if (p.status === 'published') s.published++;
  }
  const edits = {};
  for (const e of log.filter((x) => x.type === 'edited')) for (const k of Object.keys(e.changes?.slots || {})) edits[k] = (edits[k] || 0) + 1;
  return { suggestions: suggestRules(log, learnState()), stats, edits,
    rejections: log.filter((e) => e.type === 'rejected').slice(-10).reverse(), recent: log.slice(-40).reverse() };
}

route('GET', '/api/learn', () => learnView());

route('POST', '/api/learn/([a-f0-9]+)/apply', ({ m }) => {
  const s = suggestRules(readLog(), learnState()).find((x) => x.id === m[1]);
  if (!s) throw new HttpError(404, 'That suggestion is no longer open.');
  applySuggestion(s);
  return learnView();
});

route('POST', '/api/learn/([a-f0-9]+)/dismiss', ({ m }) => { dismissSuggestion(m[1]); return learnView(); });
