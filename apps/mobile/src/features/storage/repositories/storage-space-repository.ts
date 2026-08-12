import { randomUUID } from 'expo-crypto';

import type { NewStorageSpace, StorageSpace } from '@/db/user/schema';

export const STORAGE_SPACE_TYPES = [
  'refrigerator',
  'freezer',
  'pantry',
] as const;

export type StorageSpaceType = (typeof STORAGE_SPACE_TYPES)[number];

export interface CreateStorageSpaceInput {
  name: string;
  type: StorageSpaceType;
  sortOrder?: number;
}

export interface StorageSpacePersistence {
  insert(space: NewStorageSpace): Promise<void>;
  list(): Promise<StorageSpace[]>;
}

interface StorageSpaceRepositoryDependencies {
  createId?: () => string;
  now?: () => string;
  persistence: StorageSpacePersistence;
}

export function createStorageSpaceRepository({
  createId = randomUUID,
  now = () => new Date().toISOString(),
  persistence,
}: StorageSpaceRepositoryDependencies) {
  return {
    async create(input: CreateStorageSpaceInput): Promise<StorageSpace> {
      const name = normalizeStorageSpaceName(input.name);
      const timestamp = now();
      const sortOrder = input.sortOrder ?? 0;

      if (sortOrder < 0 || !Number.isInteger(sortOrder)) {
        throw new Error(
          'Storage space sort order must be a non-negative integer.',
        );
      }

      const space: StorageSpace = {
        id: createId(),
        name,
        type: input.type,
        sortOrder,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await persistence.insert(space);

      return space;
    },

    list(): Promise<StorageSpace[]> {
      return persistence.list();
    },
  };
}

export function normalizeStorageSpaceName(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ');

  if (normalized.length === 0 || normalized.length > 60) {
    throw new Error(
      'Storage space name must contain between 1 and 60 characters.',
    );
  }

  return normalized;
}
