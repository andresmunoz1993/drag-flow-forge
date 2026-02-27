import type { Board, Card, CustomField, User } from '@/types';

/** Calcula los campos con fórmula y los aplica sobre customData */
export const applyFormulaFields = (
  fields: CustomField[],
  customData: Record<string, string>,
  createdAt: string,
): Record<string, string> => {
  const cd = { ...customData };
  fields.forEach(cf => {
    if (cf.formula === 'createdAt' && cf.formulaDays !== undefined) {
      const d = new Date(createdAt);
      d.setDate(d.getDate() + cf.formulaDays);
      cd[cf.id] = d.toISOString().split('T')[0];
    }
  });
  return cd;
};

const PREFIX = 'a5_';

export const loadData = <T>(key: string, fallback: () => T): T => {
  const stored = localStorage.getItem(PREFIX + key);
  if (stored) return JSON.parse(stored);
  const v4 = localStorage.getItem('a_' + key);
  if (v4) {
    localStorage.setItem(PREFIX + key, v4);
    return JSON.parse(v4);
  }
  return fallback();
};

export const saveData = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch (e) {
    console.warn('Storage error', e);
  }
};

export const generateId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

export const formatDate = (d: string | null): string => {
  if (!d) return '—';
  const dt = new Date(d);
  return (
    dt.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' +
    dt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  );
};

export const formatShortDate = (d: string | null): string => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const getInitials = (name: string): string =>
  name ? name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '?';

export const formatSize = (bytes: number): string =>
  bytes < 1024 ? bytes + 'B' : bytes < 1048576 ? (bytes / 1024).toFixed(1) + 'KB' : (bytes / 1048576).toFixed(1) + 'MB';

export const getFileExt = (name: string): string =>
  name.split('.').pop()?.toUpperCase().substring(0, 4) || '';

export const MAX_FILE_SIZE = 2 * 1024 * 1024;

