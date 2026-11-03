import type { Db } from '../db.js';

/**
 * "Для вас" ranking. Deliberately simple and explainable:
 *
 *  1. Interest profile: for each tag, score = 3 x (likes on videos with that
 *     tag) + 1 x (videos with that tag watched to the end). Normalised to 0..1.
 *  2. Each candidate video gets
 *        interest  (best matching tag weight, 0..1)      x 1.0
 *      + popularity (log10(likes + 1) / 7, capped at 1)   x 0.3
 *      + freshness  (exp(-age_days / 14))                 x 0.2
 *      - 0.5 if the viewer already watched it to the end.
 *  3. Each slot on a page is filled with the best remaining video, except that
 *     with probability EXPLORATION_RATE (20%) a random remaining video is used
 *     instead, so the feed does not collapse into one topic.
 *  4. The viewer's own uploads from the last 15 minutes are pinned to the top
 *     of the first page, so a freshly published video shows up first.
 *
 * Pagination: the cursor carries a random seed and the ids already served. When
 * every video has been served, a new round starts (the feed is endless, like
 * the real thing, but with 10 seed videos it repeats quickly).
 */
export const EXPLORATION_RATE = 0.2;
const LIKE_WEIGHT = 3;
const COMPLETE_WEIGHT = 1;
const MAX_SEEN = 500;

export interface InterestTag {
  slug: string;
  label: string;
  likes: number;
  completes: number;
  score: number;
  /** Share of all signals, 0..1. */
  share: number;
}

export interface Interests {
  tags: InterestTag[];
  totalSignals: number;
  explorationRate: number;
}

export async function getInterests(db: Db, userId: number): Promise<Interests> {
  const { rows } = await db.query<{ slug: string; label: string; likes: number; completes: number }>(
    `SELECT t.slug, t.label,
            COALESCE(l.cnt, 0)::int AS likes,
            COALESCE(c.cnt, 0)::int AS completes
     FROM tags t
     LEFT JOIN (
       SELECT vt.tag_slug, count(*) AS cnt
       FROM likes l JOIN video_tags vt ON vt.video_id = l.video_id
       WHERE l.user_id = $1 GROUP BY vt.tag_slug
     ) l ON l.tag_slug = t.slug
     LEFT JOIN (
       SELECT vt.tag_slug, count(DISTINCT w.video_id) AS cnt
       FROM views w JOIN video_tags vt ON vt.video_id = w.video_id
       WHERE w.user_id = $1 AND w.completed GROUP BY vt.tag_slug
     ) c ON c.tag_slug = t.slug`,
    [userId],
  );
  const scored = rows.map((r) => ({ ...r, score: r.likes * LIKE_WEIGHT + r.completes * COMPLETE_WEIGHT }));
  const total = scored.reduce((s, r) => s + r.score, 0);
  const tags = scored
    .map((r) => ({ ...r, share: total > 0 ? r.score / total : 0 }))
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));
  return { tags, totalSignals: total, explorationRate: EXPLORATION_RATE };
}

export interface ForYouCursor {
  seed: number;
  seen: number[];
}

export interface RankedPick {
  id: number;
  reason: 'yours' | 'interest' | 'popular' | 'explore';
  score: number;
}

interface Candidate {
  id: number;
  author_id: number;
  like_count: number;
  age_days: number;
  tags: string[];
  completed: boolean;
  fresh_own: boolean;
}

/** Small deterministic PRNG so a given cursor always yields the same page. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function rankForYou(
  db: Db,
  viewerId: number | null,
  cursor: ForYouCursor | null,
  limit: number,
): Promise<{ picks: RankedPick[]; next: ForYouCursor | null }> {
  const seed = cursor?.seed ?? Math.floor(Math.random() * 2 ** 31);
  let seen = new Set(cursor?.seen ?? []);
  const firstPage = !cursor;

  const { rows: candidates } = await db.query<Candidate>(
    `SELECT v.id, v.author_id, v.like_count,
            EXTRACT(EPOCH FROM (now() - v.created_at)) / 86400 AS age_days,
            COALESCE((SELECT array_agg(tag_slug) FROM video_tags vt WHERE vt.video_id = v.id), '{}') AS tags,
            EXISTS (SELECT 1 FROM views w WHERE w.video_id = v.id AND w.user_id = $1 AND w.completed) AS completed,
            (v.author_id = $1 AND v.created_at > now() - interval '15 minutes') AS fresh_own
     FROM videos v`,
    [viewerId],
  );
  if (candidates.length === 0) return { picks: [], next: null };

  const weights = new Map<string, number>();
  if (viewerId != null) {
    const interests = await getInterests(db, viewerId);
    const max = Math.max(0, ...interests.tags.map((t) => t.score));
    if (max > 0) for (const t of interests.tags) weights.set(t.slug, t.score / max);
  }

  const score = (c: Candidate) => {
    const interest = Math.max(0, ...c.tags.map((t) => weights.get(t) ?? 0));
    const popularity = Math.min(1, Math.log10(Number(c.like_count) + 1) / 7);
    const freshness = Math.exp(-Number(c.age_days) / 14);
    return interest * 1.0 + popularity * 0.3 + freshness * 0.2 - (c.completed ? 0.5 : 0);
  };

  const picks: RankedPick[] = [];
  if (firstPage) {
    for (const c of candidates.filter((c) => c.fresh_own).sort((a, b) => a.age_days - b.age_days)) {
      if (picks.length >= limit) break;
      picks.push({ id: c.id, reason: 'yours', score: Math.round(score(c) * 1000) / 1000 });
      seen.add(c.id);
    }
  }

  const rng = mulberry32(seed + seen.size * 7919);
  while (picks.length < limit) {
    let remaining = candidates.filter((c) => !seen.has(c.id));
    if (remaining.length === 0) {
      // Everything served: start a new round, but never repeat within a page.
      seen = new Set(picks.map((p) => p.id));
      remaining = candidates.filter((c) => !seen.has(c.id));
      if (remaining.length === 0) break;
    }
    let chosen: Candidate;
    let reason: RankedPick['reason'];
    if (rng() < EXPLORATION_RATE) {
      chosen = remaining[Math.floor(rng() * remaining.length)];
      reason = 'explore';
    } else {
      remaining.sort((a, b) => score(b) - score(a) || b.id - a.id);
      chosen = remaining[0];
      const hasInterest = chosen.tags.some((t) => (weights.get(t) ?? 0) > 0);
      reason = hasInterest ? 'interest' : 'popular';
    }
    picks.push({ id: chosen.id, reason, score: Math.round(score(chosen) * 1000) / 1000 });
    seen.add(chosen.id);
  }

  const seenList = [...seen].slice(-MAX_SEEN);
  return { picks, next: { seed, seen: seenList } };
}
