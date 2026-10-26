import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { BackupScreen } from '../screens/backup-screen';
import { nativeBackupService } from '../services/native-backup-service';
import type { PreparedBackup } from '../domain/backup-format';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('../services/use-backup-status', () => ({
  useBackupStatus: () => ({ lastExport: null, loading: false, error: false }),
}));
jest.mock('../services/native-backup-service', () => ({
  nativeBackupService: {
    export: jest.fn(),
    prepareRestore: jest.fn(),
    restore: jest.fn(),
  },
}));
const service = jest.mocked(nativeBackupService);
beforeEach(() => {
  jest.clearAllMocks();
});
it('requires explicit full replacement confirmation after inspecting a file', async () => {
  const data = {
    profiles: [],
    spaces: [],
    containers: [],
    batches: [],
    transactions: [],
  };
  const prepared: PreparedBackup = {
    data,
    text: 'fixture',
    manifest: {
      format: 'fridge-flow-backup',
      format_version: 1,
      schema_version: 3,
      app_version: '0.1.0',
      created_at: '2026-10-26T00:00:00.000Z',
      owner_sub_sha256: 'a'.repeat(64),
      data_sha256: 'b'.repeat(64),
      record_counts: {
        profiles: 0,
        spaces: 0,
        containers: 0,
        batches: 0,
        transactions: 0,
      },
    },
  };
  service.prepareRestore.mockResolvedValue(prepared);
  service.restore.mockResolvedValue('pre-restore.db');
  const screen = await render(<BackupScreen />);
  await fireEvent.press(screen.getByText('백업 파일 선택'));
  await waitFor(() =>
    expect(screen.getByText('복원 내용 확인')).toBeOnTheScreen(),
  );
  expect(service.restore).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('복원 취소'));
  expect(service.restore).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('백업 파일 선택'));
  await waitFor(() =>
    expect(screen.getByText('복원 내용 확인')).toBeOnTheScreen(),
  );
  await fireEvent.press(screen.getByText('현재 데이터 전체 교체 복원'));
  await waitFor(() => expect(service.restore).toHaveBeenCalledWith(prepared));
  await waitFor(() =>
    expect(screen.queryByText('복원 내용 확인')).not.toBeOnTheScreen(),
  );
});