export const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const downloadFile = (data: string, name: string): void => {
  const a = document.createElement('a');
  a.href = data;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const defaultBoards = (): Board[] => [
  { id: 'inc', name: 'Incidencias Allers', prefix: 'AGDS', nextNum: 3900, columns: [{ id: 'c1', name: 'En Análisis', order: 0 }, { id: 'c2', name: 'Por hacer', order: 1 }, { id: 'c3', name: 'En Progreso', order: 2 }, { id: 'c4', name: 'Hecho', order: 3 }, { id: 'c5', name: 'Entregar', order: 4 }], customFields: [] },
  { id: 'cc', name: 'Allers - Call Center', prefix: 'ACC', nextNum: 74200, columns: [{ id: 'c6', name: 'Call Center', order: 0 }, { id: 'c7', name: 'Servicio al cliente', order: 1 }, { id: 'c8', name: 'Almacén', order: 2 }, { id: 'c9', name: 'Logística', order: 3 }, { id: 'c10', name: 'Calidad', order: 4 }, { id: 'c11', name: 'Serv. Técnico', order: 5 }, { id: 'c12', name: 'Cartera', order: 6 }, { id: 'c13', name: 'Compras', order: 7 }, { id: 'c14', name: 'Comercial', order: 8 }, { id: 'c15', name: 'Cotizaciones', order: 9 }, { id: 'c16', name: 'Entregado para cierre', order: 10 }, { id: 'c17', name: 'Cerrada', order: 11 }, { id: 'c18', name: 'Entregar', order: 12 }], customFields: [] },
  { id: 'sac', name: 'Allers - Servicio al cliente', prefix: 'ASAC', nextNum: 78900, columns: [{ id: 'c19', name: 'Servicio al cliente', order: 0 }, { id: 'c20', name: 'Almacén', order: 1 }, { id: 'c21', name: 'Logística', order: 2 }, { id: 'c22', name: 'Calidad', order: 3 }, { id: 'c23', name: 'Tiendas', order: 4 }, { id: 'c24', name: 'Serv. Técnico', order: 5 }, { id: 'c25', name: 'Cartera', order: 6 }, { id: 'c26', name: 'Compras', order: 7 }, { id: 'c27', name: 'Comercial', order: 8 }, { id: 'c28', name: 'Cotizaciones', order: 9 }, { id: 'c29', name: 'Entregado para cierre', order: 10 }, { id: 'c30', name: 'SEGUIMIENTO CALLCENTER', order: 11 }, { id: 'c31', name: 'Cerrada', order: 12 }, { id: 'c32', name: 'Entregar', order: 13 }], customFields: [{ id: 'cf_ffs', name: 'Fecha Final de Solución', type: 'date', options: [], formula: 'createdAt', formulaDays: 15 }], landing: { enabled: true } },
];

export const defaultUsers = (): User[] => [
  { id: '1', username: 'admin', password: 'admin123', fullName: 'Administrador General', email: 'admin@allers.com', isAdminTotal: true, active: true, boardRoles: {}, createdAt: new Date().toISOString() },
  { id: '2', username: 'mgarcia', password: 'maria123', fullName: 'María García', email: 'mgarcia@allers.com', isAdminTotal: false, active: true, boardRoles: { inc: 'admin_tablero', cc: 'ejecutor', sac: 'admin_tablero' }, createdAt: new Date().toISOString() },
  { id: '3', username: 'plopez', password: 'pedro123', fullName: 'Pedro López', email: 'plopez@allers.com', isAdminTotal: false, active: true, boardRoles: { cc: 'ejecutor', sac: 'ejecutor' }, createdAt: new Date().toISOString() },
  { id: '4', username: 'amoreno', password: 'ana123', fullName: 'Ana Moreno', email: 'amoreno@allers.com', isAdminTotal: false, active: true, boardRoles: { inc: 'consulta', sac: 'consulta' }, createdAt: new Date().toISOString() },
];

export const defaultCards = (): Card[] => [
  { id: 't1', boardId: 'inc', columnId: 'c1', code: 'AGDS-3181', title: 'Documentación y accesos ambiente de pruebas LA PRENSA', description: 'Referente al punto 1.', priority: 'alta', type: 'Mejora', assigneeId: '2', reporterId: '4', reporterName: 'Ana Moreno', createdAt: '2022-03-28T12:09:00', modifiedBy: 'María García', modifiedAt: '2023-10-17T18:29:00', deleted: false, closed: false, closedAt: null, closedBy: null, files: [], comments: [{ id: 'cm1', authorId: '2', authorName: 'María García', text: 'Queries realizados.', files: [], createdAt: '2023-08-29T10:17:00', modifiedBy: null, modifiedAt: null }], customData: {}, assigneeHistory: [], moveHistory: [] },
  { id: 't2', boardId: 'inc', columnId: 'c2', code: 'AGDS-3104', title: 'Error sale nombres de usuarios diferentes', description: '', priority: 'alta', type: 'Bug', assigneeId: '2', reporterId: '2', reporterName: 'María García', createdAt: '2022-03-15T10:00:00', modifiedBy: null, modifiedAt: null, deleted: false, closed: false, closedAt: null, closedBy: null, files: [], comments: [], customData: {}, assigneeHistory: [], moveHistory: [] },
  { id: 't3', boardId: 'inc', columnId: 'c3', code: 'AGDS-3884', title: 'CAMPO AGENTE GRUPO SAC', description: '', priority: 'alta', type: 'Soporte', assigneeId: '2', reporterId: '4', reporterName: 'Ana Moreno', createdAt: '2023-06-15T08:00:00', modifiedBy: null, modifiedAt: null, deleted: false, closed: false, closedAt: null, closedBy: null, files: [], comments: [], customData: {}, assigneeHistory: [], moveHistory: [] },
  { id: 't4', boardId: 'inc', columnId: 'c4', code: 'AGDS-3756', title: 'Compra de diadema Nicolas Vivas', description: '', priority: 'media', type: 'Soporte', assigneeId: '3', reporterId: '2', reporterName: 'María García', createdAt: '2023-02-10T11:00:00', modifiedBy: null, modifiedAt: null, deleted: false, closed: false, closedAt: null, closedBy: null, files: [], comments: [], customData: {}, assigneeHistory: [], moveHistory: [] },
];
