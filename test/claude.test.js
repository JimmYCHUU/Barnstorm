import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

beforeEach(() => { process.env.CE_SECRETS = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ce-sec-')), 'secrets.json'); });
const { polishCaption } = await import('../lib/providers/claude.js');
const { market } = await import('../lib/markets.js');

const original = '3,236 kei cars go under the hammer in Japan on Tuesday 🇯🇵\n\n👉 carbarn.uk/live-auction/kei-cars\n\n#CarbarnUK #KeiCar';
const stub = (text, extra = {}) => {
  const calls = [];
  return { calls, beta: { messages: { create: async (req) => { calls.push(req); return { stop_reason: 'end_turn', content: [{ type: 'text', text }], ...extra }; } } } };
};

test('claude: disabled without an API key', async () => {
  await assert.rejects(polishCaption(original, { market: market('uk') }), /API key/);
});

test('claude: a rewrite that adds a number is rejected', async () => {
  await assert.rejects(polishCaption(original, { market: market('uk') }, { client: stub('4,000 kei cars on Tuesday!') }), /number/);
});

test('claude: a rewrite that drops the link is rejected', async () => {
  await assert.rejects(polishCaption(original, { market: market('uk') }, { client: stub('3,236 kei cars go under the hammer on Tuesday 🇯🇵 #CarbarnUK #KeiCar') }), /link/);
});

test('claude: a rewrite with a banned phrase is rejected', async () => {
  const bad = '3,236 of the best kei cars on Tuesday 🇯🇵\n\n👉 carbarn.uk/live-auction/kei-cars\n\n#CarbarnUK #KeiCar';
  await assert.rejects(polishCaption(original, { market: market('uk') }, { client: stub(bad) }), /best/);
});

test('claude: a clean rewrite comes back, using the current Opus with fallbacks on', async () => {
  const good = '3,236 kei cars hit the auction floor in Japan on Tuesday 🇯🇵\n\n👉 carbarn.uk/live-auction/kei-cars\n\n#CarbarnUK #KeiCar';
  const c = stub(good);
  assert.equal(await polishCaption(original, { market: market('uk') }, { client: c }), good);
  assert.equal(c.calls[0].model, 'claude-opus-5-5');
  assert.equal(c.calls[0].fallbacks, 'default');
  assert.deepEqual(c.calls[0].betas, ['server-side-fallback-2026-07-01']);
});

test('claude: a refusal keeps the original', async () => {
  await assert.rejects(polishCaption(original, { market: market('uk') }, { client: stub('', { stop_reason: 'refusal' }) }), /declined/);
});
