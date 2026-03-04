import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db, pool } from '../db/index';
import { comments, commentFiles, cards } from '../db/schema';
import { sendEmail } from '../services/email.service';

/**
 * Copia local del helper processMentions para comentarios.
 * Inserta en card_mentions y envía email solo a los recién etiquetados.
 */
async function processMentions(
  cardId:          string,
  text:            string,
  mentionedById:   string,
  mentionedByName: string,
  cardCode:        string,
  cardTitle:       string,
  boardName:       string,
): Promise<void> {
  try {
    if (!text?.trim()) return;

    const usersRes = await pool.query<{ id: string; full_name: string; email: string }>(
      `SELECT id, full_name, email FROM users WHERE active = true AND email != '' ORDER BY full_name`
    );

    const textLower = text.toLowerCase();
    const toMention = usersRes.rows.filter(u =>
      textLower.includes(`@${u.full_name.toLowerCase()}`)
    );
    if (!toMention.length) return;

    const newlyMentioned: typeof toMention = [];
    for (const u of toMention) {
      const result = await pool.query(
        `INSERT INTO card_mentions (card_id, user_id, mentioned_by_id, mentioned_by_name, context)
         VALUES ($1, $2, $3, $4, 'comment')
         ON CONFLICT (card_id, user_id) DO NOTHING
         RETURNING id`,
        [cardId, u.id, mentionedById, mentionedByName]
      );
      if (result.rowCount && result.rowCount > 0) newlyMentioned.push(u);
    }

    if (!newlyMentioned.length) return;

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
    console.warn('[Mentions] No se pudo procesar menciones en comentario:', (err as Error)?.message);
  }
}

const router = Router({ mergeParams: true });

// Helper: serializar comentario con files
async function serializeComment(commentId: string) {
  const [c] = await db.select().from(comments).where(eq(comments.id, commentId));
  if (!c) return null;
  const cFiles = await db.select().from(commentFiles).where(eq(commentFiles.commentId, commentId));
  return {
    id:         c.id,
    authorId:   c.authorId,
    authorName: c.authorName,
    text:       c.text,
    createdAt:  c.createdAt,
    modifiedBy: c.modifiedBy ?? undefined,
    modifiedAt: c.modifiedAt ?? undefined,
    files: cFiles.map(f => ({ id: f.id, name: f.name, size: f.size, type: f.mimeType, data: f.data })),
  };
}

const isUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

// POST /api/cards/:cardId/comments
router.post('/', async (req: Request, res: Response) => {
  const cardId = String(req.params.cardId);
  if (!isUUID(cardId)) return res.status(400).json({ error: 'cardId inválido.' });

  const { authorId, authorName, text, createdAt, files } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length === 0 || text.length > 5000)
    return res.status(400).json({ error: 'text es requerido (máx 5000 caracteres).' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertRes = await client.query(
      `INSERT INTO comments (id, card_id, author_id, author_name, text, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING id`,
      [cardId, authorId ?? '', authorName ?? '', text ?? '', createdAt ? new Date(createdAt) : new Date()]
    );
    const commentId = insertRes.rows[0].id;

    if (Array.isArray(files) && files.length) {
      for (const f of files) {
        await client.query(
          'INSERT INTO comment_files (id, comment_id, name, size, mime_type, data) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
          [commentId, f.name, f.size, f.type, f.data]
        );
      }
    }

    await client.query('COMMIT');

    const serialized = await serializeComment(commentId);

    // Procesar @menciones en el comentario (fire-and-forget)
    if (text?.trim()) {
      const cardInfoRes = await pool.query<{ code: string; title: string; board_name: string }>(
        `SELECT c.code, c.title, b.name AS board_name
         FROM cards c JOIN boards b ON b.id = c.board_id
         WHERE c.id = $1`,
        [cardId]
      );
      if (cardInfoRes.rows.length) {
        const { code, title, board_name } = cardInfoRes.rows[0];
        processMentions(cardId, text, authorId ?? '', authorName ?? '', code, title, board_name);
      }
    }

    return res.status(201).json(serialized);
  } catch (err: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Error al crear comentario.', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) });
  } finally {
    client.release();
  }
});

// PUT /api/comments/:id
router.put('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!isUUID(id)) return res.status(400).json({ error: 'id de comentario inválido.' });

  const { text, modifiedBy, modifiedAt, files } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length === 0 || text.length > 5000)
    return res.status(400).json({ error: 'text es requerido (máx 5000 caracteres).' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateRes = await client.query(
      `UPDATE comments SET text = $1, modified_by = $2, modified_at = $3 WHERE id = $4 RETURNING id`,
      [text, modifiedBy ?? null, modifiedAt ? new Date(modifiedAt) : new Date(), id]
    );
    if (updateRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Comentario no encontrado.' });
    }

    // Reemplazar archivos si se envían
    if (Array.isArray(files)) {
      await client.query('DELETE FROM comment_files WHERE comment_id = $1', [id]);
      for (const f of files) {
        await client.query(
          'INSERT INTO comment_files (id, comment_id, name, size, mime_type, data) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
          [id, f.name, f.size, f.type, f.data]
        );
      }
    }

    await client.query('COMMIT');

    const serialized = await serializeComment(id);

    // Procesar @menciones nuevas en el texto editado (fire-and-forget)
    if (text?.trim()) {
      const cmtCardRes = await pool.query<{ card_id: string; code: string; title: string; board_name: string }>(
        `SELECT cm.card_id, c.code, c.title, b.name AS board_name
         FROM comments cm
         JOIN cards c ON c.id = cm.card_id
         JOIN boards b ON b.id = c.board_id
         WHERE cm.id = $1`,
        [id]
      );
      if (cmtCardRes.rows.length) {
        const { card_id, code, title, board_name } = cmtCardRes.rows[0];
        processMentions(card_id, text, modifiedBy ?? '', modifiedBy ?? '', code, title, board_name);
      }
    }

    return res.json(serialized);
  } catch (err: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Error al actualizar comentario.', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) });
  } finally {
    client.release();
  }
});

// DELETE /api/comments/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM comment_files WHERE comment_id = $1', [id]);
    await client.query('DELETE FROM comments WHERE id = $1', [id]);
    await client.query('COMMIT');
    return res.json({ ok: true });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Error al eliminar comentario.', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) });
  } finally {
    client.release();
  }
});

export default router;
