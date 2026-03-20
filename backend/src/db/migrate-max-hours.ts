/**
 * Migración: agrega max_hours a la tabla columns.
 * Ejecutar una sola vez: npx ts-node src/db/migrate-max-hours.ts
 */
import 'dotenv/config';
import { pool } from './index';

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE columns ADD COLUMN IF NOT EXISTS max_hours integer;
    `);
    console.log('[migrate-max-hours] ✅ Columna max_hours agregada a columns.');
  } catch (err) {
    console.error('[migrate-max-hours] ❌ Error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
