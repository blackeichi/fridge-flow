import { z } from 'zod';
import { BackupError } from './backup-format';

export const MAX_SAFETY_DATABASE_BYTES = 64 * 1024 * 1024;
export function validateSafetyDatabaseName(name: string) {
  if (
    name.length !== 51 ||
    !name.startsWith('pre-restore-') ||
    !name.endsWith('.db') ||
    !z.uuid().safeParse(name.slice(12, -3)).success
  ) {
    throw new BackupError('올바른 기기 안전 사본이 아닙니다.');
  }
  return name;
}
