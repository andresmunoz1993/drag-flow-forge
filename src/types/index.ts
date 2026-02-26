export interface User {
  id: string;
  username: string;
  password: string;
  fullName: string;
  email: string;
  isAdminTotal: boolean;
  active: boolean;
  boardRoles: Record<string, 'admin_tablero' | 'ejecutor' | 'consulta'>;
  createdAt: string;
}

export interface Column {
  id: string;
  name: string;
  order: number;
}

export interface CustomField {
  id: string;
  name: string;
  type: 'dropdown' | 'text' | 'number' | 'date';
  options: string[];
}

export interface Board {
  id: string;
  name: string;
  prefix: string;
  nextNum: number;
  columns: Column[];
  customFields: CustomField[];
}

export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  data: string;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  files: FileAttachment[];
  createdAt: string;
  modifiedBy: string | null;
  modifiedAt: string | null;
}

export interface AssigneeHistoryEntry {
  id: string;
  assigneeId: string;
  assigneeName: string;
  assignedAt: string;
}

export interface MoveHistoryEntry {
  id: string;
  fromCol: string;
  toCol: string;
  movedAt: string;
}

export interface Card {
  id: string;
  boardId: string;
  columnId: string;
  code: string;
  title: string;
  description: string;
  priority: 'alta' | 'media' | 'baja' | '';
  type: string;
  assigneeId: string;
  reporterId: string;
  reporterName: string;
  createdAt: string;
  modifiedBy: string | null;
  modifiedAt: string | null;
  deleted: boolean;
  closed: boolean;
  closedAt: string | null;
  closedBy: string | null;
  files: FileAttachment[];
  comments: Comment[];
  customData: Record<string, string>;
  assigneeHistory: AssigneeHistoryEntry[];
  moveHistory: MoveHistoryEntry[];
}

export type RoleKey = 'admin_tablero' | 'ejecutor' | 'consulta';

export const ROLE_LABELS: Record<RoleKey, string> = {
  admin_tablero: 'Admin Tablero',
  ejecutor: 'Ejecutor',
  consulta: 'Consulta',
};

export const ROLE_COLORS: Record<RoleKey, string> = {
  admin_tablero: 'warning',
  ejecutor: 'primary',
  consulta: 'gray',
};

export const CF_TYPES: Record<string, string> = {
  dropdown: 'Lista desplegable',
  text: 'Texto',
  number: 'Número',
  date: 'Fecha',
};
