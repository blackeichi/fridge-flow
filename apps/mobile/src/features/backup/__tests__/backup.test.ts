/** @jest-environment node */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { UserDatabase } from '@/db/user/client';
import * as schema from '@/db/user/schema';
import { createInventoryRepository } from '@/features/inventory/repositories/inventory-repository';
import {
  decodeBackup,
  encodeBackup,
  MAX_BACKUP_BYTES,
  type BackupData,
} from '../domain/backup-format';
import { createBackupRepository } from '../repositories/backup-repository';
import { createBackupService } from '../services/backup-service';

jest.mock('expo-crypto', () => ({
  randomUUID: () =>
    jest
      .requireActual<typeof import('node:crypto')>('node:crypto')
      .randomUUID(),
}));
const owner = 'a'.repeat(64);
const sha = async (value: string) =>
  createHash('sha256').update(value).digest('hex');
function database() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const directory = resolve(__dirname, '../../../db/user/migrations');
  for (const file of readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .sort())
    sqlite.exec(
      readFileSync(resolve(directory, file), 'utf8').replaceAll(
        '--> statement-breakpoint',
        '',
      ),
    );
  const db = drizzle(sqlite, { schema });
  const repository = createBackupRepository(db as unknown as UserDatabase);
  return { sqlite, db, repository };
}
function setup() {
  const result = database();
  const timestamp = new Date().toISOString();
  result.db
    .insert(schema.localOwners)
    .values({
      ownerSubSha256: owner,
      createdAt: timestamp,
      lastLoginAt: timestamp,
    })
    .run();
  const inventory = createInventoryRepository(
    result.db as unknown as UserDatabase,
    { createId: randomUUID },
  );
  inventory.initializeLocations();
  const batch = inventory.create({
    name: '우유',
    amount: '1.2',
    unit: 'L',
    quantityKnown: true,
    containerId: result.db.select().from(schema.containers).all()[0].id,
    purchasedOn: '',
    expiresOn: '2026-11-01',
    notes: '냉장 보관',
  });
  return { ...result, inventory, batch };
}

describe('versioned logical backup', () => {
  it('round trips decimals, dates and undo history without identity or operational metadata', async () => {
    const { sqlite, repository, inventory, batch } = setup();
    const moved = inventory.update(batch.id, {
      ...batch,
      amount: '0.1',
      purchasedOn: '',
      expiresOn: batch.expiresOn!,
      notes: '남음',
    });
    inventory.undo(moved.lastOperationId);
    repository.record('export', 'b'.repeat(64));
    const backup = await encodeBackup(repository.snapshot(), owner, sha);
    const decoded = await decodeBackup(backup.text, owner, sha);
    expect(decoded.data).toEqual(repository.snapshot());
    expect(decoded.data.batches[0].amount).toBe('1.2');
    expect(Object.keys(JSON.parse(JSON.parse(backup.text).data))).toEqual([
      'profiles',
      'spaces',
      'containers',
      'batches',
      'transactions',
    ]);
    expect(JSON.parse(backup.text).data).not.toContain(owner);
    sqlite.close();
  });
  it('rejects corruption, other accounts, unknown fields, future versions and oversize input', async () => {
    const { sqlite, repository } = setup();
    const backup = await encodeBackup(repository.snapshot(), owner, sha);
    const corrupt = JSON.parse(backup.text);
    corrupt.data += ' ';
    await expect(
      decodeBackup(JSON.stringify(corrupt), owner, sha),
    ).rejects.toThrow('손상');
    await expect(
      decodeBackup(backup.text, 'b'.repeat(64), sha),
    ).rejects.toThrow('Google 계정');
    const future = JSON.parse(backup.text);
    future.manifest.schema_version = 100;
    await expect(
      decodeBackup(JSON.stringify(future), owner, sha),
    ).rejects.toThrow('업데이트');
    const extra = JSON.parse(backup.text);
    extra['../data.json'] = 'bad';
    await expect(
      decodeBackup(JSON.stringify(extra), owner, sha),
    ).rejects.toThrow();
    await expect(
      decodeBackup('a'.repeat(MAX_BACKUP_BYTES + 1), owner, sha),
    ).rejects.toThrow('10MB');
    sqlite.close();
  });
  it('migrates the schema-v1 fixture into the current payload', async () => {
    const text = readFileSync(
      resolve(__dirname, 'fixtures/schema-v1.ffbackup'),
      'utf8',
    );
    const decoded = await decodeBackup(text, owner, sha);
    expect(decoded.data).toEqual({
      profiles: [],
      spaces: [],
      containers: [],
      batches: [],
      transactions: [],
    });
  });
  it('rejects cycles and malformed quantities even with a recalculated checksum', async () => {
    const { sqlite, repository } = setup();
    const data = repository.snapshot();
    data.containers[0].parentId = data.containers[0].id;
    await expect(encodeBackup(data, owner, sha)).rejects.toThrow('계층');
    data.containers[0].parentId = null;
    data.batches[0].amount = '-1';
    await expect(encodeBackup(data, owner, sha)).rejects.toThrow('형식');
    sqlite.close();
  });
});

