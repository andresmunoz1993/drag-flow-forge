import { Router, Request, Response } from 'express';
import { eq, desc, inArray, and } from 'drizzle-orm';
import { db, pool } from '../db/index';
import { cards, cardFiles, comments, commentFiles, globalCounter, boards } from '../db/schema';

const router = Router();

// Serializa un card con sus files y comments
async function serializeCard(card: typeof cards.$inferSelect) {
  const files = await db.select().from(cardFiles).where(eq(cardFiles.cardId, card.id));
  const rawComments = await db.select().from(comments)
    .where(eq(comments.cardId, card.id))
    .orderBy(comments.createdAt);

  const serializedComments = await Promise.all(rawComments.map(async (c) => {
    const cFiles = await db.select().from(commentFiles).where(eq(commentFiles.commentId, c.id));
    return {
      id:         c.id,
      authorId:   c.authorId,
      authorName: c.authorName,
      text:       c.text,
      modifiedBy: c.modifiedBy ?? undefined,
      modifiedAt: c.modifiedAt ?? undefined,
      createdAt:  c.createdAt,
      files: cFiles.map(f => ({ id: f.id, name: f.name, size: f.size, type: f.mimeType, data: f.data })),
    };
  }));

  return {
    id:              card.id,
    boardId:         card.boardId,
    columnId:        card.columnId,
    code:            card.code,
    title:           card.title,
    description:     card.description,
    priority:        card.priority,
    type:            card.type,
    assigneeId:      card.assigneeId ?? '',
    reporterId:      card.reporterId,
    reporterName:    card.reporterName,
    createdAt:       card.createdAt,
    modifiedBy:      card.modifiedBy ?? null,
    modifiedAt:      card.modifiedAt ?? null,
    deleted:         card.deleted,
    closed:          card.closed,
    closedAt:        card.closedAt ?? null,
    closedBy:        card.closedBy ?? null,
    customData:      (card.customData as Record<string, string>) ?? {},
    assigneeHistory: (card.assigneeHistory as any[]) ?? [],
    moveHistory:     (card.moveHistory as any[]) ?? [],
    spExternalId:    card.spExternalId ?? undefined,
    clientRef:       card.clientRef ?? undefined,
    files: files.map(f => ({ id: f.id, name: f.name, size: f.size, type: f.mimeType, data: f.data })),
    comments: serializedComments,
  };
}

