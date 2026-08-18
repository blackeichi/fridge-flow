import { randomUUID } from 'expo-crypto';

import type { InventoryBatch, NewInventoryBatch } from '@/db/user/schema';

export const INVENTORY_UNITS = [
  'g',
  'kg',
  'ml',
  'L',
  'piece',
  'pack',
  'bag',
  'bottle',
  'can',
] as const;

export type InventoryUnit = (typeof INVENTORY_UNITS)[number];
export type IngredientSource = 'catalog' | 'custom';

interface KnownQuantity {
  amount: number;
  known: true;
}

interface UnknownQuantity {
  known: false;
}

interface PackageQuantity {
  count: number;
  size: number;
  sizeUnit: Extract<InventoryUnit, 'g' | 'kg' | 'ml' | 'L' | 'piece'>;
}

export interface CreateInventoryBatchInput {
  ingredientSource: IngredientSource;
  ingredientRef: string;
  displayName: string;
  containerId: string;
  quantity: KnownQuantity | UnknownQuantity;
  unit: InventoryUnit;
  package?: PackageQuantity;
  purchasedOn?: string;
  expiresOn?: string;
  openedOn?: string;
  minimumAmount?: number;
  note?: string;
}

export interface InventoryBatchPersistence {
  insert(batch: NewInventoryBatch): Promise<void>;
  listAvailable(): Promise<InventoryBatch[]>;
}

interface InventoryBatchRepositoryDependencies {
  createId?: () => string;
  now?: () => string;
  persistence: InventoryBatchPersistence;
}

export function createInventoryBatchRepository({
  createId = randomUUID,
  now = () => new Date().toISOString(),
  persistence,
}: InventoryBatchRepositoryDependencies) {
  return {
    async create(input: CreateInventoryBatchInput): Promise<InventoryBatch> {
      const timestamp = now();
      const quantity = normalizeQuantity(input.quantity);
      const packageQuantity = normalizePackage(input.package);

      const batch: InventoryBatch = {
        id: createId(),
        ingredientSource: input.ingredientSource,
        ingredientRef: normalizeRequiredText(
          input.ingredientRef,
          'Ingredient reference',
          200,
        ),
        displayName: normalizeRequiredText(
          input.displayName,
          'Inventory display name',
          100,
        ),
        containerId: normalizeRequiredText(
          input.containerId,
          'Container ID',
          200,
        ),
        amount: quantity.amount,
        unit: input.unit,
        quantityKnown: quantity.known,
        packageCount: packageQuantity?.count ?? null,
        packageSize: packageQuantity?.size ?? null,
        packageSizeUnit: packageQuantity?.sizeUnit ?? null,
        purchasedOn: normalizeDate(input.purchasedOn, 'Purchase date'),
        expiresOn: normalizeDate(input.expiresOn, 'Expiration date'),
        openedOn: normalizeDate(input.openedOn, 'Opened date'),
        minimumAmount: normalizeMinimumAmount(input.minimumAmount),
        note: normalizeOptionalText(input.note, 500),
        status: 'available',
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await persistence.insert(batch);

      return batch;
    },

    listAvailable(): Promise<InventoryBatch[]> {
      return persistence.listAvailable();
    },
  };
}

function normalizeQuantity(quantity: KnownQuantity | UnknownQuantity) {
  if (!quantity.known) {
    return { amount: null, known: false } as const;
  }

  assertPositiveFinite(quantity.amount, 'Inventory amount');

  return { amount: quantity.amount, known: true } as const;
}

function normalizePackage(packageQuantity?: PackageQuantity) {
  if (!packageQuantity) {
    return undefined;
  }

  assertPositiveFinite(packageQuantity.count, 'Package count');
  assertPositiveFinite(packageQuantity.size, 'Package size');

  return packageQuantity;
}

function normalizeMinimumAmount(minimumAmount?: number) {
  if (minimumAmount === undefined) {
    return null;
  }

  if (!Number.isFinite(minimumAmount) || minimumAmount < 0) {
    throw new Error('Minimum amount must be a non-negative finite number.');
  }

  return minimumAmount;
}

function normalizeDate(value: string | undefined, label: string) {
  if (value === undefined) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD format.`);
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${label} must be a valid calendar date.`);
  }

  return value;
}

function normalizeRequiredText(
  value: string,
  label: string,
  maxLength: number,
) {
  const normalized = value.trim().replace(/\s+/g, ' ');

  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new Error(
      `${label} must contain between 1 and ${maxLength} characters.`,
    );
  }

  return normalized;
}

function normalizeOptionalText(value: string | undefined, maxLength: number) {
  if (value === undefined) {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, ' ');

  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new Error(`Note must contain at most ${maxLength} characters.`);
  }

  return normalized;
}

function assertPositiveFinite(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number.`);
  }
}
