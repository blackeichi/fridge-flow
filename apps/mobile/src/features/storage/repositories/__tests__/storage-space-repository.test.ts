import {
  createStorageSpaceRepository,
  type StorageSpacePersistence,
} from '../storage-space-repository';

describe('storageSpaceRepository', () => {
  it('normalizes and persists a new storage space', async () => {
    const inserted: Parameters<StorageSpacePersistence['insert']>[0][] = [];
    const persistence: StorageSpacePersistence = {
      async insert(space) {
        inserted.push(space);
      },
      async list() {
        return [];
      },
    };
    const repository = createStorageSpaceRepository({
      createId: () => '00000000-0000-4000-8000-000000000001',
      now: () => '2026-08-03T00:00:00.000Z',
      persistence,
    });

    const created = await repository.create({
      name: '  주방   냉장고  ',
      type: 'refrigerator',
    });

    expect(created).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      name: '주방 냉장고',
      type: 'refrigerator',
      sortOrder: 0,
      createdAt: '2026-08-03T00:00:00.000Z',
      updatedAt: '2026-08-03T00:00:00.000Z',
    });
    expect(inserted).toEqual([created]);
  });

  it('rejects an empty name before writing', async () => {
    const insert = jest.fn();
    const repository = createStorageSpaceRepository({
      persistence: { insert, list: async () => [] },
    });

    await expect(
      repository.create({ name: '   ', type: 'refrigerator' }),
    ).rejects.toThrow('Storage space name');
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects an invalid sort order before writing', async () => {
    const insert = jest.fn();
    const repository = createStorageSpaceRepository({
      persistence: { insert, list: async () => [] },
    });

    await expect(
      repository.create({
        name: '냉장고',
        type: 'refrigerator',
        sortOrder: -1,
      }),
    ).rejects.toThrow('sort order');
    expect(insert).not.toHaveBeenCalled();
  });
});
