import { Router, Request, Response } from 'express';
import { eq, desc, inArray, and } from 'drizzle-orm';
import { db, pool } from '../db/index';
import { cards, cardFiles, comments, commentFiles, globalCounter, boards } from '../db/schema';
import { sendEmail } from '../services/email.service';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * Verifica si una columna supera 100 tarjetas activas y, si es así,
 * envía un correo de alerta a los administradores del tablero.
 * Se llama de forma asíncrona (fire-and-forget) para no bloquear la respuesta.
 */
async function checkColumnOverflowAlert(columnId: string, boardId: string): Promise<void> {
  try {
    // Contar tarjetas activas en la columna
    const countRes = await pool.query<{ count: string; col_name: string; board_name: string }>(
      `SELECT COUNT(c.id)::text AS count,
              col.name         AS col_name,
              b.name           AS board_name
       FROM cards c
       JOIN columns col ON col.id = c.column_id
       JOIN boards  b   ON b.id   = c.board_id
       WHERE c.column_id = $1
         AND c.deleted   = false
         AND c.closed    = false
       GROUP BY col.name, b.name`,
      [columnId]
    );

    if (!countRes.rows.length) return;
    const count = parseInt(countRes.rows[0].count, 10);
    if (count < 100) return;

    const colName   = countRes.rows[0].col_name;
    const boardName = countRes.rows[0].board_name;

    // Obtener emails de admins: isAdminTotal=true  OR  role='admin_tablero' para este tablero
    const adminsRes = await pool.query<{ email: string; full_name: string }>(
      `SELECT DISTINCT u.email, u.full_name
       FROM users u
       WHERE u.active = true AND u.email != ''
         AND (
           u.is_admin_total = true
           OR EXISTS (
             SELECT 1 FROM user_board_roles ubr
             WHERE ubr.user_id = u.id
               AND ubr.board_id = $1
               AND ubr.role = 'admin_tablero'
           )
         )`,
      [boardId]
    );

    if (!adminsRes.rows.length) return;

    const toAddresses = adminsRes.rows.map(r => r.email);
    await sendEmail({
      to:       toAddresses,
      subject:  `[Allers] Alerta: columna "${colName}" tiene ${count} casos sin mover`,
      bodyType: 'HTML',
      body: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#dc2626;margin-top:0">⚠️ Alerta de acumulación de casos</h2>
          <p>La columna <strong>"${colName}"</strong> del tablero <strong>"${boardName}"</strong>
             ha alcanzado <strong>${count} casos activos</strong>.</p>
          <p>Se recomienda revisar y movilizar los casos para evitar cuellos de botella.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
          <p style="color:#6b7280;font-size:13px">
            Este mensaje fue enviado automáticamente por el sistema Allers.
          </p>
        </div>
      `,
    });
  } catch (err) {
    // No propagar errores de alerta — son best-effort
    console.warn('[ColumnAlert] No se pudo enviar alerta:', (err as Error)?.message);
  }
}

/**
 * Parsea @NombreCompleto del texto, inserta en card_mentions los nuevos y envía emails.
 * Fire-and-forget: nunca bloquea la respuesta HTTP.
 */
async function processMentions(
  cardId:          string,
  text:            string,
  mentionedById:   string,
  mentionedByName: string,
  context:         'description' | 'comment',
  cardCode:        string,
  cardTitle:       string,
  boardName:       string,
): Promise<void> {
  try {
    if (!text?.trim()) return;

    // Todos los usuarios activos con email
    const usersRes = await pool.query<{ id: string; full_name: string; email: string }>(
      `SELECT id, full_name, email FROM users WHERE active = true AND email != '' ORDER BY full_name`
    );

    const textLower = text.toLowerCase();
    const toMention = usersRes.rows.filter(u =>
      textLower.includes(`@${u.full_name.toLowerCase()}`)
    );
    if (!toMention.length) return;

    // Insertar solo los que no existen (ON CONFLICT DO NOTHING) y recuperar los nuevos
    const newlyMentioned: typeof toMention = [];
    for (const u of toMention) {
      const result = await pool.query(
        `INSERT INTO card_mentions (card_id, user_id, mentioned_by_id, mentioned_by_name, context)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (card_id, user_id) DO NOTHING
         RETURNING id`,
        [cardId, u.id, mentionedById, mentionedByName, context]
      );
      if (result.rowCount && result.rowCount > 0) newlyMentioned.push(u);
    }

    if (!newlyMentioned.length) return;

    // Enviar email solo a los recién mencionados
    const textSnippet = text.length > 200 ? text.slice(0, 200) + '…' : text;
    for (const u of newlyMentioned) {
      await sendEmail({
        to:       u.email,
        subject:  `[Allers] Te han etiquetado en el caso ${cardCode}`,
        bodyType: 'HTML',
        body: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#2563eb;margin-top:0">📌 Has sido etiquetado en un caso</h2>
            <p><strong>${mentionedByName}</strong> te mencionó en el caso
               <strong>${cardCode} — ${cardTitle}</strong> (${boardName}).</p>
            <div style="background:#f3f4f6;border-left:3px solid #2563eb;padding:12px 16px;border-radius:4px;margin:16px 0">
              <p style="margin:0;color:#374151;font-size:14px;font-style:italic">"${textSnippet}"</p>
            </div>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
            <p style="color:#6b7280;font-size:12px">Mensaje automático del sistema Allers.</p>
          </div>
        `,
      });
    }
  } catch (err) {
    console.warn('[Mentions] No se pudo procesar menciones:', (err as Error)?.message);
  }
}

