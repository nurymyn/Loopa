import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { pool, type Db } from '../db.js';
import { config } from '../config.js';
import { requireUser } from '../auth.js';
import { badRequest, forbidden, HttpError, notFound, unauthorized } from '../lib/errors.js';
import { hashPassword, hashToken, newToken, verifyPassword } from '../lib/passwords.js';
import { baseUrl } from '../lib/urls.js';
import { HANDLE_RE, USER_COLUMNS, toUserSummary, type UserRow } from '../lib/users.js';

const PALETTE = ['#FF8A5B', '#C77DFF', '#4CC9F0', '#FFD166', '#06D6A0', '#EF476F', '#F8961E', '#90BE6D', '#B8F227'];
const AVATAR_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

async function issueToken(db: Db, userId: number): Promise<string> {
  const token = newToken();
  await db.query('INSERT INTO auth_tokens (token_hash, user_id) VALUES ($1, $2)', [hashToken(token), userId]);
  return token;
}

function meDto(row: UserRow, req: FastifyRequest) {
  return { ...toUserSummary(row, baseUrl(req)), bio: row.bio ?? '' };
}

function normaliseHandle(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase().replace(/^@/, '');
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { handle?: string; password?: string; displayName?: string } }>('/auth/signup', async (req, reply) => {
    const handle = normaliseHandle(req.body?.handle);
    const password = String(req.body?.password ?? '');
    const displayName = String(req.body?.displayName ?? '').trim() || handle;
    if (!HANDLE_RE.test(handle)) throw badRequest('Ник: 2-30 символов, латиница, цифры, точка или _');
    if (password.length < 6) throw badRequest('Пароль должен быть не короче 6 символов');
    if (password.length > 200) throw badRequest('Пароль слишком длинный');
    if (displayName.length > 60) throw badRequest('Имя должно быть не длиннее 60 символов');
    const exists = await pool.query('SELECT 1 FROM users WHERE handle = $1', [handle]);
    if (exists.rowCount) throw new HttpError(409, 'Этот ник уже занят');
    const color = PALETTE[crypto.randomInt(PALETTE.length)];
    const { rows } = await pool.query<UserRow>(
      `INSERT INTO users (handle, display_name, avatar_color, password_hash)
       VALUES ($1, $2, $3, $4) RETURNING ${USER_COLUMNS.replaceAll('u.', '')}`,
      [handle, displayName, color, await hashPassword(password)],
    );
    const token = await issueToken(pool, rows[0].id);
    return reply.status(201).send({ token, user: meDto(rows[0], req) });
  });

  app.post<{ Body: { handle?: string; password?: string } }>('/auth/login', async (req) => {
    const handle = normaliseHandle(req.body?.handle);
    const password = String(req.body?.password ?? '');
    const { rows } = await pool.query<UserRow & { password_hash: string | null }>(
      `SELECT ${USER_COLUMNS}, u.password_hash FROM users u WHERE u.handle = $1`,
      [handle],
    );
    const user = rows[0];
    // Same message for "no such user" and "wrong password".
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      throw new HttpError(401, 'Неверный ник или пароль');
    }
    return { token: await issueToken(pool, user.id), user: meDto(user, req) };
  });

  app.post('/auth/logout', async (req) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw unauthorized();
    await pool.query('DELETE FROM auth_tokens WHERE token_hash = $1', [hashToken(header.slice(7).trim())]);
    return { ok: true };
  });

  /**
   * Dev login: give a handle, get a token. No password. Powers the
   * «Войти как демо» button and the account switcher. Disabled when DEV_AUTH=false.
   */
  app.post<{ Body: { handle?: string } }>('/auth/dev-login', async (req) => {
    if (!config.devAuth) throw forbidden('Dev login is disabled');
    const handle = normaliseHandle(req.body?.handle);
    if (!handle) throw badRequest('handle is required');
    const { rows } = await pool.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users u WHERE u.handle = $1`, [handle]);
    const user = rows[0];
    if (!user) throw notFound(`No user @${handle}`);
    return { token: await issueToken(pool, user.id), user: meDto(user, req) };
  });

  /** Seeded accounts, for the dev account switcher in the app. */
  app.get('/auth/dev-accounts', async (req) => {
    if (!config.devAuth) throw forbidden('Dev login is disabled');
    const { rows } = await pool.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users u ORDER BY u.id LIMIT 50`);
    return { items: rows.map((r) => toUserSummary(r, baseUrl(req))) };
  });

  app.get('/me', async (req) => {
    const userId = requireUser(req);
    const { rows } = await pool.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = $1`, [userId]);
    if (!rows[0]) throw notFound();
    return meDto(rows[0], req);
  });

  app.patch<{ Body: { displayName?: string; bio?: string } }>('/me', async (req) => {
    const userId = requireUser(req);
    const displayName = req.body?.displayName?.trim();
    const bio = req.body?.bio?.trim();
    if (displayName !== undefined && (displayName.length < 1 || displayName.length > 60)) {
      throw badRequest('Имя: от 1 до 60 символов');
    }
    if (bio !== undefined && bio.length > 160) throw badRequest('О себе: не больше 160 символов');
    const { rows } = await pool.query<UserRow>(
      `UPDATE users u SET display_name = COALESCE($2, display_name), bio = COALESCE($3, bio)
       WHERE u.id = $1 RETURNING ${USER_COLUMNS}`,
      [userId, displayName ?? null, bio ?? null],
    );
    return meDto(rows[0], req);
  });

  /** Avatar upload: multipart field "avatar", jpg/png/webp, up to 5 MB. */
  app.post('/me/avatar', async (req) => {
    const userId = requireUser(req);
    if (!req.isMultipart()) throw badRequest('Expected multipart/form-data');
    const file = await req.file({ limits: { fileSize: MAX_AVATAR_BYTES } });
    if (!file || file.fieldname !== 'avatar') throw badRequest('Field "avatar" with an image is required');
    const ext = path.extname(file.filename || '').toLowerCase() || '.jpg';
    if (!file.mimetype.startsWith('image/') || !AVATAR_EXT.has(ext)) {
      file.file.resume();
      throw badRequest('Нужна картинка .jpg, .png или .webp');
    }
    const dir = path.join(config.uploadDir, 'avatars');
    fs.mkdirSync(dir, { recursive: true });
    const name = `${crypto.randomUUID()}${ext}`;
    const abs = path.join(dir, name);
    await pipeline(file.file, fs.createWriteStream(abs));
    if (file.file.truncated) {
      fs.rmSync(abs, { force: true });
      throw new HttpError(413, 'Картинка больше 5 МБ');
    }
    const prev = await pool.query<{ avatar_path: string | null }>('SELECT avatar_path FROM users WHERE id = $1', [userId]);
    const { rows } = await pool.query<UserRow>(
      `UPDATE users u SET avatar_path = $2 WHERE u.id = $1 RETURNING ${USER_COLUMNS}`,
      [userId, `uploads/avatars/${name}`],
    );
    const old = prev.rows[0]?.avatar_path;
    if (old?.startsWith('uploads/avatars/')) {
      fs.rmSync(path.join(config.uploadDir, old.slice('uploads/'.length)), { force: true });
    }
    return meDto(rows[0], req);
  });
};
