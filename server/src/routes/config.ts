import type { FastifyPluginAsync } from 'fastify';
import { config } from '../config.js';

/**
 * Public client settings. The app reads the upload limit before sending a
 * video, so a too-big file is refused on the phone instead of mid-upload.
 */
export const configRoutes: FastifyPluginAsync = async (app) => {
  app.get('/config', async () => ({ maxUploadMb: config.maxUploadMb }));
};