// GET /api/cards/check?boardId=X  — lightweight change detection para polling
router.get('/check', async (req: Request, res: Response) => {
  try {
    const { boardId } = req.query;
    if (!boardId) return res.status(400).json({ error: 'boardId requerido.' });
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count,
              MAX(GREATEST(modified_at, created_at)) AS last_change
       FROM cards WHERE board_id = $1 AND deleted = false`,
      [String(boardId)]
    );
    return res.json({
      count:      result.rows[0]?.count ?? 0,
      lastChange: result.rows[0]?.last_change ?? null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/cards?boardId=X  (sin boardId = todos los casos)
// Optimizado: 4 queries batch en vez de N+1
router.get('/', async (req: Request, res: Response) => {
  try {
    const { boardId } = req.query;

    // 1. Fetch cards — excluir soft-deleted (1 query)
    const rawCards = boardId
      ? await db.select().from(cards).where(and(eq(cards.boardId, String(boardId)), eq(cards.deleted, false))).orderBy(desc(cards.createdAt))
      : await db.select().from(cards).where(eq(cards.deleted, false)).orderBy(desc(cards.createdAt));

    if (rawCards.length === 0) return res.json([]);

    const cardIds = rawCards.map(c => c.id);

    // 2. Batch fetch card_files (1 query)
    const allCardFiles = await db.select().from(cardFiles)
      .where(inArray(cardFiles.cardId, cardIds));

    // 3. Batch fetch comments (1 query)
    const allComments = await db.select().from(comments)
      .where(inArray(comments.cardId, cardIds))
      .orderBy(comments.createdAt);

    // 4. Batch fetch comment_files (1 query, solo si hay comments)
    const commentIds = allComments.map(c => c.id);
    const allCommentFiles = commentIds.length > 0
      ? await db.select().from(commentFiles).where(inArray(commentFiles.commentId, commentIds))
      : [];

    // Agrupar por parent ID usando Maps
    const cardFilesMap = new Map<string, typeof allCardFiles>();
    for (const f of allCardFiles) {
      if (!cardFilesMap.has(f.cardId)) cardFilesMap.set(f.cardId, []);
      cardFilesMap.get(f.cardId)!.push(f);
    }

    const commentFilesMap = new Map<string, typeof allCommentFiles>();
    for (const f of allCommentFiles) {
      if (!commentFilesMap.has(f.commentId)) commentFilesMap.set(f.commentId, []);
      commentFilesMap.get(f.commentId)!.push(f);
    }

    const commentsMap = new Map<string, any[]>();
    for (const c of allComments) {
      if (!commentsMap.has(c.cardId)) commentsMap.set(c.cardId, []);
      const cFiles = commentFilesMap.get(c.id) || [];
      commentsMap.get(c.cardId)!.push({
        id:         c.id,
        authorId:   c.authorId,
        authorName: c.authorName,
        text:       c.text,
        modifiedBy: c.modifiedBy ?? undefined,
        modifiedAt: c.modifiedAt ?? undefined,
        createdAt:  c.createdAt,
        files: cFiles.map(f => ({ id: f.id, name: f.name, size: f.size, type: f.mimeType, data: f.data })),
      });
    }

    // Ensamblar respuesta (misma shape que serializeCard)
    const result = rawCards.map(card => ({
      id:              card.id,
      boardId:         card.boardId,
      columnId:        card.columnId,
      code:            card.code,
      title:           card.title,
      description:     card.description,
      priority:        card.priority,
      type:            card.type,
      assigneeId:      card.assigneeId ?? '',
      reporterId:      card.reporterId,
      reporterName:    card.reporterName,
      createdAt:       card.createdAt,
      modifiedBy:      card.modifiedBy ?? null,
      modifiedAt:      card.modifiedAt ?? null,
      deleted:         card.deleted,
      closed:          card.closed,
      closedAt:        card.closedAt ?? null,
      closedBy:        card.closedBy ?? null,
      customData:      (card.customData as Record<string, string>) ?? {},
      assigneeHistory: (card.assigneeHistory as any[]) ?? [],
      moveHistory:     (card.moveHistory as any[]) ?? [],
      spExternalId:    card.spExternalId ?? undefined,
      clientRef:       card.clientRef ?? undefined,
      files: (cardFilesMap.get(card.id) || []).map(f => ({ id: f.id, name: f.name, size: f.size, type: f.mimeType, data: f.data })),
      comments: commentsMap.get(card.id) || [],
    }));

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al obtener casos.', detail: err.message });
  }
});

// POST /api/cards  — crea card con contador atómico
router.post('/', async (req: Request, res: Response) => {
  const { boardId, columnId, title } = req.body;
  if (!boardId || typeof boardId !== 'string' || boardId.length > 100)
    return res.status(400).json({ error: 'boardId inválido.' });
  if (!columnId || typeof columnId !== 'string' || columnId.length > 100)
    return res.status(400).json({ error: 'columnId inválido.' });
  if (!title || typeof title !== 'string' || title.trim().length === 0 || title.length > 500)
    return res.status(400).json({ error: 'title es requerido (máx 500 caracteres).' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

    // Incremento atómico del contador global
    const counterRes = await client.query(
      'UPDATE global_counter SET next_card_num = next_card_num + 1 WHERE id = 1 RETURNING next_card_num'
    );
    const num: number = counterRes.rows[0]?.next_card_num ?? 1;

    // Obtener prefijo del board para construir el código
    const boardRes = await client.query('SELECT prefix FROM boards WHERE id = $1', [req.body.boardId]);
    const prefix: string = boardRes.rows[0]?.prefix ?? 'CARD';
    const code = `${prefix}-${num}`;

    const {
      id, boardId, columnId, title, description, priority, type,
      assigneeId, reporterId, reporterName, customData,
      assigneeHistory, moveHistory, deleted, closed,
      closedAt, closedBy, modifiedBy, modifiedAt, createdAt,
      spExternalId, clientRef, files,
    } = req.body;

    const insertRes = await client.query(
      `INSERT INTO cards (
        id, board_id, column_id, code, title, description, priority, type,
        assignee_id, reporter_id, reporter_name, custom_data,
        assignee_history, move_history, deleted, closed,
        closed_at, closed_by, modified_by, modified_at, created_at,
        num, sp_external_id, client_ref
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23
      ) RETURNING *`,
      [
        boardId, columnId, code, title, description ?? '', priority ?? '', type ?? '',
        assigneeId || null, reporterId ?? '', reporterName ?? '',
        JSON.stringify(customData ?? {}),
        JSON.stringify(assigneeHistory ?? []),
        JSON.stringify(moveHistory ?? []),
        deleted ?? false, closed ?? false,
        closedAt ?? null, closedBy ?? null,
        modifiedBy ?? null, modifiedAt ?? null,
        createdAt ?? new Date().toISOString(),
        num, spExternalId ?? null, clientRef ?? null,
      ]
    );

    const newCard = insertRes.rows[0];

    // Insertar archivos adjuntos si hay
    if (Array.isArray(files) && files.length) {
      for (const f of files) {
        await client.query(
          'INSERT INTO card_files (id, card_id, name, size, mime_type, data) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
          [newCard.id, f.name, f.size, f.type, f.data]
        );
      }
    }

    await client.query('COMMIT');

    // Serializar y retornar
    const [row] = await db.select().from(cards).where(eq(cards.id, newCard.id));
    return res.status(201).json(await serializeCard(row));
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[cards] create error:', err);
    return res.status(500).json({ error: 'Error al crear caso.', detail: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/cards/:id
router.put('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      columnId, title, description, priority, type,
      assigneeId, customData, assigneeHistory, moveHistory,
      deleted, closed, closedAt, closedBy,
      modifiedBy, modifiedAt, clientRef, files,
    } = req.body;

    await client.query(
      `UPDATE cards SET
        column_id        = COALESCE($1, column_id),
        title            = COALESCE($2, title),
        description      = COALESCE($3, description),
        priority         = COALESCE($4, priority),
        type             = COALESCE($5, type),
        assignee_id      = $6,
        custom_data      = COALESCE($7::jsonb, custom_data),
        assignee_history = COALESCE($8::jsonb, assignee_history),
        move_history     = COALESCE($9::jsonb, move_history),
        deleted          = COALESCE($10, deleted),
        closed           = COALESCE($11, closed),
        closed_at        = $12,
        closed_by        = $13,
        modified_by      = $14,
        modified_at      = $15,
        client_ref       = COALESCE($16, client_ref)
      WHERE id = $17`,
      [
        columnId ?? null, title ?? null, description ?? null,
        priority ?? null, type ?? null,
        assigneeId || null,
        customData       ? JSON.stringify(customData)       : null,
        assigneeHistory  ? JSON.stringify(assigneeHistory)  : null,
        moveHistory      ? JSON.stringify(moveHistory)      : null,
        deleted ?? null, closed ?? null,
        closedAt ?? null, closedBy ?? null,
        modifiedBy ?? null, modifiedAt ?? null,
        clientRef ?? null,
        id,
      ]
    );

    // Reemplazar archivos si se envían
    if (Array.isArray(files)) {
      await client.query('DELETE FROM card_files WHERE card_id = $1', [id]);
      for (const f of files) {
        await client.query(
          'INSERT INTO card_files (id, card_id, name, size, mime_type, data) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
          [id, f.name, f.size, f.type, f.data]
        );
      }
    }

    await client.query('COMMIT');
    const [updated] = await db.select().from(cards).where(eq(cards.id, id));
    if (!updated) return res.status(404).json({ error: 'Caso no encontrado.' });
    return res.json(await serializeCard(updated));
  } catch (err: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Error al actualizar caso.', detail: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/cards/:id  — soft delete
router.delete('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { modifiedBy } = req.body ?? {};
  try {
    await db.update(cards).set({
      deleted:    true,
      modifiedBy: modifiedBy ?? null,
      modifiedAt: new Date(),
    }).where(eq(cards.id, id));
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al eliminar caso.', detail: err.message });
  }
});

export default router;
