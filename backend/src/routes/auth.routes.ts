import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/index';
import { users, userBoardRoles } from '../db/schema';

const router = Router();

const JWT_SECRET  = process.env.JWT_SECRET || 'allers-internal-jwt-secret';
const JWT_EXPIRES = '7d'; // 7 días — app interna, sesión larga

// Helper: serializar usuario + roles
async function serializeUserWithRoles(user: typeof users.$inferSelect) {
  const roles = await db
    .select()
    .from(userBoardRoles)
    .where(eq(userBoardRoles.userId, user.id));

  const boardRoles: Record<string, string> = {};
  for (const r of roles) boardRoles[r.boardId] = r.role;

  return {
    id:           user.id,
    username:     user.username,
    fullName:     user.fullName,
    email:        user.email,
    isAdminTotal: user.isAdminTotal,
    active:       user.active,
    createdAt:    user.createdAt,
    idSAP:        user.idSap ?? undefined,
    boardRoles,
  };
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos.' });
  }
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    const passwordValid = user
      ? await bcrypt.compare(String(password), user.passwordHash)
      : false;
    if (!user || !passwordValid) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }
    if (!user.active) {
      return res.status(403).json({ error: 'Usuario inactivo.' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    const serialized = await serializeUserWithRoles(user);
    return res.json({ ...serialized, token });
  } catch (err: any) {
    console.error('[auth] login error:', err);
    return res.status(500).json({ error: 'Error interno.', detail: err.message });
  }
});

// GET /api/auth/me  — restaurar sesión desde JWT
router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido.' });
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { userId: string };
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Sesión inválida.' });
    }

    const serialized = await serializeUserWithRoles(user);
    return res.json({ ...serialized, token: authHeader.slice(7) });
  } catch {
    return res.status(401).json({ error: 'Token expirado o inválido.' });
  }
});

export default router;
