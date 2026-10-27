/** @jest-environment node */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { UserDatabase } from '@/db/user/client';
import * as schema from '@/db/user/schema';
import { createInventoryRepository } from '@/features/inventory/repositories/inventory-repository';
import { createBackupRepository } from '@/features/backup/repositories/backup-repository';
import {
  decodeBackup,
  encodeBackup,
} from '@/features/backup/domain/backup-format';
import { createHash } from 'node:crypto';
import { createStorageManagementRepository } from '../repositories/storage-management-repository';
import {
  containerPath,
  firstFreeCell,
  validatePlacement,
  type ContainerInput,
} from '../domain/layout';

jest.mock('expo-crypto', () => ({
  randomUUID: () =>
    jest
      .requireActual<typeof import('node:crypto')>('node:crypto')
      .randomUUID(),
}));
function setup() {
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
  const database = db as unknown as UserDatabase;
  const repository = createStorageManagementRepository(database);
  repository.initializeDefaults();
  return { sqlite, db, database, repository };
}
function input(container: schema.Container): ContainerInput {
  return { ...container };
}

describe('storage layout and persistence', () => {
  it('preserves existing templates and marks initialization instead of recreating missing defaults', () => {
    const { sqlite, db, database, repository } = setup();
    const existing = db.select().from(schema.storageSpaces).all()[0];
    repository.saveSpace(
      { name: '우리집 냉장고', type: existing.type },
      existing.id,
    );
    const freezer = db
      .select()
      .from(schema.storageSpaces)
      .all()
      .find((space) => space.type === 'freezer')!;
    db.delete(schema.storageSpaces)
      .where(eq(schema.storageSpaces.id, freezer.id))
      .run();
    createStorageManagementRepository(database).initializeDefaults();
    expect(db.select().from(schema.storageSpaces).all()).toHaveLength(2);
    expect(db.select().from(schema.storageSpaces).all()[0].name).toBe(
      '우리집 냉장고',
    );
    expect(
      db.select().from(schema.appProfiles).get()?.preferences
        .storageTemplateVersion,
    ).toBe(1);
    sqlite.close();
  });
  it('creates a usable default container atomically and rejects duplicate spaces', () => {
    const { sqlite, db, repository } = setup();
    repository.saveSpace({ name: ' 보조   냉장고 ', type: 'refrigerator' });
    const spaces = db.select().from(schema.storageSpaces).all();
    const created = spaces.find((space) => space.name === '보조 냉장고')!;
    expect(
      db
        .select()
        .from(schema.containers)
        .all()
        .filter((container) => container.spaceId === created.id),
    ).toHaveLength(1);
    expect(() =>
      repository.saveSpace({ name: '보조 냉장고', type: 'pantry' }),
    ).toThrow('같은 이름');
    expect(db.select().from(schema.storageSpaces).all()).toHaveLength(4);
    sqlite.close();
  });
  it('validates boundaries, overlap and hierarchies without changing stored containers', () => {
    const { sqlite, db, repository } = setup();
    const rows = db.select().from(schema.containers).all();
    const first = rows[0];
    expect(() =>
      repository.saveContainer({ ...input(first), gridRow: 8 }, first.id),
    ).toThrow('4열');
    expect(() =>
      repository.saveContainer({ ...input(first), gridWidth: 1.5 }, first.id),
    ).toThrow('4열');
    const sibling = rows.find(
      (row) => row.spaceId === first.spaceId && row.id !== first.id,
    )!;
    expect(() =>
      repository.saveContainer(
        { ...input(first), gridRow: sibling.gridRow },
        first.id,
      ),
    ).toThrow('겹칩니다');
    const otherSpace = rows.find((row) => row.spaceId !== first.spaceId)!;
    expect(() =>
      repository.saveContainer(
        { ...input(first), parentId: otherSpace.id },
        first.id,
      ),
    ).toThrow('같은 공간');
    expect(() =>
      repository.saveContainer(
        { ...input(first), parentId: first.id },
        first.id,
      ),
    ).toThrow('하위');
    repository.saveContainer({
      ...input(first),
      name: '채소 바구니',
      parentId: first.id,
      gridRow: 0,
    });
    const child = db
      .select()
      .from(schema.containers)
      .all()
      .find((row) => row.name === '채소 바구니')!;
    expect(
      containerPath(child.id, db.select().from(schema.containers).all()),
    ).toBe(`${first.name} / 채소 바구니`);
    expect(() =>
      repository.saveContainer(
        { ...input(first), parentId: child.id },
        first.id,
      ),
    ).toThrow('하위');
    expect(
      db
        .select()
        .from(schema.containers)
        .where(eq(schema.containers.id, first.id))
        .get(),
    ).toEqual(first);
    sqlite.close();
  });
  it('preserves inventory identity, amounts and transactions when renaming and moving storage', () => {
    const { sqlite, db, database, repository } = setup();
    const shelf = db.select().from(schema.containers).all()[0];
    const inventory = createInventoryRepository(database);
    inventory.create({
      name: '우유',
      containerId: shelf.id,
      amount: '1.2',
      unit: 'L',
      quantityKnown: true,
      purchasedOn: '',
      expiresOn: '',
      notes: '',
    });
    const batches = db.select().from(schema.inventoryBatches).all();
    const transactions = db.select().from(schema.inventoryTransactions).all();
    const edit = repository.saveContainer(
      { ...input(shelf), name: '우유 칸', gridColumn: 2, gridWidth: 2 },
      shelf.id,
    )!;
    repository.undo(edit);
    expect(db.select().from(schema.inventoryBatches).all()).toEqual(batches);
    expect(db.select().from(schema.inventoryTransactions).all()).toEqual(
      transactions,
    );
    expect(
      db
        .select()
        .from(schema.containers)
        .where(eq(schema.containers.id, shelf.id))
        .get(),
    ).toMatchObject({ name: shelf.name, gridColumn: shelf.gridColumn });
    const stale = repository.saveContainer(
      { ...input(shelf), name: '첫 수정' },
      shelf.id,
    )!;
    repository.saveContainer({ ...input(shelf), name: '나중 수정' }, shelf.id);
    expect(() => repository.undo(stale)).toThrow('이후 변경');
    sqlite.close();
  });
  it('finds free cells and allows edge-touching containers without overlap', () => {
    const { sqlite, db } = setup();
    const rows = db.select().from(schema.containers).all();
    const shelf = rows[0];
    expect(firstFreeCell(rows, shelf.spaceId, null)).toEqual({
      gridRow: 0,
      gridColumn: 1,
    });
    expect(
      validatePlacement({ ...input(shelf), name: '옆칸', gridColumn: 1 }, rows),
    ).toMatchObject({ gridColumn: 1 });
    const full = [{ ...shelf, gridWidth: 4, gridHeight: 8 }];
    expect(() => firstFreeCell(full, shelf.spaceId, null)).toThrow('빈 칸');
    sqlite.close();
  });
  it('round trips custom layout and initialization preferences through backup restore', async () => {
    const { sqlite, db, database, repository } = setup();
    const shelf = db.select().from(schema.containers).all()[0];
    repository.saveContainer(
      { ...input(shelf), name: '수제 선반', gridColumn: 3 },
      shelf.id,
    );
    const backups = createBackupRepository(database);
    const expected = backups.snapshot();
    const sha = async (value: string) =>
      createHash('sha256').update(value).digest('hex');
    const encoded = await encodeBackup(expected, 'a'.repeat(64), sha);
    repository.saveContainer({ ...input(shelf), name: '나중 이름' }, shelf.id);
    const decoded = await decodeBackup(encoded.text, 'a'.repeat(64), sha);
    backups.replace(decoded.data);
    repository.initializeDefaults();
    expect(backups.snapshot()).toEqual(expected);
    sqlite.close();
  });
});