/**
 * Envía correo al responsable del caso cuando el carril cambia.
 * Fire-and-forget.
 */
async function notifyColumnChange(
  cardCode:    string,
  cardTitle:   string,
  oldColId:    string,
  newColId:    string,
  assigneeId:  string,
  movedBy:     string,
): Promise<void> {
  try {
    if (!assigneeId) return;

    const [assigneeRes, oldColRes, newColRes] = await Promise.all([
      pool.query<{ email: string; full_name: string }>(
        'SELECT email, full_name FROM users WHERE id = $1 AND active = true AND email != \'\'',
        [assigneeId]
      ),
      pool.query<{ name: string }>('SELECT name FROM columns WHERE id = $1', [oldColId]),
      pool.query<{ name: string }>('SELECT name FROM columns WHERE id = $1', [newColId]),
    ]);

    const assignee = assigneeRes.rows[0];
    if (!assignee?.email) return;

    const oldColName = oldColRes.rows[0]?.name ?? 'desconocido';
    const newColName = newColRes.rows[0]?.name ?? 'desconocido';

    await sendEmail({
      to:       assignee.email,
      subject:  `[Allers] Caso ${cardCode} movido de carril`,
      bodyType: 'HTML',
      body: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#2563eb;margin-top:0">🔀 Caso movido de carril</h2>
          <p>Hola <strong>${assignee.full_name}</strong>,</p>
          <p>El caso <strong>${cardCode} — ${cardTitle}</strong> que tienes asignado
             fue movido por <strong>${movedBy || 'el sistema'}</strong>.</p>
          <table style="border-collapse:collapse;margin:16px 0">
            <tr>
              <td style="padding:8px 14px;background:#f3f4f6;border-radius:4px 0 0 0;font-size:13px;color:#6b7280;white-space:nowrap">Antes</td>
              <td style="padding:8px 14px;background:#f3f4f6;border-radius:0 4px 0 0;font-size:13px;color:#374151;font-weight:600">${oldColName}</td>
            </tr>
            <tr>
              <td style="padding:8px 14px;background:#eff6ff;border-radius:0 0 0 4px;font-size:13px;color:#2563eb;white-space:nowrap">Ahora</td>
              <td style="padding:8px 14px;background:#eff6ff;border-radius:0 0 4px 0;font-size:13px;color:#1d4ed8;font-weight:600">${newColName}</td>
            </tr>
          </table>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
          <p style="color:#6b7280;font-size:12px">Mensaje automático del sistema Allers.</p>
        </div>
      `,
    });
  } catch (err) {
    console.warn('[ColumnChange] No se pudo notificar:', (err as Error)?.message);
  }
}

/**
 * Envía correo al nuevo responsable cuando se le asigna un caso.
 * Fire-and-forget.
 */
async function notifyAssigneeChange(
  cardCode:     string,
  cardTitle:    string,
  boardId:      string,
  newAssigneeId: string,
  assignedBy:   string,
): Promise<void> {
  try {
    if (!newAssigneeId) return;

    const [assigneeRes, boardRes] = await Promise.all([
      pool.query<{ email: string; full_name: string }>(
        'SELECT email, full_name FROM users WHERE id = $1 AND active = true AND email != \'\'',
        [newAssigneeId]
      ),
      pool.query<{ name: string }>('SELECT name FROM boards WHERE id = $1', [boardId]),
    ]);

    const assignee = assigneeRes.rows[0];
    if (!assignee?.email) return;

    const boardName = boardRes.rows[0]?.name ?? '';

    await sendEmail({
      to:       assignee.email,
      subject:  `[Allers] Te han asignado el caso ${cardCode}`,
      bodyType: 'HTML',
      body: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#2563eb;margin-top:0">👤 Nuevo caso asignado</h2>
          <p>Hola <strong>${assignee.full_name}</strong>,</p>
          <p><strong>${assignedBy || 'Un administrador'}</strong> te ha asignado el caso
             <strong>${cardCode} — ${cardTitle}</strong>${boardName ? ` (${boardName})` : ''}.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
          <p style="color:#6b7280;font-size:12px">Mensaje automático del sistema Allers.</p>
        </div>
      `,
    });
  } catch (err) {
    console.warn('[AssigneeChange] No se pudo notificar:', (err as Error)?.message);
  }
}

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

