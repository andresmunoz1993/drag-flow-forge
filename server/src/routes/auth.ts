import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, userBoardRoles } from '../db/schema.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    return;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.username, username.trim().toLowerCase()),
  });

  if (!user) {
    res.status(401).json({ error: 'Credenciales incorrectas' });
    return;
  }
  if (!user.active) {
    res.status(401).json({ error: 'Usuario desactivado' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Credenciales incorrectas' });
    return;
  }

  const token = signToken({ sub: user.id, isAdmin: user.isAdminTotal });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    secure: process.env.NODE_ENV === 'production',
  });

  // Load board roles
  const roles = await db.select().from(userBoardRoles).where(eq(userBoardRoles.userId, user.id));
  const boardRoles: Record<string, string> = {};
  for (const r of roles) boardRoles[r.boardId] = r.role;

  res.json({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    isAdminTotal: user.isAdminTotal,
    active: user.active,
    boardRoles,
    createdAt: user.createdAt,
  });
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, req.user!.sub),
  });
  if (!user) {
    res.status(404).json({ error: 'Usuario no encontrado' });
    return;
  }

  const roles = await db.select().from(userBoardRoles).where(eq(userBoardRoles.userId, user.id));
  const boardRoles: Record<string, string> = {};
  for (const r of roles) boardRoles[r.boardId] = r.role;

  res.json({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    isAdminTotal: user.isAdminTotal,
    active: user.active,
    boardRoles,
    createdAt: user.createdAt,
  });
});

export default router;
