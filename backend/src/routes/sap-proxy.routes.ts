/**
 * sap-proxy.routes.ts
 *
 * Proxy backend para SAP Business One Service Layer.
 * Elimina la necesidad de exponer credenciales SAP al navegador.
 *
 * POST /api/sap/search  — busca un documento en SAP usando la config del tablero
 */
import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { boards } from '../db/schema';
import type { SapConfig, SapOrderResult } from '../types/sap';

const router = Router();

// ── POST /api/sap/search ───────────────────────────────────────────────────────
router.post('/search', async (req: Request, res: Response) => {
  const { boardId, docNumber } = req.body;

  if (!boardId || typeof boardId !== 'string')
    return res.status(400).json({ error: 'boardId requerido.' });
  if (!docNumber || typeof docNumber !== 'string' || docNumber.trim().length === 0)
    return res.status(400).json({ error: 'docNumber requerido.' });

  // Obtener configuración SAP del tablero
  const [board] = await db.select({ sapConfig: boards.sapConfig }).from(boards).where(eq(boards.id, boardId));
  if (!board) return res.status(404).json({ error: 'Tablero no encontrado.' });

  const config = board.sapConfig as SapConfig | null;
  if (!config?.baseUrl || !config.companyDB || !config.username || !config.password || !config.queryName)
    return res.status(400).json({ error: 'El tablero no tiene integración SAP configurada.' });

  const base = config.baseUrl.replace(/\/$/, '');
  let sessionCookie = '';

  try {
    // ── 1. Login ──────────────────────────────────────────────────────────────
    const loginRes = await fetch(`${base}/b1s/v1/Login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        CompanyDB: config.companyDB,
        UserName:  config.username,
        Password:  config.password,
      }),
    });

    if (!loginRes.ok) {
      const body = await loginRes.json().catch(() => ({}));
      const msg = (body as any)?.error?.message?.value || `Error ${loginRes.status}`;
      return res.status(502).json({ error: `No se pudo autenticar en SAP: ${msg}` });
    }

    // Extraer cookie de sesión para los siguientes requests
    sessionCookie = loginRes.headers.get('set-cookie') ?? '';

    // ── 2. Consultar xSQL query ────────────────────────────────────────────────
    const url =
      `${base}/b1s/v1/SQLQueries('${encodeURIComponent(config.queryName)}')/List` +
      `?$filter=DocNum eq '${encodeURIComponent(docNumber.trim())}'`;

    const queryRes = await fetch(url, {
      method: 'GET',
      headers: sessionCookie ? { Cookie: sessionCookie } : {},
    });

    if (!queryRes.ok) {
      const body = await queryRes.json().catch(() => ({}));
      const msg = (body as any)?.error?.message?.value || `Error ${queryRes.status}`;
      return res.status(502).json({ error: `Error al consultar SAP: ${msg}` });
    }

    const data = await queryRes.json();
    const rows: Record<string, unknown>[] = (data as any)?.value ?? [];

    if (rows.length === 0) {
      return res.status(404).json({
        error: `No se encontró el documento "${docNumber}" en SAP. Verifique el número e intente de nuevo.`,
      });
    }

    const row = rows[0];
    const result: SapOrderResult = {
      docNum:          String(row.DocNum          ?? row.docnum          ?? docNumber),
      itemCount:       Number(row.ItemCount        ?? row.LineCount       ?? row.itemcount  ?? 0),
      totalValue:      Number(row.TotalValue       ?? row.DocTotal        ?? row.totalvalue ?? 0),
      currency:        String(row.DocCurrency      ?? row.Currency        ?? row.currency   ?? 'COP'),
      salesPersonCode: String(row.SalesPersonCode  ?? row.SlpCode         ?? row.salespersoncode ?? ''),
      salesPersonName: String(row.SalesPersonName  ?? row.SlpName         ?? row.salespersonname ?? ''),
    };

    return res.json(result);

  } catch (err: any) {
    if (err?.cause?.code === 'ECONNREFUSED' || err?.cause?.code === 'ENOTFOUND') {
      return res.status(502).json({ error: 'No se pudo conectar al servidor SAP. Verifique la URL y la red.' });
    }
    console.error('[SapProxy] Error:', err?.message ?? err);
    return res.status(500).json({ error: 'Error interno al consultar SAP.' });
  } finally {
    // ── 3. Logout (best-effort, asíncrono) ────────────────────────────────────
    if (sessionCookie) {
      fetch(`${base}/b1s/v1/Logout`, {
        method: 'POST',
        headers: { Cookie: sessionCookie },
      }).catch(() => {});
    }
  }
});

export default router;
