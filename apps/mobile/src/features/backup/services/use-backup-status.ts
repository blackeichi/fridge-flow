import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { userDatabase } from '@/db/user/client';
import { lastExportQuery } from '../repositories/backup-repository';
const query = lastExportQuery(userDatabase);
export function useBackupStatus() {
  const { data, error, updatedAt } = useLiveQuery(query);
  return {
    lastExport: data.at(0)?.createdAt ?? null,
    loading: !updatedAt && !error,
    error: !!error,
  };
}
