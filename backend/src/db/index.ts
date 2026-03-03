import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Parsear la URL para asegurar que password siempre sea string
// (node-postgres falla con SASL cuando password es undefined)
const rawUrl = process.env.DATABASE_URL ?? 'postgresql://postgres@localhost:5432/allers';
const parsed = new URL(rawUrl);

const pool = new Pool({
  host:     parsed.hostname,
  port:     parseInt(parsed.port || '5432', 10),
  database: parsed.pathname.replace('/', ''),
  user:     parsed.username || 'postgres',
  password: parsed.password || '',   // siempre string, nunca undefined
  // Pool para 50 usuarios concurrentes
  max:                    20,   // 20 conexiones (suficiente para 50 users: cada query ~10-50ms)
  idleTimeoutMillis:      30000, // cerrar conexiones ociosas tras 30s
  connectionTimeoutMillis: 5000, // fallar rápido si el pool está lleno
});

export const db = drizzle(pool, { schema });
export { pool };
