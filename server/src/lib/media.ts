import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * Optional helpers that shell out to ffprobe/ffmpeg. If the binaries are not
 * installed, uploads still work: duration is 0 and there is no thumbnail.
 */
export async function probe(file: string): Promise<{ durationMs: number; width: number | null; height: number | null }> {
  try {
    const { stdout } = await run('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height:format=duration',
      '-of', 'json',
      file,
    ]);
    const j = JSON.parse(stdout) as { streams?: { width?: number; height?: number }[]; format?: { duration?: string } };
    return {
      durationMs: Math.round(Number(j.format?.duration ?? 0) * 1000) || 0,
      width: j.streams?.[0]?.width ?? null,
      height: j.streams?.[0]?.height ?? null,
    };
  } catch {
    return { durationMs: 0, width: null, height: null };
  }
}

export async function makeThumbnail(file: string, out: string): Promise<boolean> {
  try {
    await run('ffmpeg', ['-v', 'error', '-y', '-ss', '0.5', '-i', file, '-frames:v', '1', '-vf', 'scale=270:-2', '-q:v', '4', out]);
    return true;
  } catch {
    return false;
  }
}
