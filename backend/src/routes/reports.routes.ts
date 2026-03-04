/**
 * reports.routes.ts — Endpoint para listar y ejecutar reportes basados en
 * funciones/stored procedures de PostgreSQL.
 *
 * GET  /api/reports          → lista las definiciones de reportes disponibles
 * POST /api/reports/:id/run  → ejecuta el SP del reporte con los parámetros enviados
 *                              y devuelve las filas como JSON
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/index';
import { REPORTS } from '../config/reports.config';

const router = Router();

// GET /api/reports — lista los reportes disponibles (metadatos, sin ejecutar)
router.get('/', (_req: Request, res: Response) => {
  // Devuelve la definición pública (sin exponer el spName al cliente)
  const publicReports = REPORTS.map(r => ({
    id:          r.id,
    name:        r.name,
    description: r.description,
    params:      r.params,
  }));
  return res.json(publicReports);
});

// POST /api/reports/:id/run — ejecuta el reporte con los parámetros dados
router.post('/:id/run', async (req: Request, res: Response) => {
  const reportId = String(req.params.id);
  const report = REPORTS.find(r => r.id === reportId);
  if (!report) return res.status(404).json({ error: 'Reporte no encontrado.' });

  // Construir array de valores de parámetros en el orden definido en el config
  const values: (string | number | null)[] = report.params.map(p => {
    const val = req.body[p.name];
    if (val === undefined || val === '' || val === null) return null;
    return String(val);
  });

  // Construir placeholders: $1, $2, ...
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  const sql = values.length > 0
    ? `SELECT * FROM ${report.spName}(${placeholders})`
    : `SELECT * FROM ${report.spName}()`;

  try {
    const result = await pool.query(sql, values);
    return res.json({
      columns: result.fields.map(f => f.name),
      rows:    result.rows,
      total:   result.rowCount ?? 0,
    });
  } catch (err: any) {
    const detail = process.env.NODE_ENV !== 'production' ? err.message : undefined;
    return res.status(500).json({ error: `Error al ejecutar el reporte "${report.name}".`, detail });
  }
});

export default router;
