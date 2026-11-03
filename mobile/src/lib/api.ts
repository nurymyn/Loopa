import Constants from 'expo-constants';
import type {
  HashtagHit,
  ProfileTab,
  Comment,
  Counters,
  Interests,
  Me,
  Notification,
  Page,
  Person,
  Profile,
  UserSummary,
  Video,
} from './types';

/**
 * Where the API lives, as seen from the phone:
 *  1. EXPO_PUBLIC_API_URL if set (see mobile/.env.example);
 *  2. otherwise the computer that runs `npx expo start`, port 4000 —
 *     Expo Go already knows that machine's LAN address (hostUri).
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const hostUri = Constants.expoConfig?.hostUri ?? '';
  const host = hostUri.split(':')[0];
  if (host && !host.endsWith('.exp.direct')) return `http://${host}:4000`;
  return 'http://localhost:4000';
}

export const API_URL = resolveBaseUrl();
const TIMEOUT_MS = 10_000;

let token: string | null = null;
export function setToken(t: string | null) {
  token = t;
}

/**
 * kind 'network' = the server could not be reached at all;
 * 'dropped' = the connection broke while a request was being sent;
 * 'http' = the server answered with an error.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly kind: 'network' | 'dropped' | 'http',
    public readonly status?: number,
  ) {
    super(message);
  }
}

export function describeError(err: unknown): string {
  if (err instanceof ApiError && err.kind === 'network') {
    return `Нет связи с сервером (${API_URL}). Проверьте, что API запущен и телефон в той же Wi-Fi сети.`;
  }
  if (err instanceof ApiError && err.kind === 'dropped') {
    return `Связь с сервером (${API_URL}) оборвалась во время загрузки. Проверьте Wi-Fi и попробуйте ещё раз.`;
  }
  if (err instanceof ApiError) return err.message;
  return 'Что-то пошло не так. Попробуйте ещё раз.';
}

/** Upload limit used when the server cannot be asked (see GET /api/config). */
export const FALLBACK_MAX_UPLOAD_MB = 200;
let maxUploadMb: number | null = null;

