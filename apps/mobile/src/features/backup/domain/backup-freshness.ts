export type BackupStatus = {
  lastExport: string | null;
  loading: boolean;
  error: boolean;
};

export function backupFreshness(status: BackupStatus, now: number) {
  if (status.error) return 'error';
  if (status.loading) return 'loading';
  if (!status.lastExport) return 'missing';
  const timestamp = Date.parse(status.lastExport);
  if (!Number.isFinite(timestamp) || timestamp > now) return 'unknown';
  return now - timestamp >= 7 * 86_400_000 ? 'overdue' : 'recent';
}
