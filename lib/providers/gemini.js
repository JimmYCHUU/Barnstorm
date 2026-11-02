// Optional: sharpen a low-resolution listing photo with Gemini image editing. The car must come back exactly as it is:
// nothing added, removed or repaired, every mark, text and logo kept (watermarks included), blurred plates still blurred.
// A result is saved beside the original photo, so the same photo is never paid for twice.
import fs from 'node:fs';
import { readSecrets } from '../secrets.js';
import { readConfig } from '../config.js';
import { imageSize } from '../photos.js';
import { UserError } from '../errors.js';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const RATIOS = ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

export const PROMPT = [
  'Make this photo sharper and higher resolution. It shows a real car that is for sale, so the car must stay exactly as it is.',
  'Do not add, remove, repair, clean or restyle anything: keep every scratch, dent, mark, reflection and speck of dirt,',
  'the wheels, tyres, badges, trim, paint colour and the background.',
  'Keep the same framing and angle. Keep all text and logos in the picture exactly as they are, including any watermark.',
  'Keep every blurred area blurred, and never draw or sharpen a number plate.',
  'Only remove blur and JPEG noise.',
].join(' ');

const DEFAULTS = { sharpen: 'auto', belowWidth: 1000, model: 'gemini-nano-banana-2.1', imageSize: '2K' };
export function photoSettings() {
  try { return { ...DEFAULTS, ...readConfig('photos.json') }; } catch { return { ...DEFAULTS }; }
}
export const hasGeminiKey = () => !!readSecrets().gemini?.apiKey;
export const autoSharpen = () => hasGeminiKey() && photoSettings().sharpen === 'auto';

// Gemini takes a fixed list of shapes; ask for the one closest to the photo's.
const ratio = (r) => { const [a, b] = r.split(':').map(Number); return a / b; };
const nearestRatio = (w, h) => RATIOS.reduce((best, r) => (Math.abs(Math.log(w / h / ratio(r))) < Math.abs(Math.log(w / h / ratio(best))) ? r : best));

// A refusal for quota: either the key's Google project has no billing (image models have no free use, so its limit is 0
// and waiting never helps), or a real per-minute limit, with Google's own "try again in N s".
function quota(body) {
  const said = JSON.stringify(body?.error?.details || []) + (body?.error?.message || '');
  const delay = body?.error?.details?.find((d) => d.retryDelay)?.retryDelay;
  return { noBilling: /free.?tier|limit: 0\b/i.test(said), wait: delay ? parseFloat(delay) : null };
}

function explain(status, body) {
  const reason = body?.error?.details?.find((d) => d.reason)?.reason || body?.error?.status || '';
  if (reason === 'API_KEY_INVALID' || status === 401 || status === 403) return 'Google says the Gemini key is not valid, or it may not use this model. Check the key in Settings.';
  if (status === 404) return `Google does not know the model "${photoSettings().model}". Change "model" in config/photos.json.`;
  if (status === 429 && quota(body).noBilling) {
    return "The Google project this key belongs to has no billing turned on, and Gemini's image models have no free use, so Google refuses every photo. "
      + "Turn on billing for that project (aistudio.google.com, API keys, the key's project, Set up billing), then press Sharpen with Gemini again.";
  }
  if (status === 429) return `Gemini is over its rate limit right now${quota(body).wait ? ` (Google says wait ${Math.ceil(quota(body).wait)} seconds)` : ''}. Press Sharpen with Gemini again in a minute.`;
  return `Gemini answered HTTP ${status}${body?.error?.message ? `: ${body.error.message}` : ''}.`;
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

export async function enhancePhoto(file, { w, h }, deps = {}) {
  const key = readSecrets().gemini?.apiKey;
  if (!key) throw new UserError('Add a Gemini API key in Settings → Connections to sharpen photos.');
  const cfg = photoSettings(), fetchFn = deps.fetchFn || fetch;
  const base = `${file.replace(/\.(jpe?g|png)$/i, '')}.${cfg.model.replace(/[^a-z0-9.-]/gi, '')}-${cfg.imageSize}`;
  for (const ext of ['.png', '.jpg']) {
    const size = fs.existsSync(base + ext) && imageSize(fs.readFileSync(base + ext));
    if (size) return { file: base + ext, ...size, model: cfg.model };
  }
  const src = fs.readFileSync(file), sleep = deps.sleep || pause;
  const ask = () => fetchFn(`${API}/models/${encodeURIComponent(cfg.model)}:generateContent`, {
    method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' }, signal: AbortSignal.timeout(180000),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: PROMPT }, { inlineData: { mimeType: src[0] === 0x89 ? 'image/png' : 'image/jpeg', data: src.toString('base64') } }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: nearestRatio(w, h), imageSize: cfg.imageSize } },
    }),
  });
  let res, body;
  // A real per-minute limit is waited out (up to twice, at most a minute each); a project without billing is not.
  for (let tries = 0; ; tries++) {
    res = await ask();
    body = await res.json().catch(() => null);
    const q = res.status === 429 ? quota(body) : null;
    if (!q || q.noBilling || tries === 2) break;
    await sleep(Math.min(q.wait ?? 10, 60) * 1000);
  }
  if (!res.ok) throw new UserError(explain(res.status, body));
  const cand = body?.candidates?.[0];
  const img = cand?.content?.parts?.map((p) => p.inlineData || p.inline_data).find((d) => d?.data);
  if (!img) {
    const why = body?.promptFeedback?.blockReason || cand?.finishReason;
    throw new UserError(`Gemini sent back no picture${why ? ` (${why})` : ''}. The original photo is kept.`);
  }
  const buf = Buffer.from(img.data, 'base64'), size = imageSize(buf);
  if (!size) throw new UserError('Gemini sent back something that is not a picture. The original photo is kept.');
  if (size.w <= w) throw new UserError(`Gemini's picture (${size.w}px wide) is no sharper than the original (${w}px). The original photo is kept.`);
  if (Math.abs(Math.log(size.w / size.h / (w / h))) > 0.05) throw new UserError('Gemini changed the shape of the photo, so it may have changed the framing. The original photo is kept.');
  const out = base + (buf[0] === 0x89 ? '.png' : '.jpg');
  fs.writeFileSync(out, buf);
  return { file: out, ...size, model: cfg.model };
}

// A free call that proves the key works and the model exists, before the key is saved.
export async function checkGeminiKey(key, deps = {}) {
  const res = await (deps.fetchFn || fetch)(`${API}/models/${encodeURIComponent(photoSettings().model)}`, { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new UserError(explain(res.status, await res.json().catch(() => null)));
}