// GET /api/cards?boardId=X&limit=N&offset=N  (sin boardId = todos los casos)
// Optimizado: 4 queries batch en vez de N+1
router.get('/', async (req: Request, res: Response) => {
  try {
    const { boardId } = req.query;
    const limit  = Math.min(parseInt(String(req.query.limit  ?? '2000'), 10) || 2000, 5000);
    const offset = Math.max(parseInt(String(req.query.offset ?? '0'),    10) || 0,    0);

    // 1. Fetch cards — excluir soft-deleted (1 query)
    const allMatching = boardId
      ? await db.select().from(cards).where(and(eq(cards.boardId, String(boardId)), eq(cards.deleted, false))).orderBy(desc(cards.createdAt))
      : await db.select().from(cards).where(eq(cards.deleted, false)).orderBy(desc(cards.createdAt));

    res.setHeader('X-Total-Count', String(allMatching.length));
    const rawCards = allMatching.slice(offset, offset + limit);

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
    return res.status(500).json({ error: 'Error al obtener casos.', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) });
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

    // Alerta de desbordamiento de columna (fire-and-forget)
    checkColumnOverflowAlert(columnId, boardId);

    // Procesar @menciones en la descripción (fire-and-forget)
    if (description) {
      const boardNameRes = await pool.query<{ name: string }>('SELECT name FROM boards WHERE id = $1', [boardId]);
      const boardName = boardNameRes.rows[0]?.name ?? '';
      processMentions(
        row.id, description,
        req.body.reporterId ?? '', req.body.reporterName ?? '',
        'description', code, title, boardName
      );
    }

    return res.status(201).json(await serializeCard(row));
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[cards] create error:', err);
    return res.status(500).json({ error: 'Error al crear caso.', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) });
  } finally {
    client.release();
  }
});

const isUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

// GET /api/cards/:id/mentions  — colaboradores etiquetados en el caso
router.get('/:id/mentions', requireAuth, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!isUUID(id)) return res.status(400).json({ error: 'id de caso inválido.' });
  try {
    const result = await pool.query<{
      user_id:            string;
      user_name:          string;
      user_email:         string;
      mentioned_by_name:  string;
      first_mentioned_at: string;
      context:            string;
    }>(
      `SELECT cm.user_id,
              u.full_name  AS user_name,
              u.email      AS user_email,
              cm.mentioned_by_name,
              cm.first_mentioned_at,
              cm.context
       FROM card_mentions cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.card_id = $1
       ORDER BY cm.first_mentioned_at ASC`,
      [id]
    );
    return res.json(result.rows.map(r => ({
      userId:           r.user_id,
      userName:         r.user_name,
      userEmail:        r.user_email,
      mentionedByName:  r.mentioned_by_name,
      firstMentionedAt: r.first_mentioned_at,
      context:          r.context,
    })));
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al obtener menciones.', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) });
  }
});

// PUT /api/cards/:id
router.put('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!isUUID(id)) return res.status(400).json({ error: 'id de caso inválido.' });

  const { title, columnId } = req.body;
  if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0 || title.length > 500))
    return res.status(400).json({ error: 'title debe ser un texto no vacío (máx 500 caracteres).' });
  if (columnId !== undefined && typeof columnId !== 'string')
    return res.status(400).json({ error: 'columnId inválido.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Capturar estado previo para detectar cambios (column, assignee)
    const prevRes = await client.query<{ column_id: string; assignee_id: string | null }>(
      'SELECT column_id, assignee_id FROM cards WHERE id = $1',
      [id]
    );
    const prev = prevRes.rows[0] ?? null;

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

    // Alerta de desbordamiento de columna cuando se mueve la tarjeta (fire-and-forget)
    if (columnId && updated.boardId) {
      checkColumnOverflowAlert(updated.columnId, updated.boardId);
    }

    // Procesar @menciones si la descripción fue modificada (fire-and-forget)
    if (description !== undefined && description) {
      const boardNameRes = await pool.query<{ name: string }>('SELECT name FROM boards WHERE id = $1', [updated.boardId]);
      const boardName = boardNameRes.rows[0]?.name ?? '';
      processMentions(
        id, description,
        String((req as any).user?.userId ?? req.body.modifiedBy ?? ''),
        req.body.modifiedBy ?? '',
        'description', updated.code, updated.title, boardName
      );
    }

    // Notificar cambio de carril al responsable actual (fire-and-forget)
    if (prev && columnId && columnId !== prev.column_id) {
      const currentAssigneeId = updated.assigneeId ?? prev.assignee_id;
      if (currentAssigneeId) {
        notifyColumnChange(
          updated.code, updated.title,
          prev.column_id, columnId,
          currentAssigneeId,
          modifiedBy ?? ''
        );
      }
    }

    // Notificar al nuevo responsable si cambió (fire-and-forget)
    const assigneeInBody = 'assigneeId' in req.body;
    if (prev && assigneeInBody && assigneeId && (assigneeId || null) !== (prev.assignee_id || null)) {
      notifyAssigneeChange(
        updated.code, updated.title,
        updated.boardId,
        assigneeId,
        modifiedBy ?? ''
      );
    }

    return res.json(await serializeCard(updated));
  } catch (err: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Error al actualizar caso.', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) });
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
    return res.status(500).json({ error: 'Error al eliminar caso.', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) });
  }
});

export default router;
