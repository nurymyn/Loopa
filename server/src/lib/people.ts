import { mediaUrl } from './urls.js';

export interface PersonRow {
  id: number;
  handle: string;
  display_name: string;
  bio: string;
  avatar_color: string;
  avatar_path: string | null;
  follower_count: number;
  is_following: boolean;
  follows_you: boolean;
}

/** $1 is the viewer id (may be NULL). Callers add JOIN / WHERE / ORDER BY. */
export const PERSON_SELECT = `
  SELECT u.id, u.handle, u.display_name, u.bio, u.avatar_color, u.avatar_path,
         (SELECT count(*) FROM follows f WHERE f.followee_id = u.id)::int AS follower_count,
         EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followee_id = u.id) AS is_following,
         EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = u.id AND f.followee_id = $1) AS follows_you
  FROM users u
`;

export function toPerson(r: PersonRow, base: string) {
  return {
    id: r.id,
    handle: r.handle,
    displayName: r.display_name,
    bio: r.bio,
    avatarColor: r.avatar_color,
    avatarUrl: mediaUrl(base, r.avatar_path),
    followerCount: r.follower_count,
    isFollowing: r.is_following,
    followsYou: r.follows_you,
  };
}
