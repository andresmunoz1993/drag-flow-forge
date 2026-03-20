import { Router, Request, Response } from 'express';
import { eq, asc, inArray } from 'drizzle-orm';
import { db, pool } from '../db/index';
import { boards, columns, customFields, cards, userBoardRoles } from '../db/schema';

const router = Router();

/** Elimina la contraseña SAP del objeto de config antes de enviarlo al cliente */
function stripSapPassword(sap: unknown): unknown {
  if (!sap || typeof sap !== 'object') return sap;
  const { password: _pw, ...rest } = sap as Record<string, unknown>;
  return { ...rest, password: '' };
}

// Serializa un board con sus columns y customFields
async function serializeBoard(board: typeof boards.$inferSelect) {
  const cols = await db.select().from(columns)
    .where(eq(columns.boardId, board.id))
    .orderBy(asc(columns.order));

  const fields = await db.select().from(customFields)
    .where(eq(customFields.boardId, board.id));

  return {
    id:           board.id,
    name:         board.name,
    prefix:       board.prefix,
    nextNum:      board.nextNum,
    createdAt:    board.createdAt,
    sap:          board.sapConfig ? stripSapPassword(board.sapConfig) : undefined,
    spAutoImport: board.spAutoImport ?? undefined,
    landing:      board.landing ?? undefined,
    columns: cols.map(c => ({
      id:               c.id,
      boardId:          c.boardId,
      name:             c.name,
      order:            c.order,
      defaultAssigneeId: c.defaultAssigneeId ?? null,
      maxHours:         c.maxHours ?? null,
    })),
    customFields: fields.map(f => ({
      id:          f.id,
      boardId:     f.boardId,
      name:        f.name,
      type:        f.type,
      options:     (f.options as string[]) ?? [],
      formula:     f.formula ?? undefined,
      formulaDays: f.formulaDays ?? undefined,
    })),
  };
}

// GET /api/boards — batch load columns + customFields (3 queries instead of N+1)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const allBoards = await db.select().from(boards).orderBy(asc(boards.createdAt));
    if (!allBoards.length) return res.json([]);

    const boardIds = allBoards.map(b => b.id);

    // Batch load columns + customFields (2 queries)
    const allCols = await db.select().from(columns)
      .where(inArray(columns.boardId, boardIds))
      .orderBy(asc(columns.order));
    const allFields = await db.select().from(customFields)
      .where(inArray(customFields.boardId, boardIds));

    const colsMap = new Map<string, typeof allCols>();
    for (const c of allCols) {
      if (!colsMap.has(c.boardId)) colsMap.set(c.boardId, []);
      colsMap.get(c.boardId)!.push(c);
    }
    const fieldsMap = new Map<string, typeof allFields>();
    for (const f of allFields) {
      if (!fieldsMap.has(f.boardId)) fieldsMap.set(f.boardId, []);
      fieldsMap.get(f.boardId)!.push(f);
    }

    const result = allBoards.map(board => ({
      id:           board.id,
      name:         board.name,
      prefix:       board.prefix,
      nextNum:      board.nextNum,
      createdAt:    board.createdAt,
      sap:          board.sapConfig ? stripSapPassword(board.sapConfig) : undefined,
      spAutoImport: board.spAutoImport ?? undefined,
      landing:      board.landing ?? undefined,
      columns: (colsMap.get(board.id) || []).map(c => ({
        id: c.id, boardId: c.boardId, name: c.name, order: c.order,
        defaultAssigneeId: c.defaultAssigneeId ?? null,
        maxHours: c.maxHours ?? null,
      })),
      customFields: (fieldsMap.get(board.id) || []).map(f => ({
        id: f.id, boardId: f.boardId, name: f.name, type: f.type,
        options: (f.options as string[]) ?? [],
        formula: f.formula ?? undefined,
        formulaDays: f.formulaDays ?? undefined,
      })),
    }));

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al obtener tableros.', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) });
  }
});

// POST /api/boards
router.post('/', async (req: Request, res: Response) => {
  const { name, prefix } = req.body;
  if (!name || !prefix) return res.status(400).json({ error: 'name y prefix son requeridos.' });
  try {
    const [newBoard] = await db.insert(boards).values({ name, prefix: prefix.toUpperCase(), nextNum: 1 }).returning();
    return res.status(201).json(await serializeBoard(newBoard));
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al crear tablero.', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) });
  }
});

const isUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

