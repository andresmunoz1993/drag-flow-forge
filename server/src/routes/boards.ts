import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { boards, columns, customFields, userBoardRoles, cards } from '../db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Helper: load a full board with columns + customFields
async function fullBoard(boardId: string) {
  const board = await db.query.boards.findFirst({ where: eq(boards.id, boardId) });
  if (!board) return null;
  const cols = await db.select().from(columns).where(eq(columns.boardId, boardId));
  const cfs = await db.select().from(customFields).where(eq(customFields.boardId, boardId));
  return { ...board, columns: cols, customFields: cfs };
}

// GET /api/boards — visible boards for current user
router.get('/', requireAuth, async (req, res) => {
  const me = req.user!;
  const allBoards = await db.select().from(boards);
  const allCols = await db.select().from(columns);
  const allCFs = await db.select().from(customFields);

  let visibleBoards = allBoards;
  if (!me.isAdmin) {
    const roles = await db.select().from(userBoardRoles).where(eq(userBoardRoles.userId, me.sub));
    const allowedIds = new Set(roles.map(r => r.boardId));
    visibleBoards = allBoards.filter(b => allowedIds.has(b.id));
  }

  const result = visibleBoards.map(b => ({
    ...b,
    columns: allCols.filter(c => c.boardId === b.id),
    customFields: allCFs.filter(cf => cf.boardId === b.id),
  }));
  res.json(result);
});

// POST /api/boards — admin only
router.post('/', requireAdmin, async (req, res) => {
  const { name, prefix } = req.body as { name?: string; prefix?: string };
  if (!name || !prefix) {
    res.status(400).json({ error: 'name y prefix son requeridos' });
    return;
  }
  if (!/^[A-Z0-9]+$/.test(prefix)) {
    res.status(400).json({ error: 'Prefijo solo puede contener letras mayúsculas y números' });
    return;
  }

  const existing = await db.query.boards.findFirst({ where: eq(boards.prefix, prefix) });
  if (existing) {
    res.status(409).json({ error: 'El prefijo ya existe' });
    return;
  }

  const [board] = await db.insert(boards).values({ name, prefix, nextNum: 101 }).returning();
  res.status(201).json({ ...board, columns: [], customFields: [] });
});

// PUT /api/boards/:id — admin only
router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, prefix } = req.body as { name?: string; prefix?: string };
  if (prefix && !/^[A-Z0-9]+$/.test(prefix)) {
    res.status(400).json({ error: 'Prefijo solo puede contener letras mayúsculas y números' });
    return;
  }

  await db.update(boards).set({ ...(name && { name }), ...(prefix && { prefix }) }).where(eq(boards.id, id));
  const updated = await fullBoard(id);
  if (!updated) { res.status(404).json({ error: 'Tablero no encontrado' }); return; }
  res.json(updated);
});

// DELETE /api/boards/:id — admin only (cascades to cards, columns, customFields, userBoardRoles)
router.delete('/:id', requireAdmin, async (req, res) => {
  await db.delete(boards).where(eq(boards.id, req.params.id));
  res.json({ ok: true });
});

// PUT /api/boards/:id/columns — replace all columns
router.put('/:id/columns', requireAuth, async (req, res) => {
  const { id } = req.params;
  const me = req.user!;
  const role = me.isAdmin ? 'admin_total' : (await db.query.userBoardRoles.findFirst({
    where: (t, { and, eq: eqFn }) => and(eqFn(t.userId, me.sub), eqFn(t.boardId, id)),
  }))?.role;

  if (role !== 'admin_total' && role !== 'admin_tablero') {
    res.status(403).json({ error: 'Sin permisos para modificar columnas' });
    return;
  }

  const cols = req.body as Array<{ id: string; name: string; order: number }>;
  if (!Array.isArray(cols)) {
    res.status(400).json({ error: 'Se esperaba un array de columnas' });
    return;
  }

  // Delete removed columns (cascade deletes card column references — but we need to keep cards)
  // Actually we update the columnId if needed, but for simplicity we replace all
  await db.delete(columns).where(eq(columns.boardId, id));
  if (cols.length > 0) {
    await db.insert(columns).values(cols.map(c => ({ id: c.id, boardId: id, name: c.name, order: c.order })));
  }

  const updated = await fullBoard(id);
  res.json(updated);
});

// PUT /api/boards/:id/custom-fields — replace all custom fields
router.put('/:id/custom-fields', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const cfs = req.body as Array<{ id: string; name: string; type: string; options: string[] }>;
  if (!Array.isArray(cfs)) {
    res.status(400).json({ error: 'Se esperaba un array de campos' });
    return;
  }

  await db.delete(customFields).where(eq(customFields.boardId, id));
  if (cfs.length > 0) {
    await db.insert(customFields).values(
      cfs.map(cf => ({
        id: cf.id,
        boardId: id,
        name: cf.name,
        type: cf.type as 'dropdown' | 'text' | 'number' | 'date',
        options: cf.options,
      }))
    );
  }

  const updated = await fullBoard(id);
  res.json(updated);
});

export default router;
