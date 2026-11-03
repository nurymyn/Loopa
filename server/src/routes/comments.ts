import type { FastifyPluginAsync } from 'fastify';
import { pool, withTransaction, type Db } from '../db.js';
import { requireUser } from '../auth.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { decodeCursor, encodeCursor, parseLimit, type TimeCursor } from '../lib/cursor.js';
import { notify } from '../lib/notify.js';
import { parseId } from './videos.js';
import { baseUrl, mediaUrl } from '../lib/urls.js';
import type { UserSummary } from '../lib/users.js';

interface CommentRow {
  id: number;
  video_id: number;
  parent_id: number | null;
  body: string;
  like_count: number;
  reply_count: number;
  created_at: Date;
  author_id: number;
  handle: string;
  display_name: string;
  avatar_color: string;
  avatar_path: string | null;
  liked: boolean;
}

export interface CommentDto {
  id: number;
  videoId: number;
  parentId: number | null;
  body: string;
  likeCount: number;
  replyCount: number;
  createdAt: string;
  likedByMe: boolean;
  author: UserSummary;
}

const COMMENT_SELECT = `
  SELECT c.id, c.video_id, c.parent_id, c.body, c.like_count, c.reply_count, c.created_at,
         u.id AS author_id, u.handle, u.display_name, u.avatar_color, u.avatar_path,
         EXISTS (SELECT 1 FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = $1) AS liked
  FROM comments c JOIN users u ON u.id = c.author_id
`;

function toDto(r: CommentRow, base: string): CommentDto {
  return {
    id: r.id,
    videoId: r.video_id,
    parentId: r.parent_id,
    body: r.body,
    likeCount: r.like_count,
    replyCount: r.reply_count,
    createdAt: r.created_at.toISOString(),
    likedByMe: r.liked,
    author: {
      id: r.author_id,
      handle: r.handle,
      displayName: r.display_name,
      avatarColor: r.avatar_color,
      avatarUrl: mediaUrl(base, r.avatar_path),
    },
  };
}

async function commentById(db: Db, viewerId: number | null, id: number, base: string): Promise<CommentDto> {
  const { rows } = await db.query<CommentRow>(`${COMMENT_SELECT} WHERE c.id = $2`, [viewerId, id]);
  if (!rows[0]) throw notFound('Comment not found');
  return toDto(rows[0], base);
}

export const commentRoutes: FastifyPluginAsync = async (app) => {
  /** Top-level comments, newest first. */
  app.get<{ Params: { id: string }; Querystring: { cursor?: string; limit?: string } }>(
    '/videos/:id/comments',
    async (req) => {
      const videoId = parseId(req.params.id);
      const limit = parseLimit(req.query.limit, 20, 50);
      const c = decodeCursor<TimeCursor>(req.query.cursor);
      const { rows } = await pool.query<CommentRow>(
        `${COMMENT_SELECT}
         WHERE c.video_id = $2 AND c.parent_id IS NULL
           AND ($3::timestamptz IS NULL OR (c.created_at, c.id) < ($3::timestamptz, $4::bigint))
         ORDER BY c.created_at DESC, c.id DESC
         LIMIT $5`,
        [req.userId, videoId, c?.t ?? null, c?.id ?? 0, limit + 1],
      );
      const page = rows.slice(0, limit).map((r) => toDto(r, baseUrl(req)));
      const last = page[page.length - 1];
      const total = await pool.query<{ comment_count: number }>('SELECT comment_count FROM videos WHERE id = $1', [videoId]);
      if (!total.rows[0]) throw notFound('Video not found');
      return {
        total: total.rows[0].comment_count,
        items: page,
        nextCursor: rows.length > limit && last ? encodeCursor({ t: last.createdAt, id: last.id }) : null,
      };
    },
  );

  /** Replies to one comment, oldest first. */
  app.get<{ Params: { id: string } }>('/comments/:id/replies', async (req) => {
    const id = parseId(req.params.id);
    const { rows } = await pool.query<CommentRow>(
      `${COMMENT_SELECT} WHERE c.parent_id = $2 ORDER BY c.created_at, c.id LIMIT 100`,
      [req.userId, id],
    );
    return { items: rows.map((r) => toDto(r, baseUrl(req))) };
  });

  app.post<{ Params: { id: string }; Body: { body?: string; parentId?: number | null } }>(
    '/videos/:id/comments',
    async (req, reply) => {
      const userId = requireUser(req);
      const videoId = parseId(req.params.id);
      const body = String(req.body?.body ?? '').trim();
      if (body.length < 1 || body.length > 500) throw badRequest('Comment must be 1-500 characters');
      const parentId = req.body?.parentId ? parseId(String(req.body.parentId)) : null;

      const created = await withTransaction(async (db) => {
        const v = await db.query<{ author_id: number }>('SELECT author_id FROM videos WHERE id = $1', [videoId]);
        if (!v.rows[0]) throw notFound('Video not found');
        let parentAuthor: number | null = null;
        if (parentId) {
          const p = await db.query<{ author_id: number; video_id: number; parent_id: number | null }>(
            'SELECT author_id, video_id, parent_id FROM comments WHERE id = $1',
            [parentId],
          );
          if (!p.rows[0] || p.rows[0].video_id !== videoId) throw badRequest('parentId does not belong to this video');
          if (p.rows[0].parent_id) throw badRequest('Replies are one level deep');
          parentAuthor = p.rows[0].author_id;
        }
        const ins = await db.query<{ id: number }>(
          'INSERT INTO comments (video_id, author_id, parent_id, body) VALUES ($1, $2, $3, $4) RETURNING id',
          [videoId, userId, parentId, body],
        );
        const commentId = ins.rows[0].id;
        await notify(db, { recipientId: v.rows[0].author_id, actorId: userId, type: 'comment', videoId, commentId });
        if (parentAuthor && parentAuthor !== v.rows[0].author_id) {
          await notify(db, { recipientId: parentAuthor, actorId: userId, type: 'reply', videoId, commentId });
        }
        return commentById(db, userId, commentId, baseUrl(req));
      });
      return reply.status(201).send(created);
    },
  );

  app.delete<{ Params: { id: string } }>('/comments/:id', async (req) => {
    const userId = requireUser(req);
    const id = parseId(req.params.id);
    const { rows } = await pool.query<{ author_id: number }>('SELECT author_id FROM comments WHERE id = $1', [id]);
    if (!rows[0]) throw notFound('Comment not found');
    if (rows[0].author_id !== userId) throw forbidden('You can only delete your own comments');
    await pool.query('DELETE FROM comments WHERE id = $1', [id]);
    return { deleted: true };
  });

  app.post<{ Params: { id: string } }>('/comments/:id/like', async (req) => {
    const userId = requireUser(req);
    const id = parseId(req.params.id);
    await commentById(pool, userId, id, baseUrl(req));
    await pool.query('INSERT INTO comment_likes (user_id, comment_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, id]);
    return commentById(pool, userId, id, baseUrl(req));
  });

  app.delete<{ Params: { id: string } }>('/comments/:id/like', async (req) => {
    const userId = requireUser(req);
    const id = parseId(req.params.id);
    await pool.query('DELETE FROM comment_likes WHERE user_id = $1 AND comment_id = $2', [userId, id]);
    return commentById(pool, userId, id, baseUrl(req));
  });
};
