import {
  createInventoryBatchRepository,
  type InventoryBatchPersistence,
} from '../inventory-batch-repository';

describe('inventoryBatchRepository', () => {
  function createHarness() {
    const inserted: Parameters<InventoryBatchPersistence['insert']>[0][] = [];
    const persistence: InventoryBatchPersistence = {
      async insert(batch) {
        inserted.push(batch);
      },
      async listAvailable() {
        return [];
      },
    };
    const repository = createInventoryBatchRepository({
      createId: () => '00000000-0000-4000-8000-000000000010',
      now: () => '2026-08-18T00:00:00.000Z',
      persistence,
    });

    return { inserted, repository };
  }

  it('normalizes and persists a known inventory quantity', async () => {
    const { inserted, repository } = createHarness();

    const created = await repository.create({
      ingredientSource: 'catalog',
      ingredientRef: '  ingredient-tofu  ',
      displayName: '  부침용   두부  ',
      containerId: 'container-fridge-top',
      quantity: { known: true, amount: 300 },
      unit: 'g',
      package: { count: 1, size: 300, sizeUnit: 'g' },
      purchasedOn: '2026-08-18',
      expiresOn: '2026-08-24',
      minimumAmount: 100,
      note: '  찌개보다   부침 우선  ',
    });

    expect(created).toEqual({
      id: '00000000-0000-4000-8000-000000000010',
      ingredientSource: 'catalog',
      ingredientRef: 'ingredient-tofu',
      displayName: '부침용 두부',
      containerId: 'container-fridge-top',
      amount: 300,
      unit: 'g',
      quantityKnown: true,
      packageCount: 1,
      packageSize: 300,
      packageSizeUnit: 'g',
      purchasedOn: '2026-08-18',
      expiresOn: '2026-08-24',
      openedOn: null,
      minimumAmount: 100,
      note: '찌개보다 부침 우선',
      status: 'available',
      createdAt: '2026-08-18T00:00:00.000Z',
      updatedAt: '2026-08-18T00:00:00.000Z',
    });
    expect(inserted).toEqual([created]);
  });

  it('stores an unknown quantity without inventing a zero amount', async () => {
    const { repository } = createHarness();

    const created = await repository.create({
      ingredientSource: 'custom',
      ingredientRef: 'custom-green-onion',
      displayName: '대파',
      containerId: 'container-vegetable-drawer',
      quantity: { known: false },
      unit: 'g',
    });

    expect(created.quantityKnown).toBe(false);
    expect(created.amount).toBeNull();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid known amount %s before writing',
    async (amount) => {
      const { inserted, repository } = createHarness();

      await expect(
        repository.create({
          ingredientSource: 'catalog',
          ingredientRef: 'ingredient-milk',
          displayName: '우유',
          containerId: 'container-door',
          quantity: { known: true, amount },
          unit: 'ml',
        }),
      ).rejects.toThrow('Inventory amount');
      expect(inserted).toHaveLength(0);
    },
  );

  it('rejects an invalid calendar date before writing', async () => {
    const { inserted, repository } = createHarness();

    await expect(
      repository.create({
        ingredientSource: 'catalog',
        ingredientRef: 'ingredient-egg',
        displayName: '달걀',
        containerId: 'container-door',
        quantity: { known: true, amount: 10 },
        unit: 'piece',
        expiresOn: '2026-02-30',
      }),
    ).rejects.toThrow('valid calendar date');
    expect(inserted).toHaveLength(0);
  });
});
