import { Router, Request, Response } from "express";
import { fetchSpRecords } from "../services/sp.service";

const router = Router();

/**
 * GET /api/sp/fetch
 * Parámetros de query: boardId (string), spName (string)
 *
 * Llama al SP configurado y devuelve los registros listos para crear casos.
 * El frontend filtra duplicados por `externalId` antes de crear las tarjetas.
 */
router.get("/fetch", async (req: Request, res: Response) => {
  const { boardId, spName } = req.query as {
    boardId?: string;
    spName?: string;
  };

  if (!boardId || !spName) {
    res.status(400).json({
      error: "Los parámetros 'boardId' y 'spName' son requeridos.",
    });
    return;
  }

  try {
    const records = await fetchSpRecords({
      spName,
      boardId,
      server: process.env.SP_DB_SERVER,
      database: process.env.SP_DB_DATABASE,
      dbUser: process.env.SP_DB_USER,
      dbPassword: process.env.SP_DB_PASSWORD,
    });

    res.json({ records, count: records.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("[SpRoute] Error al ejecutar SP:", message);
    res.status(500).json({
      error: "Error al obtener registros del SP.",
      detail: message,
    });
  }
});

/**
 * GET /api/sp/health
 * Verifica que la ruta está activa y muestra el modo actual (stub/real).
 */
router.get("/health", (_req: Request, res: Response) => {
  const isConfigured =
    !!process.env.SP_DB_SERVER &&
    !!process.env.SP_DB_DATABASE &&
    !!process.env.SP_DB_USER;

  res.json({
    status: "ok",
    mode: isConfigured ? "configured" : "stub",
    server: process.env.SP_DB_SERVER ?? "not set",
    database: process.env.SP_DB_DATABASE ?? "not set",
  });
});

export default router;
