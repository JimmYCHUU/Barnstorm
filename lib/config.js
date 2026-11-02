// Location of the editable config files (config/*.json). Tests point CE_CONFIG at a copy.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT = fileURLToPath(new URL('../config', import.meta.url));

export const configPath = (name) => path.join(process.env.CE_CONFIG || DEFAULT, name);
export const readConfig = (name) => JSON.parse(fs.readFileSync(configPath(name), 'utf8'));
export const writeConfig = (name, value) => fs.writeFileSync(configPath(name), JSON.stringify(value, null, 2) + '\n');
