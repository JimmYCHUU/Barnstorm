// Date words used on cards and in captions. Dates are plain YYYY-MM-DD auction days (Japan).
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const parse = (d) => { const [y, m, day] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, day)); };

export function dayName(date) { return DOW[parse(date).getUTCDay()]; }

// "TUE 3 NOV" (day-month markets) or "TUE NOV 3" (US).
export function auctionPill(date, market) {
  const d = parse(date), dow = DOW[d.getUTCDay()].slice(0, 3).toUpperCase(), mon = MON[d.getUTCMonth()], n = d.getUTCDate();
  return market.dateStyle === 'mdy' ? `${dow} ${mon} ${n}` : `${dow} ${n} ${mon}`;
}

// "Tue 3 Nov" / "Tue Nov 3" for captions and notes.
export function shortDate(date, market) {
  const p = auctionPill(date, market).toLowerCase().split(' ');
  return p.map((w) => (/\d/.test(w) ? w : w[0].toUpperCase() + w.slice(1))).join(' ');
}

export function addDays(date, n) {
  const d = parse(date); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}

// The local calendar date (the engine runs on Jim's PC; UTC would be yesterday for part of every morning).
export function today(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function mondayOf(date) {
  const d = parse(date), dow = d.getUTCDay();
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}
