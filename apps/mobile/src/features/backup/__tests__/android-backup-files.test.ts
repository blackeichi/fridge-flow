/** @jest-environment node */
import {
  androidBackupFiles,
  readBoundedDocument,
} from '../adapters/android-backup-files';
import { MAX_BACKUP_BYTES } from '../domain/backup-format';
import { startActivityAsync } from 'expo-intent-launcher';

const mockOpen = jest.fn();
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({
    open: (...args: unknown[]) => mockOpen(...args),
  })),
  FileMode: { ReadOnly: 'r', Truncate: 'wt' },
}));
jest.mock('expo-intent-launcher', () => ({
  ResultCode: { Success: -1 },
  startActivityAsync: jest.fn(),
}));
const activity = jest.mocked(startActivityAsync);
beforeEach(() => {
  jest.clearAllMocks();
});
function reader(text: string, declaredSize: number | null = null) {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return {
    size: declaredSize,
    close: jest.fn(),
    readBytes: jest.fn((length: number) => {
      // A provider may return short reads in the middle of a multi-byte Korean character.
      const chunk = bytes.slice(offset, offset + Math.min(3, length));
      offset += chunk.length;
      return chunk;
    }),
  };
}
it('reads bounded short chunks and closes handles on success or size errors', () => {
  const handle = reader('냉장고 데이터');
  mockOpen.mockReturnValueOnce(handle);
  expect(readBoundedDocument('content://test/backup')).toBe('냉장고 데이터');
  expect(handle.close).toHaveBeenCalled();
  const oversized = reader('', MAX_BACKUP_BYTES + 1);
  mockOpen.mockReturnValueOnce(oversized);
  expect(() => readBoundedDocument('content://test/large')).toThrow('10MB');
  expect(oversized.readBytes).not.toHaveBeenCalled();
  expect(oversized.close).toHaveBeenCalled();
  expect(() => readBoundedDocument('https://untrusted/backup')).toThrow(
    '시스템 파일',
  );
});
it('enforces the cap even when the provider omits the file size', () => {
  const handle = {
    size: null,
    close: jest.fn(),
    readBytes: jest.fn(() => new Uint8Array(64 * 1024)),
  };
  mockOpen.mockReturnValueOnce(handle);
  expect(() => readBoundedDocument('content://test/large')).toThrow('10MB');
  expect(handle.close).toHaveBeenCalled();
});
it('uses the system create document intent and verifies persisted content', async () => {
  activity.mockResolvedValueOnce({
    resultCode: -1,
    data: 'content://drive/new',
  });
  const writer = { writeBytes: jest.fn(), close: jest.fn() };
  mockOpen
    .mockReturnValueOnce(writer)
    .mockReturnValueOnce(reader('backup text'));
  expect(await androidBackupFiles.save('test.ffbackup', 'backup text')).toBe(
    true,
  );
  expect(activity).toHaveBeenCalledWith(
    'android.intent.action.CREATE_DOCUMENT',
    expect.objectContaining({
      extra: { 'android.intent.extra.TITLE': 'test.ffbackup' },
    }),
  );
  expect(writer.close).toHaveBeenCalled();
  activity.mockResolvedValueOnce({
    resultCode: -1,
    data: 'content://drive/partial',
  });
  mockOpen.mockReturnValueOnce(writer).mockReturnValueOnce(reader('partial'));
  await expect(
    androidBackupFiles.save('test.ffbackup', 'backup text'),
  ).rejects.toThrow('저장');
});
it('treats picker cancellation as a cancellation and does not open a file', async () => {
  activity.mockResolvedValue({ resultCode: 0 });
  expect(await androidBackupFiles.open()).toBeNull();
  expect(await androidBackupFiles.save('test.ffbackup', 'backup text')).toBe(
    false,
  );
  expect(mockOpen).not.toHaveBeenCalled();
});
