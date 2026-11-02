// Plan API: propose a week, edit slots, build a slot into a post.
import path from 'node:path';
import { route, HttpError, postView, hooks, DATE } from './api.js';
import { proposeWeek, planFile, rankCollections, scheduleConfig, plannedAround } from './planner.js';
import { collection } from './collections.js';
import { market as getMarket } from './markets.js';
import { history } from './history.js';
import { allMarkets } from './markets.js';
import { dataDir, readJson, writeJson, getPost, logEvent } from './store.js';
import { buildPost, setStatus } from './build.js';
import { UserError } from './errors.js';
import { addDays, mondayOf, today } from './text/dates.js';

const defaultWeek = () => mondayOf(addDays(today(), 1));
const load = (week) => readJson(planFile(dataDir(), week), null);
const save = (plan) => writeJson(planFile(dataDir(), plan.weekStart), plan);

function findSlot(id) {
  const week = id.slice(0, 10), plan = load(week);
  const slot = plan?.slots.find((s) => s.id === id);
  if (!slot) throw new HttpError(404, `No planned slot "${id}"`);
  return { plan, slot };
}

export function linkSlot(slotId, postId) {
  if (!slotId) return;
  try { const { plan, slot } = findSlot(slotId); slot.postId = postId; slot.status = 'built'; save(plan); } catch { /* slot gone */ }
}
hooks.afterBuild.push((post, body) => linkSlot(body.slotId, post.id));

const nameOf = (m, k) => { try { return collection(m, k).label; } catch { return k; } };
const tooClose = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5 < scheduleConfig().categoryCooldownDays;
const movable = (slot) => !slot.postId && slot.status !== 'dropped' && slot.params?.category;

// Give an unbuilt slot the next fresh theme for its Page, and say why on the slot.
function repick(plan, slot, why) {
  const m = getMarket(slot.market), key = slot.params.category;
  const takenToday = new Set(plan.slots.filter((x) => x.date === slot.date && x !== slot).map((x) => x.params?.category).filter(Boolean));
  const others = plannedAround(dataDir(), plan.weekStart).filter((x) => !(x.market === slot.market && x.date === slot.date));
  const next = rankCollections(m, slot.date, [...history(), ...others], { takenToday, exclude: new Set([key]) })[0];
  if (!next) return false;
  slot.params = { ...slot.params, category: next.key };
  slot.note = `Changed from ${nameOf(m, key)}: ${why}`;
  return true;
}

// A post built outside the plan can land within the cooldown of a slot already planned with the same theme:
// move those slots on.
export function moveClashingSlots(post) {
  const key = post.params?.category;
  if (!key) return;
  for (let w = -28; w <= 28; w += 7) {
    const plan = load(addDays(mondayOf(post.plannedFor), w));
    if (!plan) continue;
    let changed = false;
    for (const slot of plan.slots) {
      if (slot.market !== post.market || !movable(slot) || slot.params.category !== key || !tooClose(slot.date, post.plannedFor)) continue;
      changed = repick(plan, slot, `you made a ${nameOf(getMarket(post.market), key)} post for ${post.plannedFor}.`) || changed;
    }
    if (changed) save(plan);
  }
}
hooks.afterBuild.push((post) => moveClashingSlots(post));

// A plan proposed before some post was made (or before this check existed) can still repeat it: fix that on opening.
// ---- clearing a built slot so it can be built again ----
// The old post's cars are kept out of the next build (slot.avoid), and the note says what happened.
function release(slot, post, note) {
  if (post) slot.avoid = [...new Set([...(slot.avoid || []), ...post.cards.map((c) => c.facts?.id).filter(Boolean).map(String)])];
  delete slot.postId; delete slot.postStatus;
  slot.status = 'accepted';
  slot.note = note;
}

// Remove or Rebuild: the post is set aside (under Posts → Rejected) without counting as a rejection, so Learn
// never reads it as a dislike of the theme. A published post is never touched.
async function takeOff(slot, why) {
  const post = slot.postId && getPost(slot.postId);
  if (post?.status === 'published') throw new HttpError(409, 'This post is already published, so it stays. Plan a new post on another day instead.');
  if (post && post.status !== 'rejected') {
    await setStatus(post, 'rejected', { rejectedAt: new Date().toISOString(), rejectReason: why, removedFromPlan: true });
    logEvent({ type: 'removed', postId: post.id, market: post.market, topic: post.topic, params: post.params, reason: why });
  }
  release(slot, post, `${why} on ${today()}.`);
}

// A post rejected in the studio, or deleted, frees its slot by itself.
function releaseRejected(plan) {
  let changed = false;
  for (const slot of plan.slots.filter((s) => s.postId)) {
    const post = getPost(slot.postId);
    if (post && post.status !== 'rejected') continue;
    release(slot, post, post?.removedFromPlan ? `Removed on ${(post.rejectedAt || '').slice(0, 10)}.`
      : post ? `Rejected on ${(post.rejectedAt || '').slice(0, 10)}: "${post.rejectReason || 'no reason'}". Build it again for other cars, or change the theme.` : 'Its post was deleted.');
    changed = true;
  }
  return changed;
}

function repairPlan(plan) {
  const h = history();
  let changed = false;
  for (const slot of plan.slots.filter(movable)) {
    const hit = h.find((x) => x.market === slot.market && x.params?.category === slot.params.category && tooClose(x.date, slot.date));
    if (hit) changed = repick(plan, slot, `this Page already has a ${nameOf(getMarket(slot.market), slot.params.category)} post for ${hit.date}.`) || changed;
  }
  if (changed) save(plan);
}

