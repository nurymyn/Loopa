import { mediaUrl } from './urls.js';

export interface UserRow {
  id: number;
  handle: string;
  display_name: string;
  bio?: string;
  avatar_color: string;
  avatar_path: string | null;
}

export interface UserSummary {
  id: number;
  handle: string;
  displayName: string;
  avatarColor: string;
  avatarUrl: string | null;
}

export function toUserSummary(row: UserRow, base: string): UserSummary {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
    avatarUrl: mediaUrl(base, row.avatar_path),
  };
}

export const USER_COLUMNS = 'u.id, u.handle, u.display_name, u.bio, u.avatar_color, u.avatar_path';

export const HANDLE_RE = /^[a-z0-9._]{2,30}$/;
