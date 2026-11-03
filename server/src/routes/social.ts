import type { FastifyPluginAsync } from 'fastify';
import { pool } from '../db.js';
import { requireUser } from '../auth.js';
import { decodeCursor, encodeCursor, parseLimit, type TimeCursor } from '../lib/cursor.js';
import { PERSON_SELECT, toPerson, type PersonRow } from '../lib/people.js';
import { baseUrl, mediaUrl } from '../lib/urls.js';

export const socialRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Friends screen: who I follow, plus suggestions. Suggestions are people I
   * don't follow, ranked by "followed by people I follow", then by followers.
   */
  app.get('/friends', async (req) => {
    const userId = requireUser(req);
    const base = baseUrl(req);
    const following = await pool.query<PersonRow>(
      `${PERSON_SELECT}
       JOIN follows mine ON mine.followee_id = u.id AND mine.follower_id = $1
       ORDER BY mine.created_at DESC
       LIMIT 200`,
      [userId],
    );
    const suggested = await pool.query<PersonRow>(
      `${PERSON_SELECT}
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS mutuals FROM follows a
         JOIN follows b ON b.follower_id = a.followee_id AND b.followee_id = u.id
         WHERE a.follower_id = $1
       ) m ON true
       WHERE u.id <> $1
         AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followee_id = u.id)
       ORDER BY m.mutuals DESC, follower_count DESC, u.id
       LIMIT 20`,
      [userId],
    );
    return {
      following: following.rows.map((r) => toPerson(r, base)),
      suggested: suggested.rows.map((r) => toPerson(r, base)),
    };
  });

  app.get<{ Querystring: { cursor?: string; limit?: string } }>('/inbox', async (req) => {
    const userId = requireUser(req);
    const limit = parseLimit(req.query.limit, 20, 50);
    const c = decodeCursor<TimeCursor>(req.query.cursor);
    const { rows } = await pool.query<{
      id: number;
      type: string;
      created_at: Date;
      read_at: Date | null;
      actor_id: number;
      handle: string;
      display_name: string;
      avatar_color: string;
      avatar_path: string | null;
      i_follow_actor: boolean;
      video_id: number | null;
      thumbnail_path: string | null;
      comment_id: number | null;
      comment_body: string | null;
    }>(
      `SELECT n.id, n.type, n.created_at, n.read_at,
              a.id AS actor_id, a.handle, a.display_name, a.avatar_color, a.avatar_path,
              EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followee_id = a.id) AS i_follow_actor,
              n.video_id, v.thumbnail_path, n.comment_id, c.body AS comment_body
       FROM notifications n
       JOIN users a ON a.id = n.actor_id
       LEFT JOIN videos v ON v.id = n.video_id
       LEFT JOIN comments c ON c.id = n.comment_id
       WHERE n.recipient_id = $1
         AND ($2::timestamptz IS NULL OR (n.created_at, n.id) < ($2::timestamptz, $3::bigint))
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT $4`,
      [userId, c?.t ?? null, c?.id ?? 0, limit + 1],
    );
    const base = baseUrl(req);
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      unreadCount: await unreadCount(userId),
      items: page.map((r) => ({
        id: r.id,
        type: r.type,
        createdAt: r.created_at.toISOString(),
        read: r.read_at !== null,
        actor: {
          id: r.actor_id,
          handle: r.handle,
          displayName: r.display_name,
          avatarColor: r.avatar_color,
          avatarUrl: mediaUrl(base, r.avatar_path),
        },
        iFollowActor: r.i_follow_actor,
        videoId: r.video_id,
        videoThumbnailUrl: mediaUrl(base, r.thumbnail_path),
        commentId: r.comment_id,
        commentBody: r.comment_body,
      })),
      nextCursor: rows.length > limit && last ? encodeCursor({ t: last.created_at.toISOString(), id: last.id }) : null,
    };
  });

  /** Cheap poll for the tab-bar badge. */
  app.get('/inbox/unread', async (req) => ({ count: await unreadCount(requireUser(req)) }));

  app.post('/inbox/read', async (req) => {
    const userId = requireUser(req);
    const r = await pool.query('UPDATE notifications SET read_at = now() WHERE recipient_id = $1 AND read_at IS NULL', [userId]);
    return { marked: r.rowCount ?? 0 };
  });
};

async function unreadCount(userId: number): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM notifications WHERE recipient_id = $1 AND read_at IS NULL',
    [userId],
  );
  return rows[0].n;
}
