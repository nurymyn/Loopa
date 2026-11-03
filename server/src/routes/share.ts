import type { FastifyPluginAsync } from 'fastify';
import { pool } from '../db.js';
import { baseUrl, mediaUrl } from '../lib/urls.js';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * The link handed out by "Поделиться" / "Скопировать ссылку": a small public
 * page with Open Graph tags (so messengers show a preview card), the video,
 * and an "open in app" link using the loopa:// scheme.
 */
export const shareRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>('/v/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const { rows } = await pool.query<{
      caption: string;
      media_path: string;
      thumbnail_path: string | null;
      handle: string;
      display_name: string;
      width: number | null;
      height: number | null;
    }>(
      `SELECT v.caption, v.media_path, v.thumbnail_path, v.width, v.height, u.handle, u.display_name
       FROM videos v JOIN users u ON u.id = v.author_id WHERE v.id = $1`,
      [Number.isSafeInteger(id) ? id : 0],
    );
    const v = rows[0];
    if (!v) return reply.status(404).type('text/plain; charset=utf-8').send('Видео не найдено');
    const base = baseUrl(req);
    const src = mediaUrl(base, v.media_path)!;
    const thumb = mediaUrl(base, v.thumbnail_path);
    const pageUrl = `${base}/v/${id}`;
    const title = `${v.display_name} (@${v.handle}) в Loopa`;
    const description = v.caption || 'Короткое видео в Loopa';
    return reply.type('text/html; charset=utf-8').send(`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="video.other">
<meta property="og:site_name" content="Loopa">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(pageUrl)}">
${thumb ? `<meta property="og:image" content="${esc(thumb)}">` : ''}
<meta property="og:video" content="${esc(src)}">
<meta property="og:video:type" content="video/mp4">
${v.width && v.height ? `<meta property="og:video:width" content="${v.width}"><meta property="og:video:height" content="${v.height}">` : ''}
<meta name="twitter:card" content="${thumb ? 'summary_large_image' : 'summary'}">
<style>
  body{margin:0;background:#000;color:#fff;font:16px/1.45 system-ui,sans-serif;display:flex;flex-direction:column;align-items:center}
  video{display:block;max-height:78vh;max-width:100%;background:#111}
  main{max-width:480px;width:100%;padding:16px;box-sizing:border-box}
  .handle{color:#B8F227;font-weight:700}
  a.open{display:block;margin-top:16px;padding:14px;border-radius:10px;background:#B8F227;color:#0B0B0B;text-align:center;font-weight:700;text-decoration:none}
  small{display:block;margin-top:10px;color:#8a8a8e}
</style>
</head>
<body>
<video src="${esc(src)}" ${thumb ? `poster="${esc(thumb)}"` : ''} controls autoplay loop playsinline muted></video>
<main>
  <div><span class="handle">@${esc(v.handle)}</span> ${esc(v.caption)}</div>
  <a class="open" href="loopa://video/${id}">Открыть в приложении Loopa</a>
  <small>Ссылка открывает приложение, если оно установлено как отдельная сборка. В Expo Go эта схема не работает.</small>
</main>
</body>
</html>`);
  });
};
