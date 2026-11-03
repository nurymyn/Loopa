import type { FastifyPluginAsync } from 'fastify';
import { pool } from '../db.js';
import { requireUser } from '../auth.js';
import { decodeCursor, encodeCursor, parseLimit, type TimeCursor } from '../lib/cursor.js';
import { baseUrl } from '../lib/urls.js';
import { queryVideos, videosByIds } from '../lib/videos.js';
import { getInterests, rankForYou, type ForYouCursor } from '../lib/recommend.js';

interface FeedQuery {
  cursor?: string;
  limit?: string;
}

export const feedRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: FeedQuery }>('/feed/for-you', async (req) => {
    const limit = parseLimit(req.query.limit, 5, 20);
    const cursor = decodeCursor<ForYouCursor>(req.query.cursor);
    const { picks, next } = await rankForYou(pool, req.userId, cursor, limit);
    const videos = await videosByIds(pool, req.userId, picks.map((p) => p.id), baseUrl(req));
    const why = new Map(picks.map((p) => [p.id, p]));
    return {
      items: videos.map((v) => ({ ...v, recommendation: { reason: why.get(v.id)!.reason, score: why.get(v.id)!.score } })),
      nextCursor: next ? encodeCursor(next) : null,
    };
  });

  /** Videos from people the viewer follows, newest first, keyset-paginated. */
  app.get<{ Querystring: FeedQuery }>('/feed/following', async (req) => {
    const userId = requireUser(req);
    const limit = parseLimit(req.query.limit, 5, 20);
    const c = decodeCursor<TimeCursor>(req.query.cursor);
    const items = await queryVideos(
      pool,
      userId,
      `WHERE v.author_id IN (SELECT followee_id FROM follows WHERE follower_id = $1)
         AND ($2::timestamptz IS NULL OR (v.created_at, v.id) < ($2::timestamptz, $3::bigint))
       ORDER BY v.created_at DESC, v.id DESC
       LIMIT $4`,
      [c?.t ?? null, c?.id ?? 0, limit + 1],
      baseUrl(req),
    );
    const page = items.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page,
      nextCursor: items.length > limit && last ? encodeCursor({ t: last.createdAt, id: last.id }) : null,
    };
  });

  /** What the "Для вас" algorithm thinks the viewer likes (hidden screen). */
  app.get('/me/interests', async (req) => {
    const userId = requireUser(req);
    return getInterests(pool, userId);
  });
};
