/**
 * Script de creación inicial de tablas.
 * Ejecutar una sola vez: npx ts-node src/db/setup.ts
 */
import 'dotenv/config';
import { pool } from './index';

async function setup() {
  const client = await pool.connect();
  try {
    console.log('[setup] Creando enums y tablas...');

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE cf_type AS ENUM ('dropdown', 'text', 'number', 'date');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE TYPE role AS ENUM ('admin_tablero', 'ejecutor', 'consulta');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      CREATE TABLE IF NOT EXISTS users (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username      TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        full_name     TEXT NOT NULL,
        email         TEXT NOT NULL,
        is_admin_total BOOLEAN NOT NULL DEFAULT false,
        active        BOOLEAN NOT NULL DEFAULT true,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        id_sap        TEXT
      );

      CREATE TABLE IF NOT EXISTS boards (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name         TEXT NOT NULL,
        prefix       TEXT NOT NULL UNIQUE,
        next_num     INTEGER NOT NULL DEFAULT 1,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sap_config   JSONB,
        sp_auto_import JSONB,
        landing      JSONB
      );

      CREATE TABLE IF NOT EXISTS columns (
        id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        name     TEXT NOT NULL,
        "order"  INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS custom_fields (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        board_id     UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        type         cf_type NOT NULL,
        options      JSONB DEFAULT '[]',
        formula      TEXT,
        formula_days INTEGER
      );

      CREATE TABLE IF NOT EXISTS cards (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        board_id         UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        column_id        UUID NOT NULL REFERENCES columns(id),
        code             TEXT NOT NULL UNIQUE,
        title            TEXT NOT NULL,
        description      TEXT NOT NULL DEFAULT '',
        priority         TEXT NOT NULL DEFAULT '',
        type             TEXT NOT NULL DEFAULT '',
        assignee_id      UUID REFERENCES users(id),
        reporter_id      TEXT NOT NULL DEFAULT '',
        reporter_name    TEXT NOT NULL DEFAULT '',
        custom_data      JSONB DEFAULT '{}',
        assignee_history JSONB DEFAULT '[]',
        move_history     JSONB DEFAULT '[]',
        deleted          BOOLEAN NOT NULL DEFAULT false,
        closed           BOOLEAN NOT NULL DEFAULT false,
        closed_at        TIMESTAMPTZ,
        closed_by        TEXT,
        modified_by      TEXT,
        modified_at      TIMESTAMPTZ,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        num              INTEGER NOT NULL DEFAULT 0,
        sp_external_id   TEXT
      );

      CREATE TABLE IF NOT EXISTS card_files (
        id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id   UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        name      TEXT NOT NULL,
        size      INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        data      TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS comments (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id     UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        author_id   TEXT NOT NULL,
        author_name TEXT NOT NULL,
        text        TEXT NOT NULL,
        modified_by TEXT,
        modified_at TIMESTAMPTZ,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS comment_files (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        size       INTEGER NOT NULL,
        mime_type  TEXT NOT NULL,
        data       TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS global_counter (
        id            INTEGER PRIMARY KEY,
        next_card_num INTEGER NOT NULL DEFAULT 1
      );

      INSERT INTO global_counter(id, next_card_num)
      VALUES (1, 1)
      ON CONFLICT (id) DO NOTHING;

      CREATE TABLE IF NOT EXISTS user_board_roles (
        user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        role     role NOT NULL,
        PRIMARY KEY (user_id, board_id)
      );
    `);

    console.log('[setup] ✅ Tablas creadas correctamente.');

    // Usuario admin inicial (password: admin123 — bcrypt hash)
    const existing = await client.query(`SELECT id FROM users WHERE username = 'admin' LIMIT 1`);
    if (existing.rowCount === 0) {
      // Hash bcrypt de 'admin123' (generado con bcrypt.hash('admin123', 10))
      const adminHash = '$2b$10$AXRI.cWWhIx4iZwq/WjNAOsXG/yc7Re7EWNE2Qo9Oak1jf4L2y.oO';
      await client.query(
        `INSERT INTO users (username, password_hash, full_name, email, is_admin_total)
         VALUES ('admin', $1, 'Administrador', 'admin@allers.com', true)`,
        [adminHash]
      );
      console.log('[setup] ✅ Usuario admin creado (usuario: admin / contraseña: admin123).');
    } else {
      console.log('[setup] ℹ  Usuario admin ya existe, omitido.');
    }

  } catch (err) {
    console.error('[setup] ❌ Error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setup();
