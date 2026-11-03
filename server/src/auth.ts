import type { FastifyInstance, FastifyRequest } from 'fastify';
import { pool } from './db.js';
import { unauthorized } from './lib/errors.js';
import { hashToken } from './lib/passwords.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set when the request carries a valid dev token. */
    userId: number | null;
  }
}

/**
 * Bearer-token auth. Tokens come from /api/auth/signup, /login or /dev-login.
 * Only a SHA-256 of each token is stored. Tokens do not expire yet
 * (see docs/HANDOFF.md).
 */
export function registerAuth(app: FastifyInstance): void {
  app.decorateRequest('userId', null);
  app.addHook('onRequest', async (req) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return;
    const token = header.slice('Bearer '.length).trim();
    if (!token) return;
    const { rows } = await pool.query<{ user_id: number }>(
      'UPDATE auth_tokens SET last_used_at = now() WHERE token_hash = $1 RETURNING user_id',
      [hashToken(token)],
    );
    req.userId = rows[0]?.user_id ?? null;
  });
}

export function requireUser(req: FastifyRequest): number {
  if (req.userId == null) throw unauthorized();
  return req.userId;
}
