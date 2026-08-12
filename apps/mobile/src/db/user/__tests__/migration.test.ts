/** @jest-environment node */

import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

function createMigratedDatabase() {
  const database = new Database(':memory:');
  database.pragma('foreign_keys = ON');

  const migrationDirectory = resolve(__dirname, '../migrations');
  const migrations = readdirSync(migrationDirectory)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort();

  for (const migration of migrations) {
    const sql = readFileSync(
      resolve(migrationDirectory, migration),
      'utf8',
    ).replaceAll('--> statement-breakpoint', '');
    database.exec(sql);
  }

  return database;
}

describe('user.db initial migration', () => {
  it('creates the foundational user tables', () => {
    const database = createMigratedDatabase();
    const rows = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      )
      .all() as { name: string }[];

    expect(rows.map(({ name }) => name)).toEqual([
      'app_profiles',
      'containers',
      'local_owners',
      'storage_spaces',
    ]);

    database.close();
  });

  it('enforces owner hash, storage type and foreign-key constraints', () => {
    const database = createMigratedDatabase();

    expect(() =>
      database
        .prepare(
          'INSERT INTO local_owners (owner_sub_sha256, created_at, last_login_at) VALUES (?, ?, ?)',
        )
        .run(
          'not-a-sha256',
          '2026-08-03T00:00:00.000Z',
          '2026-08-03T00:00:00.000Z',
        ),
    ).toThrow();

    expect(() =>
      database
        .prepare(
          'INSERT INTO storage_spaces (id, name, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        )
        .run(
          '00000000-0000-4000-8000-000000000001',
          '잘못된 공간',
          'garage',
          '2026-08-03T00:00:00.000Z',
          '2026-08-03T00:00:00.000Z',
        ),
    ).toThrow();

    expect(() =>
      database
        .prepare(
          'INSERT INTO containers (id, space_id, name, grid_row, grid_column, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          '00000000-0000-4000-8000-000000000002',
          'missing-space',
          '상단 선반',
          0,
          0,
          '2026-08-03T00:00:00.000Z',
          '2026-08-03T00:00:00.000Z',
        ),
    ).toThrow();

    database.close();
  });

  it('cascades container deletion when a storage space is deleted', () => {
    const database = createMigratedDatabase();
    database
      .prepare(
        'INSERT INTO storage_spaces (id, name, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(
        '00000000-0000-4000-8000-000000000001',
        '주방 냉장고',
        'refrigerator',
        '2026-08-03T00:00:00.000Z',
        '2026-08-03T00:00:00.000Z',
      );
    database
      .prepare(
        'INSERT INTO containers (id, space_id, name, grid_row, grid_column, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000001',
        '상단 선반',
        0,
        0,
        '2026-08-03T00:00:00.000Z',
        '2026-08-03T00:00:00.000Z',
      );

    database
      .prepare('DELETE FROM storage_spaces WHERE id = ?')
      .run('00000000-0000-4000-8000-000000000001');

    expect(
      database.prepare('SELECT COUNT(*) AS count FROM containers').get(),
    ).toEqual({
      count: 0,
    });

    database.close();
  });

  it('rejects a parent container from another storage space', () => {
    const database = createMigratedDatabase();
    const insertSpace = database.prepare(
      'INSERT INTO storage_spaces (id, name, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    );
    insertSpace.run(
      '00000000-0000-4000-8000-000000000001',
      '주방 냉장고',
      'refrigerator',
      '2026-08-03T00:00:00.000Z',
      '2026-08-03T00:00:00.000Z',
    );
    insertSpace.run(
      '00000000-0000-4000-8000-000000000002',
      '다용도실 냉동고',
      'freezer',
      '2026-08-03T00:00:00.000Z',
      '2026-08-03T00:00:00.000Z',
    );

    const insertContainer = database.prepare(
      'INSERT INTO containers (id, space_id, parent_id, name, grid_row, grid_column, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    );
    insertContainer.run(
      '00000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000001',
      null,
      '상단 선반',
      0,
      0,
      '2026-08-03T00:00:00.000Z',
      '2026-08-03T00:00:00.000Z',
    );

    expect(() =>
      insertContainer.run(
        '00000000-0000-4000-8000-000000000004',
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003',
        '잘못 연결된 바구니',
        0,
        0,
        '2026-08-03T00:00:00.000Z',
        '2026-08-03T00:00:00.000Z',
      ),
    ).toThrow();

    database.close();
  });
});
