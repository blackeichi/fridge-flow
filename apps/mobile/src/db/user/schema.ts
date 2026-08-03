import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const localOwners = sqliteTable(
  'local_owners',
  {
    ownerSubSha256: text('owner_sub_sha256').primaryKey(),
    createdAt: text('created_at').notNull(),
    lastLoginAt: text('last_login_at').notNull(),
  },
  (table) => [
    check(
      'local_owners_owner_hash_check',
      sql`length(${table.ownerSubSha256}) = 64 AND ${table.ownerSubSha256} NOT GLOB '*[^0-9a-f]*'`,
    ),
  ],
);

export const appProfiles = sqliteTable(
  'app_profiles',
  {
    id: text('id').primaryKey(),
    locale: text('locale').notNull().default('ko-KR'),
    timezone: text('timezone').notNull(),
    preferences: text('preferences', { mode: 'json' })
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    allergyFlags: text('allergy_flags', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default([]),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    check('app_profiles_singleton_id_check', sql`${table.id} = 'default'`),
  ],
);

export const storageSpaces = sqliteTable(
  'storage_spaces',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: text('type', {
      enum: ['refrigerator', 'freezer', 'pantry'],
    }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('storage_spaces_name_unique').on(table.name),
    index('storage_spaces_sort_order_idx').on(table.sortOrder),
    check(
      'storage_spaces_name_check',
      sql`length(trim(${table.name})) BETWEEN 1 AND 60`,
    ),
    check(
      'storage_spaces_type_check',
      sql`${table.type} IN ('refrigerator', 'freezer', 'pantry')`,
    ),
    check('storage_spaces_sort_order_check', sql`${table.sortOrder} >= 0`),
  ],
);

export const containers = sqliteTable(
  'containers',
  {
    id: text('id').primaryKey(),
    spaceId: text('space_id')
      .notNull()
      .references(() => storageSpaces.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'),
    name: text('name').notNull(),
    gridRow: integer('grid_row').notNull(),
    gridColumn: integer('grid_column').notNull(),
    gridWidth: integer('grid_width').notNull().default(1),
    gridHeight: integer('grid_height').notNull().default(1),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('containers_space_id_idx').on(table.spaceId),
    index('containers_parent_id_idx').on(table.parentId),
    index('containers_sort_order_idx').on(table.spaceId, table.sortOrder),
    uniqueIndex('containers_id_space_id_unique').on(table.id, table.spaceId),
    foreignKey({
      columns: [table.parentId, table.spaceId],
      foreignColumns: [table.id, table.spaceId],
      name: 'containers_parent_same_space_fk',
    }).onDelete('restrict'),
    check(
      'containers_name_check',
      sql`length(trim(${table.name})) BETWEEN 1 AND 60`,
    ),
    check('containers_grid_row_check', sql`${table.gridRow} >= 0`),
    check('containers_grid_column_check', sql`${table.gridColumn} >= 0`),
    check('containers_grid_width_check', sql`${table.gridWidth} > 0`),
    check('containers_grid_height_check', sql`${table.gridHeight} > 0`),
    check('containers_sort_order_check', sql`${table.sortOrder} >= 0`),
    check(
      'containers_parent_self_check',
      sql`${table.parentId} IS NULL OR ${table.parentId} <> ${table.id}`,
    ),
  ],
);

export type LocalOwner = typeof localOwners.$inferSelect;
export type NewLocalOwner = typeof localOwners.$inferInsert;
export type AppProfile = typeof appProfiles.$inferSelect;
export type NewAppProfile = typeof appProfiles.$inferInsert;
export type StorageSpace = typeof storageSpaces.$inferSelect;
export type NewStorageSpace = typeof storageSpaces.$inferInsert;
export type Container = typeof containers.$inferSelect;
export type NewContainer = typeof containers.$inferInsert;
