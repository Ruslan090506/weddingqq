import { applyCommand, requireRole, viewState } from '../lib/domain.mjs';
import { getRepository, mutate } from '../lib/repository.mjs';
import { drainOutbox, getIntegrations } from '../lib/integrations.mjs';
import { body, protectPost, readSession, makeSession, publicConfig, json, failure, equal } from '../lib/http.mjs';
import { RuleError } from '../lib/domain.mjs';
export default async function handler(req, res) {
  try {
    const action = new URL(req.url, 'http://localhost').searchParams.get('action') ?? 'state';
    if (action === 'config' && req.method === 'GET') return json(res, 200, publicConfig());
    if (action === 'session') {
      protectPost(req); const p = await body(req);
      if (process.env.DEMO_ACCESS_CODE && !equal(p.code, process.env.DEMO_ACCESS_CODE)) throw new RuleError('The classroom access code is incorrect.', 403);
      const token = makeSession(p.actor);
      res.setHeader('Set-Cookie', `fi_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${process.env.VERCEL || process.env.APP_URL?.startsWith('https:') ? '; Secure' : ''}`);
      return json(res, 200, { ok: true });
    }
    const actor = readSession(req), repo = getRepository();
    if (action === 'state' && req.method === 'GET') return json(res, 200, viewState((await repo.load()).state, actor));
    protectPost(req); const p = await body(req);
    if (action === 'retry') {
      requireRole(actor, 'manager');
    } else if (['submit', 'approve', 'link'].includes(action)) {
      // Actor and origin are server-derived. Client-provided impersonation fields are ignored.
      await mutate(repo, s => applyCommand(s, actor, { ...p, action }));
    } else throw new RuleError('Unknown action.', 404);
    // Side effects are durable before dispatch. A delivery failure never reverses finance.
    try { await drainOutbox(repo, getIntegrations(), { maxMessages: 2 }); } catch { /* persisted jobs remain retryable */ }
    return json(res, 200, viewState((await repo.load()).state, actor));
  } catch (e) { failure(res, e); }
}
