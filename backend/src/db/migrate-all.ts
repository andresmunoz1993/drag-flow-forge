/**
 * migrate-all.ts — Runner consolidado de todas las migraciones.
 * Ejecuta cada migración en orden idempotente (IF NOT EXISTS).
 *
 * USO (primera instalación o actualización):
 *   cd backend
 *   npx ts-node src/db/migrate-all.ts
 *
 * Es SEGURO re-ejecutar — ninguna migración duplicará datos ni borrará nada.
 */
import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  let step = 0;
  try {
    console.log('🚀 [migrate-all] Iniciando migraciones...\n');

    // ── 1. Tablas base (setup) ──────────────────────────────────────────────
    step = 1;
    console.log(`[${step}] Tablas base (users, boards, columns, cards, etc.)...`);
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS users (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username        TEXT NOT NULL UNIQUE,
        password_hash   TEXT NOT NULL,
        full_name       TEXT NOT NULL DEFAULT '',
        email           TEXT,
        is_admin_total  BOOLEAN NOT NULL DEFAULT false,
        active          BOOLEAN NOT NULL DEFAULT true,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        id_sap          TEXT
      );

      CREATE TABLE IF NOT EXISTS global_counter (
        id    SERIAL PRIMARY KEY,
        value INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO global_counter (value) SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM global_counter);

      CREATE TABLE IF NOT EXISTS boards (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        TEXT NOT NULL,
        prefix      TEXT NOT NULL DEFAULT '',
        description TEXT,
        color       TEXT,
        sap_config    JSONB,
        sp_auto_import JSONB,
        landing       JSONB,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS columns (
        id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        name     TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        color    TEXT
      );

      CREATE TABLE IF NOT EXISTS cards (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        column_id   UUID NOT NULL REFERENCES columns(id),
        title       TEXT NOT NULL,
        description TEXT,
        assignee_id UUID REFERENCES users(id),
        reporter_id UUID REFERENCES users(id),
        code        TEXT,
        closed      BOOLEAN NOT NULL DEFAULT false,
        closed_at   TIMESTAMPTZ,
        deleted     BOOLEAN NOT NULL DEFAULT false,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sp_external_id TEXT,
        client_ref     TEXT
      );

      CREATE TABLE IF NOT EXISTS user_board_roles (
        id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        role     TEXT NOT NULL,
        UNIQUE (user_id, board_id)
      );

      CREATE TABLE IF NOT EXISTS custom_fields (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        board_id     UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        type         TEXT NOT NULL DEFAULT 'text',
        options      JSONB,
        formula      TEXT,
        formula_days INTEGER
      );

      CREATE TABLE IF NOT EXISTS card_custom_values (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id        UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        custom_field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
        value          TEXT,
        UNIQUE (card_id, custom_field_id)
      );

      CREATE TABLE IF NOT EXISTS comments (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id    UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        user_id    UUID NOT NULL REFERENCES users(id),
        text       TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        edited     BOOLEAN NOT NULL DEFAULT false
      );

      CREATE TABLE IF NOT EXISTS card_files (
        id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id   UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        name      TEXT NOT NULL,
        size      INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        data      TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS comment_files (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        size       INTEGER NOT NULL,
        mime_type  TEXT NOT NULL,
        data       TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS adjuntos_clientes (
        id                    SERIAL PRIMARY KEY,
        card_id               UUID REFERENCES cards(id) ON DELETE CASCADE,
        client_id             TEXT NOT NULL,
        nombre_archivo        TEXT NOT NULL,
        tipo                  TEXT NOT NULL,
        ruta_local            TEXT NOT NULL,
        fecha_sincronizacion  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log(`   ✅ Tablas base listas.\n`);

    // ── 2. ALTER TABLE: columnas nuevas ───────────────────────────────────────
    step = 2;
    console.log(`[${step}] ALTER TABLE (columnas nuevas si no existen)...`);
    await client.query(`
      ALTER TABLE users         ADD COLUMN IF NOT EXISTS id_sap         TEXT;
      ALTER TABLE boards        ADD COLUMN IF NOT EXISTS sap_config      JSONB;
      ALTER TABLE boards        ADD COLUMN IF NOT EXISTS sp_auto_import  JSONB;
      ALTER TABLE boards        ADD COLUMN IF NOT EXISTS landing         JSONB;
      ALTER TABLE custom_fields ADD COLUMN IF NOT EXISTS formula         TEXT;
      ALTER TABLE custom_fields ADD COLUMN IF NOT EXISTS formula_days    INTEGER;
      ALTER TABLE cards         ADD COLUMN IF NOT EXISTS sp_external_id  TEXT;
      ALTER TABLE cards         ADD COLUMN IF NOT EXISTS client_ref      TEXT;
      ALTER TABLE cards         ADD COLUMN IF NOT EXISTS closed_at       TIMESTAMPTZ;
    `);
    console.log(`   ✅ Columnas verificadas.\n`);

    // ── 3. Tabla card_mentions ────────────────────────────────────────────────
    step = 3;
    console.log(`[${step}] Tabla card_mentions (@menciones)...`);
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
    console.log(`   ✅ Tabla card_mentions lista.\n`);

    // ── 4. Índices de rendimiento ─────────────────────────────────────────────
    step = 4;
    console.log(`[${step}] Índices de rendimiento...`);
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
      CREATE INDEX IF NOT EXISTS idx_card_mentions_card_id     ON card_mentions(card_id);
    `);
    console.log(`   ✅ Índices creados.\n`);

    // ── 5. Usuario admin inicial ──────────────────────────────────────────────
    step = 5;
    console.log(`[${step}] Verificando usuario admin...`);
    const adminCheck = await client.query(`SELECT id FROM users WHERE username = 'admin' LIMIT 1`);
    if (adminCheck.rowCount === 0) {
      // Hash de 'admin123' con bcrypt cost=10
      await client.query(`
        INSERT INTO users (username, password_hash, full_name, email, is_admin_total, active)
        VALUES (
          'admin',
          '$2b$10$YBPGKhk8HZ1g5H/bD3VG5.ULiH4cBFW6tI0EVy3Pd5FEDsKJ3v7P6',
          'Administrador',
          '',
          true,
          true
        )
      `);
      console.log(`   ✅ Usuario admin creado (contraseña: admin123 — cámbiala en Gestión de Usuarios).\n`);
    } else {
      console.log(`   ℹ️  Admin ya existe, omitido.\n`);
    }

    console.log('🎉 [migrate-all] Todas las migraciones completadas exitosamente.\n');
    console.log('📋 Checklist post-migración:');
    console.log('   1. Cambiar la contraseña del admin en la app (Gestión de Usuarios)');
    console.log('   2. Cambiar la contraseña de PostgreSQL en producción');
    console.log('   3. Configurar JWT_SECRET en el .env del servidor');
    console.log('   4. Configurar CORS_ORIGIN con la URL del frontend\n');

  } catch (err) {
    console.error(`\n❌ [migrate-all] Error en paso ${step}:`, err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
