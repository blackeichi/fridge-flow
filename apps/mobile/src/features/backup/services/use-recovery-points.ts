import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { userDatabase } from '@/db/user/client';
import { recoveryPointsQuery } from '../repositories/backup-repository';
const query = recoveryPointsQuery(userDatabase);
export function useRecoveryPoints() {
  const { data, updatedAt, error } = useLiveQuery(query);
  return { points: data, loading: !updatedAt && !error, error: !!error };
}
