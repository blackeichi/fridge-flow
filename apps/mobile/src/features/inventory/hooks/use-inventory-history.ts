import { useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { userDatabase } from '@/db/user/client';
import { containerPath } from '@/features/storage/domain/layout';
import {
  createInventoryRepository,
  inventoryQueries,
} from '../repositories/inventory-repository';
import { inventoryHistoryQuery } from '../repositories/inventory-history-repository';

const repository = createInventoryRepository(userDatabase);
const queries = inventoryQueries(userDatabase);
export function useInventoryHistory(limit: number) {
  const query = useMemo(
    () => inventoryHistoryQuery(userDatabase, limit),
    [limit],
  );
  const history = useLiveQuery(query, [limit]);
  const spaces = useLiveQuery(queries.spaces);
  const locations = useLiveQuery(queries.locations, [spaces.updatedAt]);
  return {
    rows: history.data.slice(0, limit),
    hasMore: history.data.length > limit,
    loading: !history.updatedAt || !locations.updatedAt || !spaces.updatedAt,
    error: !!(history.error || locations.error || spaces.error),
    locations: locations.data.map((location) => ({
      ...location,
      name: containerPath(location.id, locations.data),
    })),
    repository,
  };
}