route('GET', '/api/plan', ({ url }) => {
  const week = url.searchParams.get('week') || defaultWeek();
  const plan = load(week) || { weekStart: week, slots: [] };
  if (releaseRejected(plan)) save(plan);
  repairPlan(plan);
  for (const s of plan.slots) if (s.postId) s.postStatus = getPost(s.postId)?.status || null;
  const linked = new Set(plan.slots.map((s) => s.postId).filter(Boolean)), end = addDays(week, 6);
  plan.existing = history().filter((h) => h.date >= week && h.date <= end && !linked.has(h.postId))
    .map((h) => ({ market: h.market, date: h.date, topic: h.topic, params: h.params, postId: h.postId || null }));
  plan.cooldown = scheduleConfig().categoryCooldownDays;
  return plan;
});

route('POST', '/api/plan/propose', async ({ body, ctx }) => {
  if (body.week && !DATE.test(body.week)) throw new HttpError(400, 'week must look like 2026-11-02');
  const week = body.week ? mondayOf(body.week) : defaultWeek();
  const stock = {};
  for (const m of allMarkets()) {
    try { stock[m.key] = (await ctx.deps.source.getStockList(m)).filter((s) => s.status === 'LIVE' && s.ownPhotos.length).length; }
    catch { stock[m.key] = 0; }
  }
  const old = load(week);
  const kept = (old?.slots || []).filter((s) => s.postId);
  const fresh = proposeWeek(week, [...history(), ...plannedAround(dataDir(), week, { skipWeek: true })], allMarkets(), stock).filter((s) => !kept.some((k) => k.id === s.id));
  const plan = { weekStart: week, createdAt: new Date().toISOString(), slots: [...kept, ...fresh].sort((a, b) => a.date.localeCompare(b.date) || a.market.localeCompare(b.market)) };
  save(plan);
  return plan;
});

route('PATCH', '/api/plan/([^/]+)', ({ m, body }) => {
  const { plan, slot } = findSlot(m[1]);
  if (body.status && ['proposed', 'accepted', 'dropped'].includes(body.status)) slot.status = body.status;
  if (body.topic) slot.topic = body.topic;
  if (body.params) slot.params = body.params;
  if (body.date) { if (!DATE.test(body.date)) throw new HttpError(400, 'date must look like 2026-11-04'); slot.date = body.date; }
  save(plan);
  return slot;
});

route('POST', '/api/plan/([^/]+)/build', async ({ m, ctx }) => {
  const { plan, slot } = findSlot(m[1]);
  const linked = slot.postId && getPost(slot.postId);
  if (linked && linked.status !== 'rejected') return postView(linked);
  releaseRejected(plan);
  if (/^(Rejected|Removed|Rebuilt|Its post was deleted)/.test(slot.note || '')) delete slot.note;   // it is being built again
  const post = await buildWithFallback(slot, ctx.deps);
  slot.postId = post.id; slot.status = 'built';
  save(plan);
  return postView(post);
});

route('POST', '/api/plan/([^/]+)/remove', async ({ m }) => {
  const { plan, slot } = findSlot(m[1]);
  await takeOff(slot, 'Removed from the Plan');
  save(plan);
  return slot;
});

// Build a new post for the slot, then take the old one off: the same theme with other cars, or a changed topic, theme
// or date. The new one is built first (the old post still holds its cars, so they are not picked), so a failed build
// leaves the slot as it was.
route('POST', '/api/plan/([^/]+)/rebuild', async ({ m, body, ctx }) => {
  const { plan, slot } = findSlot(m[1]);
  if (body.date && !DATE.test(body.date)) throw new HttpError(400, 'date must look like 2026-11-04');
  if (getPost(slot.postId || '')?.status === 'published') throw new HttpError(409, 'This post is already published, so it stays. Plan a new post on another day instead.');
  const next = { ...slot, note: undefined, ...(body.topic && { topic: body.topic }), ...(body.params && { params: body.params }), ...(body.date && { date: body.date }) };
  const post = await buildWithFallback(next, ctx.deps);
  await takeOff(slot, 'Rebuilt');
  Object.assign(slot, { topic: next.topic, params: next.params, date: next.date, postId: post.id, status: 'built' });
  if (next.note) slot.note = next.note; else delete slot.note;
  save(plan);
  return postView(post);
});

// A theme can be empty on the days after the post (lots appear daily): try the next fresh collections, at most 3 more.
async function buildWithFallback(slot, deps) {
  const build = (params) => buildPost({ market: slot.market, topic: slot.topic, params, plannedFor: slot.date, avoid: slot.avoid || [] }, deps);
  if (!['live-lots', 'lot-spotlight'].includes(slot.topic) || !slot.params?.category) return build(slot.params);
  const m = getMarket(slot.market), tried = [slot.params.category];
  for (;;) {
    try {
      const post = await build({ ...slot.params, category: tried.at(-1) });
      if (tried.length > 1) {
        slot.note = `Switched from ${tried.slice(0, -1).map((k) => collection(m, k).label).join(', ')}: no eligible lots.`;
        slot.params = { ...slot.params, category: tried.at(-1) };
      }
      return post;
    } catch (e) {
      if (e.name !== 'UserError' || !/No eligible lots/.test(e.message) || tried.length > 3) throw e;
      // Further out than tomorrow, the auctions simply aren't listed yet: another theme won't help.
      if (slot.date > addDays(today(), 1)) throw new UserError(`No eligible lots yet: the site lists auctions only a few days ahead. Build this post on ${addDays(slot.date, -1)}, the day before it goes out.`);
      const next = rankCollections(m, slot.date, history(), { exclude: new Set(tried) })[0];
      if (!next) throw e;
      tried.push(next.key);
    }
  }
}
