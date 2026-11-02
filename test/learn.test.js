import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const cfgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-cfg-'));
for (const f of fs.readdirSync(new URL('../config/', import.meta.url))) fs.copyFileSync(new URL(`../config/${f}`, import.meta.url), path.join(cfgDir, f));
process.env.CE_CONFIG = cfgDir;
beforeEach(() => { process.env.CE_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-learn-')); });

const { suggestRules, applySuggestion, dismissSuggestion, learnState } = await import('../lib/learn.js');
const { rulesConfig } = await import('../lib/text/rules.js');
const { hookConfig } = await import('../lib/text/hooks.js');
const { loadMarkets } = await import('../lib/markets.js');

const hookEdit = (id, from, to, src = 'model-library') => ({ id, type: 'edited', market: 'uk', card: 0, changes: { slots: { hook: to } }, before: { slots: { hook: from } },
  car: { make: 'HONDA', model: 'N BOX', modelCode: 'JF5' }, hookSource: src, hookKey: null });
const capEdit = (id, before, after) => ({ id, type: 'edited', market: 'ie', changes: { caption: { a: after } }, beforeCaption: { a: before } });

test('learn: two edits away from the same library hook suggest replacing it', () => {
  const s = suggestRules([hookEdit('e1', 'Big box, small car', 'Tiny outside, huge in'), hookEdit('e2', 'Big box, small car', 'Tiny outside, huge in')]);
  const h = s.find((x) => x.kind === 'hook-library');
  assert.ok(h, JSON.stringify(s));
  assert.equal(h.proposal.from, 'Big box, small car');
  assert.equal(h.proposal.to, 'Tiny outside, huge in');
  assert.deepEqual(h.evidence, ['e1', 'e2']);
});

test('learn: one edit is not enough', () => {
  assert.equal(suggestRules([hookEdit('e1', 'Big box, small car', 'Other')]).length, 0);
});

test('learn: phrase deleted in 3 caption edits suggests a never-phrase', () => {
  const ev = [1, 2, 3].map((n) => capEdit(`c${n}`, `Car ${n} is a real head turner in the yard`, `Car ${n} in the yard`));
  const s = suggestRules(ev);
  assert.ok(s.some((x) => x.kind === 'never-phrase' && x.proposal.phrase === 'a real head turner'), JSON.stringify(s.map((x) => x.proposal)));
});

test('learn: two rejections of one category suggest moving it down', () => {
  const rej = (id) => ({ id, type: 'rejected', market: 'mt', topic: 'live-lots', params: { category: 'suv' }, reason: 'too many SUVs' });
  const s = suggestRules([rej('r1'), rej('r2')]);
  assert.ok(s.some((x) => x.kind === 'category-weight' && x.proposal.category === 'suv'));
});

test('learn: applying suggestions updates the config, dismissing hides them', () => {
  const ev = [hookEdit('e1', 'Big box, small car', 'Tiny outside, huge in'), hookEdit('e2', 'Big box, small car', 'Tiny outside, huge in'),
    ...[1, 2, 3].map((n) => capEdit(`c${n}`, `Car ${n} is a real head turner here`, `Car ${n} here`)),
    { id: 'r1', type: 'rejected', market: 'mt', params: { category: 'suv' } }, { id: 'r2', type: 'rejected', market: 'mt', params: { category: 'suv' } }];
  for (const s of suggestRules(ev)) {
    if (s.kind === 'never-phrase') { dismissSuggestion(s.id); continue; }
    applySuggestion(s, ev);
  }
  assert.ok(hookConfig().models.some((m) => m.model === 'N BOX' && m.hook === 'Tiny outside, huge in'));
  assert.equal(loadMarkets().markets.mt.categories.at(-1).slug, 'suv');
  assert.ok(!rulesConfig().never.some((n) => n.phrase === 'a real head turner'));
  assert.equal(suggestRules(ev, learnState()).length, 0);
});
