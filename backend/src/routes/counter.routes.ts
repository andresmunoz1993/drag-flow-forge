import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { globalCounter } from '../db/schema';

const router = Router();

// GET /api/counter  — retorna el valor actual del contador global
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [row] = await db.select().from(globalCounter).where(eq(globalCounter.id, 1));
    return res.json({ next_card_num: row?.nextCardNum ?? 1 });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al obtener contador.', detail: err.message });
  }
});

export default router;
