// Optional caption polish with Claude. Facts are protected: the rewrite is refused if it adds a number, drops the link or a
// hashtag, or uses a banned phrase, and the post's QA runs again afterwards.
import Anthropic from '@anthropic-ai/sdk';
import { readSecrets } from '../secrets.js';
import { rulesConfig, checkCopy } from '../text/rules.js';
import { UserError } from '../errors.js';

const MODEL = 'claude-opus-5-5';
const numbers = (s) => new Set((String(s).match(/\d[\d,.]*\d|\d/g) || []).map((n) => n.replace(/[.,]$/, '')));
const links = (s) => String(s).match(/\b[a-z0-9-]+\.(?:ie|uk|us|mt|cy|com)\S*/gi) || [];
const tags = (s) => String(s).match(/#\w+/g) || [];

function systemPrompt(market) {
  const never = rulesConfig().never.map((n) => n.phrase).join('; ');
  return [
    `You polish Facebook and Instagram captions for ${market.brand}, which sells Japanese used cars to buyers in ${market.country} from Japan.`,
    `Make the caption warmer and livelier, in ${market.spelling === 'us' ? 'American' : 'British'} English, keeping its structure, line breaks and emojis.`,
    'Keep every number, date, day name, price, link and hashtag exactly as written, and add no new facts or claims.',
    `Never use these words or phrases: ${never}.`,
    'Reply with the caption only.',
  ].join('\n');
}

export async function polishCaption(text, { market }, deps = {}) {
  const key = readSecrets().anthropic?.apiKey;
  if (!key && !deps.client) throw new UserError('Add an Anthropic API key in Settings to use caption polish.');
  const client = deps.client || new Anthropic({ apiKey: key });
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: systemPrompt(market),
    messages: [{ role: 'user', content: `Polish this caption:\n\n${text}` }],
  });
  if (response.stop_reason === 'refusal') throw new UserError('Claude declined to rewrite this caption; the original is kept.');
  const out = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  if (!out) throw new UserError('Claude returned an empty caption; the original is kept.');

  const before = numbers(text);
  const added = [...numbers(out)].filter((n) => !before.has(n));
  if (added.length) throw new UserError(`The rewrite added a number (${added.join(', ')}) that is not in the original; the original is kept.`);
  const lostLinks = links(text).filter((l) => !out.includes(l));
  if (lostLinks.length) throw new UserError(`The rewrite dropped the link ${lostLinks[0]}; the original is kept.`);
  const lostTags = tags(text).filter((t) => !out.includes(t));
  if (lostTags.length) throw new UserError(`The rewrite dropped ${lostTags.join(' ')}; the original is kept.`);
  const banned = checkCopy(out, market).filter((r) => r.severity === 'error');
  if (banned.length) throw new UserError(`The rewrite used "${banned[0].phrase}"; the original is kept.`);
  return out;
}
