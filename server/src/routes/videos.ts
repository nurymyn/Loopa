import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { pool, withTransaction, type Db } from '../db.js';
import { requireUser } from '../auth.js';
import { badRequest, notFound } from '../lib/errors.js';
import { baseUrl } from '../lib/urls.js';
import { queryVideos } from '../lib/videos.js';
import { notify, retractNotification } from '../lib/notify.js';

type IdParams = { Params: { id: string } };

export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) throw badRequest('Invalid id');
  return id;
}

async function videoAuthor(db: Db, videoId: number): Promise<number> {
  const { rows } = await db.query<{ author_id: number }>('SELECT author_id FROM videos WHERE id = $1', [videoId]);
  if (!rows[0]) throw notFound('Video not found');
  return rows[0].author_id;
}

async function counters(db: Db, videoId: number) {
  const { rows } = await db.query<{
    like_count: number;
    save_count: number;
    share_count: number;
    comment_count: number;
    view_count: number;
  }>('SELECT like_count, save_count, share_count, comment_count, view_count FROM videos WHERE id = $1', [videoId]);
  const r = rows[0];
  return {
    likeCount: r.like_count,
    saveCount: r.save_count,
    shareCount: r.share_count,
    commentCount: r.comment_count,
    viewCount: r.view_count,
  };
}

export const videoRoutes: FastifyPluginAsync = async (app) => {
  app.get<IdParams>('/videos/:id', async (req) => {
    const id = parseId(req.params.id);
    const [video] = await queryVideos(pool, req.userId, 'WHERE v.id = $2', [id], baseUrl(req));
    if (!video) throw notFound('Video not found');
    return video;
  });

  // Likes ------------------------------------------------------------------
  // PUT-like semantics: POST likes, DELETE unlikes; both are idempotent.

  app.post<IdParams>('/videos/:id/like', async (req) => {
    const userId = requireUser(req);
    const id = parseId(req.params.id);
    return withTransaction(async (db) => {
      const authorId = await videoAuthor(db, id);
      const ins = await db.query(
        'INSERT INTO likes (user_id, video_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, id],
      );
      if (ins.rowCount) await notify(db, { recipientId: authorId, actorId: userId, type: 'like', videoId: id });
      return { liked: true, ...(await counters(db, id)) };
    });
  });

  app.delete<IdParams>('/videos/:id/like', async (req) => {
    const userId = requireUser(req);
    const id = parseId(req.params.id);
    return withTransaction(async (db) => {
      const authorId = await videoAuthor(db, id);
      const del = await db.query('DELETE FROM likes WHERE user_id = $1 AND video_id = $2', [userId, id]);
      if (del.rowCount) await retractNotification(db, { recipientId: authorId, actorId: userId, type: 'like', videoId: id });
      return { liked: false, ...(await counters(db, id)) };
    });
  });

  // Saves ("Избранное") ---------------------------------------------------

  app.post<IdParams>('/videos/:id/save', async (req) => {
    const userId = requireUser(req);
    const id = parseId(req.params.id);
    await videoAuthor(pool, id);
    await pool.query('INSERT INTO saves (user_id, video_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, id]);
    return { saved: true, ...(await counters(pool, id)) };
  });

  app.delete<IdParams>('/videos/:id/save', async (req) => {
    const userId = requireUser(req);
    const id = parseId(req.params.id);
    await videoAuthor(pool, id);
    await pool.query('DELETE FROM saves WHERE user_id = $1 AND video_id = $2', [userId, id]);
    return { saved: false, ...(await counters(pool, id)) };
  });

  // Repost / share: records the share and returns a public link. -----------

  app.post<IdParams>('/videos/:id/share', async (req) => {
    const id = parseId(req.params.id);
    await videoAuthor(pool, id);
    await pool.query('INSERT INTO shares (user_id, video_id) VALUES ($1, $2)', [req.userId, id]);
    return { url: `${baseUrl(req)}/v/${id}`, ...(await counters(pool, id)) };
  });

  // Reposts: the video appears in the "Репосты" tab of the reposter's profile.

  app.post<IdParams>('/videos/:id/repost', async (req) => {
    const userId = requireUser(req);
    const id = parseId(req.params.id);
    return withTransaction(async (db) => {
      const authorId = await videoAuthor(db, id);
      if (authorId === userId) throw badRequest('You cannot repost your own video');
      const ins = await db.query('INSERT INTO reposts (user_id, video_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, id]);
      if (ins.rowCount) await notify(db, { recipientId: authorId, actorId: userId, type: 'repost', videoId: id });
      return { reposted: true, ...(await counters(db, id)) };
    });
  });

  app.delete<IdParams>('/videos/:id/repost', async (req) => {
    const userId = requireUser(req);
    const id = parseId(req.params.id);
    return withTransaction(async (db) => {
      const authorId = await videoAuthor(db, id);
      const del = await db.query('DELETE FROM reposts WHERE user_id = $1 AND video_id = $2', [userId, id]);
      if (del.rowCount) await retractNotification(db, { recipientId: authorId, actorId: userId, type: 'repost', videoId: id });
      return { reposted: false, ...(await counters(db, id)) };
    });
  });

  // Views: the app reports one row per playback session. --------------------

  app.post<IdParams & { Body: { watchedMs?: number; completed?: boolean } }>(
    '/videos/:id/view',
    async (req: FastifyRequest<IdParams & { Body: { watchedMs?: number; completed?: boolean } }>) => {
      const id = parseId(req.params.id);
      const watchedMs = Math.max(0, Math.min(Math.floor(Number(req.body?.watchedMs ?? 0)) || 0, 3_600_000));
      const completed = req.body?.completed === true;
      await videoAuthor(pool, id);
      await pool.query(
        'INSERT INTO views (user_id, video_id, watched_ms, completed) VALUES ($1, $2, $3, $4)',
        [req.userId, id, watchedMs, completed],
      );
      return { ok: true, ...(await counters(pool, id)) };
    },
  );
};