describe('restore transactions', () => {
  it('validates staging and takes a safety snapshot before replacing current data', async () => {
    const { sqlite, db, repository, inventory, batch } = setup();
    const original = repository.snapshot();
    const backup = await encodeBackup(original, owner, sha);
    inventory.remove(batch.id);
    const order: string[] = [];
    let safety: BackupData | undefined;
    const staging = {
      validate: jest.fn(async (data: BackupData) => {
        order.push('validate');
        const temp = database();
        try {
          temp.repository.replace(data);
        } finally {
          temp.sqlite.close();
        }
      }),
      safetySnapshot: jest.fn(() => {
        order.push('safety');
        safety = repository.snapshot();
        return 'pre-restore-test.db';
      }),
    };
    const service = createBackupService(
      repository,
      { save: jest.fn(), open: async () => backup.text },
      staging,
      sha,
    );
    await service.restore((await service.prepareRestore())!);
    expect(order).toEqual(['validate', 'safety']);
    expect(safety?.batches[0].status).toBe('deleted');
    expect(repository.snapshot()).toEqual(original);
    expect(repository.owner().ownerSubSha256).toBe(owner);
    expect(db.select().from(schema.backupHistory).all()).toMatchObject([
      { action: 'restore', safetyDatabaseName: 'pre-restore-test.db' },
    ]);
    expect(inventory.undo(batch.lastOperationId).status).toBe('deleted');
    sqlite.close();
  });
  it('keeps current data when staging or safety snapshot fails', async () => {
    const { sqlite, repository, inventory, batch } = setup();
    const backup = await encodeBackup(repository.snapshot(), owner, sha);
    inventory.remove(batch.id);
    const current = repository.snapshot();
    const files = { save: jest.fn(), open: async () => backup.text };
    const safety = jest.fn(() => {
      throw new Error('disk full');
    });
    const service = createBackupService(
      repository,
      files,
      { validate: async () => {}, safetySnapshot: safety },
      sha,
    );
    await expect(service.restore(backup)).rejects.toThrow('disk full');
    expect(repository.snapshot()).toEqual(current);
    const service2 = createBackupService(
      repository,
      files,
      {
        validate: async () => {
          throw new Error('invalid staged database');
        },
        safetySnapshot: safety,
      },
      sha,
    );
    await expect(service2.restore(backup)).rejects.toThrow('invalid staged');
    expect(safety).toHaveBeenCalledTimes(1);
    expect(repository.snapshot()).toEqual(current);
    sqlite.close();
  });
  it('rolls back all replaced rows if import violates a SQLite unique constraint', () => {
    const { sqlite, repository } = setup();
    const current = repository.snapshot();
    const invalid = structuredClone(current);
    invalid.transactions.push(invalid.transactions[0]);
    expect(() => repository.replace(invalid)).toThrow();
    expect(repository.snapshot()).toEqual(current);
    sqlite.close();
  });
  it('does not record cancellation or failed exports as successful backups', async () => {
    const { sqlite, db, repository } = setup();
    const files = { save: jest.fn(async () => false), open: async () => null };
    const service = createBackupService(
      repository,
      files,
      { validate: async () => {}, safetySnapshot: () => '' },
      sha,
    );
    expect(await service.export()).toBe(false);
    expect(await service.prepareRestore()).toBeNull();
    expect(db.select().from(schema.backupHistory).all()).toEqual([]);
    files.save.mockRejectedValueOnce(new Error('provider failed'));
    await expect(service.export()).rejects.toThrow('provider failed');
    expect(db.select().from(schema.backupHistory).all()).toEqual([]);
    files.save.mockResolvedValueOnce(true);
    expect(await service.export()).toBe(true);
    expect(db.select().from(schema.backupHistory).all()[0].action).toBe(
      'export',
    );
    sqlite.close();
  });
});

