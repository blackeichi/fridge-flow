import { File } from 'expo-file-system';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { randomUUID } from 'expo-crypto';
import {
  backupDatabaseSync,
  defaultDatabaseDirectory,
  deleteDatabaseSync,
  openDatabaseSync,
} from 'expo-sqlite';
import { configureUserDatabase } from '@/db/user/client';
import migrations from '@/db/user/migrations/migrations';
import journal from '@/db/user/migrations/meta/_journal.json';
import * as schema from '@/db/user/schema';
import { BackupError } from '../domain/backup-format';
import {
  MAX_SAFETY_DATABASE_BYTES,
  validateSafetyDatabaseName,
} from '../domain/safety-recovery';
import { createBackupRepository } from '../repositories/backup-repository';
import type { SafetyRecoveryReader } from '../services/backup-service';

export const sqliteSafetyRecovery: SafetyRecoveryReader = {
  async read(name, owner) {
    validateSafetyDatabaseName(name);
    const file = new File(defaultDatabaseDirectory, name);
    if (!file.exists)
      throw new BackupError(
        '안전 사본 파일이 기기에 없습니다. 별도로 내보낸 백업을 선택해 주세요.',
      );
    if (file.size <= 0 || file.size > MAX_SAFETY_DATABASE_BYTES)
      throw new BackupError(
        '안전 사본 파일 크기를 확인할 수 없거나 지원 한도를 초과했습니다.',
      );
    const source = openDatabaseSync(name, { useNewConnection: true });
    const cloneName = `recovery-read-${randomUUID()}.db`;
    let clone: ReturnType<typeof openDatabaseSync> | undefined;
    try {
      source.execSync('PRAGMA query_only = ON;');
      const result = await source.getFirstAsync<{ integrity_check: string }>(
        'PRAGMA integrity_check',
      );
      if (result?.integrity_check !== 'ok')
        throw new BackupError('안전 사본이 손상되어 복구할 수 없습니다.');
      const sourceDatabase = drizzle(source, { schema });
      if (
        createBackupRepository(sourceDatabase).owner().ownerSubSha256 !== owner
      )
        throw new BackupError(
          '현재 Google 계정의 안전 사본만 복구할 수 있습니다.',
        );
      const version = source.getFirstSync<{ created_at: number }>(
        'SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1',
      );
      if (
        !version ||
        !journal.entries.some((entry) => entry.when === version.created_at)
      )
        throw new BackupError(
          '이 안전 사본을 읽으려면 호환되는 앱 버전이 필요합니다.',
        );
      // Migrations run on a disposable clone, never on the original safety copy.
      clone = openDatabaseSync(cloneName);
      backupDatabaseSync({ sourceDatabase: source, destDatabase: clone });
      configureUserDatabase(clone);
      const database = drizzle(clone, { schema });
      await migrate(database, migrations);
      if (clone.getAllSync('PRAGMA foreign_key_check').length)
        throw new BackupError('안전 사본의 데이터 연결이 올바르지 않습니다.');
      return createBackupRepository(database).snapshot();
    } catch (error) {
      if (error instanceof BackupError) throw error;
      throw new BackupError(
        '안전 사본을 읽을 수 없습니다. 파일이 손상되었거나 호환되지 않는 형식입니다.',
      );
    } finally {
      try {
        source.closeSync();
      } finally {
        if (clone) {
          try {
            clone.closeSync();
          } finally {
            deleteDatabaseSync(cloneName);
          }
        }
      }
    }
  },
};
