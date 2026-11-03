/**
 * Minimal migration runner. Applies every migrations/NNN_*.sql file that is not
 * yet recorded in schema_migrations, in filename order, each in its own
 * transaction. Usage: npm run migrate
 */
import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../src/db.js';
import { config } from '../src/config.js';

const dir = path.join(config.serverRoot, 'migrations');

async function main() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const done = new Set((await pool.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const files = fs.readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();

  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`applied ${file}`);
      applied++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`failed ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }
  console.log(applied ? `${applied} migration(s) applied` : 'database is up to date');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
