// API keys and Page tokens live in %APPDATA%\CarbarnContentEngine\secrets.json, never in the project folder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectRoot } from './store.js';
import { MARKET_KEYS } from './markets.js';

export function secretsPath() {
  return process.env.CE_SECRETS || path.join(process.env.APPDATA || os.homedir(), 'CarbarnContentEngine', 'secrets.json');
}

function assertOutside(file) {
  const root = path.resolve(projectRoot()).toLowerCase() + path.sep;
  if (path.resolve(file).toLowerCase().startsWith(root)) throw new Error('Secrets must be stored outside the project folder.');
}

export function readSecrets() {
  try { return JSON.parse(fs.readFileSync(secretsPath(), 'utf8')); } catch { return {}; }
}

export function writeSecrets(value) {
  const file = secretsPath();
  assertOutside(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

export function updateSecrets(fn) { const s = readSecrets(); fn(s); writeSecrets(s); return s; }

// What is connected, never the values themselves.
export function connectionStatus() {
  const s = readSecrets(), pages = s.meta?.pages || {};
  const meta = Object.fromEntries(MARKET_KEYS.map((k) => [k, {
    facebook: !!(pages[k]?.pageId && pages[k]?.pageToken), instagram: !!(pages[k]?.igUserId && pages[k]?.pageToken),
  }]));
  return { meta, graphVersion: s.meta?.graphVersion || 'v23.0', anthropic: !!s.anthropic?.apiKey, gemini: !!s.gemini?.apiKey, path: secretsPath() };
}
