// Nothing private may leave this computer. Run before every push (the pre-push hook does):
// every file git would commit is checked for the data folder, secrets files and token-shaped text.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\n').filter((f) => f && fs.existsSync(f));

const PATHS = [
  ['the real posts, plans and log (data/)', /^data\//],
  ['a secrets file', /(^|\/)secrets\.json$/],
  ['an .env file', /(^|\/)\.env(\.|$)(?!.*example)/],
  ['design review screenshots', /^\.impeccable\/review\//],
];
const TEXT = [
  ['a Meta access token', /\bEAA[A-Za-z0-9]{30,}/],
  ['an Anthropic API key', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['a GitHub token', /\bgh[opsu]_[A-Za-z0-9]{30,}/],
  ['a private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['a path inside a Windows user folder', /\b[A-Z]:\\{1,2}Users\\{1,2}[A-Za-z0-9._-]+\\{1,2}/],
];
const BINARY = /\.(png|jpe?g|gif|ico|woff2?)$/i;

const problems = [];
for (const f of files) {
  for (const [what, re] of PATHS) if (re.test(f)) problems.push(`${f}: ${what}`);
  if (BINARY.test(f) || fs.statSync(f).size > 5e6) continue;
  const text = fs.readFileSync(f, 'utf8');
  for (const [what, re] of TEXT) if (re.test(text)) problems.push(`${f}: looks like ${what}`);
}

if (problems.length) {
  console.error(`Not safe to push. ${problems.length} problem${problems.length > 1 ? 's' : ''}:\n${problems.map((p) => `  ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`Safe: ${files.length} files checked, nothing private found.`);