// PUT /api/boards/:id
router.put('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!isUUID(id)) return res.status(400).json({ error: 'id de tablero inválido.' });

  const { name, prefix, nextNum, sap, spAutoImport, landing } = req.body;
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0 || name.length > 200))
    return res.status(400).json({ error: 'name debe ser un texto no vacío (máx 200 caracteres).' });
  if (prefix !== undefined && (typeof prefix !== 'string' || prefix.trim().length === 0 || prefix.length > 20))
    return res.status(400).json({ error: 'prefix debe ser un texto no vacío (máx 20 caracteres).' });

  try {
    const upd: Partial<typeof boards.$inferInsert> = {};
    if (name          !== undefined) upd.name         = name;
    if (prefix        !== undefined) upd.prefix        = prefix.toUpperCase();
    if (nextNum       !== undefined) upd.nextNum       = nextNum;
    if (spAutoImport  !== undefined) upd.spAutoImport  = spAutoImport ?? null;
    if (landing       !== undefined) upd.landing       = landing ?? null;

    if (sap !== undefined) {
      if (sap === null) {
        upd.sapConfig = null; // desactivar SAP
      } else {
        // Si la contraseña llega vacía, conservar la que ya está en DB
        let finalSap = { ...sap };
        if (!finalSap.password) {
          const [existing] = await db.select({ sapConfig: boards.sapConfig }).from(boards).where(eq(boards.id, id));
          finalSap.password = (existing?.sapConfig as any)?.password ?? '';
        }
        upd.sapConfig = finalSap;
      }
    }

    const [updated] = await db.update(boards).set(upd).where(eq(boards.id, id)).returning();
    if (!updated) return res.status(404).json({ error: 'Tablero no encontrado.' });
    return res.json(await serializeBoard(updated));
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al actualizar tablero.', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) });
  }
});

// DELETE /api/boards/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_board_roles WHERE board_id = $1', [id]);
    await client.query('DELETE FROM boards WHERE id = $1', [id]); // CASCADE elimina columns, cards, etc.
    await client.query('COMMIT');
    return res.json({ ok: true });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Error al eliminar tablero.', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) });
  } finally {
    client.release();
  }
});

// PUT /api/boards/:id/columns  — reemplaza array completo de columns (atómico)
router.put('/:id/columns', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { columns: colsInput } = req.body as { columns: Array<{ id?: string; name: string; order: number; defaultAssigneeId?: string | null; maxHours?: number | null }> };
  if (!Array.isArray(colsInput)) return res.status(400).json({ error: 'columns array requerido.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Obtener columnas existentes
    const existingRes = await client.query('SELECT id FROM columns WHERE board_id = $1', [id]);
    const existingIds = new Set(existingRes.rows.map((r: any) => r.id));
    const incomingIds = new Set(colsInput.filter(c => c.id).map(c => c.id!));

    // Eliminar las que ya no están
    for (const row of existingRes.rows) {
      if (!incomingIds.has(row.id)) {
        await client.query('DELETE FROM columns WHERE id = $1', [row.id]);
      }
    }

    // Insertar o actualizar
    const result = [];
    for (const col of colsInput) {
      const defAssigneeId = col.defaultAssigneeId || null;
      const maxHours = (col.maxHours != null && col.maxHours > 0) ? col.maxHours : null;
      if (col.id && existingIds.has(col.id)) {
        const updRes = await client.query(
          'UPDATE columns SET name = $1, "order" = $2, default_assignee_id = $3, max_hours = $4 WHERE id = $5 RETURNING *',
          [col.name, col.order, defAssigneeId, maxHours, col.id]
        );
        result.push(updRes.rows[0]);
      } else {
        const insRes = await client.query(
          'INSERT INTO columns (id, board_id, name, "order", default_assignee_id, max_hours) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING *',
          [id, col.name, col.order, defAssigneeId, maxHours]
        );
        result.push(insRes.rows[0]);
      }
    }

    await client.query('COMMIT');
    // Mapear a camelCase para que coincida con la interfaz Column del frontend
    return res.json(result.map((row: any) => ({
      id:               row.id,
      boardId:          row.board_id,
      name:             row.name,
      order:            row.order,
      defaultAssigneeId: row.default_assignee_id ?? null,
      maxHours:         row.max_hours ?? null,
    })));
  } catch (err: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Error al guardar carriles.', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) });
  } finally {
    client.release();
  }
});

export default router;
