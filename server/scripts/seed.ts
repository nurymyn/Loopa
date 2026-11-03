/**
 * Wipes all app data and loads the demo dataset: users, follows, the 10 sample
 * videos from media/manifest.json, ~10 comments per video, and an inbox for the
 * demo user. Tags (from migration 001) are kept.
 *
 * Usage: npm run seed      (DESTROYS existing data in the target database)
 */
import fs from 'node:fs';
import path from 'node:path';
import { pool, withTransaction } from '../src/db.js';
import { hashPassword, hashToken } from '../src/lib/passwords.js';
import { config } from '../src/config.js';
import {
  DEMO_HANDLE,
  DEMO_PASSWORD,
  DEMO_TOKEN,
  demoReposts,
  repostsOfDemoVideo,
  demoLikes,
  demoSaves,
  follows,
  likesOnDemoVideo,
  users,
  videoExtras,
  type SeedComment,
} from './seed-data.js';

interface ManifestItem {
  file: string;
  thumbnail: string;
  durationSec: number;
  width: number;
  height: number;
  authorHandle: string;
  tags: string[];
  caption: string;
  soundName: string;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);

async function main() {
  const manifestPath = path.join(config.seedMediaDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ManifestItem[];
  const missing = manifest.filter((m) => !fs.existsSync(path.join(config.seedMediaDir, m.file)));
  // CI runs the API tests without downloading the clips; nothing there plays video.
  if (missing.length && process.env.SEED_ALLOW_MISSING_MEDIA !== 'true') {
    throw new Error(
      `${missing.length} sample clip(s) are missing in ${config.seedMediaDir} (first: ${missing[0].file}). ` +
        'Run `npm run media` first: it downloads them from Mixkit.',
    );
  }

  await withTransaction(async (db) => {
    await db.query(`TRUNCATE notifications, comment_likes, comments, views, shares, reposts, saves, likes,
                    video_tags, videos, follows, auth_tokens, users RESTART IDENTITY CASCADE`);

    // DEV ONLY: every seeded account shares one documented password.
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    const userId = new Map<string, number>();
    for (const [i, u] of users.entries()) {
      const { rows } = await db.query<{ id: number }>(
        `INSERT INTO users (handle, display_name, bio, avatar_color, password_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [u.handle, u.displayName, u.bio, u.color, passwordHash, hoursAgo(24 * 60 - i * 24)],
      );
      userId.set(u.handle, rows[0].id);
    }
    const uid = (h: string) => {
      const id = userId.get(h);
      if (!id) throw new Error(`Seed refers to unknown user @${h}`);
      return id;
    };
    const demo = uid(DEMO_HANDLE);
    await db.query('INSERT INTO auth_tokens (token_hash, user_id) VALUES ($1, $2)', [hashToken(DEMO_TOKEN), demo]);

    for (const [i, [a, b]] of follows.entries()) {
      const at = hoursAgo(200 - i * 5);
      await db.query('INSERT INTO follows (follower_id, followee_id, created_at) VALUES ($1, $2, $3)', [uid(a), uid(b), at]);
      if (b === DEMO_HANDLE) {
        await db.query(
          "INSERT INTO notifications (recipient_id, actor_id, type, created_at) VALUES ($1, $2, 'follow', $3)",
          [demo, uid(a), at],
        );
      }
    }

    const videoId = new Map<string, number>();
    for (const item of manifest) {
      const extra = videoExtras[item.file];
      if (!extra) throw new Error(`No seed extras for ${item.file}`);
      const authorId = uid(item.authorHandle);
      const { rows } = await db.query<{ id: number }>(
        `INSERT INTO videos (author_id, caption, sound_name, media_path, thumbnail_path,
                             duration_ms, width, height, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          authorId,
          item.caption,
          item.soundName,
          `seed/${item.file}`,
          `seed/${item.thumbnail}`,
          Math.round(item.durationSec * 1000),
          item.width,
          item.height,
          hoursAgo(extra.hoursAgo),
        ],
      );
      const vid = rows[0].id;
      videoId.set(item.file, vid);
      for (const tag of item.tags) {
        await db.query('INSERT INTO video_tags (video_id, tag_slug) VALUES ($1, $2)', [vid, tag]);
      }

      const insertComment = async (c: SeedComment, parentId: number | null) => {
        const [handle, body, likes, ago] = c;
        const { rows: cr } = await db.query<{ id: number }>(
          `INSERT INTO comments (video_id, author_id, parent_id, body, created_at)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [vid, uid(handle), parentId, body, hoursAgo(ago)],
        );
        // Baseline like count; real comment_likes rows are added on top by the app.
        await db.query('UPDATE comments SET like_count = $2 WHERE id = $1', [cr[0].id, likes]);
        if (authorId === demo && uid(handle) !== demo) {
          await db.query(
            `INSERT INTO notifications (recipient_id, actor_id, type, video_id, comment_id, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [demo, uid(handle), parentId ? 'reply' : 'comment', vid, cr[0].id, hoursAgo(ago)],
          );
        }
        return cr[0].id;
      };
      for (const c of extra.comments) {
        const parent = await insertComment(c, null);
        for (const r of c[4] ?? []) await insertComment(r, parent);
      }
    }
    const vid = (file: string) => {
      const id = videoId.get(file);
      if (!id) throw new Error(`Seed refers to unknown video ${file}`);
      return id;
    };

    // Real rows for the demo user, so "Понравившиеся" / "Избранное" are not empty.
    for (const f of demoLikes) await db.query('INSERT INTO likes (user_id, video_id) VALUES ($1, $2)', [demo, vid(f)]);
    for (const f of demoSaves) await db.query('INSERT INTO saves (user_id, video_id) VALUES ($1, $2)', [demo, vid(f)]);
    for (const f of demoReposts) await db.query('INSERT INTO reposts (user_id, video_id) VALUES ($1, $2)', [demo, vid(f)]);

    const demoVideo = manifest.find((m) => m.authorHandle === DEMO_HANDLE);
    if (demoVideo) {
      for (const [i, h] of likesOnDemoVideo.entries()) {
        const at = hoursAgo(40 - i * 6);
        await db.query('INSERT INTO likes (user_id, video_id, created_at) VALUES ($1, $2, $3)', [uid(h), vid(demoVideo.file), at]);
        await db.query(
          "INSERT INTO notifications (recipient_id, actor_id, type, video_id, created_at) VALUES ($1, $2, 'like', $3, $4)",
          [demo, uid(h), vid(demoVideo.file), at],
        );
      }
    }

    if (demoVideo) {
      for (const [i, h] of repostsOfDemoVideo.entries()) {
        const at = hoursAgo(20 - i * 7);
        await db.query('INSERT INTO reposts (user_id, video_id, created_at) VALUES ($1, $2, $3)', [uid(h), vid(demoVideo.file), at]);
        await db.query(
          "INSERT INTO notifications (recipient_id, actor_id, type, video_id, created_at) VALUES ($1, $2, 'repost', $3, $4)",
          [demo, uid(h), vid(demoVideo.file), at],
        );
      }
    }

    // Baseline counters on top of whatever the triggers counted.
    for (const item of manifest) {
      const e = videoExtras[item.file];
      await db.query(
        `UPDATE videos SET like_count = like_count + $2, view_count = view_count + $3,
                           save_count = save_count + $4, share_count = share_count + $5
         WHERE id = $1`,
        [vid(item.file), e.likes, e.views, e.saves, e.shares],
      );
    }
  });

  const counts = await pool.query<{ t: string; n: number }>(`
    SELECT 'users' AS t, count(*)::int AS n FROM users
    UNION ALL SELECT 'videos', count(*)::int FROM videos
    UNION ALL SELECT 'comments', count(*)::int FROM comments
    UNION ALL SELECT 'follows', count(*)::int FROM follows
    UNION ALL SELECT 'likes', count(*)::int FROM likes
    UNION ALL SELECT 'notifications', count(*)::int FROM notifications`);
  console.log('seeded:', Object.fromEntries(counts.rows.map((r) => [r.t, r.n])));
  console.log(`DEV ONLY: every seeded account (e.g. @${DEMO_HANDLE}) has password "${DEMO_PASSWORD}"`);
  console.log(`DEV ONLY: curl token for @${DEMO_HANDLE}: Authorization: Bearer ${DEMO_TOKEN}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
