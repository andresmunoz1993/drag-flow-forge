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
  /** Código de vendedor en SAP Business One (SlpCode) */
  idSAP?: string;
}

export interface SapConfig {
  baseUrl: string;    // e.g. "https://sap-server:50000"
  companyDB: string;  // e.g. "ALLERS_PROD"
  username: string;   // SAP Service Layer user
  password: string;
  queryName: string;  // Nombre de la xSQL query en Service Layer
}

/** Configuración del módulo de importación automática desde SP */
export interface SpAutoImportConfig {
  enabled: boolean;
  /** Nombre del stored procedure a ejecutar en el backend */
  spName: string;
  /** ID del usuario al que se asignarán los casos importados */
  defaultAssigneeId: string;
  /** ID del carril destino (si no se especifica, se usa el primero) */
  targetColumnId?: string;
}

/**
 * Registro devuelto por el SP vía backend.
 * El frontend usa `externalId` para evitar importaciones duplicadas.
 */
export interface SpCaseRecord {
  /** ID único del registro en el sistema origen */
  externalId: string;
  title: string;
  description?: string;
  /**
   * Datos para campos personalizados del tablero.
   * Clave = nombre del campo personalizado, valor = dato a guardar.
   */
  customData?: Record<string, string>;
}

export interface SapOrderResult {
  docNum: string;
  itemCount: number;
  totalValue: number;
  currency: string;
  salesPersonCode: string;
  salesPersonName: string;
}

export interface Column {
  id: string;
  name: string;
  order: number;
  /** UUID del responsable asignado por defecto al mover un caso a este carril. */
  defaultAssigneeId?: string | null;
  /** Tiempo máximo (en horas) que un caso debería permanecer en este carril. null = sin límite. */
  maxHours?: number | null;
}

export interface CustomField {
  id: string;
  name: string;
  type: 'dropdown' | 'text' | 'number' | 'date';
  options: string[];
  /** Para campos de tipo fecha: base de cálculo automático */
  formula?: 'createdAt';
  /** Días a sumar a la fecha base */
  formulaDays?: number;
}

export interface BoardLanding {
  enabled: boolean;
}

export interface Board {
  id: string;
  name: string;
  prefix: string;
  nextNum: number;
  columns: Column[];
  customFields: CustomField[];
  landing?: BoardLanding;
  sap?: SapConfig;
  spAutoImport?: SpAutoImportConfig;
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
  /** ID externo del SP de origen. Presente solo en casos creados via SP auto-import. */
  spExternalId?: string;
  /** Código externo del cliente para vincular documentos sincronizados vía SFTP (ej: CN13718). */
  clientRef?: string;
}

// ─── Reportes ─────────────────────────────────────────────────────────────────

export interface ReportParam {
  name:         string;
  label:        string;
  type:         'date' | 'text' | 'number' | 'select';
  required?:    boolean;
  options?:     string[];
  default?:     string;
  placeholder?: string;
}

export interface ReportDefinition {
  id:          string;
  name:        string;
  description: string;
  params:      ReportParam[];
}

export interface ReportResult {
  columns: string[];
  rows:    Record<string, unknown>[];
  total:   number;
}

// ─── Menciones ────────────────────────────────────────────────────────────────

/** Colaborador etiquetado con @mención en un caso. */
export interface CardMention {
  userId:           string;
  userName:         string;
  userEmail:        string;
  mentionedByName:  string;
  firstMentionedAt: string;
  context:          'description' | 'comment';
}

/** Documento sincronizado desde SFTP, vinculado a un caso por clientRef. */
export interface ClientDocument {
  id: number;
  cardId: string | null;
  clientId: string;
  nombreArchivo: string;
  tipo: string;
  rutaLocal: string;
  fechaSincronizacion: string;
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
