// Every word on the pictures starts with a capital (Jim, 2 Nov 2026): "Room for seven" → "Room For Seven".
// Only first letters change, so JDM, 4WD and GR stay as they are; a word that starts with a number (4x4, 2.5, 660cc)
// is left alone; each part of a hyphenated word is capitalised (Pocket-Sized, 6-Speed); units stay small (km, cc).
const UNITS = new Set(['km', 'cc', 'kg', 'mph']);

const part = (p) => p.replace(/^([^\p{L}\p{N}]*)(\p{Ll})/u, (_, lead, ch) => lead + ch.toUpperCase());

export function capitalWords(text) {
  return String(text ?? '').split(/(\s+)/).map((w) => (/^\s*$/.test(w) || UNITS.has(w.toLowerCase()) ? w : w.split(/([-–])/).map(part).join(''))).join('');
}

// The other way, for captions, which read as sentences: each word goes back to a small first letter, except short forms
// and names with a capital inside (4WD, TV, ED, GR, McLaren), single capital letters (Bongo Van V) and words `keep` matches.
export function sentenceWords(text, keep = null) {
  return String(text ?? '').split(/(\s+)/).map((w) => {
    if (/^\s*$/.test(w) || /\p{Lu}.*\p{Lu}/u.test(w) || /^\p{Lu}$/u.test(w) || keep?.test(w)) return w;
    return w.split(/([-–])/).map((p) => p.replace(/^([^\p{L}\p{N}]*)(\p{Lu})(?=\p{Ll})/u, (_, lead, ch) => lead + ch.toLowerCase())).join('');
  }).join('');
}