/** The server's video upload limit in megabytes, cached after the first call. */
export async function getMaxUploadMb(): Promise<number> {
  if (maxUploadMb !== null) return maxUploadMb;
  try {
    const cfg = await request<{ maxUploadMb: number }>('GET', '/config');
    if (typeof cfg.maxUploadMb === 'number' && cfg.maxUploadMb > 0) maxUploadMb = cfg.maxUploadMb;
  } catch {
    // Offline or an older server: the fallback matches the server default.
  }
  return maxUploadMb ?? FALLBACK_MAX_UPLOAD_MB;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError('network', 'network');
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error ?? `Ошибка сервера (${res.status})`;
    throw new ApiError(msg, 'http', res.status);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const q = (params: Record<string, string | number | null | undefined>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
};

export const api = {
  signup: (handle: string, password: string, displayName: string) =>
    request<{ token: string; user: Me }>('POST', '/auth/signup', { handle, password, displayName }),
  login: (handle: string, password: string) => request<{ token: string; user: Me }>('POST', '/auth/login', { handle, password }),
  logout: () => request<{ ok: boolean }>('POST', '/auth/logout'),
  devLogin: (handle: string) => request<{ token: string; user: Me }>('POST', '/auth/dev-login', { handle }),
  devAccounts: () => request<{ items: UserSummary[] }>('GET', '/auth/dev-accounts'),
  me: () => request<Me>('GET', '/me'),
  updateMe: (patch: { displayName?: string; bio?: string }) => request<Me>('PATCH', '/me', patch),

  forYou: (cursor?: string | null) => request<Page<Video>>('GET', `/feed/for-you${q({ cursor, limit: 5 })}`),
  following: (cursor?: string | null) => request<Page<Video>>('GET', `/feed/following${q({ cursor, limit: 5 })}`),
  interests: () => request<Interests>('GET', '/me/interests'),

  video: (id: number) => request<Video>('GET', `/videos/${id}`),
  like: (id: number, on: boolean) =>
    request<Counters & { liked: boolean }>(on ? 'POST' : 'DELETE', `/videos/${id}/like`),
  save: (id: number, on: boolean) =>
    request<Counters & { saved: boolean }>(on ? 'POST' : 'DELETE', `/videos/${id}/save`),
  repost: (id: number, on: boolean) =>
    request<Counters & { reposted: boolean }>(on ? 'POST' : 'DELETE', `/videos/${id}/repost`),
  share: (id: number) => request<Counters & { url: string }>('POST', `/videos/${id}/share`),
  view: (id: number, watchedMs: number, completed: boolean) =>
    request<Counters>('POST', `/videos/${id}/view`, { watchedMs, completed }),

  comments: (videoId: number, cursor?: string | null) =>
    request<Page<Comment> & { total: number }>('GET', `/videos/${videoId}/comments${q({ cursor })}`),
  replies: (commentId: number) => request<{ items: Comment[] }>('GET', `/comments/${commentId}/replies`),
  addComment: (videoId: number, body: string, parentId?: number | null) =>
    request<Comment>('POST', `/videos/${videoId}/comments`, { body, parentId: parentId ?? null }),
  likeComment: (id: number, on: boolean) => request<Comment>(on ? 'POST' : 'DELETE', `/comments/${id}/like`),

  profile: (handle: string) => request<Profile>('GET', `/users/${encodeURIComponent(handle)}`),
  userVideos: (handle: string, tab: ProfileTab, cursor?: string | null) =>
    request<Page<Video>>('GET', `/users/${encodeURIComponent(handle)}/${tab}${q({ cursor })}`),
  userPeople: (handle: string, kind: 'followers' | 'following', cursor?: string | null) =>
    request<Page<Person>>('GET', `/users/${encodeURIComponent(handle)}/${kind}${q({ cursor })}`),
  follow: (handle: string, on: boolean) =>
    request<{ following: boolean }>(on ? 'POST' : 'DELETE', `/users/${encodeURIComponent(handle)}/follow`),

  friends: () => request<{ following: Person[]; suggested: Person[] }>('GET', '/friends'),
  inbox: (cursor?: string | null) => request<Page<Notification> & { unreadCount: number }>('GET', `/inbox${q({ cursor })}`),
  unread: () => request<{ count: number }>('GET', '/inbox/unread'),
  markInboxRead: () => request<{ marked: number }>('POST', '/inbox/read'),
  search: (text: string) =>
    request<{ users: Person[]; videos: Video[]; hashtags: HashtagHit[] }>('GET', `/search${q({ q: text })}`),
  hashtag: (tag: string, cursor?: string | null) =>
    request<Page<Video> & { tag: string; videoCount: number; viewCount: number }>(
      'GET',
      `/hashtags/${encodeURIComponent(tag)}${q({ cursor })}`,
    ),
  sound: (name: string, cursor?: string | null) =>
    request<Page<Video> & { name: string; videoCount: number }>('GET', `/sounds${q({ name, cursor })}`),

  publish(
    file: { uri: string; name: string; type: string },
    fields: { caption: string },
    onProgress: (fraction: number) => void,
  ): Promise<Video> {
    return upload<Video>('/videos', 'video', file, { caption: fields.caption }, onProgress);
  },

  uploadAvatar(file: { uri: string; name: string; type: string }): Promise<Me> {
    return upload<Me>('/me/avatar', 'avatar', file, {}, () => {});
  },
};

/**
 * Multipart upload with progress. fetch() cannot report upload progress in
 * React Native, so this uses XMLHttpRequest.
 */
function upload<T>(
  path: string,
  field: string,
  file: { uri: string; name: string; type: string },
  fields: Record<string, string>,
  onProgress: (fraction: number) => void,
): Promise<T> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/api${path}`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      let sentBytes = 0;
      xhr.upload.onprogress = (e) => {
        sentBytes = e.loaded;
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        const data = safeJson(xhr.responseText) as (T & { error?: string }) | null;
        if (xhr.status >= 200 && xhr.status < 300 && data) resolve(data);
        else reject(new ApiError(data?.error ?? `Ошибка загрузки (${xhr.status})`, 'http', xhr.status));
      };
      // onerror fires both when the server is unreachable and when the
      // connection breaks mid-upload; upload progress tells the two apart.
      xhr.onerror = () => reject(new ApiError('network', sentBytes > 0 ? 'dropped' : 'network'));
      const form = new FormData();
      for (const [k, v] of Object.entries(fields)) form.append(k, v);
      // React Native's FormData accepts { uri, name, type } for files.
      form.append(field, file as unknown as Blob);
      xhr.send(form);
    });
}
