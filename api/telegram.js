import { processUpdate } from '../lib/telegram.mjs';
import { getRepository, mutate } from '../lib/repository.mjs';
import { drainOutbox, getIntegrations } from '../lib/integrations.mjs';
import { body, json, failure, equal } from '../lib/http.mjs';
import { RuleError } from '../lib/domain.mjs';
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw new RuleError('Use POST.', 405);
    if (!process.env.TELEGRAM_WEBHOOK_SECRET || !equal(req.headers['x-telegram-bot-api-secret-token'], process.env.TELEGRAM_WEBHOOK_SECRET)) throw new RuleError('Unauthorized webhook.', 403);
    const repo = getRepository(), awaitUpdate = await body(req);
    await mutate(repo, s => processUpdate(s, awaitUpdate));
    try { await drainOutbox(repo, getIntegrations(), { maxMessages: 2 }); } catch { /* cron / manager retry handles pending deliveries */ }
    json(res, 200, { ok: true });
  } catch (e) { failure(res, e); }
}
