import { asc, desc, eq, sql } from 'drizzle-orm';

import type { InventoryBatchPersistence } from '@/features/inventory/repositories/inventory-batch-repository';

import { userDatabase } from '../client';
import { inventoryBatches } from '../schema';

export const drizzleInventoryBatchPersistence: InventoryBatchPersistence = {
  async insert(batch) {
    await userDatabase.transaction(async (transaction) => {
      await transaction.insert(inventoryBatches).values(batch);
    });
  },

  async listAvailable() {
    return userDatabase
      .select()
      .from(inventoryBatches)
      .where(eq(inventoryBatches.status, 'available'))
      .orderBy(
        sql`CASE WHEN ${inventoryBatches.expiresOn} IS NULL THEN 1 ELSE 0 END`,
        asc(inventoryBatches.expiresOn),
        desc(inventoryBatches.createdAt),
      );
  },
};
