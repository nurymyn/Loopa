import fs from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { registerAuth } from './auth.js';
import { HttpError } from './lib/errors.js';
import { authRoutes } from './routes/auth.js';
import { feedRoutes } from './routes/feed.js';
import { videoRoutes } from './routes/videos.js';
import { commentRoutes } from './routes/comments.js';
import { userRoutes } from './routes/users.js';
import { socialRoutes } from './routes/social.js';
import { uploadRoutes } from './routes/upload.js';
import { shareRoutes } from './routes/share.js';
import { discoverRoutes } from './routes/discover.js';
import { pool } from './db.js';

export async function buildApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger === false ? false : { level: config.logLevel },
    trustProxy: true,
  });

  await app.register(cors, { origin: true });
  await app.register(multipart, {
    limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1, fields: 10 },
  });

  fs.mkdirSync(config.uploadDir, { recursive: true });
  await app.register(fastifyStatic, { root: config.seedMediaDir, prefix: '/media/seed/' });
  await app.register(fastifyStatic, {
    root: config.uploadDir,
    prefix: '/media/uploads/',
    decorateReply: false,
  });

  registerAuth(app);

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.statusCode).send({ error: err.message });
    }
    const e = err as { statusCode?: number; code?: string; message?: string };
    if (e.code === 'FST_REQ_FILE_TOO_LARGE') {
      return reply.status(413).send({ error: `File is larger than ${config.maxUploadMb} MB` });
    }
    if (e.statusCode && e.statusCode < 500) {
      return reply.status(e.statusCode).send({ error: e.message });
    }
    req.log.error(err);
    return reply.status(500).send({ error: 'Internal server error' });
  });

  app.get('/health', async () => {
    await pool.query('SELECT 1');
    return { ok: true };
  });

  await app.register(
    async (api) => {
      await api.register(authRoutes);
      await api.register(feedRoutes);
      await api.register(videoRoutes);
      await api.register(commentRoutes);
      await api.register(userRoutes);
      await api.register(socialRoutes);
      await api.register(uploadRoutes);
      await api.register(discoverRoutes);
    },
    { prefix: '/api' },
  );
  await app.register(shareRoutes);

  return app;
}
