import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { cards, cardFiles, comments, commentFiles, boards, columns, userBoardRoles } from '../db/schema.js';
import type { AssigneeHistoryEntry, MoveHistoryEntry } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { randomUUID } from 'crypto';

const router = Router();

// Helper: get user's role in a board
async function getBoardRole(userId: string, boardId: string, isAdmin: boolean): Promise<string | undefined> {
  if (isAdmin) return 'admin_total';
  const r = await db.query.userBoardRoles.findFirst({
    where: (t, { and, eq: eqFn }) => and(eqFn(t.userId, userId), eqFn(t.boardId, boardId)),
  });
  return r?.role;
}

// Helper: build full card response (with files and comments)
async function fullCard(cardId: string) {
  const card = await db.query.cards.findFirst({ where: eq(cards.id, cardId) });
  if (!card) return null;
  const files = await db.select().from(cardFiles).where(eq(cardFiles.cardId, cardId));
  const cmts = await db.select().from(comments).where(eq(comments.cardId, cardId));
  const cFiles = await db.select().from(commentFiles);

  const commentsWithFiles = cmts.map(c => ({
    ...c,
    files: cFiles.filter(f => f.commentId === c.id).map(f => ({
      id: f.id, name: f.name, size: f.size, type: f.mimeType, data: f.data,
    })),
  }));

  return {
    ...card,
    files: files.map(f => ({ id: f.id, name: f.name, size: f.size, type: f.mimeType, data: f.data })),
    comments: commentsWithFiles,
  };
}

// GET /api/cards — all visible cards (optional ?boardId=)
router.get('/', requireAuth, async (req, res) => {
  const me = req.user!;
  const { boardId } = req.query as { boardId?: string };

  let allCards;
  if (boardId) {
    allCards = await db.select().from(cards).where(eq(cards.boardId, boardId));
  } else {
    allCards = await db.select().from(cards);
  }

  // Filter by access
  if (!me.isAdmin) {
    const roles = await db.select().from(userBoardRoles).where(eq(userBoardRoles.userId, me.sub));
    const allowedIds = new Set(roles.map(r => r.boardId));
    allCards = allCards.filter(c => allowedIds.has(c.boardId));
  }

  // Load files and comments
  const cardIds = allCards.map(c => c.id);
  if (cardIds.length === 0) { res.json([]); return; }

  const allFiles = await db.select().from(cardFiles);
  const allComments = await db.select().from(comments);
  const allCommentFiles = await db.select().from(commentFiles);

  const result = allCards.map(card => ({
    ...card,
    files: allFiles.filter(f => f.cardId === card.id).map(f => ({
      id: f.id, name: f.name, size: f.size, type: f.mimeType, data: f.data,
    })),
    comments: allComments
      .filter(c => c.cardId === card.id)
      .map(c => ({
        ...c,
        files: allCommentFiles.filter(f => f.commentId === c.id).map(f => ({
          id: f.id, name: f.name, size: f.size, type: f.mimeType, data: f.data,
        })),
      })),
  }));

  res.json(result);
});

// POST /api/cards — create card
router.post('/', requireAuth, async (req, res) => {
  const me = req.user!;
  const { boardId, columnId, title, description, priority, type, assigneeId,
    reporterName, customData, files: fileList, assigneeHistory } =
    req.body as {
      boardId: string; columnId: string; title: string; description?: string;
      priority?: string; type?: string; assigneeId: string; reporterName: string;
      customData?: Record<string, string>; files?: Array<{ id: string; name: string; size: number; type: string; data: string }>;
      assigneeHistory?: AssigneeHistoryEntry[];
    };

  const role = await getBoardRole(me.sub, boardId, me.isAdmin);
  if (!role || role === 'consulta') {
    res.status(403).json({ error: 'Sin permisos para crear tarjetas' });
    return;
  }

  // Atomic increment of nextNum on the board
  const board = await db.query.boards.findFirst({ where: eq(boards.id, boardId) });
  if (!board) { res.status(404).json({ error: 'Tablero no encontrado' }); return; }

  const code = `${board.prefix}-${board.nextNum}`;
  await db.update(boards).set({ nextNum: board.nextNum + 1 }).where(eq(boards.id, boardId));

  const [card] = await db.insert(cards).values({
    boardId,
    columnId,
    code,
    title,
    description: description || '',
    priority: priority || '',
    type: type || '',
    assigneeId,
    reporterId: me.sub,
    reporterName,
    customData: customData || {},
    assigneeHistory: assigneeHistory || [],
    moveHistory: [],
    deleted: false,
    closed: false,
  }).returning();

  // Insert files
  if (fileList && fileList.length > 0) {
    await db.insert(cardFiles).values(
      fileList.map(f => ({ cardId: card.id, name: f.name, size: f.size, mimeType: f.type, data: f.data }))
    );
  }

  res.status(201).json(await fullCard(card.id));
});

