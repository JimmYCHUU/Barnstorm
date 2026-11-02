// Reads live auction lots, category counts and stock from the Carbarn storefronts.
// Each page answers `RSC: 1` requests with a Next.js payload carrying structured vehicle objects.
import { extractObjects, extractObjectsAt, firstNumber, firstString } from '../util/rsc.js';
import { collectionUrl } from '../collections.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

export class SourceError extends Error {
  constructor(message, url, { notFound = false } = {}) { super(`${message} (${url})`); this.name = 'SourceError'; this.url = url; this.notFound = notFound; }
}

export async function fetchRsc(url, fetchFn = fetch) {
  let res;
  try {
    res = await fetchFn(url, { headers: { RSC: '1', 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(30000) });
  } catch (e) {
    throw new SourceError(`Could not reach the site: ${e.message}`, url);
  }
  if (!res.ok) throw new SourceError(`Site answered HTTP ${res.status}`, url, { notFound: res.status === 404 });
  const text = await res.text();
  if (/^\s*<(!doctype|html)/i.test(text)) throw new SourceError('Site sent a web page instead of data (page missing or layout changed)', url);
  return text;
}

const slugPart = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';

export function lotUrl(m, v) {
  return `${m.base}/live-auction/${slugPart(v.make)}/${slugPart(v.model)}/${slugPart(v.modelCode)}/${v.id}`;
}

// Auction photo host serves up to 1024x768 when asked for the largest size.
export function photoUrl(url) {
  if (!url.includes('photos.carbarn.com.au')) return url;
  const u = url.replace(/&h=\d+|&w=\d+/g, '');
  return `${u}&h=900&w=1600`;
}

function toLot(v, m) {
  const sheet = v.auctionSheetSummary || {};
  return {
    id: String(v.id), title: v.title, make: v.make, model: v.model, modelCode: v.modelCode, year: v.year,
    auctionDate: v.auctionDate, auctionHouse: v.auctionHouse, lotNumber: v.lotNumber,
    odometerKm: v.odometerKm, grade: v.auctionGrade ?? sheet.grade ?? null,
    interiorGrade: v.interiorGrade ?? null, exteriorGrade: v.exteriorGrade ?? null,
    fuel: v.fuelType, engineCc: v.engineCc, drive: v.driveType, transmission: v.transmission, colour: v.colour ?? null,
    body: v.bodyType, seats: v.seatingCapacity ?? null, variant: v.variant ?? sheet.variant ?? null,
    regDate: sheet.regDate ?? null, equipment: v.equipment ?? sheet.equipment ?? null,
    sellingPoints: sheet.sellingPoints ?? null, inspectorNotes: sheet.inspectorNotes ?? null,
    repairHistory: sheet.repairHistory ?? null,
    photos: (v.photos && v.photos.length ? v.photos : [v.mainImageUrl]).filter(Boolean),
    mainPhoto: v.mainImageUrl ?? null,
    url: lotUrl(m, v), market: m.key,
  };
}

export function parseCategory(text, m) {
  const seen = new Set(), lots = [];
  for (const v of extractObjects(text, 'vehicle')) {
    if (!v.id || seen.has(v.id)) continue;
    seen.add(v.id); lots.push(toLot(v, m));
  }
  return { count: firstNumber(text, 'vehicleCount') ?? 0, cutoffUtc: firstString(text, 'feedCutOffAtUtc'), lots };
}

// With `id`, the page must be for that lot: a page for any other car means the lot is gone.
export function parseLot(text, m, id = null) {
  const all = extractObjects(text, 'vehicle');
  const v = id ? all.find((o) => String(o.id) === String(id))
    : all.find((o) => o.auctionSheetSummary) || all[0];
  if (!v) throw new SourceError(id ? `Lot ${id} not found` : 'No lot data in page', m.base, { notFound: !!id });
  return toLot(v, m);
}

const isOwn = (u) => /amazonaws\.com\/nichibo\//.test(u);

function toStock(o, m) {
  const photos = [...(o.exteriorPhoto || []), ...(o.interiorPhoto || [])];
  const region = { ie: 'IE', uk: 'GB', us: 'US', mt: 'MT', cy: 'CY' }[m.key];
  const price = o.price?.[region] ?? null;
  return {
    id: String(o.stockNo || o.slug), slug: o.slug, title: o.title, make: o.make, model: o.model, modelCode: o.modelCode,
    year: Number(o.builtYear) || null, variant: o.variant ?? null, odometerKm: Number(o.odometer) || null,
    grade: o.auctionGrade ?? null, seats: Number(o.seats) || null, fuel: o.fuel, drive: o.driveTrain, transmission: o.transmission,
    colour: o.exteriorColor ?? null, engineCc: o.engineSize ?? null, status: o.status, soldStatus: o.soldStatus ?? null,
    features: (o.features || []).map((f) => f.featureDescription || f.featureTitle).filter(Boolean),
    price: price ? { amount: price.salePrice, currency: price.currency } : null,
    ownPhotos: photos.filter(isOwn), auctionPhotos: photos.filter((u) => !isOwn(u)),
    url: `${m.base}/vehicles/${o.slug}`, market: m.key, sites: o.sites || [],
  };
}

export function parseStockList(text, m) {
  const seen = new Set(), out = [];
  for (const o of extractObjectsAt(text, '{"updatedAt":')) {
    if (!o.slug || !o.stockNo || seen.has(o.slug)) continue;
    seen.add(o.slug); out.push(toStock(o, m));
  }
  return out;
}

export function isOwnPhoto(url) { return isOwn(url); }

// ---- network calls ----

// coll: a collection from lib/collections.js (or a site category slug).
export async function getCategory(m, coll, { date, page } = {}, fetchFn) {
  const c = typeof coll === 'string' ? { path: coll } : coll;
  return parseCategory(await fetchRsc(collectionUrl(m, c, { date, page }), fetchFn), m);
}

export async function getCategoryCounts(m, coll, dates, fetchFn) {
  const total = (await getCategory(m, coll, {}, fetchFn)).count;
  const byDate = {};
  for (const d of dates) byDate[d] = (await getCategory(m, coll, { date: d }, fetchFn)).count;
  return { total, byDate, fetchedAt: new Date().toISOString() };
}

export async function getLot(m, id, fetchFn) {
  return parseLot(await fetchRsc(`${m.base}/live-auction/x/x/x/${id}`, fetchFn), m, id);
}

export async function getStockList(m, fetchFn) {
  const out = new Map();
  for (let page = 1; page <= 5; page++) {
    const items = parseStockList(await fetchRsc(`${m.base}/cars${page > 1 ? `?page=${page}` : ''}`, fetchFn), m);
    const before = out.size;
    for (const s of items) out.set(s.slug, s);
    if (out.size === before) break;
  }
  return [...out.values()];
}

export async function getStockVehicle(m, slug, fetchFn) {
  const list = parseStockList(await fetchRsc(`${m.base}/vehicles/${slug}`, fetchFn), m);
  const v = list.find((s) => s.slug === slug);
  if (!v) throw new SourceError('Stock car not found', `${m.base}/vehicles/${slug}`, { notFound: true });
  return v;
}
