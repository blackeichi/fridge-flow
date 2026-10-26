import {
  backupFilename,
  decodeBackup,
  encodeBackup,
  type BackupData,
  type PreparedBackup,
  type Sha256,
  BackupError,
} from '../domain/backup-format';
import type { BackupRepository } from '../repositories/backup-repository';

export interface BackupFiles {
  save(filename: string, text: string): Promise<boolean>;
  open(): Promise<string | null>;
}
export interface RestoreStaging {
  validate(data: BackupData): Promise<void>;
  safetySnapshot(): string;
}
export function createBackupService(
  repository: BackupRepository,
  files: BackupFiles,
  staging: RestoreStaging,
  sha256: Sha256,
) {
  let busy = false;
  async function exclusive<T>(work: () => Promise<T>): Promise<T> {
    if (busy) throw new BackupError('다른 백업 작업이 진행 중입니다.');
    busy = true;
    try {
      return await work();
    } finally {
      busy = false;
    }
  }
  return {
    export: () =>
      exclusive(async () => {
        const owner = repository.owner().ownerSubSha256;
        const backup = await encodeBackup(repository.snapshot(), owner, sha256);
        if (
          !(await files.save(
            backupFilename(backup.manifest.created_at),
            backup.text,
          ))
        )
          return false;
        repository.record('export', backup.manifest.data_sha256);
        return true;
      }),
    prepareRestore: () =>
      exclusive(async () => {
        const text = await files.open();
        if (text === null) return null;
        return decodeBackup(text, repository.owner().ownerSubSha256, sha256);
      }),
    restore: (prepared: PreparedBackup) =>
      exclusive(async () => {
        // Re-validate the exact bytes after confirmation, including the current owner.
        const owner = repository.owner().ownerSubSha256;
        const verified = await decodeBackup(prepared.text, owner, sha256);
        await staging.validate(verified.data);
        // From here to replace there are no awaits: the safety snapshot and commit see the same state.
        if (repository.owner().ownerSubSha256 !== owner)
          throw new BackupError('연결 계정이 변경되어 복원을 중단했습니다.');
        const safety = staging.safetySnapshot();
        repository.replace(verified.data, {
          checksum: verified.manifest.data_sha256,
          safetyDatabaseName: safety,
        });
        return safety;
      }),
  };
}
