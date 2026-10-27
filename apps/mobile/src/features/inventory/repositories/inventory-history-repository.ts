import { desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import type { UserDatabase } from '@/db/user/client';
import { inventoryBatches, inventoryTransactions } from '@/db/user/schema';

const reversals = alias(inventoryTransactions, 'history_reversals');
export const HISTORY_PAGE_SIZE = 30;

export function inventoryHistoryQuery(database: UserDatabase, limit: number) {
  return database
    .select({
      operation: inventoryTransactions,
      currentOperationId: inventoryBatches.lastOperationId,
      reversedBy: reversals.operationId,
    })
    .from(inventoryTransactions)
    .leftJoin(
      inventoryBatches,
      eq(inventoryTransactions.batchId, inventoryBatches.id),
    )
    .leftJoin(
      reversals,
      eq(reversals.reversesOperationId, inventoryTransactions.operationId),
    )
    .orderBy(desc(inventoryTransactions.sequence))
    .limit(limit + 1);
}
export type InventoryHistoryRow = Awaited<
  ReturnType<typeof inventoryHistoryQuery>
>[number];
