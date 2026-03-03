/**
 * Migración: client_ref en cards + tabla adjuntos_clientes
 * Ejecutar una sola vez: npx ts-node src/db/migrate-clientref.ts
 */
import 'dotenv/config';
import { pool } from './index';

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('[migrate-clientref] Ejecutando...');
    await client.query(`
      -- Columna client_ref en cards (referencia al código externo del cliente)
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS client_ref TEXT;
      CREATE INDEX IF NOT EXISTS idx_cards_client_ref ON cards(client_ref);

      -- Tabla de documentos sincronizados desde SFTP
      CREATE TABLE IF NOT EXISTS adjuntos_clientes (
        id                    SERIAL PRIMARY KEY,
        card_id               UUID REFERENCES cards(id) ON DELETE CASCADE,
        client_id             TEXT NOT NULL,
        nombre_archivo        TEXT NOT NULL,
        tipo                  TEXT NOT NULL,
        ruta_local            TEXT NOT NULL,
        fecha_sincronizacion  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_adjuntos_client_id ON adjuntos_clientes(client_id);
      CREATE INDEX IF NOT EXISTS idx_adjuntos_card_id   ON adjuntos_clientes(card_id);
    `);
    console.log('[migrate-clientref] ✅ Listo.');
  } catch (err) {
    console.error('[migrate-clientref] ❌ Error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
