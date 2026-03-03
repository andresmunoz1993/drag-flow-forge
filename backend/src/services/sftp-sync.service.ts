/**
 * Servicio de sincronización SFTP.
 * Descarga PDFs desde el servidor Windows, los registra en PostgreSQL
 * y los vincula al caso correspondiente por client_ref.
 *
 * Patrón de nombre esperado: [CODIGO]_[TIPO].PDF  (ej: CN13718_Cedula.PDF)
 */
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import SftpClient from 'ssh2-sftp-client';
import { pool } from '../db/index';

// ── Config desde .env ──────────────────────────────────────────────────────────
const SFTP_HOST           = process.env.SFTP_HOST           ?? '';
const SFTP_PORT           = parseInt(process.env.SFTP_PORT  ?? '22', 10);
const SFTP_USER           = process.env.SFTP_USER           ?? '';
const SFTP_PASSWORD       = process.env.SFTP_PASSWORD       ?? '';
const SFTP_REMOTE_PATH    = process.env.SFTP_REMOTE_PATH    ?? '/pdfs';
const SFTP_PROCESSED_PATH = process.env.SFTP_PROCESSED_PATH ?? '/pdfs/procesados';
const LOCAL_STORAGE       = process.env.PDF_STORAGE_PATH    ?? path.join(__dirname, '../../storage/pdfs');

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface SyncResult {
  total:      number;
  imported:   number;
  skipped:    number;
  errors:     string[];
}

// ── Parseo del nombre de archivo ───────────────────────────────────────────────
function parseFilename(filename: string): { clientId: string; tipo: string } | null {
  // Espera: [CODIGO]_[TIPO].PDF  (case-insensitive en extensión)
  const match = filename.match(/^([^_]+)_(.+)\.[Pp][Dd][Ff]$/);
  if (!match) return null;
  return { clientId: match[1], tipo: match[2] };
}

// ── Función principal ─────────────────────────────────────────────────────────
export async function runSftpSync(): Promise<SyncResult> {
  if (!SFTP_HOST || !SFTP_USER) {
    throw new Error('SFTP no configurado. Revisa SFTP_HOST, SFTP_USER y SFTP_PASSWORD en .env');
  }

  // Asegurar que existe el directorio local
  fs.mkdirSync(LOCAL_STORAGE, { recursive: true });

  const sftp   = new SftpClient();
  const result: SyncResult = { total: 0, imported: 0, skipped: 0, errors: [] };

  try {
    await sftp.connect({
      host:     SFTP_HOST,
      port:     SFTP_PORT,
      username: SFTP_USER,
      password: SFTP_PASSWORD,
    });

    // Listar archivos .pdf en el directorio remoto
    const fileList = await sftp.list(SFTP_REMOTE_PATH);
    const pdfs = fileList.filter(f => f.type === '-' && /\.[Pp][Dd][Ff]$/.test(f.name));

    result.total = pdfs.length;

    for (const file of pdfs) {
      const parsed = parseFilename(file.name);
      if (!parsed) {
        result.errors.push(`Nombre inválido (no sigue patrón CODIGO_TIPO.PDF): ${file.name}`);
        result.skipped++;
        continue;
      }

      const { clientId, tipo } = parsed;
      const remotePath = `${SFTP_REMOTE_PATH}/${file.name}`;
      const localPath  = path.join(LOCAL_STORAGE, file.name);

      // Verificar si ya fue importado (evitar duplicados)
      const existing = await pool.query(
        'SELECT id FROM adjuntos_clientes WHERE nombre_archivo = $1 LIMIT 1',
        [file.name]
      );
      if (existing.rowCount! > 0) {
        result.skipped++;
        continue;
      }

      try {
        // Descargar archivo
        await sftp.fastGet(remotePath, localPath);

        // Buscar la card vinculada por client_ref
        const cardRes = await pool.query(
          'SELECT id FROM cards WHERE client_ref = $1 AND deleted = false LIMIT 1',
          [clientId]
        );
        const cardId = cardRes.rows[0]?.id ?? null;

        // Registrar en BD
        await pool.query(
          `INSERT INTO adjuntos_clientes (card_id, client_id, nombre_archivo, tipo, ruta_local)
           VALUES ($1, $2, $3, $4, $5)`,
          [cardId, clientId, file.name, tipo, localPath]
        );

        // Mover a /procesados en el servidor remoto para no reimportar
        try {
          await sftp.mkdir(SFTP_PROCESSED_PATH, true);
          await sftp.rename(remotePath, `${SFTP_PROCESSED_PATH}/${file.name}`);
        } catch {
          // No es crítico si falla el movimiento — el registro en BD evita duplicados
        }

        result.imported++;
      } catch (err: any) {
        result.errors.push(`Error procesando ${file.name}: ${err.message}`);
        result.skipped++;
      }
    }
  } finally {
    await sftp.end().catch(() => {});
  }

  return result;
}
