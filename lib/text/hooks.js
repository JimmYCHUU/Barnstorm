// Hooks and feature lines, built only from the lot's own data and config/hooks.json.
import { readConfig, writeConfig } from '../config.js';
import { themeList } from '../collections.js';

let cfg = null;
export function hookConfig() { if (!cfg) cfg = readConfig('hooks.json'); return cfg; }
export function saveHooks(next) { writeConfig('hooks.json', next); cfg = null; }
export function reloadHooks() { cfg = null; return hookConfig(); }

const MAX_HOOK = 22, MAX_FEAT = 44;
const WORD = { 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten' };

const textOf = (lot) => [lot.sellingPoints, lot.equipment, lot.variant].filter(Boolean).join(' | ');
const isHybrid = (lot) => /hybrid/i.test(lot.fuel || '') || /hybrid/i.test(lot.variant || '');
const isManual = (lot) => /manual/i.test(lot.transmission || '');
const is4wd = (lot) => /4WD|AWD/i.test(lot.drive || '');
const isKei = (lot) => lot.engineCc && lot.engineCc <= 660;
const gearbox = (lot) => { const m = /(\d)-speed/i.exec(lot.transmission || ''); return m ? `${m[1]}-speed manual` : 'manual'; };

function fill(tpl, lot, match) {
  return tpl.replace('{seatsWord}', WORD[lot.seats] || String(lot.seats)).replace('{1}', match?.[1] || '');
}

function modelHooks(lot) {
  return hookConfig().models.filter((r) => r.make === String(lot.make).toUpperCase()
    && (r.model === String(lot.model).toUpperCase() || String(lot.title || '').toUpperCase().includes(` ${r.model}`))
    && (!r.modelCode || r.modelCode === String(lot.modelCode).toUpperCase())
    && (!r.seatsMin || (lot.seats || 0) >= r.seatsMin))
    .map((r) => ({ text: fill(r.hook, lot), source: 'model-library', key: r.key || null }));
}

function pointHooks(lot) {
  const t = textOf(lot), out = [];
  for (const r of hookConfig().points) {
    if (r.make && r.make !== String(lot.make).toUpperCase()) continue;
    const m = new RegExp(r.re, 'i').exec(t);
    if (m) out.push({ text: fill(r.hook, lot, m), source: 'selling-points', key: r.key });
  }
  return out;
}

function specHooks(lot) {
  const out = [];
  if (['S', '6'].includes(String(lot.grade))) out.push({ text: `Top marks: grade ${lot.grade}`, source: 'grade', key: 'grade' });
  if (lot.interiorGrade === 'A' && lot.exteriorGrade === 'A') out.push({ text: 'A-grade inside and out', source: 'grade', key: 'interior' });
  if ((lot.seats || 0) >= 7) out.push({ text: `Room for ${WORD[lot.seats] || lot.seats}`, source: 'spec', key: 'seats' });
  if (is4wd(lot) && isKei(lot)) out.push({ text: 'Pocket-sized 4x4', source: 'spec', key: '4wd' });
  if (isManual(lot)) out.push({ text: 'Proper manual gearbox', source: 'spec', key: 'manual' });
  if (isHybrid(lot)) out.push({ text: 'Petrol-electric hybrid', source: 'spec', key: 'hybrid' });
  if (isKei(lot) && /turbo/i.test(lot.variant || '')) out.push({ text: 'Small car, turbo kick', source: 'spec', key: 'turbo' });
  return out;
}

// Up to 3 hook options, best first: [{text, source, key}].
export function hookCandidates(lot, market, categorySlug) {
  const cats = hookConfig().categories;
  const all = [...modelHooks(lot), ...pointHooks(lot), ...specHooks(lot),
    { text: cats[categorySlug] || themeList().find((t) => t.key === categorySlug)?.hook || cats._default, source: 'category', key: null }];
  const seen = new Set(), out = [];
  for (const h of all) {
    if (!h.text || h.text.length > MAX_HOOK || seen.has(h.text)) continue;
    seen.add(h.text); out.push(h);
    if (out.length === 3) break;
  }
  return out;
}

// Up to 3 features joined with " · ", never longer than 44 characters, skipping keys the hook already uses.
export function featureLine(lot, usedKeys = []) {
  const skip = new Set(usedKeys.filter(Boolean)), items = [], keys = new Set();
  const add = (key, label) => { if (!label || skip.has(key) || keys.has(key)) return; keys.add(key); items.push(label); };
  if (is4wd(lot)) add('4wd', isHybrid(lot) ? 'hybrid AWD' : '4WD');
  if (isHybrid(lot) && !is4wd(lot)) add('hybrid', 'hybrid');
  if (isManual(lot)) add('manual', gearbox(lot));
  const t = textOf(lot);
  for (const r of hookConfig().features) {
    const m = new RegExp(r.re, 'i').exec(t);
    if (m) add(r.key, fill(r.label, lot, m));
  }
  if (lot.seats >= 6) add('seats', `${lot.seats} seats`);
  if (lot.engineCc) add('engine', isKei(lot) ? '660cc' : `${(lot.engineCc / 1000).toFixed(1)} ${isHybrid(lot) ? 'hybrid' : String(lot.fuel || 'petrol').toLowerCase()}`);
  if (!isManual(lot) && lot.transmission) add('gearbox', 'automatic');
  if (lot.seats) add('seats', `${lot.seats} seats`);

  const picked = [];
  for (const it of items) {
    if (picked.length === 3) break;
    if ([...picked, it].join(' · ').length <= MAX_FEAT) picked.push(it);
  }
  const line = picked.join(' · ');
  return line ? line[0].toUpperCase() + line.slice(1) : '';
}

export function kmLabel(lot) {
  return lot.odometerKm == null ? '' : `${Number(lot.odometerKm).toLocaleString('en-GB')} km`;
}
