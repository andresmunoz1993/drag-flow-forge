/**
 * Migración de índices para rendimiento a escala.
 * Ejecutar una sola vez: npx ts-node src/db/migrate-indexes.ts
 */
import 'dotenv/config';
import { pool } from './index';

async function migrateIndexes() {
  const client = await pool.connect();
  try {
    console.log('[migrate-indexes] Creando índices...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cards_board_id           ON cards(board_id);
      CREATE INDEX IF NOT EXISTS idx_cards_column_id          ON cards(column_id);
      CREATE INDEX IF NOT EXISTS idx_cards_board_deleted       ON cards(board_id, deleted);
      CREATE INDEX IF NOT EXISTS idx_cards_modified_at         ON cards(board_id, modified_at DESC) WHERE deleted = false;
      CREATE INDEX IF NOT EXISTS idx_cards_sp_external_id      ON cards(sp_external_id) WHERE sp_external_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_cards_client_ref          ON cards(client_ref) WHERE client_ref IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_card_files_card_id        ON card_files(card_id);
      CREATE INDEX IF NOT EXISTS idx_comments_card_id          ON comments(card_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_comment_files_comment_id  ON comment_files(comment_id);
      CREATE INDEX IF NOT EXISTS idx_columns_board_id          ON columns(board_id);
      CREATE INDEX IF NOT EXISTS idx_custom_fields_board_id    ON custom_fields(board_id);
      CREATE INDEX IF NOT EXISTS idx_ubr_user_id               ON user_board_roles(user_id);
      CREATE INDEX IF NOT EXISTS idx_ubr_board_id              ON user_board_roles(board_id);
      CREATE INDEX IF NOT EXISTS idx_adjuntos_client_id        ON adjuntos_clientes(client_id);
      CREATE INDEX IF NOT EXISTS idx_adjuntos_card_id          ON adjuntos_clientes(card_id);
    `);
    console.log('[migrate-indexes] ✅ Índices creados correctamente.');
  } catch (err) {
    console.error('[migrate-indexes] ❌ Error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateIndexes();
