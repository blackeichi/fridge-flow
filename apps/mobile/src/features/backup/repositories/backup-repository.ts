import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import type { UserDatabase } from '@/db/user/client';
import {
  appProfiles,
  backupHistory,
  containers,
  inventoryBatches,
  inventoryTransactions,
  localOwners,
  storageSpaces,
} from '@/db/user/schema';
import {
  BackupError,
  validateBackupData,
  type BackupData,
} from '../domain/backup-format';

export function createBackupRepository(database: UserDatabase) {
  return {
    owner() {
      const owners = database.select().from(localOwners).all();
      if (owners.length !== 1)
        throw new BackupError('먼저 Google 계정을 연결해 주세요.');
      return owners[0];
    },
    recoveryPoint(id: string) {
      const point = database
        .select()
        .from(backupHistory)
        .where(
          and(
            eq(backupHistory.id, id),
            eq(backupHistory.action, 'restore'),
            isNotNull(backupHistory.safetyDatabaseName),
          ),
        )
        .get();
      if (!point?.safetyDatabaseName)
        throw new BackupError('복구할 안전 사본 기록을 찾을 수 없습니다.');
      return {
        id: point.id,
        createdAt: point.createdAt,
        databaseName: point.safetyDatabaseName,
      };
    },
    snapshot(): BackupData {
      return validateBackupData(
        database.transaction((tx) => ({
          profiles: tx.select().from(appProfiles).all(),
          spaces: tx.select().from(storageSpaces).all(),
          containers: tx.select().from(containers).all(),
          batches: tx.select().from(inventoryBatches).all(),
          transactions: tx.select().from(inventoryTransactions).all(),
        })),
      );
    },
    replace(
      data: BackupData,
      restoration?: { checksum: string; safetyDatabaseName: string },
    ) {
      database.transaction((tx) => {
        tx.run(sql`PRAGMA defer_foreign_keys = ON`);
        tx.delete(inventoryTransactions).run();
        tx.delete(inventoryBatches).run();
        tx.update(containers).set({ parentId: null }).run();
        tx.delete(containers).run();
        tx.delete(storageSpaces).run();
        tx.delete(appProfiles).run();
        for (const row of data.profiles)
          tx.insert(appProfiles).values(row).run();
        for (const row of data.spaces)
          tx.insert(storageSpaces).values(row).run();
        // Insert roots first, then reconnect validated hierarchy with deferred FK checks.
        for (const row of data.containers)
          tx.insert(containers)
            .values({ ...row, parentId: null })
            .run();
        for (const row of data.containers)
          if (row.parentId)
            tx.update(containers)
              .set({ parentId: row.parentId })
              .where(eq(containers.id, row.id))
              .run();
        for (const row of data.batches)
          tx.insert(inventoryBatches).values(row).run();
        for (const row of data.transactions)
          tx.insert(inventoryTransactions).values(row).run();
        if (restoration)
          tx.insert(backupHistory)
            .values({
              id: randomUUID(),
              action: 'restore',
              checksum: restoration.checksum,
              safetyDatabaseName: restoration.safetyDatabaseName,
              createdAt: new Date().toISOString(),
            })
            .run();
        const errors = tx.all(sql`PRAGMA foreign_key_check`);
        if (errors.length)
          throw new BackupError('백업의 데이터 연결이 올바르지 않습니다.');
      });
    },
    record(
      action: 'export' | 'restore',
      checksum: string,
      safetyDatabaseName: string | null = null,
    ) {
      database.transaction((tx) =>
        tx
          .insert(backupHistory)
          .values({
            id: randomUUID(),
            action,
            checksum,
            safetyDatabaseName,
            createdAt: new Date().toISOString(),
          })
          .run(),
      );
    },
  };
}
export const lastExportQuery = (database: UserDatabase) =>
  database
    .select()
    .from(backupHistory)
    .where(eq(backupHistory.action, 'export'))
    .orderBy(desc(backupHistory.createdAt))
    .limit(1);
export const recoveryPointsQuery = (database: UserDatabase) =>
  database
    .select({ id: backupHistory.id, createdAt: backupHistory.createdAt })
    .from(backupHistory)
    .where(
      and(
        eq(backupHistory.action, 'restore'),
        isNotNull(backupHistory.safetyDatabaseName),
      ),
    )
    .orderBy(desc(backupHistory.createdAt), desc(backupHistory.id));
export type RecoveryPoint = { id: string; createdAt: string };
export type BackupRepository = ReturnType<typeof createBackupRepository>;
