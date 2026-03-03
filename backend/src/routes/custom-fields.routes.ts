import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { customFields } from '../db/schema';

const router = Router();

// GET /api/custom-fields  (opcionalmente ?boardId=X)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { boardId } = req.query;
    const rows = boardId
      ? await db.select().from(customFields).where(eq(customFields.boardId, String(boardId)))
      : await db.select().from(customFields);

    return res.json(rows.map(f => ({
      id:          f.id,
      boardId:     f.boardId,
      name:        f.name,
      type:        f.type,
      options:     (f.options as string[]) ?? [],
      formula:     f.formula ?? undefined,
      formulaDays: f.formulaDays ?? undefined,
    })));
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al obtener campos personalizados.', detail: err.message });
  }
});

// POST /api/custom-fields
router.post('/', async (req: Request, res: Response) => {
  const { boardId, name, type, options, formula, formulaDays } = req.body;
  if (!boardId || !name || !type) {
    return res.status(400).json({ error: 'boardId, name y type son requeridos.' });
  }
  try {
    const [newField] = await db.insert(customFields).values({
      boardId,
      name,
      type,
      options:     options ?? [],
      formula:     formula ?? null,
      formulaDays: formulaDays ?? null,
    }).returning();

    return res.status(201).json({
      id:          newField.id,
      boardId:     newField.boardId,
      name:        newField.name,
      type:        newField.type,
      options:     (newField.options as string[]) ?? [],
      formula:     newField.formula ?? undefined,
      formulaDays: newField.formulaDays ?? undefined,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al crear campo personalizado.', detail: err.message });
  }
});

// PUT /api/custom-fields/:id
router.put('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { name, type, options, formula, formulaDays } = req.body;
  try {
    const upd: Partial<typeof customFields.$inferInsert> = {};
    if (name        !== undefined) upd.name        = name;
    if (type        !== undefined) upd.type        = type;
    if (options     !== undefined) upd.options     = options;
    if (formula     !== undefined) upd.formula     = formula ?? null;
    if (formulaDays !== undefined) upd.formulaDays = formulaDays ?? null;

    const [updated] = await db.update(customFields).set(upd).where(eq(customFields.id, id)).returning();
    if (!updated) return res.status(404).json({ error: 'Campo no encontrado.' });

    return res.json({
      id:          updated.id,
      boardId:     updated.boardId,
      name:        updated.name,
      type:        updated.type,
      options:     (updated.options as string[]) ?? [],
      formula:     updated.formula ?? undefined,
      formulaDays: updated.formulaDays ?? undefined,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al actualizar campo personalizado.', detail: err.message });
  }
});

// DELETE /api/custom-fields/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    await db.delete(customFields).where(eq(customFields.id, id));
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al eliminar campo personalizado.', detail: err.message });
  }
});

export default router;
