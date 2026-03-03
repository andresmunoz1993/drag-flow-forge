/**
 * Script de migración one-shot: agrega columnas nuevas a tablas existentes.
 * Ejecutar UNA sola vez: npx ts-node src/db/migrate.ts
 */
import 'dotenv/config';
import { pool } from './index';

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('[migrate] Ejecutando ALTER TABLE...');
    await client.query(`
      ALTER TABLE users         ADD COLUMN IF NOT EXISTS id_sap TEXT;
      ALTER TABLE boards        ADD COLUMN IF NOT EXISTS sap_config    JSONB;
      ALTER TABLE boards        ADD COLUMN IF NOT EXISTS sp_auto_import JSONB;
      ALTER TABLE boards        ADD COLUMN IF NOT EXISTS landing        JSONB;
      ALTER TABLE custom_fields ADD COLUMN IF NOT EXISTS formula        TEXT;
      ALTER TABLE custom_fields ADD COLUMN IF NOT EXISTS formula_days   INTEGER;
      ALTER TABLE cards         ADD COLUMN IF NOT EXISTS sp_external_id TEXT;
    `);
    console.log('[migrate] ✅ Columnas agregadas correctamente.');
  } catch (err) {
    console.error('[migrate] ❌ Error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
