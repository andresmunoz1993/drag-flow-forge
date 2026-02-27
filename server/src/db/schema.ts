import {
  pgTable, uuid, text, boolean, integer,
  timestamp, jsonb, pgEnum, index, primaryKey,
} from 'drizzle-orm/pg-core';

// Enums
export const roleEnum = pgEnum('role', ['admin_tablero', 'ejecutor', 'consulta']);
export const cfTypeEnum = pgEnum('cf_type', ['dropdown', 'text', 'number', 'date']);

// Users
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull().default(''),
  isAdminTotal: boolean('is_admin_total').notNull().default(false),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Boards
export const boards = pgTable('boards', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  prefix: text('prefix').notNull().unique(),
  nextNum: integer('next_num').notNull().default(101),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// User ↔ Board roles (many-to-many)
export const userBoardRoles = pgTable('user_board_roles', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  role: roleEnum('role').notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.boardId] }),
]);

// Columns (kanban lanes)
export const columns = pgTable('columns', {
  id: uuid('id').defaultRandom().primaryKey(),
  boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  order: integer('order').notNull(),
});

// Custom fields per board
export const customFields = pgTable('custom_fields', {
  id: uuid('id').defaultRandom().primaryKey(),
  boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: cfTypeEnum('type').notNull(),
  options: jsonb('options').$type<string[]>().notNull().default([]),
});

// Cards
export const cards = pgTable('cards', {
  id: uuid('id').defaultRandom().primaryKey(),
  boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  columnId: uuid('column_id').notNull().references(() => columns.id),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  priority: text('priority').notNull().default(''),
  type: text('type').notNull().default(''),
  assigneeId: uuid('assignee_id').references(() => users.id),
  reporterId: uuid('reporter_id').references(() => users.id),
  reporterName: text('reporter_name').notNull(),
  customData: jsonb('custom_data').$type<Record<string, string>>().notNull().default({}),
  assigneeHistory: jsonb('assignee_history').$type<AssigneeHistoryEntry[]>().notNull().default([]),
  moveHistory: jsonb('move_history').$type<MoveHistoryEntry[]>().notNull().default([]),
  deleted: boolean('deleted').notNull().default(false),
  closed: boolean('closed').notNull().default(false),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedBy: text('closed_by'),
  modifiedBy: text('modified_by'),
  modifiedAt: timestamp('modified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('cards_board_idx').on(t.boardId),
  index('cards_column_idx').on(t.columnId),
]);

// Card file attachments
export const cardFiles = pgTable('card_files', {
  id: uuid('id').defaultRandom().primaryKey(),
  cardId: uuid('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  size: integer('size').notNull(),
  mimeType: text('mime_type').notNull(),
  data: text('data').notNull(), // base64
});

// Comments
export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  cardId: uuid('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').references(() => users.id),
  authorName: text('author_name').notNull(),
  text: text('text').notNull().default(''),
  modifiedBy: text('modified_by'),
  modifiedAt: timestamp('modified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('comments_card_idx').on(t.cardId),
]);

// Comment file attachments
export const commentFiles = pgTable('comment_files', {
  id: uuid('id').defaultRandom().primaryKey(),
  commentId: uuid('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  size: integer('size').notNull(),
  mimeType: text('mime_type').notNull(),
  data: text('data').notNull(),
});

// JSON history types (stored as JSONB)
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
