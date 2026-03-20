import { Router, Request, Response } from 'express';
import { eq, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../db/index';
import { users, userBoardRoles } from '../db/schema';
import { sendEmail } from '../services/email.service';

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

    // Enviar correo de bienvenida con credenciales (fire-and-forget)
    if (newUser.email) {
      sendEmail({
        to:       newUser.email,
        subject:  '[Allers] Tu cuenta ha sido creada',
        bodyType: 'HTML',
        body: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#2563eb;margin-top:0">👤 Bienvenido a Allers</h2>
            <p>Hola <strong>${newUser.fullName}</strong>,</p>
            <p>Tu cuenta ha sido creada exitosamente. Aquí están tus credenciales de acceso:</p>
            <div style="background:#f3f4f6;border-left:3px solid #2563eb;padding:12px 16px;border-radius:4px;margin:16px 0">
              <p style="margin:0 0 6px;color:#374151;font-size:14px"><strong>Usuario:</strong> ${newUser.username}</p>
              <p style="margin:0;color:#374151;font-size:14px"><strong>Contraseña:</strong> ${password}</p>
            </div>
            <p style="color:#6b7280;font-size:13px">Por seguridad, te recomendamos cambiar tu contraseña al iniciar sesión.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
            <p style="color:#6b7280;font-size:12px">Mensaje automático del sistema Allers.</p>
          </div>
        `,
      }).catch(err => console.warn('[UserEmail] No se pudo enviar correo de bienvenida:', (err as Error)?.message));
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

    // Notificar cambio de contraseña si aplica (fire-and-forget)
    if (password !== undefined && updated.email) {
      sendEmail({
        to:       updated.email,
        subject:  '[Allers] Tu contraseña ha sido modificada',
        bodyType: 'HTML',
        body: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#2563eb;margin-top:0">🔑 Cambio de contraseña</h2>
            <p>Hola <strong>${updated.fullName}</strong>,</p>
            <p>La contraseña de tu cuenta ha sido actualizada.</p>
            <div style="background:#f3f4f6;border-left:3px solid #2563eb;padding:12px 16px;border-radius:4px;margin:16px 0">
              <p style="margin:0 0 6px;color:#374151;font-size:14px"><strong>Usuario:</strong> ${updated.username}</p>
              <p style="margin:0;color:#374151;font-size:14px"><strong>Nueva contraseña:</strong> ${password}</p>
            </div>
            <p style="color:#dc2626;font-size:13px">Si no solicitaste este cambio, contacta al administrador inmediatamente.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
            <p style="color:#6b7280;font-size:12px">Mensaje automático del sistema Allers.</p>
          </div>
        `,
      }).catch(err => console.warn('[UserEmail] No se pudo enviar correo de contraseña:', (err as Error)?.message));
    }

    return res.json(await serializeUser(updated));
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al actualizar usuario.', detail: err.message });
  }
});

// DELETE /api/users/:id — soft delete (desactiva al usuario)
router.delete('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const [updated] = await db.update(users).set({ active: false }).where(eq(users.id, id)).returning();
    if (!updated) return res.status(404).json({ error: 'Usuario no encontrado.' });
    return res.json(await serializeUser(updated));
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al desactivar usuario.', detail: err.message });
  }
});

export default router;