// PUT /api/cards/:id — update card
router.put('/:id', requireAuth, async (req, res) => {
  const me = req.user!;
  const card = await db.query.cards.findFirst({ where: eq(cards.id, req.params.id) });
  if (!card) { res.status(404).json({ error: 'Tarjeta no encontrada' }); return; }

  const role = await getBoardRole(me.sub, card.boardId, me.isAdmin);
  if (!role || role === 'consulta') {
    res.status(403).json({ error: 'Sin permisos' });
    return;
  }

  const { assigneeId, description, priority, type, customData,
    assigneeHistory, files: newFiles, modifiedBy, modifiedAt } =
    req.body as {
      assigneeId?: string; description?: string; priority?: string; type?: string;
      customData?: Record<string, string>; assigneeHistory?: AssigneeHistoryEntry[];
      files?: Array<{ id: string; name: string; size: number; type: string; data: string }>;
      modifiedBy?: string; modifiedAt?: string;
    };

  await db.update(cards).set({
    ...(assigneeId !== undefined && { assigneeId }),
    ...(description !== undefined && { description }),
    ...(priority !== undefined && { priority }),
    ...(type !== undefined && { type }),
    ...(customData !== undefined && { customData }),
    ...(assigneeHistory !== undefined && { assigneeHistory }),
    ...(modifiedBy !== undefined && { modifiedBy }),
    ...(modifiedAt !== undefined && { modifiedAt: new Date(modifiedAt) }),
  }).where(eq(cards.id, req.params.id));

  // Replace files
  if (newFiles !== undefined) {
    await db.delete(cardFiles).where(eq(cardFiles.cardId, req.params.id));
    if (newFiles.length > 0) {
      await db.insert(cardFiles).values(
        newFiles.map(f => ({ cardId: req.params.id, name: f.name, size: f.size, mimeType: f.type, data: f.data }))
      );
    }
  }

  res.json(await fullCard(req.params.id));
});

// DELETE /api/cards/:id — soft delete
router.delete('/:id', requireAuth, async (req, res) => {
  const me = req.user!;
  const card = await db.query.cards.findFirst({ where: eq(cards.id, req.params.id) });
  if (!card) { res.status(404).json({ error: 'Tarjeta no encontrada' }); return; }

  const role = await getBoardRole(me.sub, card.boardId, me.isAdmin);
  if (role !== 'admin_total' && role !== 'admin_tablero') {
    res.status(403).json({ error: 'Sin permisos' });
    return;
  }

  const { modifiedBy } = req.body as { modifiedBy?: string };
  await db.update(cards).set({
    deleted: true,
    modifiedBy: modifiedBy || null,
    modifiedAt: new Date(),
  }).where(eq(cards.id, req.params.id));

  res.json({ ok: true });
});

// POST /api/cards/:id/move
router.post('/:id/move', requireAuth, async (req, res) => {
  const me = req.user!;
  const card = await db.query.cards.findFirst({ where: eq(cards.id, req.params.id) });
  if (!card) { res.status(404).json({ error: 'Tarjeta no encontrada' }); return; }

  const role = await getBoardRole(me.sub, card.boardId, me.isAdmin);
  if (!role || role === 'consulta') {
    res.status(403).json({ error: 'Sin permisos' });
    return;
  }

  const { columnId, moveEntry, modifiedBy } = req.body as {
    columnId: string;
    moveEntry: MoveHistoryEntry;
    modifiedBy: string;
  };

  const newHistory = [...(card.moveHistory || []), moveEntry];
  await db.update(cards).set({
    columnId,
    moveHistory: newHistory,
    modifiedBy,
    modifiedAt: new Date(),
  }).where(eq(cards.id, req.params.id));

  res.json(await fullCard(req.params.id));
});

// POST /api/cards/:id/close
router.post('/:id/close', requireAuth, async (req, res) => {
  const me = req.user!;
  const card = await db.query.cards.findFirst({ where: eq(cards.id, req.params.id) });
  if (!card) { res.status(404).json({ error: 'Tarjeta no encontrada' }); return; }

  const role = await getBoardRole(me.sub, card.boardId, me.isAdmin);
  if (!role || role === 'consulta') {
    res.status(403).json({ error: 'Sin permisos' });
    return;
  }

  const { columnId, closedBy, moveEntry } = req.body as {
    columnId: string; closedBy: string; moveEntry: MoveHistoryEntry;
  };

  const newHistory = [...(card.moveHistory || []), moveEntry];
  await db.update(cards).set({
    columnId,
    closed: true,
    closedAt: new Date(),
    closedBy,
    moveHistory: newHistory,
    modifiedBy: closedBy,
    modifiedAt: new Date(),
  }).where(eq(cards.id, req.params.id));

  res.json(await fullCard(req.params.id));
});

