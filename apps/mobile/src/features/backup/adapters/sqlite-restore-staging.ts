import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { randomUUID } from 'expo-crypto';
import {
  backupDatabaseSync,
  deleteDatabaseSync,
  openDatabaseSync,
} from 'expo-sqlite';
import { configureUserDatabase, userSqlite } from '@/db/user/client';
import migrations from '@/db/user/migrations/migrations';
import * as schema from '@/db/user/schema';
import { createBackupRepository } from '../repositories/backup-repository';
import type { RestoreStaging } from '../services/backup-service';

export const sqliteRestoreStaging: RestoreStaging = {
  async validate(data) {
    const name = `restore-validation-${randomUUID()}.db`;
    const sqlite = openDatabaseSync(name);
    try {
      configureUserDatabase(sqlite);
      const database = drizzle(sqlite, { schema });
      await migrate(database, migrations);
      createBackupRepository(database).replace(data);
      const result = sqlite.getFirstSync<{ integrity_check: string }>(
        'PRAGMA integrity_check',
      );
      if (result?.integrity_check !== 'ok')
        throw new Error('SQLite validation failed.');
    } finally {
      sqlite.closeSync();
      deleteDatabaseSync(name);
    }
  },
  safetySnapshot() {
    const name = `pre-restore-${randomUUID()}.db`;
    const safety = openDatabaseSync(name);
    try {
      backupDatabaseSync({ sourceDatabase: userSqlite, destDatabase: safety });
      const result = safety.getFirstSync<{ integrity_check: string }>(
        'PRAGMA integrity_check',
      );
      if (result?.integrity_check !== 'ok')
        throw new Error('Safety snapshot validation failed.');
    } finally {
      safety.closeSync();
    }
    return name;
  },
};
