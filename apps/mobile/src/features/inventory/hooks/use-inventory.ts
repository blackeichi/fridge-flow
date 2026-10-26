import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useState } from 'react';
import { userDatabase } from '@/db/user/client';
import {
  createInventoryRepository,
  inventoryQueries,
} from '../repositories/inventory-repository';

const repository = createInventoryRepository(userDatabase);
const queries = inventoryQueries(userDatabase);

export function useInventory() {
  const batches = useLiveQuery(queries.batches);
  const locations = useLiveQuery(queries.locations);
  const latest = useLiveQuery(queries.latest);
  const [ready, setReady] = useState(false);
  const [setupError, setSetupError] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      try {
        repository.initializeLocations();
        setReady(true);
      } catch {
        setSetupError(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);
  return {
    batches: batches.data.filter((batch) => batch.status !== 'deleted'),
    locations: locations.data,
    latest: latest.data.at(0),
    loading:
      !ready || !batches.updatedAt || !locations.updatedAt || !latest.updatedAt,
    error: setupError || !!(batches.error || locations.error || latest.error),
    repository,
  };
}
