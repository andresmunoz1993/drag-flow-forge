/**
 * migrate-mentions.ts — one-shot migration para la tabla card_mentions.
 * Ejecutar una sola vez: npx ts-node backend/src/db/migrate-mentions.ts
 */
import { pool } from './index';

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS card_mentions (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id             UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        mentioned_by_id     TEXT NOT NULL DEFAULT '',
        mentioned_by_name   TEXT NOT NULL DEFAULT '',
        first_mentioned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        context             TEXT NOT NULL DEFAULT 'description',
        UNIQUE (card_id, user_id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_card_mentions_card_id ON card_mentions(card_id);
    `);
    console.log('[migrate-mentions] ✅ Tabla card_mentions lista.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error('[migrate-mentions] ❌', err); process.exit(1); });
