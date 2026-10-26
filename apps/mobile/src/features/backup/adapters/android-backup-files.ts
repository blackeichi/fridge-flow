import { File, FileMode } from 'expo-file-system';
import { ResultCode, startActivityAsync } from 'expo-intent-launcher';
import { BackupError, MAX_BACKUP_BYTES } from '../domain/backup-format';
import type { BackupFiles } from '../services/backup-service';

// Never copy an unbounded document into the app cache or accept network URLs.
export function readBoundedDocument(uri: string): string {
  if (!uri.startsWith('content://'))
    throw new BackupError('시스템 파일 선택기에서 백업을 선택해 주세요.');
  const handle = new File(uri).open(FileMode.ReadOnly);
  try {
    if (handle.size !== null && handle.size > MAX_BACKUP_BYTES)
      throw new BackupError('10MB 이하의 백업만 열 수 있습니다.');
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const chunk = handle.readBytes(
        Math.min(64 * 1024, MAX_BACKUP_BYTES + 1 - total),
      );
      total += chunk.length;
      if (total > MAX_BACKUP_BYTES)
        throw new BackupError('10MB 이하의 백업만 열 수 있습니다.');
      if (!chunk.length) break;
      chunks.push(chunk);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } finally {
    handle.close();
  }
}
export const androidBackupFiles: BackupFiles = {
  async save(filename, text) {
    const result = await startActivityAsync(
      'android.intent.action.CREATE_DOCUMENT',
      {
        type: 'application/octet-stream',
        category: 'android.intent.category.OPENABLE',
        extra: { 'android.intent.extra.TITLE': filename },
        flags: 3,
      },
    );
    if (result.resultCode !== ResultCode.Success) return false;
    if (!result.data?.startsWith('content://'))
      throw new BackupError('백업 저장 위치를 열 수 없습니다.');
    const handle = new File(result.data).open(FileMode.Truncate);
    try {
      handle.writeBytes(new TextEncoder().encode(text));
    } finally {
      handle.close();
    }
    // A provider can fail or write only part of a document. Record success only after round-trip verification.
    if (readBoundedDocument(result.data) !== text)
      throw new BackupError(
        '백업 파일 저장을 확인하지 못했습니다. 다른 위치에 다시 저장해 주세요.',
      );
    return true;
  },
  async open() {
    const result = await startActivityAsync(
      'android.intent.action.OPEN_DOCUMENT',
      {
        type: '*/*',
        category: 'android.intent.category.OPENABLE',
        flags: 1,
      },
    );
    return result.resultCode === ResultCode.Success && result.data
      ? readBoundedDocument(result.data)
      : null;
  },
};
