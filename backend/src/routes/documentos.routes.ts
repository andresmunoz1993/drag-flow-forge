import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { pool } from '../db/index';
import { runSftpSync } from '../services/sftp-sync.service';

const router = Router();

// GET /api/documentos/card/:cardId — documentos vinculados a un caso
router.get('/card/:cardId', async (req: Request, res: Response) => {
  try {
    const { cardId } = req.params;
    const result = await pool.query(
      `SELECT id, card_id, client_id, nombre_archivo, tipo, ruta_local, fecha_sincronizacion
       FROM adjuntos_clientes
       WHERE card_id = $1
       ORDER BY tipo, nombre_archivo`,
      [cardId]
    );
    return res.json(result.rows.map(r => ({
      id:                   r.id,
      cardId:               r.card_id,
      clientId:             r.client_id,
      nombreArchivo:        r.nombre_archivo,
      tipo:                 r.tipo,
      rutaLocal:            r.ruta_local,
      fechaSincronizacion:  r.fecha_sincronizacion,
    })));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/documentos/file/:id — stream del PDF con JWT (Authorization header)
router.get('/file/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const result = await pool.query(
      'SELECT nombre_archivo, ruta_local FROM adjuntos_clientes WHERE id = $1',
      [parseInt(id, 10)]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Archivo no encontrado.' });

    const { nombre_archivo, ruta_local } = result.rows[0];
    if (!fs.existsSync(ruta_local)) {
      return res.status(404).json({ error: 'Archivo no disponible en disco.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nombre_archivo}"`);
    fs.createReadStream(ruta_local).pipe(res);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/documentos/sync — dispara sincronización manual desde SFTP
router.post('/sync', async (_req: Request, res: Response) => {
  try {
    const result = await runSftpSync();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
