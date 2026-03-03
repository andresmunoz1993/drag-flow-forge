/**
 * sp.service.ts
 * Servicio para obtener registros desde un Stored Procedure (SP) de SQL Server.
 *
 * ESTADO ACTUAL: STUB — devuelve array vacío hasta que el SP esté listo.
 *
 * Para activar la conexión real:
 *   1. Instalar el driver:  npm install mssql && npm install -D @types/mssql
 *   2. Descomentar el bloque "IMPLEMENTACIÓN REAL" y comentar el bloque "STUB".
 *   3. Configurar las variables de entorno SP_DB_* en el archivo .env.
 */

// ─── Tipo de registro que devuelve el SP ──────────────────────────────────────

/**
 * Cada registro devuelto por el SP representa un caso a crear en el tablero.
 * El campo `externalId` es clave: identifica de forma única al registro en el
 * sistema origen para evitar importaciones duplicadas.
 */
export interface SpCaseRecord {
  /** ID único del registro en el sistema origen (evita duplicados) */
  externalId: string;
  /** Título del caso */
  title: string;
  /** Descripción opcional */
  description?: string;
  /**
   * Datos extra para mapear a los campos personalizados del tablero.
   * La clave debe coincidir con el NOMBRE del campo personalizado en el tablero.
   * Ejemplo: { "Categoría": "Soporte", "Región": "Bogotá" }
   */
  customData?: Record<string, string>;
}

// ─── Configuración de conexión al SP ─────────────────────────────────────────

export interface SpFetchConfig {
  /** Nombre del stored procedure a ejecutar */
  spName: string;
  /** ID del tablero (puede usarse como parámetro al SP) */
  boardId: string;
  /** Servidor SQL Server (de env SP_DB_SERVER) */
  server?: string;
  /** Base de datos (de env SP_DB_DATABASE) */
  database?: string;
  /** Usuario SQL (de env SP_DB_USER) */
  dbUser?: string;
  /** Contraseña SQL (de env SP_DB_PASSWORD) */
  dbPassword?: string;
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Llama al SP configurado y devuelve los registros mapeados.
 * El frontend se encarga de filtrar duplicados y crear los casos.
 */
export async function fetchSpRecords(config: SpFetchConfig): Promise<SpCaseRecord[]> {

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  STUB: El SP aún no está listo. Se devuelve array vacío.               ║
  // ║  Remover este bloque cuando el SP esté disponible.                     ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  console.log(`[SpService] STUB — boardId=${config.boardId}, sp=${config.spName}. Sin datos reales.`);
  return [];

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  IMPLEMENTACIÓN REAL — descomentar cuando el SP esté listo             ║
  // ╠══════════════════════════════════════════════════════════════════════════╣
  //
  // import sql from 'mssql';
  //
  // const poolConfig: sql.config = {
  //   server: config.server!,
  //   database: config.database!,
  //   user: config.dbUser!,
  //   password: config.dbPassword!,
  //   options: {
  //     encrypt: true,
  //     trustServerCertificate: true,
  //   },
  //   connectionTimeout: 15000,
  //   requestTimeout: 30000,
  // };
  //
  // let pool: sql.ConnectionPool | null = null;
  // try {
  //   pool = await sql.connect(poolConfig);
  //   const result = await pool.request()
  //     .input('BoardId', sql.VarChar(50), config.boardId)
  //     .execute(config.spName);
  //
  //   // ── Mapear columnas del SP a SpCaseRecord ──────────────────────────────
  //   // Ajustar los nombres de columna según lo que devuelva el SP real.
  //   return result.recordset.map((row: Record<string, unknown>) => ({
  //     externalId: String(row['ExternalId'] ?? row['Id'] ?? ''),
  //     title: String(row['Title'] ?? row['Titulo'] ?? ''),
  //     description: row['Description'] != null ? String(row['Description']) : undefined,
  //     customData: {
  //       // Ejemplo de mapeo de columnas del SP a nombres de campos del tablero:
  //       // 'Categoría': String(row['Categoria'] ?? ''),
  //       // 'Región': String(row['Region'] ?? ''),
  //       // Agregar aquí todos los campos personalizados relevantes.
  //     },
  //   }));
  // } finally {
  //   if (pool) await pool.close();
  // }
  //
  // ╚══════════════════════════════════════════════════════════════════════════╝
}
