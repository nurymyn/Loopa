import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// src/ in dev (tsx), dist/src/ after build. Both sit under server/.
const serverRoot = here.includes(`${path.sep}dist${path.sep}`)
  ? path.resolve(here, '..', '..')
  : path.resolve(here, '..');

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '0.0.0.0',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://loopa:loopa@localhost:5432/loopa',
  /** Folder with the sample clips (repo-level media/). Served at /media/seed/. */
  seedMediaDir: path.resolve(serverRoot, process.env.SEED_MEDIA_DIR ?? '../media'),
  /** Folder for user uploads. Served at /media/uploads/. */
  uploadDir: path.resolve(serverRoot, process.env.UPLOAD_DIR ?? './uploads'),
  /** Max upload size in megabytes. A 60 s 1080p phone video is about 100-130 MB. */
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 200),
  /** If set, absolute media/share URLs use this instead of the request Host header. */
  publicBaseUrl: process.env.PUBLIC_BASE_URL?.replace(/\/$/, '') || null,
  /** Enables POST /api/auth/dev-login. Never enable on a public server. */
  devAuth: bool(process.env.DEV_AUTH, true),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  serverRoot,
};
