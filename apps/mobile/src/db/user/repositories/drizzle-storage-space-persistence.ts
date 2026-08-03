import { asc } from 'drizzle-orm';

import type { StorageSpacePersistence } from '@/features/storage/repositories/storage-space-repository';

import { userDatabase } from '../client';
import { storageSpaces } from '../schema';

export const drizzleStorageSpacePersistence: StorageSpacePersistence = {
  async insert(space) {
    await userDatabase.transaction(async (transaction) => {
      await transaction.insert(storageSpaces).values(space);
    });
  },

  async list() {
    return userDatabase
      .select()
      .from(storageSpaces)
      .orderBy(asc(storageSpaces.sortOrder));
  },
};
