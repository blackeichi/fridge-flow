import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import * as schema from './schema';

export const USER_DATABASE_NAME = 'user.db';

export function configureUserDatabase(
  sqlite: Pick<SQLiteDatabase, 'execSync'>,
) {
  sqlite.execSync('PRAGMA journal_mode = WAL;');
  sqlite.execSync('PRAGMA foreign_keys = ON;');
}

export const userSqlite = openDatabaseSync(USER_DATABASE_NAME, {
  enableChangeListener: true,
});

configureUserDatabase(userSqlite);

export const userDatabase = drizzle(userSqlite, { schema });

export type UserDatabase = typeof userDatabase;
