export interface UserSummary {
  id: number;
  handle: string;
  displayName: string;
  avatarColor: string;
  avatarUrl: string | null;
}

export interface Me extends UserSummary {
  bio: string;
}

export interface Video {
  id: number;
  author: UserSummary;
  caption: string;
  soundName: string;
  tags: string[];
  videoUrl: string;
  thumbnailUrl: string | null;
  durationMs: number;
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
  /** Client-only: unique key of this entry in a feed list. */
  listKey?: string;
  recommendation?: { reason: 'yours' | 'interest' | 'popular' | 'explore'; score: number };
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface Comment {
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

export interface Profile extends Me {
  followingCount: number;
  followerCount: number;
  likeCount: number;
  videoCount: number;
  isMe: boolean;
  isFollowing: boolean;
  followsYou: boolean;
}

export interface Person extends Me {
  followerCount: number;
  isFollowing: boolean;
  followsYou: boolean;
}

export interface Notification {
  id: number;
  type: 'like' | 'comment' | 'reply' | 'follow' | 'repost';
  createdAt: string;
  read: boolean;
  actor: UserSummary;
  iFollowActor: boolean;
  videoId: number | null;
  videoThumbnailUrl: string | null;
  commentId: number | null;
  commentBody: string | null;
}

export interface Interests {
  tags: { slug: string; label: string; likes: number; completes: number; score: number; share: number }[];
  totalSignals: number;
  explorationRate: number;
}

export interface Counters {
  likeCount: number;
  saveCount: number;
  shareCount: number;
  commentCount: number;
  viewCount: number;
}

export type ProfileTab = 'videos' | 'saved' | 'liked' | 'reposts';

export interface HashtagHit {
  tag: string;
  videos: number;
}