describe('safety copy recovery', () => {
  it('previews without mutation and keeps a new recovery point before applying or re-applying data', async () => {
    const { sqlite, db, repository, inventory, batch } = setup();
    const original = repository.snapshot();
    const firstName = `pre-restore-${randomUUID()}.db`;
    const saved = new Map<string, BackupData>([[firstName, original]]);
    repository.record('restore', 'b'.repeat(64), firstName);
    const firstPoint = db.select().from(schema.backupHistory).all()[0];
    inventory.remove(batch.id);
    const changed = repository.snapshot();
    const safetySnapshot = jest.fn(() => {
      const name = `pre-restore-${randomUUID()}.db`;
      saved.set(name, repository.snapshot());
      return name;
    });
    const read = jest.fn(async (name: string, expectedOwner: string) => {
      expect(expectedOwner).toBe(owner);
      const data = saved.get(name);
      if (!data) throw new Error('missing safety copy');
      return data;
    });
    const service = createBackupService(
      repository,
      { save: jest.fn(), open: async () => null },
      { validate: async () => {}, safetySnapshot },
      sha,
      { read },
    );
    const prepared = await service.prepareRecovery(firstPoint.id);
    expect(repository.snapshot()).toEqual(changed);
    expect(safetySnapshot).not.toHaveBeenCalled();
    await service.restore(prepared);
    expect(repository.snapshot()).toEqual(original);
    const secondPoint = db
      .select()
      .from(schema.backupHistory)
      .all()
      .find((point) => point.id !== firstPoint.id)!;
    expect(saved.get(secondPoint.safetyDatabaseName!)).toEqual(changed);
    await service.restore(await service.prepareRecovery(secondPoint.id));
    expect(repository.snapshot()).toEqual(changed);
    expect(db.select().from(schema.backupHistory).all()).toHaveLength(3);
    sqlite.close();
  });
  it('refuses missing records and unsafe file names before calling the native reader', async () => {
    const { sqlite, db, repository } = setup();
    const read = jest.fn();
    const service = createBackupService(
      repository,
      { save: jest.fn(), open: async () => null },
      { validate: async () => {}, safetySnapshot: () => '' },
      sha,
      { read },
    );
    await expect(service.prepareRecovery('missing')).rejects.toThrow('기록');
    repository.record('restore', 'b'.repeat(64), '../user.db');
    const point = db.select().from(schema.backupHistory).all()[0];
    await expect(service.prepareRecovery(point.id)).rejects.toThrow('올바른');
    expect(read).not.toHaveBeenCalled();
    sqlite.close();
  });
  it('aborts if the linked account changes while reading a safety copy', async () => {
    const { sqlite, db, repository } = setup();
    const snapshot = repository.snapshot();
    repository.record(
      'restore',
      'b'.repeat(64),
      `pre-restore-${randomUUID()}.db`,
    );
    const point = db.select().from(schema.backupHistory).all()[0];
    const initialOwner = repository.owner();
    jest
      .spyOn(repository, 'owner')
      .mockReturnValueOnce(initialOwner)
      .mockReturnValueOnce({ ...initialOwner, ownerSubSha256: 'b'.repeat(64) });
    const service = createBackupService(
      repository,
      { save: jest.fn(), open: async () => null },
      { validate: async () => {}, safetySnapshot: () => '' },
      sha,
      { read: async () => snapshot },
    );
    await expect(service.prepareRecovery(point.id)).rejects.toThrow(
      '연결 계정',
    );
    expect(repository.snapshot()).toEqual(snapshot);
    sqlite.close();
  });
});
