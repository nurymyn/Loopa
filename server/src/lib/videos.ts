import type { Db } from '../db.js';
import { mediaUrl } from './urls.js';
import type { UserSummary } from './users.js';

export interface VideoDto {
  id: number;
  author: UserSummary;
  caption: string;
  soundName: string;
  tags: string[];
  videoUrl: string;
  thumbnailUrl: string | null;
  durationMs: number;
  width: number | null;
  height: number | null;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  shareCount: number;
  viewCount: number;
  createdAt: string;
  likedByMe: boolean;
  savedByMe: boolean;
  followingAuthor: boolean;
  repostedByMe: boolean;
}

interface VideoRow {
  id: number;
  author_id: number;
  caption: string;
  sound_name: string;
  media_path: string;
  thumbnail_path: string | null;
  duration_ms: number;
  width: number | null;
  height: number | null;
  like_count: number;
  comment_count: number;
  save_count: number;
  share_count: number;
  view_count: number;
  created_at: Date;
  handle: string;
  display_name: string;
  avatar_color: string;
  avatar_path: string | null;
  tags: string[];
  liked: boolean;
  saved: boolean;
  following: boolean;
  reposted: boolean;
}

/**
 * Base SELECT for anything that returns videos. $1 is always the viewer id
 * (may be NULL). Callers append WHERE / ORDER BY / LIMIT using $2.. params.
 */
export const VIDEO_SELECT = `
  SELECT v.*, u.handle, u.display_name, u.avatar_color, u.avatar_path,
    COALESCE((SELECT array_agg(vt.tag_slug ORDER BY vt.tag_slug)
              FROM video_tags vt WHERE vt.video_id = v.id), '{}') AS tags,
    EXISTS (SELECT 1 FROM likes l WHERE l.video_id = v.id AND l.user_id = $1) AS liked,
    EXISTS (SELECT 1 FROM saves s WHERE s.video_id = v.id AND s.user_id = $1) AS saved,
    EXISTS (SELECT 1 FROM follows f WHERE f.followee_id = v.author_id AND f.follower_id = $1) AS following,
    EXISTS (SELECT 1 FROM reposts r WHERE r.video_id = v.id AND r.user_id = $1) AS reposted
  FROM videos v
  JOIN users u ON u.id = v.author_id
`;

export function toVideoDto(row: VideoRow, base: string): VideoDto {
  return {
    id: row.id,
    author: {
      id: row.author_id,
      handle: row.handle,
      displayName: row.display_name,
      avatarColor: row.avatar_color,
      avatarUrl: mediaUrl(base, row.avatar_path),
    },
    caption: row.caption,
    soundName: row.sound_name,
    tags: row.tags,
    videoUrl: mediaUrl(base, row.media_path)!,
    thumbnailUrl: mediaUrl(base, row.thumbnail_path),
    durationMs: row.duration_ms,
    width: row.width,
    height: row.height,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    saveCount: row.save_count,
    shareCount: row.share_count,
    viewCount: row.view_count,
    createdAt: row.created_at.toISOString(),
    likedByMe: row.liked,
    savedByMe: row.saved,
    followingAuthor: row.following,
    repostedByMe: row.reposted,
  };
}

export async function queryVideos(
  db: Db,
  viewerId: number | null,
  tail: string,
  params: unknown[],
  base: string,
): Promise<VideoDto[]> {
  const { rows } = await db.query<VideoRow>(`${VIDEO_SELECT} ${tail}`, [viewerId, ...params]);
  return rows.map((r) => toVideoDto(r, base));
}

/** Fetch videos by id and return them in the order of `ids`. */
export async function videosByIds(
  db: Db,
  viewerId: number | null,
  ids: number[],
  base: string,
): Promise<VideoDto[]> {
  if (ids.length === 0) return [];
  const list = await queryVideos(db, viewerId, 'WHERE v.id = ANY($2::bigint[])', [ids], base);
  const byId = new Map(list.map((v) => [v.id, v]));
  return ids.map((id) => byId.get(id)).filter((v): v is VideoDto => v !== undefined);
}

/** Pull #hashtags out of a caption, lower-cased, without the '#'. */
export function extractHashtags(caption: string): string[] {
  const out = new Set<string>();
  for (const m of caption.matchAll(/#([\p{L}\p{N}_]+)/gu)) out.add(m[1].toLowerCase());
  return [...out];
}
