import { useEffect, useState } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { userDatabase } from '@/db/user/client';
import {
  createStorageManagementRepository,
  storageQueries,
} from '../repositories/storage-management-repository';
const repository = createStorageManagementRepository(userDatabase);
const queries = storageQueries(userDatabase);
export function useStorage() {
  const spaces = useLiveQuery(queries.spaces);
  const containers = useLiveQuery(queries.containers);
  const [ready, setReady] = useState(false);
  const [setupError, setSetupError] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      try {
        repository.initializeDefaults();
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
    spaces: spaces.data,
    containers: containers.data,
    loading: !ready || !spaces.updatedAt || !containers.updatedAt,
    error: setupError || !!(spaces.error || containers.error),
    repository,
  };
}
