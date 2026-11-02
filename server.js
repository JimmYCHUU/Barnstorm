// Barnstorm, Carbarn's social media agent: start with `npm start` (or start.cmd) and open http://localhost:5317
import { exec } from 'node:child_process';
import { createServer } from './lib/api.js';
import { closeBrowser } from './lib/render.js';
import './lib/routes.js';
import { ensureSeed } from './lib/history.js';
import { readConfig } from './lib/config.js';

ensureSeed();

const PORT = Number(process.env.PORT) || 5317;
const server = createServer();
server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`${readConfig('app.json').name} is running at ${url}  (close this window to stop it)`);
  if (process.argv.includes('--open')) exec(`start "" ${url}`);
});
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.log(`Port ${PORT} is busy: the engine is probably already running. Open http://localhost:${PORT}`);
  else console.error(e);
  process.exit(1);
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await closeBrowser(); process.exit(0); });
