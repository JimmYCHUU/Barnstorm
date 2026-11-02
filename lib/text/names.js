// Turn auction-feed names (all caps) into the names printed on cards.
const WORDS = {
  'N BOX': 'N-Box', 'N-BOX': 'N-Box', 'N-ONE': 'N-One', 'N-WGN': 'N-WGN', 'N-VAN': 'N-Van', 'NBOX': 'N-Box',
  'CR-X': 'CR-X', DELSOL: 'del Sol', MAZDA2: 'Mazda2', MAZDA3: 'Mazda3', MAZDA6: 'Mazda6', 'CX-3': 'CX-3', 'CX-5': 'CX-5',
  'CX-30': 'CX-30', 'CX-60': 'CX-60', 'MX-5': 'MX-5', 'MERCEDES BENZ': 'Mercedes-Benz', STEPWGN: 'Stepwgn', 'GT-R': 'GT-R',
  IX1: 'iX1', 'E:S': 'e:S', 'C-HR': 'C-HR', 'HR-V': 'HR-V', 'ZR-V': 'ZR-V', 'WR-V': 'WR-V', RAV4: 'RAV4', 'RX-7': 'RX-7',
  'RX-8': 'RX-8', 'X-TRAIL': 'X-Trail', 'E-POWER': 'e-Power', 'S-Z': 'S-Z', '+': '+', MINI: 'Mini', BMW: 'BMW', WRX: 'WRX',
  STI: 'STI', TRD: 'TRD', AMG: 'AMG', GR: 'GR', SUV: 'SUV', LAPIN: 'Lapin', BASE: 'Base',
};
const DROP_VARIANT = /^(4WD|2WD|AWD|DO4WD|E-FOUR|BASE|GRADE|PACKAGE|PKG|LIMITED|EDITION|SELECTION|SPECIAL|\[.*\])$/i;

export function titleWord(w) {
  const up = w.toUpperCase();
  if (WORDS[up]) return WORDS[up];
  if (/^\d/.test(w)) return up;                       // 15, 20P
  if (up.length <= 2) return up;                       // XC, RS, Z, GT
  if (/\d/.test(up) && up.length <= 4) return up;      // RZ4 style codes
  if (!/[AEIOUY]/.test(up)) return up;                 // SLK, GSR, BRZ
  return up[0] + up.slice(1).toLowerCase();
}

export function titleCase(s) {
  let t = String(s || '').trim().replace(/\s+/g, ' ');
  for (const k of Object.keys(WORDS).filter((k) => k.includes(' '))) t = t.replace(new RegExp(`\\b${k}\\b`, 'i'), `\u0000${k.replace(/ /g, '\u0001')}`);
  return t.split(' ').map((w) => (w.startsWith('\u0000') ? WORDS[w.slice(1).replace(/\u0001/g, ' ')] : titleWord(w))).join(' ')
    .replace(/ \+ ?/g, '+ ').replace(/\+ $/, '+');
}

function makeName(make) { return make === 'MERCEDES BENZ' ? 'Mercedes-Benz' : titleCase(make); }

const VARIANT_WORDS = new Set(['HYBRID', 'TURBO', 'E-POWER', 'TYPE']);
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function shortVariant(variant, modelText) {
  if (!variant) return '';
  const evo = /EVOLUTION\s*(\d+|[IVX]+)/i.exec(variant);
  if (evo) return `Evo ${ROMAN[Number(evo[1])] || evo[1].toUpperCase()}`;
  const toks = variant.replace(/\[[^\]]*\]/g, ' ').split(/\s+/).filter((t) => t && !DROP_VARIANT.test(t));
  // Keep grade codes (XC, RS, 20S, GT-R, S-Z, 15 BD) and a few known words, from the start only, at most two;
  // anything else (edition names, "*" fragments, PREMIUM...) ends the variant.
  const ok = (t) => (/^[A-Z0-9][A-Z0-9+-]{0,3}$/i.test(t) && !t.endsWith('-')) || VARIANT_WORDS.has(t.toUpperCase());
  const pick = [];
  for (const t of toks) { if (!ok(t) || pick.length === 2) break; pick.push(t); }
  const out = pick.filter((t) => !modelText.toUpperCase().split(' ').includes(t.toUpperCase()));
  const s = out.map(titleWord).join(' ');
  return s.length <= 12 ? s : '';
}

// "Suzuki Jimny", "Mazda2", "Mercedes-Benz B Class": make and model only, for captions.
export function shortName(lot) {
  const make = String(lot.make || '').toUpperCase(), model = String(lot.model || '').toUpperCase();
  return model.startsWith(make.split(' ')[0]) ? titleCase(model) : `${makeName(make)} ${titleCase(model)}`.trim();
}

// lot: {title, year, make, model, variant}. "2022 Suzuki Jimny XC", "2025 Mazda2 15 BD", "1994 Nissan Skyline GT-R".
export function modelName(lot) {
  const year = lot.year || Number(String(lot.title || '').slice(0, 4)) || '';
  let rest = String(lot.title || `${lot.make} ${lot.model}`).replace(/^\d{4}\s+/, '');
  const make = String(lot.make || '').toUpperCase();
  rest = rest.toUpperCase().startsWith(make + ' ') ? rest.slice(make.length + 1) : rest;
  const modelUp = rest.toUpperCase();
  const dropMake = make && modelUp.startsWith(make.split(' ')[0]);   // MAZDA MAZDA2 -> Mazda2
  const base = `${dropMake ? '' : makeName(make) + ' '}${titleCase(rest)}`.trim();
  const v = shortVariant(lot.variant, base);
  let name = [year, base, v].filter(Boolean).join(' ');
  if (name.length > 30) name = [year, base].filter(Boolean).join(' ');
  if (name.length > 30) name = [year, titleCase(rest)].filter(Boolean).join(' ');
  return name;
}
