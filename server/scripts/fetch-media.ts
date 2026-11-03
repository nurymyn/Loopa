/**
 * Downloads the 10 sample clips listed in media/manifest.json from Mixkit,
 * trims them to 14 s, scales to 540x960 and writes a thumbnail for each.
 *
 * The clips are not committed to git: the Mixkit licence allows using them in
 * a project but not redistributing the files on their own. Everyone who clones
 * the repo runs this once instead.
 *
 * Needs ffmpeg on PATH. Usage: npm run media   (skips files that already exist)
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { config } from '../src/config.js';

const run = promisify(execFile);

interface Item {
  file: string;
  thumbnail: string;
  source: { file: string; page: string };
}

async function hasFfmpeg(): Promise<boolean> {
  try {
    await run('ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const dir = config.seedMediaDir;
  const items = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')) as Item[];
  if (!(await hasFfmpeg())) {
    console.error('ffmpeg not found. Install it first: https://ffmpeg.org/download.html');
    console.error('  macOS: brew install ffmpeg   Ubuntu/Debian: sudo apt install ffmpeg   Windows: winget install ffmpeg');
    process.exitCode = 1;
    return;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'loopa-media-'));
  try {
    for (const item of items) {
      const out = path.join(dir, item.file);
      const thumb = path.join(dir, item.thumbnail);
      if (fs.existsSync(out) && fs.existsSync(thumb)) {
        console.log(`ok      ${item.file}`);
        continue;
      }
      const raw = path.join(tmp, item.file);
      const res = await fetch(item.source.file, { headers: { 'User-Agent': 'Mozilla/5.0 (loopa fetch-media)' } });
      if (!res.ok) throw new Error(`${item.source.file} -> HTTP ${res.status}. Source page: ${item.source.page}`);
      fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
      await run('ffmpeg', [
        '-v', 'error', '-y', '-i', raw, '-t', '14', '-an',
        '-vf', 'scale=540:960', '-c:v', 'libx264', '-preset', 'slow', '-crf', '28',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out,
      ]);
      await run('ffmpeg', ['-v', 'error', '-y', '-ss', '1', '-i', out, '-frames:v', '1', '-vf', 'scale=270:480', '-q:v', '4', thumb]);
      console.log(`fetched ${item.file}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`done: ${items.length} clips in ${dir}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
