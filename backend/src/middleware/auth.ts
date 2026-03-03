import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'allers-internal-jwt-secret';

export interface AuthPayload {
  userId: string;
  username: string;
}

/**
 * Middleware que exige JWT válido.
 * Adjunta `req.user` con { userId, username } si el token es válido.
 * Devuelve 401 si no hay token o es inválido.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido.' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as AuthPayload;
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token expirado o inválido.' });
  }
}
