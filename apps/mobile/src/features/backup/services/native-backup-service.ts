import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { userDatabase } from '@/db/user/client';
import { androidBackupFiles } from '../adapters/android-backup-files';
import { sqliteRestoreStaging } from '../adapters/sqlite-restore-staging';
import { createBackupRepository } from '../repositories/backup-repository';
import { createBackupService } from './backup-service';

export const nativeBackupService = createBackupService(
  createBackupRepository(userDatabase),
  androidBackupFiles,
  sqliteRestoreStaging,
  (value) => digestStringAsync(CryptoDigestAlgorithm.SHA256, value),
);