// POST /api/cards/:id/comments
router.post('/:id/comments', requireAuth, async (req, res) => {
  const me = req.user!;
  const card = await db.query.cards.findFirst({ where: eq(cards.id, req.params.id) });
  if (!card) { res.status(404).json({ error: 'Tarjeta no encontrada' }); return; }

  const role = await getBoardRole(me.sub, card.boardId, me.isAdmin);
  if (!role || role === 'consulta') {
    res.status(403).json({ error: 'Sin permisos' });
    return;
  }

  const { text, files: fileList, authorName } = req.body as {
    text?: string; authorName: string;
    files?: Array<{ id: string; name: string; size: number; type: string; data: string }>;
  };

  const [comment] = await db.insert(comments).values({
    cardId: req.params.id,
    authorId: me.sub,
    authorName,
    text: text || '',
  }).returning();

  if (fileList && fileList.length > 0) {
    await db.insert(commentFiles).values(
      fileList.map(f => ({ commentId: comment.id, name: f.name, size: f.size, mimeType: f.type, data: f.data }))
    );
  }

  const files = await db.select().from(commentFiles).where(eq(commentFiles.commentId, comment.id));
  res.status(201).json({
    ...comment,
    files: files.map(f => ({ id: f.id, name: f.name, size: f.size, type: f.mimeType, data: f.data })),
  });
});

// PUT /api/cards/:id/comments/:cid
router.put('/:id/comments/:cid', requireAuth, async (req, res) => {
  const me = req.user!;
  const comment = await db.query.comments.findFirst({ where: eq(comments.id, req.params.cid) });
  if (!comment) { res.status(404).json({ error: 'Comentario no encontrado' }); return; }

  const card = await db.query.cards.findFirst({ where: eq(cards.id, req.params.id) });
  if (!card) { res.status(404).json({ error: 'Tarjeta no encontrada' }); return; }

  const role = await getBoardRole(me.sub, card.boardId, me.isAdmin);
  const canEdit = comment.authorId === me.sub || me.isAdmin || role === 'admin_tablero';
  if (!canEdit) {
    res.status(403).json({ error: 'Sin permisos para editar este comentario' });
    return;
  }

  const { text, files: fileList, modifiedBy } = req.body as {
    text?: string; modifiedBy?: string;
    files?: Array<{ id: string; name: string; size: number; type: string; data: string }>;
  };

  await db.update(comments).set({
    text: text ?? comment.text,
    modifiedBy: modifiedBy || null,
    modifiedAt: new Date(),
  }).where(eq(comments.id, req.params.cid));

  if (fileList !== undefined) {
    await db.delete(commentFiles).where(eq(commentFiles.commentId, req.params.cid));
    if (fileList.length > 0) {
      await db.insert(commentFiles).values(
        fileList.map(f => ({ commentId: req.params.cid, name: f.name, size: f.size, mimeType: f.type, data: f.data }))
      );
    }
  }

  const files = await db.select().from(commentFiles).where(eq(commentFiles.commentId, req.params.cid));
  const updated = await db.query.comments.findFirst({ where: eq(comments.id, req.params.cid) });
  res.json({
    ...updated,
    files: files.map(f => ({ id: f.id, name: f.name, size: f.size, type: f.mimeType, data: f.data })),
  });
});

// DELETE /api/cards/:id/comments/:cid
router.delete('/:id/comments/:cid', requireAuth, async (req, res) => {
  const me = req.user!;
  const comment = await db.query.comments.findFirst({ where: eq(comments.id, req.params.cid) });
  if (!comment) { res.status(404).json({ error: 'Comentario no encontrado' }); return; }

  const card = await db.query.cards.findFirst({ where: eq(cards.id, req.params.id) });
  if (!card) { res.status(404).json({ error: 'Tarjeta no encontrada' }); return; }

  const role = await getBoardRole(me.sub, card.boardId, me.isAdmin);
  const canEdit = comment.authorId === me.sub || me.isAdmin || role === 'admin_tablero';
  if (!canEdit) {
    res.status(403).json({ error: 'Sin permisos' });
    return;
  }

  await db.delete(comments).where(eq(comments.id, req.params.cid));
  res.json({ ok: true });
});

export default router;
