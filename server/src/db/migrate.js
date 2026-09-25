import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../../migrations');

const files = (await fs.readdir(migrationsDir))
  .filter((name) => name.endsWith('.sql'))
  .sort();

await pool.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

for (const filename of files) {
  const existing = await pool.query(
    'SELECT 1 FROM schema_migrations WHERE filename = $1',
    [filename],
  );
  if (existing.rowCount) continue;

  const sql = await fs.readFile(path.join(migrationsDir, filename), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(filename) VALUES($1)', [filename]);
    await client.query('COMMIT');
    console.log(`Applied ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Migration failed: ${filename}`);
    throw error;
  } finally {
    client.release();
  }
}

await pool.end();
