/** @jest-environment node */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { UserDatabase } from '@/db/user/client';
import * as schema from '@/db/user/schema';
import { createInventoryRepository } from '../inventory-repository';
import type { InventoryInput } from '../../domain/inventory';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));

function setup(filename = ':memory:') {
  const sqlite = new Database(filename);
  sqlite.pragma('foreign_keys = ON');
  const directory = resolve(__dirname, '../../../../db/user/migrations');
  for (const file of readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    sqlite.exec(
      readFileSync(resolve(directory, file), 'utf8').replaceAll(
        '--> statement-breakpoint',
        '',
      ),
    );
  }
  const db = drizzle(sqlite, { schema });
  let id = 0;
  let timestamp = '2026-10-26T00:00:00.000Z';
  const repository = createInventoryRepository(db as unknown as UserDatabase, {
    createId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`,
    now: () => timestamp,
  });
  repository.initializeLocations();
  const containerId = db.select().from(schema.containers).all()[0].id;
  const input: InventoryInput = {
    name: '우유',
    amount: '1.2',
    unit: 'L',
    quantityKnown: true,
    containerId,
    expiresOn: '2026-10-29',
    purchasedOn: '',
    notes: '',
  };
  return {
    sqlite,
    db,
    repository,
    input,
    setNow: (value: string) => {
      timestamp = value;
    },
  };
}

describe('local inventory transactions', () => {
  it('initializes once, keeps separate batches, and rolls back duplicate operations', () => {
    const { sqlite, db, repository, input } = setup();
    repository.initializeLocations();
    expect(db.select().from(schema.storageSpaces).all()).toHaveLength(3);
    expect(db.select().from(schema.containers).all()).toHaveLength(5);
    const first = repository.create(input, 'create-once');
    repository.create({ ...input, expiresOn: '2026-11-01' });
    expect(() => repository.create(input, 'create-once')).toThrow();
    expect(db.select().from(schema.inventoryBatches).all()).toHaveLength(2);
    repository.update(first.id, { ...input, amount: '1.1' }, 'adjust-once');
    expect(() =>
      repository.update(first.id, { ...input, amount: '0' }, 'adjust-once'),
    ).toThrow();
    expect(
      db
        .select()
        .from(schema.inventoryBatches)
        .where(eq(schema.inventoryBatches.id, first.id))
        .get()?.amount,
    ).toBe('1.1');
    expect(
      db.select().from(schema.inventoryTransactions).all().at(-1)?.amountDelta,
    ).toBe('-0.1');
    sqlite.close();
  });
  it('undoes location, quantity and deletion with append-only records', () => {
    const { sqlite, db, repository, input } = setup();
    const batch = repository.create(input);
    const destination = db.select().from(schema.containers).all()[1].id;
    const moved = repository.update(batch.id, {
      ...input,
      containerId: destination,
      amount: '0',
      notes: '소진',
    });
    expect(moved.status).toBe('exhausted');
    const restored = repository.undo(moved.lastOperationId);
    expect(restored).toMatchObject({
      containerId: input.containerId,
      amount: '1.2',
      notes: '',
      status: 'available',
    });
    expect(() => repository.undo(moved.lastOperationId)).toThrow();
    const removed = repository.remove(batch.id);
    expect(removed.status).toBe('deleted');
    expect(repository.undo(removed.lastOperationId).status).toBe('available');
    expect(db.select().from(schema.inventoryTransactions).all()).toHaveLength(
      5,
    );
    expect(() =>
      db
        .delete(schema.containers)
        .where(eq(schema.containers.id, input.containerId))
        .run(),
    ).toThrow();
    sqlite.close();
  });
  it('rejects stale and expired undo and keeps the current state', () => {
    const { sqlite, repository, input, setNow } = setup();
    const batch = repository.create(input);
    const changed = repository.update(batch.id, {
      ...input,
      quantityKnown: false,
    });
    expect(changed.amount).toBeNull();
    expect(() => repository.undo(batch.lastOperationId)).toThrow('이후 변경');
    setNow('2026-11-03T00:00:00.000Z');
    expect(() => repository.undo(changed.lastOperationId)).toThrow('7일');
    sqlite.close();
  });
  it('rolls back writes with invalid locations and preserves prior data', () => {
    const { sqlite, db, repository, input } = setup();
    const batch = repository.create(input);
    expect(() =>
      repository.update(batch.id, { ...input, containerId: 'missing' }),
    ).toThrow();
    expect(db.select().from(schema.inventoryTransactions).all()).toHaveLength(
      1,
    );
    expect(db.select().from(schema.inventoryBatches).all()[0]).toEqual(batch);
    expect(repository.undo(batch.lastOperationId).status).toBe('deleted');
    sqlite.close();
  });
  it('keeps saved batches and undo history after reopening the database', () => {
    const directory = mkdtempSync(resolve(tmpdir(), 'fridge-inventory-'));
    const filename = resolve(directory, 'user.db');
    try {
      const first = setup(filename);
      const batch = first.repository.create(first.input);
      const removed = first.repository.remove(batch.id);
      first.sqlite.close();
      const reopened = new Database(filename);
      reopened.pragma('foreign_keys = ON');
      try {
        const db = drizzle(reopened, { schema });
        expect(db.select().from(schema.inventoryBatches).all()[0].status).toBe(
          'deleted',
        );
        const repository = createInventoryRepository(
          db as unknown as UserDatabase,
          {
            createId: () => '11111111-1111-4111-8111-111111111111',
            now: () => '2026-10-27T00:00:00.000Z',
          },
        );
        expect(repository.undo(removed.lastOperationId)).toMatchObject({
          name: '우유',
          amount: '1.2',
          status: 'available',
        });
      } finally {
        reopened.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
