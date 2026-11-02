import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-gem-'));
  process.env.CE_SECRETS = path.join(dir, 'secrets.json');
});
const { enhancePhoto, checkGeminiKey, PROMPT } = await import('../lib/providers/gemini.js');
const { writeSecrets } = await import('../lib/secrets.js');

// Just enough of a PNG for the size reader: signature, IHDR length and name, width, height.
const png = (w, h) => { const b = Buffer.alloc(24); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); b.write('IHDR', 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
const photo = () => { const f = path.join(dir, 'lot.jpg'); fs.writeFileSync(f, Buffer.from([0xff, 0xd8, 0xff, 0xe0])); return f; };
const answer = (status, body) => async () => ({ ok: status < 300, status, json: async () => body });
const picture = (w, h) => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png(w, h).toString('base64') } }] } }] });

test('gemini: needs a key before it sends anything', async () => {
  let called = false;
  await assert.rejects(enhancePhoto(photo(), { w: 640, h: 480 }, { fetchFn: async () => { called = true; } }), /Gemini API key/);
  assert.equal(called, false);
});

test('gemini: asks for a 2K picture of the same shape, keeps the car, its marks and its blurred plates, and caches the result', async () => {
  writeSecrets({ gemini: { apiKey: 'test-key' } });
  const calls = [];
  const fetchFn = async (url, init) => { calls.push({ url, init }); return answer(200, picture(2048, 1536))(); };
  const r = await enhancePhoto(photo(), { w: 640, h: 480 }, { fetchFn });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/models\/gemini-nano-banana-2\.1:generateContent$/);
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'test-key');
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body.generationConfig.imageConfig, { aspectRatio: '4:3', imageSize: '2K' });
  assert.equal(body.contents[0].parts[1].inlineData.mimeType, 'image/jpeg');
  assert.match(PROMPT, /watermark/); assert.match(PROMPT, /number plate/); assert.match(PROMPT, /scratch/);
  assert.deepEqual([r.w, r.h], [2048, 1536]);
  assert.ok(fs.existsSync(r.file) && r.file !== path.join(dir, 'lot.jpg'));
  const again = await enhancePhoto(path.join(dir, 'lot.jpg'), { w: 640, h: 480 }, { fetchFn });
  assert.equal(calls.length, 1, 'the second sharpen of the same photo is free');
  assert.equal(again.file, r.file);
});

test('gemini: refuses a picture that is no larger, or a different shape, and keeps the original', async () => {
  writeSecrets({ gemini: { apiKey: 'k' } });
  await assert.rejects(enhancePhoto(photo(), { w: 640, h: 480 }, { fetchFn: answer(200, picture(640, 480)) }), /no sharper/);
  await assert.rejects(enhancePhoto(photo(), { w: 640, h: 480 }, { fetchFn: answer(200, picture(2048, 2048)) }), /shape/);
});

test('gemini: explains a bad key, a blocked picture and a quota in plain words', async () => {
  writeSecrets({ gemini: { apiKey: 'k' } });
  await assert.rejects(enhancePhoto(photo(), { w: 640, h: 480 }, { fetchFn: answer(400, { error: { status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } }) }), /not valid/);
  await assert.rejects(enhancePhoto(photo(), { w: 640, h: 480 }, { fetchFn: answer(200, { promptFeedback: { blockReason: 'OTHER' } }) }), /no picture \(OTHER\)/);
  await assert.rejects(enhancePhoto(photo(), { w: 640, h: 480 }, { fetchFn: answer(429, { error: { status: 'RESOURCE_EXHAUSTED' } }), sleep: async () => {} }), /rate limit/);
  await assert.rejects(checkGeminiKey('bad', { fetchFn: answer(403, { error: { status: 'PERMISSION_DENIED' } }) }), /not valid/);
  await checkGeminiKey('good', { fetchFn: answer(200, { name: 'models/gemini-nano-banana-2.1' }) });
});

// What Google sends when the key's project has no billing: image models have no free use, so the limit is 0.
const noBilling = { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'You exceeded your current quota, please check your plan and billing details. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-nano-banana-2.1',
  details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests', quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }] },
    { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '37s' }] } };

test('gemini: a key with no billing says so in plain words, and is not tried again', async () => {
  writeSecrets({ gemini: { apiKey: 'k' } });
  let calls = 0;
  const fetchFn = async () => { calls++; return answer(429, noBilling)(); };
  await assert.rejects(enhancePhoto(photo(), { w: 640, h: 480 }, { fetchFn, sleep: async () => {} }), /billing/);
  assert.equal(calls, 1);
});

test('gemini: a real rate limit waits as long as Google asks, then tries again', async () => {
  writeSecrets({ gemini: { apiKey: 'k' } });
  const waits = [];
  let calls = 0;
  const busy = { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Resource has been exhausted (e.g. check quota).', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '2s' }] } };
  const fetchFn = async () => (++calls === 1 ? answer(429, busy)() : answer(200, picture(2048, 1536))());
  const r = await enhancePhoto(photo(), { w: 640, h: 480 }, { fetchFn, sleep: async (ms) => { waits.push(ms); } });
  assert.equal(r.w, 2048);
  assert.deepEqual(waits, [2000]);
});

