import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { pool, withTransaction } from '../db.js';
import { config } from '../config.js';
import { requireUser } from '../auth.js';
import { badRequest, HttpError } from '../lib/errors.js';
import { baseUrl } from '../lib/urls.js';
import { extractHashtags, queryVideos } from '../lib/videos.js';
import { makeThumbnail, probe } from '../lib/media.js';

const ALLOWED_EXT = new Set(['.mp4', '.mov', '.m4v', '.webm']);

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Publish a video. multipart/form-data with:
   *   video     (file, required, up to MAX_UPLOAD_MB)
   *   caption   (text, optional, hashtags allowed)
   *   tags      (text, optional, comma-separated tag slugs)
   *   soundName (text, optional)
   * Hashtags in the caption that match a known tag (#еда, #юмор...) are added as tags.
   */
  app.post('/videos', async (req, reply) => {
    const userId = requireUser(req);
    if (!req.isMultipart()) throw badRequest('Expected multipart/form-data');

    const fields: Record<string, string> = {};
    let saved: { abs: string; rel: string } | null = null;
    // Set as soon as the file stream is opened, so a failure mid-upload
    // (size limit, client disconnect) still removes the partial file.
    let partial: string | null = null;

    try {
      for await (const part of req.parts()) {
        if (part.type === 'file') {
          if (part.fieldname !== 'video' || saved) {
            part.file.resume();
            continue;
          }
          const ext = (path.extname(part.filename || '').toLowerCase() || '.mp4');
          const looksLikeVideo = part.mimetype.startsWith('video/') || ALLOWED_EXT.has(ext);
          if (!looksLikeVideo || !ALLOWED_EXT.has(ext)) {
            part.file.resume();
            throw badRequest('Only .mp4, .mov, .m4v or .webm video files are accepted');
          }
          const name = `${crypto.randomUUID()}${ext}`;
          const abs = path.join(config.uploadDir, name);
          partial = abs;
          await pipeline(part.file, fs.createWriteStream(abs));
          if (part.file.truncated) {
            throw new HttpError(413, `File is larger than ${config.maxUploadMb} MB`);
          }
          partial = null;
          saved = { abs, rel: `uploads/${name}` };
        } else {
          fields[part.fieldname] = String(part.value ?? '');
        }
      }
    } catch (err) {
      if (saved) fs.rmSync(saved.abs, { force: true });
      if (partial) fs.rmSync(partial, { force: true });
      throw err;
    }
    if (!saved) throw badRequest('Field "video" with a file is required');

    const caption = (fields.caption ?? '').trim().slice(0, 300);
    const soundName = (fields.soundName ?? '').trim().slice(0, 100);
    const meta = await probe(saved.abs);
    const thumbAbs = saved.abs.replace(/\.[^.]+$/, '.jpg');
    const thumbRel = (await makeThumbnail(saved.abs, thumbAbs)) ? saved.rel.replace(/\.[^.]+$/, '.jpg') : null;

    const known = new Set((await pool.query<{ slug: string }>('SELECT slug FROM tags')).rows.map((r) => r.slug));
    const requested = (fields.tags ?? '').split(',').map((t) => t.trim().toLowerCase());
    const tags = [...new Set([...requested, ...extractHashtags(caption)])].filter((t) => known.has(t));

    const videoId = await withTransaction(async (db) => {
      const handle = await db.query<{ handle: string }>('SELECT handle FROM users WHERE id = $1', [userId]);
      const ins = await db.query<{ id: number }>(
        `INSERT INTO videos (author_id, caption, sound_name, media_path, thumbnail_path, duration_ms, width, height)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          userId,
          caption,
          soundName || `оригинальный звук — ${handle.rows[0].handle}`,
          saved!.rel,
          thumbRel,
          meta.durationMs,
          meta.width,
          meta.height,
        ],
      );
      for (const t of tags) {
        await db.query('INSERT INTO video_tags (video_id, tag_slug) VALUES ($1, $2)', [ins.rows[0].id, t]);
      }
      return ins.rows[0].id;
    });

    const [video] = await queryVideos(pool, userId, 'WHERE v.id = $2', [videoId], baseUrl(req));
    return reply.status(201).send(video);
  });
};
