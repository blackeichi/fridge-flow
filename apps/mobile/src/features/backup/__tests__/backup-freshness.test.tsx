import { render } from '@testing-library/react-native';
import { BackupFreshness } from '../components/backup-freshness';
import { backupFreshness } from '../domain/backup-freshness';

const now = Date.parse('2026-10-26T12:00:00.000Z');
const status = { lastExport: null, loading: false, error: false };

it('warns at exactly seven elapsed days and keeps the timestamp visible', async () => {
  const lastExport = '2026-10-19T12:00:00.000Z';
  expect(backupFreshness({ ...status, lastExport }, now - 1)).toBe('recent');
  expect(backupFreshness({ ...status, lastExport }, now)).toBe('overdue');
  const screen = await render(
    <BackupFreshness status={{ ...status, lastExport }} now={now - 1} />,
  );
  expect(screen.queryByText(/마지막 백업 후 7일/)).not.toBeOnTheScreen();
  await screen.rerender(
    <BackupFreshness status={{ ...status, lastExport }} now={now} />,
  );
  expect(screen.getByText(/마지막 백업 후 7일/)).toBeOnTheScreen();
  expect(screen.getByText(/마지막 성공 백업:/)).toHaveTextContent(
    `마지막 성공 백업: ${new Date(lastExport).toLocaleString()}`,
  );
});

it('distinguishes pending and failed history from a confirmed empty history', async () => {
  const screen = await render(
    <BackupFreshness status={{ ...status, loading: true }} now={now} />,
  );
  expect(screen.getByText('백업 기록을 확인하고 있어요.')).toBeOnTheScreen();
  expect(screen.queryByText(/아직 백업이 없어요/)).not.toBeOnTheScreen();
  await screen.rerender(
    <BackupFreshness
      status={{
        lastExport: '2026-10-25T12:00:00Z',
        error: true,
        loading: false,
      }}
      now={now}
    />,
  );
  expect(screen.getByText(/백업 기록을 확인하지 못했습니다/)).toBeOnTheScreen();
  expect(screen.queryByText(/마지막 성공 백업:/)).not.toBeOnTheScreen();
  await screen.rerender(<BackupFreshness status={status} now={now} />);
  expect(screen.getByText(/아직 백업이 없어요/)).toBeOnTheScreen();
});

it('does not present invalid or future timestamps as recent successful protection', () => {
  for (const lastExport of ['invalid', '2026-10-27T12:00:00Z']) {
    expect(backupFreshness({ ...status, lastExport }, now)).toBe('unknown');
  }
});

it('clears the overdue warning when a new successful export arrives', async () => {
  const screen = await render(
    <BackupFreshness
      status={{ ...status, lastExport: '2026-10-01T00:00:00Z' }}
      now={now}
    />,
  );
  await screen.rerender(
    <BackupFreshness
      status={{ ...status, lastExport: '2026-10-26T12:00:00Z' }}
      now={now}
    />,
  );
  expect(screen.queryByText(/마지막 백업 후 7일/)).not.toBeOnTheScreen();
  expect(screen.getByText(/마지막 성공 백업:/)).toBeOnTheScreen();
});
