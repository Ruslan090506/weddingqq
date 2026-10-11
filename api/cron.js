import { getRepository } from '../lib/repository.mjs';
import { drainOutbox, getIntegrations } from '../lib/integrations.mjs';
import { json, failure, equal } from '../lib/http.mjs';
import { RuleError } from '../lib/domain.mjs';
export default async function handler(req, res) {
  try {
    if (!process.env.CRON_SECRET || !equal(req.headers.authorization, `Bearer ${process.env.CRON_SECRET}`)) throw new RuleError('Unauthorized.', 403);
    await drainOutbox(getRepository(), getIntegrations(), { maxMessages: 2 });
    json(res, 200, { ok: true });
  } catch (e) { failure(res, e); }
}
