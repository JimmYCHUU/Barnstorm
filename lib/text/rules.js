// Copy rules: banned phrases, market terms and spelling, from config/rules.json.
import { readConfig, writeConfig } from '../config.js';

let cfg = null;
export function rulesConfig() { if (!cfg) cfg = readConfig('rules.json'); return cfg; }
export function reloadRules() { cfg = null; return rulesConfig(); }
export function saveRules(next) { writeConfig('rules.json', next); cfg = null; }

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (phrase) => new RegExp(`(^|[^\\w])${escape(phrase)}(?![\\w])`, 'i');

// Returns [{rule:'banned-phrase'|'term'|'spelling', phrase, severity, why?, suggestion?}].
export function checkCopy(text, market) {
  const c = rulesConfig(), pm = c.perMarket?.[market.key] || {}, out = [];
  const t = String(text || '');
  for (const n of [...c.never, ...(pm.never || []).map((p) => ({ phrase: p, why: `Not used for ${market.brand}.` }))]) {
    if (wordRe(n.phrase).test(t)) out.push({ rule: 'banned-phrase', phrase: n.phrase, severity: 'error', why: n.why });
  }
  for (const [bad, good] of Object.entries(pm.replace || {})) {
    if (wordRe(bad).test(t) && !out.some((o) => o.rule === 'term' && good.startsWith(o.suggestion))) {
      out.push({ rule: 'term', phrase: bad, severity: 'error', suggestion: good });
    }
  }
  const us = market.spelling === 'us';
  for (const [uk, am] of c.spellingPairs) {
    const wrong = us ? uk : am, right = us ? am : uk;
    if (wordRe(wrong).test(t) && !out.some((o) => o.rule === 'spelling' && right.startsWith(o.suggestion))) {
      out.push({ rule: 'spelling', phrase: wrong, severity: 'warn', suggestion: right });
    }
  }
  return out;
}

// Spell a word the market's way ("favourites" -> "favorites" for the US).
export function spell(word, market) {
  if (market.spelling !== 'us') return word;
  const p = rulesConfig().spellingPairs.find(([uk]) => uk === word);
  return p ? p[1] : word;
}
