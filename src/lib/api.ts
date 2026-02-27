import type { User, Board, Card } from '@/types';

// Base fetch con credenciales (cookies)
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw Object.assign(new Error(err.error || 'Error en la solicitud'), { status: res.status });
  }

  return res.json() as Promise<T>;
}

// Auth
export const authApi = {
  login: (username: string, password: string) =>
    request<User>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  logout: () =>
    request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  me: () =>
    request<User>('/auth/me'),
};

// Users
export const usersApi = {
  list: () => request<User[]>('/users'),

  create: (data: Partial<User> & { password: string }) =>
    request<User>('/users', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<User> & { password?: string }) =>
    request<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    request<{ ok: boolean }>(`/users/${id}`, { method: 'DELETE' }),
};

// Boards
export const boardsApi = {
  list: () => request<Board[]>('/boards'),

  create: (data: { name: string; prefix: string }) =>
    request<Board>('/boards', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: { name?: string; prefix?: string }) =>
    request<Board>(`/boards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    request<{ ok: boolean }>(`/boards/${id}`, { method: 'DELETE' }),

  saveColumns: (boardId: string, cols: Array<{ id: string; name: string; order: number }>) =>
    request<Board>(`/boards/${boardId}/columns`, { method: 'PUT', body: JSON.stringify(cols) }),

  saveCustomFields: (boardId: string, fields: Array<{ id: string; name: string; type: string; options: string[] }>) =>
    request<Board>(`/boards/${boardId}/custom-fields`, { method: 'PUT', body: JSON.stringify(fields) }),
};

// Cards
export const cardsApi = {
  list: (boardId?: string) =>
    request<Card[]>(boardId ? `/cards?boardId=${boardId}` : '/cards'),

  create: (data: Omit<Card, 'id' | 'code' | 'createdAt' | 'modifiedBy' | 'modifiedAt'>) =>
    request<Card>('/cards', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, updates: Partial<Card>) =>
    request<Card>(`/cards/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),

  softDelete: (id: string, modifiedBy: string) =>
    request<{ ok: boolean }>(`/cards/${id}`, { method: 'DELETE', body: JSON.stringify({ modifiedBy }) }),

  move: (id: string, payload: { columnId: string; moveEntry: object; modifiedBy: string }) =>
    request<Card>(`/cards/${id}/move`, { method: 'POST', body: JSON.stringify(payload) }),

  close: (id: string, payload: { columnId: string; closedBy: string; moveEntry: object }) =>
    request<Card>(`/cards/${id}/close`, { method: 'POST', body: JSON.stringify(payload) }),

  addComment: (cardId: string, payload: { text: string; authorName: string; files: object[] }) =>
    request(`/cards/${cardId}/comments`, { method: 'POST', body: JSON.stringify(payload) }),

  updateComment: (cardId: string, commentId: string, payload: { text?: string; files?: object[]; modifiedBy?: string }) =>
    request(`/cards/${cardId}/comments/${commentId}`, { method: 'PUT', body: JSON.stringify(payload) }),

  deleteComment: (cardId: string, commentId: string) =>
    request(`/cards/${cardId}/comments/${commentId}`, { method: 'DELETE' }),
};
