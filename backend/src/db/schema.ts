import {
  pgTable, uuid, text, integer, boolean,
  timestamp, jsonb, pgEnum, primaryKey, serial,
} from 'drizzle-orm/pg-core';

// ── Enums ──────────────────────────────────────────────────────────────────────
export const cfTypeEnum  = pgEnum('cf_type', ['dropdown', 'text', 'number', 'date']);
export const roleEnum    = pgEnum('role', ['admin_tablero', 'ejecutor', 'consulta']);

// ── users ─────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id:           uuid('id').primaryKey().defaultRandom(),
  username:     text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName:     text('full_name').notNull(),
  email:        text('email').notNull(),
  isAdminTotal: boolean('is_admin_total').notNull().default(false),
  active:       boolean('active').notNull().default(true),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  idSap:        text('id_sap'),
});

// ── boards ────────────────────────────────────────────────────────────────────
export const boards = pgTable('boards', {
  id:           uuid('id').primaryKey().defaultRandom(),
  name:         text('name').notNull(),
  prefix:       text('prefix').notNull().unique(),
  nextNum:      integer('next_num').notNull().default(1),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  sapConfig:    jsonb('sap_config'),
  spAutoImport: jsonb('sp_auto_import'),
  landing:      jsonb('landing'),
});

// ── columns ───────────────────────────────────────────────────────────────────
export const columns = pgTable('columns', {
  id:      uuid('id').primaryKey().defaultRandom(),
  boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  name:    text('name').notNull(),
  order:   integer('order').notNull(),
});

// ── custom_fields ─────────────────────────────────────────────────────────────
export const customFields = pgTable('custom_fields', {
  id:          uuid('id').primaryKey().defaultRandom(),
  boardId:     uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  name:        text('name').notNull(),
  type:        cfTypeEnum('type').notNull(),
  options:     jsonb('options').$type<string[]>().default([]),
  formula:     text('formula'),
  formulaDays: integer('formula_days'),
});

// ── cards ─────────────────────────────────────────────────────────────────────
export const cards = pgTable('cards', {
  id:              uuid('id').primaryKey().defaultRandom(),
  boardId:         uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  columnId:        uuid('column_id').notNull().references(() => columns.id),
  code:            text('code').notNull().unique(),
  title:           text('title').notNull(),
  description:     text('description').notNull().default(''),
  priority:        text('priority').notNull().default(''),
  type:            text('type').notNull().default(''),
  assigneeId:      uuid('assignee_id').references(() => users.id),
  reporterId:      text('reporter_id').notNull().default(''),
  reporterName:    text('reporter_name').notNull().default(''),
  customData:      jsonb('custom_data').$type<Record<string, string>>().default({}),
  assigneeHistory: jsonb('assignee_history').$type<any[]>().default([]),
  moveHistory:     jsonb('move_history').$type<any[]>().default([]),
  deleted:         boolean('deleted').notNull().default(false),
  closed:          boolean('closed').notNull().default(false),
  closedAt:        timestamp('closed_at', { withTimezone: true }),
  closedBy:        text('closed_by'),
  modifiedBy:      text('modified_by'),
  modifiedAt:      timestamp('modified_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  num:             integer('num').notNull().default(0),
  spExternalId:    text('sp_external_id'),
  clientRef:       text('client_ref'),
});

// ── card_files ────────────────────────────────────────────────────────────────
export const cardFiles = pgTable('card_files', {
  id:       uuid('id').primaryKey().defaultRandom(),
  cardId:   uuid('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  name:     text('name').notNull(),
  size:     integer('size').notNull(),
  mimeType: text('mime_type').notNull(),
  data:     text('data').notNull(),
});

// ── comments ──────────────────────────────────────────────────────────────────
export const comments = pgTable('comments', {
  id:         uuid('id').primaryKey().defaultRandom(),
  cardId:     uuid('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  authorId:   text('author_id').notNull(),
  authorName: text('author_name').notNull(),
  text:       text('text').notNull(),
  modifiedBy: text('modified_by'),
  modifiedAt: timestamp('modified_at', { withTimezone: true }),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── comment_files ─────────────────────────────────────────────────────────────
export const commentFiles = pgTable('comment_files', {
  id:        uuid('id').primaryKey().defaultRandom(),
  commentId: uuid('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  size:      integer('size').notNull(),
  mimeType:  text('mime_type').notNull(),
  data:      text('data').notNull(),
});

// ── global_counter ────────────────────────────────────────────────────────────
export const globalCounter = pgTable('global_counter', {
  id:          integer('id').primaryKey(),
  nextCardNum: integer('next_card_num').notNull().default(1),
});

// ── adjuntos_clientes ─────────────────────────────────────────────────────────
export const adjuntosClientes = pgTable('adjuntos_clientes', {
  id:                   serial('id').primaryKey(),
  cardId:               uuid('card_id').references(() => cards.id, { onDelete: 'cascade' }),
  clientId:             text('client_id').notNull(),
  nombreArchivo:        text('nombre_archivo').notNull(),
  tipo:                 text('tipo').notNull(),
  rutaLocal:            text('ruta_local').notNull(),
  fechaSincronizacion:  timestamp('fecha_sincronizacion', { withTimezone: true }).notNull().defaultNow(),
});

// ── card_mentions ─────────────────────────────────────────────────────────────
export const cardMentions = pgTable('card_mentions', {
  id:                uuid('id').primaryKey().defaultRandom(),
  cardId:            uuid('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  userId:            uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mentionedById:     text('mentioned_by_id').notNull(),
  mentionedByName:   text('mentioned_by_name').notNull(),
  firstMentionedAt:  timestamp('first_mentioned_at', { withTimezone: true }).notNull().defaultNow(),
  context:           text('context').notNull().default('description'), // 'description' | 'comment'
});

// ── user_board_roles ──────────────────────────────────────────────────────────
export const userBoardRoles = pgTable('user_board_roles', {
  userId:  uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  role:    roleEnum('role').notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.userId, t.boardId] }) }));
