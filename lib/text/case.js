// Every word on the pictures starts with a capital (Jim, 2 Nov 2026): "Room for seven" → "Room For Seven".
// Only first letters change, so JDM, 4WD and GR stay as they are; a word that starts with a number (4x4, 2.5, 660cc)
// is left alone; each part of a hyphenated word is capitalised (Pocket-Sized, 6-Speed); units stay small (km, cc).
const UNITS = new Set(['km', 'cc', 'kg', 'mph']);

const part = (p) => p.replace(/^([^\p{L}\p{N}]*)(\p{Ll})/u, (_, lead, ch) => lead + ch.toUpperCase());

export function capitalWords(text) {
  return String(text ?? '').split(/(\s+)/).map((w) => (/^\s*$/.test(w) || UNITS.has(w.toLowerCase()) ? w : w.split(/([-–])/).map(part).join(''))).join('');
}
