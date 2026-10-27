/** @jest-environment node */
import { sqliteSafetyRecovery } from '../adapters/sqlite-safety-recovery';
import { MAX_SAFETY_DATABASE_BYTES } from '../domain/safety-recovery';
import {
  openDatabaseSync,
  deleteDatabaseSync,
  backupDatabaseSync,
} from 'expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import journal from '@/db/user/migrations/meta/_journal.json';

const name = 'pre-restore-11111111-1111-4111-8111-111111111111.db';
const owner = 'a'.repeat(64);
const data = {
  profiles: [],
  spaces: [],
  containers: [],
  batches: [],
  transactions: [],
};
const mockFile = { exists: true, size: 4096 };
const mockOwner = jest.fn();
const mockSnapshot = jest.fn();
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => mockFile),
}));
jest.mock('expo-sqlite', () => ({
  defaultDatabaseDirectory: 'file:///private/SQLite',
  openDatabaseSync: jest.fn(),
  deleteDatabaseSync: jest.fn(),
  backupDatabaseSync: jest.fn(),
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => '22222222-2222-4222-8222-222222222222',
}));
jest.mock('drizzle-orm/expo-sqlite', () => ({
  drizzle: (connection: unknown) => connection,
}));
jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({ migrate: jest.fn() }));
jest.mock('@/db/user/client', () => ({ configureUserDatabase: jest.fn() }));
jest.mock('@/db/user/migrations/migrations', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../repositories/backup-repository', () => ({
  createBackupRepository: () => ({
    owner: () => mockOwner(),
    snapshot: () => mockSnapshot(),
  }),
}));
const source = {
  execSync: jest.fn(),
  getFirstAsync: jest.fn(),
  getFirstSync: jest.fn(),
  closeSync: jest.fn(),
};
const clone = { getAllSync: jest.fn(), closeSync: jest.fn() };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(openDatabaseSync).mockReset();
  mockFile.exists = true;
  mockFile.size = 4096;
  mockOwner.mockReturnValue({ ownerSubSha256: owner });
  mockSnapshot.mockReturnValue(data);
  source.getFirstAsync.mockResolvedValue({ integrity_check: 'ok' });
  source.getFirstSync.mockReturnValue({
    created_at: journal.entries.at(-1)!.when,
  });
  clone.getAllSync.mockReturnValue([]);
  jest
    .mocked(openDatabaseSync)
    .mockReturnValueOnce(source as never)
    .mockReturnValueOnce(clone as never);
  jest.mocked(migrate).mockResolvedValue(undefined);
});
it('reads a source in query-only mode and migrates only a disposable clone', async () => {
  expect(await sqliteSafetyRecovery.read(name, owner)).toEqual(data);
  expect(source.execSync).toHaveBeenCalledTimes(1);
  expect(source.execSync).toHaveBeenCalledWith('PRAGMA query_only = ON;');
  expect(backupDatabaseSync).toHaveBeenCalledWith({
    sourceDatabase: source,
    destDatabase: clone,
  });
  expect(migrate).toHaveBeenCalledWith(clone, expect.anything());
  expect(source.closeSync).toHaveBeenCalled();
  expect(clone.closeSync).toHaveBeenCalled();
  expect(deleteDatabaseSync).toHaveBeenCalledWith(
    'recovery-read-22222222-2222-4222-8222-222222222222.db',
  );
  expect(deleteDatabaseSync).not.toHaveBeenCalledWith(name);
});
it('rejects path traversal, missing and oversized copies before opening SQLite', async () => {
  await expect(sqliteSafetyRecovery.read('../user.db', owner)).rejects.toThrow(
    '올바른',
  );
  mockFile.exists = false;
  await expect(sqliteSafetyRecovery.read(name, owner)).rejects.toThrow(
    '기기에 없습니다',
  );
  mockFile.exists = true;
  mockFile.size = MAX_SAFETY_DATABASE_BYTES + 1;
  await expect(sqliteSafetyRecovery.read(name, owner)).rejects.toThrow('한도');
  expect(openDatabaseSync).not.toHaveBeenCalled();
});
it('closes the source and refuses a different account without reading payload data', async () => {
  mockOwner.mockReturnValue({ ownerSubSha256: 'b'.repeat(64) });
  await expect(sqliteSafetyRecovery.read(name, owner)).rejects.toThrow(
    'Google 계정',
  );
  expect(mockSnapshot).not.toHaveBeenCalled();
  expect(backupDatabaseSync).not.toHaveBeenCalled();
  expect(source.closeSync).toHaveBeenCalled();
});
it('rejects integrity and schema errors before copying the source', async () => {
  source.getFirstAsync.mockResolvedValue({ integrity_check: 'corrupt' });
  await expect(sqliteSafetyRecovery.read(name, owner)).rejects.toThrow('손상');
  expect(source.closeSync).toHaveBeenCalled();
  expect(backupDatabaseSync).not.toHaveBeenCalled();
});
it('refuses unknown migration versions', async () => {
  source.getFirstSync.mockReturnValue({ created_at: 9999999999999 });
  await expect(sqliteSafetyRecovery.read(name, owner)).rejects.toThrow(
    '앱 버전',
  );
  expect(migrate).not.toHaveBeenCalled();
  expect(source.closeSync).toHaveBeenCalled();
});
it('removes a failed migration clone while preserving the source', async () => {
  jest.mocked(migrate).mockRejectedValue(new Error('migration failed'));
  await expect(sqliteSafetyRecovery.read(name, owner)).rejects.toThrow(
    '안전 사본을 읽을 수 없습니다',
  );
  expect(clone.closeSync).toHaveBeenCalled();
  expect(source.closeSync).toHaveBeenCalled();
  expect(deleteDatabaseSync).toHaveBeenCalledTimes(1);
  expect(deleteDatabaseSync).not.toHaveBeenCalledWith(name);
});
