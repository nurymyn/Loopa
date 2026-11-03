import type { FastifyPluginAsync } from 'fastify';
import { pool, withTransaction } from '../db.js';
import { requireUser } from '../auth.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { offsetFrom, offsetPage, parseLimit } from '../lib/cursor.js';
import { baseUrl } from '../lib/urls.js';
import { queryVideos } from '../lib/videos.js';
import { notify, retractNotification } from '../lib/notify.js';
import { PERSON_SELECT, toPerson, type PersonRow } from '../lib/people.js';
import { USER_COLUMNS, toUserSummary, type UserRow } from '../lib/users.js';

type HandleParams = { Params: { handle: string }; Querystring: { limit?: string; cursor?: string } };

async function userByHandle(handle: string): Promise<UserRow> {
  const h = handle.toLowerCase().replace(/^@/, '');
  const { rows } = await pool.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users u WHERE u.handle = $1`, [h]);
  if (!rows[0]) throw notFound(`No user @${h}`);
  return rows[0];
}

/** Grid tabs on a profile. Each entry: JOIN/WHERE + ORDER BY for VIDEO_SELECT, $2 = profile owner id. */
const GRIDS = {
  videos: 'WHERE v.author_id = $2 ORDER BY v.created_at DESC, v.id DESC',
  liked: 'JOIN likes lk ON lk.video_id = v.id AND lk.user_id = $2 ORDER BY lk.created_at DESC, v.id DESC',
  saved: 'JOIN saves sv ON sv.video_id = v.id AND sv.user_id = $2 ORDER BY sv.created_at DESC, v.id DESC',
  reposts: 'JOIN reposts rp ON rp.video_id = v.id AND rp.user_id = $2 ORDER BY rp.created_at DESC, v.id DESC',
} as const;

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.get<HandleParams>('/users/:handle', async (req) => {
    const user = await userByHandle(req.params.handle);
    const { rows } = await pool.query<{
      following: number;
      followers: number;
      likes: number;
      videos: number;
      is_following: boolean;
      follows_you: boolean;
    }>(
      `SELECT
         (SELECT count(*) FROM follows WHERE follower_id = $1)::int AS following,
         (SELECT count(*) FROM follows WHERE followee_id = $1)::int AS followers,
         (SELECT COALESCE(sum(like_count), 0) FROM videos WHERE author_id = $1)::bigint AS likes,
         (SELECT count(*) FROM videos WHERE author_id = $1)::int AS videos,
         EXISTS (SELECT 1 FROM follows WHERE follower_id = $2 AND followee_id = $1) AS is_following,
         EXISTS (SELECT 1 FROM follows WHERE follower_id = $1 AND followee_id = $2) AS follows_you`,
      [user.id, req.userId],
    );
    const s = rows[0];
    return {
      ...toUserSummary(user, baseUrl(req)),
      bio: user.bio ?? '',
      followingCount: s.following,
      followerCount: s.followers,
      likeCount: s.likes,
      videoCount: s.videos,
      isMe: req.userId === user.id,
      isFollowing: s.is_following,
      followsYou: s.follows_you,
    };
  });

  for (const [tab, tail] of Object.entries(GRIDS)) {
    app.get<HandleParams>(`/users/:handle/${tab}`, async (req) => {
      const user = await userByHandle(req.params.handle);
      // "Избранное" is private: only the owner can list it. Likes and reposts are public.
      if (tab === 'saved' && requireUser(req) !== user.id) throw forbidden('Saved videos are private');
      const limit = parseLimit(req.query.limit, 18, 60);
      const offset = offsetFrom(req.query.cursor);
      const rows = await queryVideos(pool, req.userId, `${tail} LIMIT $3 OFFSET $4`, [user.id, limit + 1, offset], baseUrl(req));
      return offsetPage(rows, offset, limit);
    });
  }

  /** Followers / following lists, newest first. */
  for (const kind of ['followers', 'following'] as const) {
    app.get<HandleParams>(`/users/:handle/${kind}`, async (req) => {
      const user = await userByHandle(req.params.handle);
      const limit = parseLimit(req.query.limit, 30, 50);
      const offset = offsetFrom(req.query.cursor);
      const join =
        kind === 'followers'
          ? 'JOIN follows rel ON rel.follower_id = u.id AND rel.followee_id = $2'
          : 'JOIN follows rel ON rel.followee_id = u.id AND rel.follower_id = $2';
      const { rows } = await pool.query<PersonRow>(
        `${PERSON_SELECT} ${join} ORDER BY rel.created_at DESC, u.id LIMIT $3 OFFSET $4`,
        [req.userId, user.id, limit + 1, offset],
      );
      const page = offsetPage(rows, offset, limit);
      return { items: page.items.map((r) => toPerson(r, baseUrl(req))), nextCursor: page.nextCursor };
    });
  }

  app.post<HandleParams>('/users/:handle/follow', async (req) => {
    const userId = requireUser(req);
    const target = await userByHandle(req.params.handle);
    if (target.id === userId) throw badRequest('You cannot follow yourself');
    await withTransaction(async (db) => {
      const ins = await db.query(
        'INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, target.id],
      );
      if (ins.rowCount) await notify(db, { recipientId: target.id, actorId: userId, type: 'follow' });
    });
    return { following: true };
  });

  app.delete<HandleParams>('/users/:handle/follow', async (req) => {
    const userId = requireUser(req);
    const target = await userByHandle(req.params.handle);
    await withTransaction(async (db) => {
      const del = await db.query('DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2', [userId, target.id]);
      if (del.rowCount) await retractNotification(db, { recipientId: target.id, actorId: userId, type: 'follow' });
    });
    return { following: false };
  });
};
