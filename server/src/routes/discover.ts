import type { FastifyPluginAsync } from 'fastify';
import { pool } from '../db.js';
import { badRequest } from '../lib/errors.js';
import { offsetFrom, offsetPage, parseLimit } from '../lib/cursor.js';
import { PERSON_SELECT, toPerson, type PersonRow } from '../lib/people.js';
import { baseUrl } from '../lib/urls.js';
import { queryVideos } from '../lib/videos.js';

const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

type ListQuery = { Querystring: { cursor?: string; limit?: string } };

export const discoverRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Search people (handle, name), videos (caption, sound, tag) and hashtags.
   * Substring match with ILIKE; pg_trgm indexes keep it fast. A query that
   * starts with '#' searches hashtags only.
   */
  app.get<{ Querystring: { q?: string } }>('/search', async (req) => {
    const raw = String(req.query.q ?? '').trim();
    if (!raw) return { users: [], videos: [], hashtags: [] };
    const tagOnly = raw.startsWith('#');
    const q = raw.replace(/^[#@]/, '');
    if (!q) return { users: [], videos: [], hashtags: [] };
    const pattern = likePattern(q);
    const base = baseUrl(req);

    const hashtags = await pool.query<{ tag: string; videos: number }>(
      `SELECT lower(m[1]) AS tag, count(DISTINCT v.id)::int AS videos
       FROM videos v, regexp_matches(v.caption, '#([^[:space:]#.,!?;:()"«»]+)', 'g') AS m
       WHERE m[1] ILIKE $1
       GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10`,
      [pattern],
    );
    if (tagOnly) {
      return { users: [], videos: [], hashtags: hashtags.rows };
    }
    const users = await pool.query<PersonRow>(
      `${PERSON_SELECT}
       WHERE u.handle ILIKE $2 OR u.display_name ILIKE $2
       ORDER BY follower_count DESC, u.id LIMIT 20`,
      [req.userId, pattern],
    );
    const videos = await queryVideos(
      pool,
      req.userId,
      `WHERE v.caption ILIKE $2 OR v.sound_name ILIKE $2
          OR EXISTS (SELECT 1 FROM video_tags vt WHERE vt.video_id = v.id AND vt.tag_slug ILIKE $2)
       ORDER BY v.like_count DESC, v.id DESC LIMIT 30`,
      [pattern],
      base,
    );
    return { users: users.rows.map((r) => toPerson(r, base)), videos, hashtags: hashtags.rows };
  });

  /** Hashtag page: videos whose caption has #tag or that carry the tag. Most liked first. */
  app.get<{ Params: { tag: string } } & ListQuery>('/hashtags/:tag', async (req) => {
    const tag = req.params.tag.replace(/^#/, '').toLowerCase();
    if (!/^[\p{L}\p{N}_]{1,50}$/u.test(tag)) throw badRequest('Invalid hashtag');
    const limit = parseLimit(req.query.limit, 18, 60);
    const offset = offsetFrom(req.query.cursor);
    const where = `WHERE v.caption ~* ('#' || $2 || '([[:space:]#.,!?;:()"«»]|$)')
                      OR EXISTS (SELECT 1 FROM video_tags vt WHERE vt.video_id = v.id AND vt.tag_slug = $2)`;
    const rows = await queryVideos(
      pool,
      req.userId,
      `${where} ORDER BY v.like_count DESC, v.id DESC LIMIT $3 OFFSET $4`,
      [tag, limit + 1, offset],
      baseUrl(req),
    );
    const total = await pool.query<{ n: number; views: number }>(
      `SELECT count(*)::int AS n, COALESCE(sum(view_count), 0)::bigint AS views FROM videos v ${where.replaceAll('$2', '$1')}`,
      [tag],
    );
    return { tag, videoCount: total.rows[0].n, viewCount: total.rows[0].views, ...offsetPage(rows, offset, limit) };
  });

  /** Sound page: every video that uses this sound name. */
  app.get<{ Querystring: { name?: string; cursor?: string; limit?: string } }>('/sounds', async (req) => {
    const name = String(req.query.name ?? '').trim();
    if (!name) throw badRequest('name is required');
    const limit = parseLimit(req.query.limit, 18, 60);
    const offset = offsetFrom(req.query.cursor);
    const rows = await queryVideos(
      pool,
      req.userId,
      'WHERE v.sound_name = $2 ORDER BY v.like_count DESC, v.id DESC LIMIT $3 OFFSET $4',
      [name, limit + 1, offset],
      baseUrl(req),
    );
    const total = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM videos WHERE sound_name = $1', [name]);
    return { name, videoCount: total.rows[0].n, ...offsetPage(rows, offset, limit) };
  });
};
