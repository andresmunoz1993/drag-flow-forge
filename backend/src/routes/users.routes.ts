import { Router, Request, Response } from 'express';
import { eq, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../db/index';
import { users, userBoardRoles } from '../db/schema';

const router = Router();

// Serializa un usuario con sus boardRoles
async function serializeUser(user: typeof users.$inferSelect) {
  const roles = await db.select().from(userBoardRoles).where(eq(userBoardRoles.userId, user.id));
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

// GET /api/users — batch load roles (2 queries instead of N+1)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const allUsers = await db.select().from(users).orderBy(users.createdAt);
    if (!allUsers.length) return res.json([]);

    // Batch load all roles in 1 query
    const userIds = allUsers.map(u => u.id);
    const allRoles = await db.select().from(userBoardRoles)
      .where(inArray(userBoardRoles.userId, userIds));

    const rolesMap = new Map<string, Record<string, string>>();
    for (const r of allRoles) {
      if (!rolesMap.has(r.userId)) rolesMap.set(r.userId, {});
      rolesMap.get(r.userId)![r.boardId] = r.role;
    }

    const result = allUsers.map(user => ({
      id:           user.id,
      username:     user.username,
      fullName:     user.fullName,
      email:        user.email,
      isAdminTotal: user.isAdminTotal,
      active:       user.active,
      createdAt:    user.createdAt,
      idSAP:        user.idSap ?? undefined,
      boardRoles:   rolesMap.get(user.id) ?? {},
    }));

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al obtener usuarios.', detail: err.message });
  }
});

// POST /api/users
router.post('/', async (req: Request, res: Response) => {
  const { username, password, fullName, email, isAdminTotal, active, boardRoles, idSAP } = req.body;
  if (!username || typeof username !== 'string' || username.trim().length < 3 || username.length > 50)
    return res.status(400).json({ error: 'username requerido (3-50 caracteres).' });
  if (!password || typeof password !== 'string' || String(password).length < 6)
    return res.status(400).json({ error: 'password requerido (mínimo 6 caracteres).' });
  if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0 || fullName.length > 100)
    return res.status(400).json({ error: 'fullName requerido (máx 100 caracteres).' });
  try {
    const hashedPassword = await bcrypt.hash(String(password), 10);
    const [newUser] = await db.insert(users).values({
      username,
      passwordHash: hashedPassword,
      fullName,
      email:        email ?? '',
      isAdminTotal: !!isAdminTotal,
      active:       active !== false,
      idSap:        idSAP ?? null,
    }).returning();

    // Insertar roles
    if (boardRoles && !isAdminTotal) {
      const roleRows = Object.entries(boardRoles).map(([boardId, role]) => ({
        userId: newUser.id, boardId, role: role as any,
      }));
      if (roleRows.length) await db.insert(userBoardRoles).values(roleRows);
    }

    return res.status(201).json(await serializeUser(newUser));
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al crear usuario.', detail: err.message });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { username, password, fullName, email, isAdminTotal, active, boardRoles, idSAP } = req.body;
  try {
    const updateData: Partial<typeof users.$inferInsert> = {};
    if (username  !== undefined) updateData.username     = username;
    if (password  !== undefined) updateData.passwordHash = await bcrypt.hash(String(password), 10);
    if (fullName  !== undefined) updateData.fullName     = fullName;
    if (email     !== undefined) updateData.email        = email;
    if (isAdminTotal !== undefined) updateData.isAdminTotal = isAdminTotal;
    if (active    !== undefined) updateData.active       = active;
    if (idSAP     !== undefined) updateData.idSap        = idSAP ?? null;

    const [updated] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    if (!updated) return res.status(404).json({ error: 'Usuario no encontrado.' });

    // Reemplazar roles: eliminar y reinsertar
    await db.delete(userBoardRoles).where(eq(userBoardRoles.userId, id));
    if (boardRoles && !updated.isAdminTotal) {
      const roleRows = Object.entries(boardRoles).map(([boardId, role]) => ({
        userId: id, boardId, role: role as any,
      }));
      if (roleRows.length) await db.insert(userBoardRoles).values(roleRows);
    }

    return res.json(await serializeUser(updated));
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al actualizar usuario.', detail: err.message });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    await db.delete(userBoardRoles).where(eq(userBoardRoles.userId, id));
    await db.delete(users).where(eq(users.id, id));
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al eliminar usuario.', detail: err.message });
  }
});

export default router;
