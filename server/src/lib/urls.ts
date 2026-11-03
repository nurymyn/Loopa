import type { FastifyRequest } from 'fastify';
import { config } from '../config.js';

export function baseUrl(req: FastifyRequest): string {
  if (config.publicBaseUrl) return config.publicBaseUrl;
  return `${req.protocol}://${req.host}`;
}

/** media_path values are relative ('seed/x.mp4', 'uploads/y.mp4'). */
export function mediaUrl(base: string, relPath: string | null): string | null {
  if (!relPath) return null;
  return `${base}/media/${relPath.split('/').map(encodeURIComponent).join('/')}`;
}
