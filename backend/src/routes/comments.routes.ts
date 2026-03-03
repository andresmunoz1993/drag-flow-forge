import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db, pool } from '../db/index';
import { comments, commentFiles, cards } from '../db/schema';

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
