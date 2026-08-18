import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  real,
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

export const customIngredients = sqliteTable(
  'custom_ingredients',
  {
    id: text('id').primaryKey(),
    canonicalName: text('canonical_name').notNull(),
    aliases: text('aliases', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default([]),
    category: text('category'),
    defaultUnit: text('default_unit', {
      enum: ['g', 'kg', 'ml', 'L', 'piece', 'pack', 'bag', 'bottle', 'can'],
    }).notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('custom_ingredients_canonical_name_unique').on(
      table.canonicalName,
    ),
    check(
      'custom_ingredients_canonical_name_check',
      sql`length(trim(${table.canonicalName})) BETWEEN 1 AND 100`,
    ),
    check(
      'custom_ingredients_default_unit_check',
      sql`${table.defaultUnit} IN ('g', 'kg', 'ml', 'L', 'piece', 'pack', 'bag', 'bottle', 'can')`,
    ),
  ],
);

export const inventoryBatches = sqliteTable(
  'inventory_batches',
  {
    id: text('id').primaryKey(),
    ingredientSource: text('ingredient_source', {
      enum: ['catalog', 'custom'],
    }).notNull(),
    ingredientRef: text('ingredient_ref').notNull(),
    displayName: text('display_name').notNull(),
    containerId: text('container_id')
      .notNull()
      .references(() => containers.id, { onDelete: 'restrict' }),
    amount: real('amount'),
    unit: text('unit', {
      enum: ['g', 'kg', 'ml', 'L', 'piece', 'pack', 'bag', 'bottle', 'can'],
    }).notNull(),
    quantityKnown: integer('quantity_known', { mode: 'boolean' })
      .notNull()
      .default(true),
    packageCount: real('package_count'),
    packageSize: real('package_size'),
    packageSizeUnit: text('package_size_unit', {
      enum: ['g', 'kg', 'ml', 'L', 'piece'],
    }),
    purchasedOn: text('purchased_on'),
    expiresOn: text('expires_on'),
    openedOn: text('opened_on'),
    minimumAmount: real('minimum_amount'),
    note: text('note'),
    status: text('status', {
      enum: ['available', 'consumed', 'discarded', 'deleted'],
    })
      .notNull()
      .default('available'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('inventory_batches_ingredient_idx').on(
      table.ingredientSource,
      table.ingredientRef,
    ),
    index('inventory_batches_container_idx').on(table.containerId),
    index('inventory_batches_expiry_idx').on(table.status, table.expiresOn),
    check(
      'inventory_batches_ingredient_source_check',
      sql`${table.ingredientSource} IN ('catalog', 'custom')`,
    ),
    check(
      'inventory_batches_ingredient_ref_check',
      sql`length(trim(${table.ingredientRef})) BETWEEN 1 AND 200`,
    ),
    check(
      'inventory_batches_display_name_check',
      sql`length(trim(${table.displayName})) BETWEEN 1 AND 100`,
    ),
    check(
      'inventory_batches_unit_check',
      sql`${table.unit} IN ('g', 'kg', 'ml', 'L', 'piece', 'pack', 'bag', 'bottle', 'can')`,
    ),
    check(
      'inventory_batches_quantity_check',
      sql`(${table.quantityKnown} = 1 AND ${table.amount} > 0) OR (${table.quantityKnown} = 0 AND ${table.amount} IS NULL)`,
    ),
    check(
      'inventory_batches_package_check',
      sql`(${table.packageCount} IS NULL AND ${table.packageSize} IS NULL AND ${table.packageSizeUnit} IS NULL) OR (${table.packageCount} > 0 AND ${table.packageSize} > 0 AND ${table.packageSizeUnit} IS NOT NULL)`,
    ),
    check(
      'inventory_batches_package_size_unit_check',
      sql`${table.packageSizeUnit} IS NULL OR ${table.packageSizeUnit} IN ('g', 'kg', 'ml', 'L', 'piece')`,
    ),
    check(
      'inventory_batches_minimum_amount_check',
      sql`${table.minimumAmount} IS NULL OR ${table.minimumAmount} >= 0`,
    ),
    check(
      'inventory_batches_status_check',
      sql`${table.status} IN ('available', 'consumed', 'discarded', 'deleted')`,
    ),
    check(
      'inventory_batches_note_check',
      sql`${table.note} IS NULL OR length(${table.note}) <= 500`,
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
export type CustomIngredient = typeof customIngredients.$inferSelect;
export type NewCustomIngredient = typeof customIngredients.$inferInsert;
export type InventoryBatch = typeof inventoryBatches.$inferSelect;
export type NewInventoryBatch = typeof inventoryBatches.$inferInsert;
