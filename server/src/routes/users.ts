import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, userBoardRoles } from '../db/schema.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

// Helper: load user with boardRoles
async function userWithRoles(userId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return null;
  const roles = await db.select().from(userBoardRoles).where(eq(userBoardRoles.userId, userId));
  const boardRoles: Record<string, string> = {};
  for (const r of roles) boardRoles[r.boardId] = r.role;
  return { ...user, boardRoles };
}

// GET /api/users — todos los autenticados (necesario para ver nombres en tarjetas)
router.get('/', requireAuth, async (_req, res) => {
  const allUsers = await db.select().from(users);
  const allRoles = await db.select().from(userBoardRoles);

  const result = allUsers.map(u => {
    const boardRoles: Record<string, string> = {};
    allRoles.filter(r => r.userId === u.id).forEach(r => { boardRoles[r.boardId] = r.role; });
    return { ...u, boardRoles };
  });
  res.json(result);
});

// POST /api/users — admin only
router.post('/', requireAdmin, async (req, res) => {
  const { username, password, fullName, email, isAdminTotal, active, boardRoles } =
    req.body as {
      username: string; password: string; fullName: string; email?: string;
      isAdminTotal?: boolean; active?: boolean; boardRoles?: Record<string, string>;
    };

  if (!username || !password || !fullName) {
    res.status(400).json({ error: 'Campos requeridos: username, password, fullName' });
    return;
  }

  const existing = await db.query.users.findFirst({ where: eq(users.username, username.toLowerCase()) });
  if (existing) {
    res.status(409).json({ error: 'El usuario ya existe' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [newUser] = await db.insert(users).values({
    username: username.toLowerCase(),
    passwordHash,
    fullName,
    email: email || '',
    isAdminTotal: isAdminTotal ?? false,
    active: active ?? true,
  }).returning();

  // Insert board roles
  if (!newUser.isAdminTotal && boardRoles && Object.keys(boardRoles).length > 0) {
    await db.insert(userBoardRoles).values(
      Object.entries(boardRoles).map(([boardId, role]) => ({
        userId: newUser.id,
        boardId,
        role: role as 'admin_tablero' | 'ejecutor' | 'consulta',
      }))
    );
  }

  res.status(201).json(await userWithRoles(newUser.id));
});

// PUT /api/users/:id — admin only (or self for non-sensitive fields)
router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const me = req.user!;

  // Non-admins can only update themselves
  if (!me.isAdmin && me.sub !== id) {
    res.status(403).json({ error: 'Sin permisos' });
    return;
  }

  const { password, fullName, email, isAdminTotal, active, boardRoles } =
    req.body as {
      password?: string; fullName?: string; email?: string;
      isAdminTotal?: boolean; active?: boolean; boardRoles?: Record<string, string>;
    };

  const updateData: Partial<typeof users.$inferInsert> = {};
  if (fullName) updateData.fullName = fullName;
  if (email !== undefined) updateData.email = email;
  if (password) updateData.passwordHash = await bcrypt.hash(password, 10);
  // Only admins can change these
  if (me.isAdmin && me.sub !== id) {
    if (isAdminTotal !== undefined) updateData.isAdminTotal = isAdminTotal;
    if (active !== undefined) updateData.active = active;
  }

  await db.update(users).set(updateData).where(eq(users.id, id));

  // Update board roles (admin only, not self)
  if (me.isAdmin && boardRoles !== undefined) {
    await db.delete(userBoardRoles).where(eq(userBoardRoles.userId, id));
    const isAdminNow = isAdminTotal ?? (await db.query.users.findFirst({ where: eq(users.id, id) }))?.isAdminTotal;
    if (!isAdminNow && Object.keys(boardRoles).length > 0) {
      await db.insert(userBoardRoles).values(
        Object.entries(boardRoles).map(([boardId, role]) => ({
          userId: id,
          boardId,
          role: role as 'admin_tablero' | 'ejecutor' | 'consulta',
        }))
      );
    }
  }

  const updated = await userWithRoles(id);
  if (!updated) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
  res.json(updated);
});

// DELETE /api/users/:id — admin only
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (id === req.user!.sub) {
    res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    return;
  }
  await db.delete(users).where(eq(users.id, id));
  res.json({ ok: true });
});

export default router;
