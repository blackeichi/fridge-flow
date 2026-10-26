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
      database.transaction((tx) => {
        const timestamp = now();
        const templates = [
          {
            type: 'refrigerator' as const,
            name: '냉장실',
            names: ['냉장 선반', '문 선반', '야채 서랍'],
          },
          { type: 'freezer' as const, name: '냉동실', names: ['냉동 선반'] },
          { type: 'pantry' as const, name: '실온/팬트리', names: ['팬트리'] },
        ];
        for (const [sortOrder, template] of templates.entries()) {
          let space = tx
            .select()
            .from(storageSpaces)
            .where(eq(storageSpaces.type, template.type))
            .orderBy(asc(storageSpaces.sortOrder))
            .get();
          if (!space) {
            // Existing user names are preserved; avoid a collision with another type.
            const names = tx
              .select()
              .from(storageSpaces)
              .all()
              .map((item) => item.name);
            let name = template.name;
            let suffix = 2;
            while (names.includes(name)) name = `${template.name} ${suffix++}`;
            space = {
              id: createId(),
              name,
              type: template.type,
              sortOrder,
              createdAt: timestamp,
              updatedAt: timestamp,
            };
            tx.insert(storageSpaces).values(space).run();
          }
          if (
            tx
              .select()
              .from(containers)
              .where(eq(containers.spaceId, space.id))
              .get()
          )
            continue;
          for (const [index, name] of template.names.entries()) {
            tx.insert(containers)
              .values({
                id: createId(),
                spaceId: space.id,
                name,
                gridRow: index,
                gridColumn: 0,
                sortOrder: index,
                createdAt: timestamp,
                updatedAt: timestamp,
              })
              .run();
          }
        }
      });
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
    batches: database
      .select()
      .from(inventoryBatches)
      .orderBy(asc(inventoryBatches.expiresOn), asc(inventoryBatches.name)),
    locations: database
      .select({
        id: containers.id,
        name: containers.name,
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
