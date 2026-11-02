// Pull JSON objects out of a Next.js RSC payload without a full parser.

// Return the index just past the JSON object that opens at `start` (text[start] === '{'), or -1.
export function objectEnd(text, start) {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i + 1;
  }
  return -1;
}

function parseAt(text, start) {
  const end = objectEnd(text, start);
  if (end < 0) return null;
  try { return JSON.parse(text.slice(start, end)); } catch { return null; }
}

// Every object value of `"key":{...}` in the payload.
export function extractObjects(text, key) {
  const needle = `"${key}":{`, out = [];
  for (let i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + needle.length)) {
    const o = parseAt(text, i + needle.length - 1);
    if (o) out.push(o);
  }
  return out;
}

// Every object that starts with `prefix` (which must begin with '{').
export function extractObjectsAt(text, prefix) {
  const out = [];
  for (let i = text.indexOf(prefix); i >= 0; i = text.indexOf(prefix, i + 1)) {
    const o = parseAt(text, i);
    if (o) out.push(o);
  }
  return out;
}

// First number value of `"key":<n>`.
export function firstNumber(text, key) {
  const m = text.match(new RegExp(`"${key}":(\\d+)`));
  return m ? Number(m[1]) : null;
}

export function firstString(text, key) {
  const m = text.match(new RegExp(`"${key}":"([^"]*)"`));
  return m ? m[1] : null;
}
