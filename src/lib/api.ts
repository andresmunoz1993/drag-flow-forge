/**
 * api.ts — Cliente HTTP centralizado para el backend REST de PostgreSQL.
 * Todas las llamadas al backend pasan por aquí.
 */

import type { Board, Card, Column, Comment, CustomField, User } from '@/types';

// En dev, el proxy de Vite redirige /api → localhost:3001 (misma origin, sin CORS).
// En producción, definir VITE_BACKEND_URL con la URL del servidor backend.
const BASE = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? '';

// ─── Token management ────────────────────────────────────────────────────────

export const setAuthToken = (token: string | null) => {
  if (token) localStorage.setItem('auth_token', token);
  else localStorage.removeItem('auth_token');
};

export const getAuthToken = (): string | null => localStorage.getItem('auth_token');

// ─── helpers ──────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500; // duplica en cada intento: 500ms, 1000ms, 1500ms

async function request<T>(method: string, path: string, body?: unknown, attempt = 1): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    // Error de red (servidor caído, sin conexión) — reintentar con backoff
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
      return request<T>(method, path, body, attempt + 1);
    }
    throw new Error('Sin conexión con el servidor. Verifica tu red.');
  }

  if (!res.ok) {
    // Token expirado o inválido → limpiar sesión y recargar al login
    if (res.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.reload();
    }
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

const GET    = <T>(path: string)               => request<T>('GET',    path);
const POST   = <T>(path: string, body: unknown) => request<T>('POST',   path, body);
const PUT    = <T>(path: string, body: unknown) => request<T>('PUT',    path, body);
const DELETE = <T>(path: string, body?: unknown) => request<T>('DELETE', path, body);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginResponse extends User {
  boardRoles: Record<string, string>;
  token?: string;
}

export const apiLogin = (username: string, password: string): Promise<LoginResponse> =>
  POST('/api/auth/login', { username, password });

export const apiGetMe = (): Promise<LoginResponse> =>
  GET('/api/auth/me');

// ─── Polling ─────────────────────────────────────────────────────────────────

export const apiCheckCards = (boardId: string): Promise<{ count: number; lastChange: string | null }> =>
  GET(`/api/cards/check?boardId=${boardId}`);

// ─── Users ────────────────────────────────────────────────────────────────────

export const apiGetUsers = (): Promise<User[]> =>
  GET('/api/users');

export const apiCreateUser = (data: Omit<User, 'id' | 'createdAt'> & { boardRoles: Record<string, string> }): Promise<User> =>
  POST('/api/users', data);

export const apiUpdateUser = (id: string, data: Partial<User> & { boardRoles?: Record<string, string> }): Promise<User> =>
  PUT(`/api/users/${id}`, data);

export const apiDeleteUser = (id: string): Promise<{ ok: boolean }> =>
  DELETE(`/api/users/${id}`);

// ─── Boards ───────────────────────────────────────────────────────────────────

export const apiGetBoards = (): Promise<Board[]> =>
  GET('/api/boards');

export const apiCreateBoard = (data: { name: string; prefix: string }): Promise<Board> =>
  POST('/api/boards', data);

export const apiUpdateBoard = (id: string, data: Partial<Board>): Promise<Board> =>
  PUT(`/api/boards/${id}`, data);

export const apiDeleteBoard = (id: string): Promise<{ ok: boolean }> =>
  DELETE(`/api/boards/${id}`);

export const apiSaveColumns = (boardId: string, cols: Array<{ id?: string; name: string; order: number }>): Promise<Column[]> =>
  PUT(`/api/boards/${boardId}/columns`, { columns: cols });

// ─── Cards ────────────────────────────────────────────────────────────────────

export const apiGetCards = (boardId?: string): Promise<Card[]> =>
  GET(`/api/cards${boardId ? `?boardId=${boardId}` : ''}`);

export const apiCreateCard = (data: Omit<Card, 'id' | 'code'>): Promise<Card> =>
  POST('/api/cards', data);

export const apiUpdateCard = (id: string, data: Partial<Card>): Promise<Card> =>
  PUT(`/api/cards/${id}`, data);

export const apiDeleteCard = (id: string, modifiedBy?: string): Promise<{ ok: boolean }> =>
  DELETE(`/api/cards/${id}`, { modifiedBy });

// ─── Comments ─────────────────────────────────────────────────────────────────

export const apiCreateComment = (cardId: string, data: Omit<Comment, 'id'>): Promise<Comment> =>
  POST(`/api/cards/${cardId}/comments`, data);

export const apiUpdateComment = (id: string, data: Partial<Comment>): Promise<Comment> =>
  PUT(`/api/comments/${id}`, data);

export const apiDeleteComment = (id: string): Promise<{ ok: boolean }> =>
  DELETE(`/api/comments/${id}`);

// ─── Custom Fields ────────────────────────────────────────────────────────────

export const apiGetCustomFields = (boardId?: string): Promise<CustomField[]> =>
  GET(`/api/custom-fields${boardId ? `?boardId=${boardId}` : ''}`);

export const apiCreateCustomField = (data: Omit<CustomField, 'id'> & { boardId: string }): Promise<CustomField> =>
  POST('/api/custom-fields', data);

export const apiUpdateCustomField = (id: string, data: Partial<CustomField>): Promise<CustomField> =>
  PUT(`/api/custom-fields/${id}`, data);

export const apiDeleteCustomField = (id: string): Promise<{ ok: boolean }> =>
  DELETE(`/api/custom-fields/${id}`);

// ─── Counter ──────────────────────────────────────────────────────────────────

export const apiGetCounter = (): Promise<{ next_card_num: number }> =>
  GET('/api/counter');

// ─── SP (SharePoint) ──────────────────────────────────────────────────────────

export const apiGetSpRecords = (boardId: string, spName: string): Promise<{ records: import('@/types').SpCaseRecord[] }> =>
  GET(`/api/sp/fetch?boardId=${encodeURIComponent(boardId)}&spName=${encodeURIComponent(spName)}`);

// ─── Documentos SFTP ──────────────────────────────────────────────────────────

export const apiGetDocumentos = (cardId: string): Promise<import('@/types').ClientDocument[]> =>
  GET(`/api/documentos/card/${cardId}`);

export const apiSyncSftp = (): Promise<{ total: number; imported: number; skipped: number; errors: string[] }> =>
  POST('/api/documentos/sync', {});

/** Descarga el PDF como Blob para mostrarlo con URL.createObjectURL */
export const apiGetDocumentoPdf = async (id: number): Promise<Blob> => {
  const token = getAuthToken();
  const res = await fetch(`${BASE}/api/documentos/file/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
};
