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

// Decimal text preserves the entered amount without binary floating-point storage.
export const inventoryBatches = sqliteTable(
  'inventory_batches',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    containerId: text('container_id')
      .notNull()
      .references(() => containers.id, { onDelete: 'restrict' }),
    amount: text('amount'),
    unit: text('unit', {
      enum: ['g', 'kg', 'ml', 'L', '개', '팩', '봉', '병', '캔'],
    }).notNull(),
    quantityKnown: integer('quantity_known', { mode: 'boolean' }).notNull(),
    purchasedOn: text('purchased_on'),
    expiresOn: text('expires_on'),
    notes: text('notes').notNull().default(''),
    status: text('status', {
      enum: ['available', 'exhausted', 'discarded', 'deleted'],
    }).notNull(),
    lastOperationId: text('last_operation_id').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('inventory_batches_container_idx').on(table.containerId),
    index('inventory_batches_expiry_idx').on(table.status, table.expiresOn),
    check(
      'inventory_batches_name_check',
      sql`length(trim(${table.name})) BETWEEN 1 AND 100`,
    ),
    check(
      'inventory_batches_unit_check',
      sql`${table.unit} IN ('g','kg','ml','L','개','팩','봉','병','캔')`,
    ),
    check(
      'inventory_batches_quantity_check',
      sql`(${table.quantityKnown} = 0 AND ${table.amount} IS NULL) OR (${table.quantityKnown} = 1 AND ${table.amount} IS NOT NULL AND length(${table.amount}) BETWEEN 1 AND 16 AND ${table.amount} NOT GLOB '*[^0-9.]*' AND ${table.amount} GLOB '[0-9]*' AND length(${table.amount}) - length(replace(${table.amount}, '.', '')) <= 1 AND substr(${table.amount}, -1) <> '.' AND CAST(${table.amount} AS REAL) >= 0)`,
    ),
    check(
      'inventory_batches_status_check',
      sql`${table.status} IN ('available','exhausted','discarded','deleted')`,
    ),
    check(
      'inventory_batches_exhausted_check',
      sql`${table.status} <> 'exhausted' OR (${table.quantityKnown} = 1 AND CAST(${table.amount} AS REAL) = 0)`,
    ),
    check(
      'inventory_batches_available_check',
      sql`${table.status} <> 'available' OR ${table.quantityKnown} = 0 OR CAST(${table.amount} AS REAL) > 0`,
    ),
  ],
);

export type InventoryBatch = typeof inventoryBatches.$inferSelect;

export const inventoryTransactions = sqliteTable(
  'inventory_transactions',
  {
    sequence: integer('sequence').primaryKey({ autoIncrement: true }),
    id: text('id').notNull().unique(),
    operationId: text('operation_id').notNull().unique(),
    batchId: text('batch_id')
      .notNull()
      .references(() => inventoryBatches.id, { onDelete: 'restrict' }),
    type: text('type', {
      enum: ['create', 'update', 'delete', 'undo'],
    }).notNull(),
    amountDelta: text('amount_delta'),
    before: text('before', { mode: 'json' }).$type<InventoryBatch | null>(),
    after: text('after', { mode: 'json' }).$type<InventoryBatch>().notNull(),
    reversesOperationId: text('reverses_operation_id').unique(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('inventory_transactions_batch_idx').on(table.batchId),
    check(
      'inventory_transactions_type_check',
      sql`${table.type} IN ('create','update','delete','undo')`,
    ),
  ],
);
