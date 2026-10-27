import { createStorageManagementRepository } from '@/features/storage/repositories/storage-management-repository';
import { asc, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';

import type { UserDatabase } from '@/db/user/client';
import {
  containers,
  inventoryBatches,
  inventoryTransactions,
  storageSpaces,
  type InventoryBatch,
} from '@/db/user/schema';
import {
  amountDelta,
  normalizeInventory,
  type InventoryInput,
} from '../domain/inventory';

export function createInventoryRepository(
  database: UserDatabase,
  {
    createId = randomUUID,
    now = () => new Date().toISOString(),
  }: { createId?: () => string; now?: () => string } = {},
) {
  function current(id: string) {
    const batch = database
      .select()
      .from(inventoryBatches)
      .where(eq(inventoryBatches.id, id))
      .get();
    if (!batch) throw new Error('재료를 찾을 수 없습니다.');
    return batch;
  }

  function write(
    before: InventoryBatch | null,
    after: InventoryBatch,
    type: 'create' | 'update' | 'delete' | 'undo',
    reversesOperationId?: string,
  ) {
    database.transaction((tx) => {
      if (before)
        tx.update(inventoryBatches)
          .set(after)
          .where(eq(inventoryBatches.id, after.id))
          .run();
      else tx.insert(inventoryBatches).values(after).run();
      tx.insert(inventoryTransactions)
        .values({
          id: createId(),
          operationId: after.lastOperationId,
          batchId: after.id,
          type,
          amountDelta: amountDelta(before, after),
          before,
          after,
          reversesOperationId: reversesOperationId ?? null,
          createdAt: after.updatedAt,
        })
        .run();
    });
    return after;
  }

  return {
    initializeLocations() {
      createStorageManagementRepository(database, {
        createId,
        now,
      }).initializeDefaults();
    },
    create(input: InventoryInput, operationId = createId()) {
      const normalized = normalizeInventory(input);
      const timestamp = now();
      return write(
        null,
        {
          ...normalized,
          id: createId(),
          lastOperationId: operationId,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        'create',
      );
    },
    update(id: string, input: InventoryInput, operationId = createId()) {
      const normalized = normalizeInventory(input);
      const before = current(id);
      if (before.status === 'deleted')
        throw new Error('삭제된 재료는 먼저 실행 취소해 주세요.');
      return write(
        before,
        {
          ...before,
          ...normalized,
          lastOperationId: operationId,
          updatedAt: now(),
        },
        'update',
      );
    },
    remove(id: string, operationId = createId()) {
      const before = current(id);
      if (before.status === 'deleted')
        throw new Error('이미 삭제된 재료입니다.');
      return write(
        before,
        {
          ...before,
          status: 'deleted',
          lastOperationId: operationId,
          updatedAt: now(),
        },
        'delete',
      );
    },
    undo(operationId: string) {
      const operation = database
        .select()
        .from(inventoryTransactions)
        .where(eq(inventoryTransactions.operationId, operationId))
        .get();
      if (!operation || operation.type === 'undo')
        throw new Error('실행 취소할 변경을 찾을 수 없습니다.');
      if (Date.parse(now()) - Date.parse(operation.createdAt) > 7 * 86_400_000)
        throw new Error('실행 취소 기간(7일)이 지났습니다.');
      const before = current(operation.batchId);
      if (before.lastOperationId !== operationId)
        throw new Error('이후 변경이 있어 실행 취소할 수 없습니다.');
      const restored = operation.before ?? {
        ...before,
        status: 'deleted' as const,
      };
      return write(
        before,
        { ...restored, lastOperationId: createId(), updatedAt: now() },
        'undo',
        operationId,
      );
    },
  };
}

// Query builders stay in the repository layer; screens subscribe through the hook.
export function inventoryQueries(database: UserDatabase) {
  return {
    spaces: database
      .select()
      .from(storageSpaces)
      .orderBy(asc(storageSpaces.sortOrder)),
    batches: database
      .select()
      .from(inventoryBatches)
      .orderBy(asc(inventoryBatches.expiresOn), asc(inventoryBatches.name)),
    locations: database
      .select({
        id: containers.id,
        name: containers.name,
        parentId: containers.parentId,
        spaceName: storageSpaces.name,
        spaceId: storageSpaces.id,
      })
      .from(containers)
      .innerJoin(storageSpaces, eq(containers.spaceId, storageSpaces.id))
      .orderBy(asc(storageSpaces.sortOrder), asc(containers.sortOrder)),
    latest: database
      .select()
      .from(inventoryTransactions)
      .orderBy(desc(inventoryTransactions.sequence))
      .limit(1),
  };
}
export type InventoryRepository = ReturnType<typeof createInventoryRepository>;
export interface InventoryLocation {
  id: string;
  name: string;
  spaceName: string;
  spaceId: string;
}
