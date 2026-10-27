import { fireEvent, render } from '@testing-library/react-native';
import { InventoryHistoryScreen } from '../screens/inventory-history-screen';
import { useInventoryHistory } from '../hooks/use-inventory-history';
import type { InventoryHistoryRow } from '../repositories/inventory-history-repository';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('../hooks/use-inventory-history', () => ({
  useInventoryHistory: jest.fn(),
}));
const mocked = jest.mocked(useInventoryHistory);
const undo = jest.fn();
const now = Date.parse('2026-10-27T00:00:00.000Z');
const after = {
  id: 'milk',
  name: '우유',
  containerId: 'shelf',
  amount: '0.5',
  unit: 'L' as const,
  quantityKnown: true,
  purchasedOn: null,
  expiresOn: null,
  notes: '',
  status: 'available' as const,
  lastOperationId: 'edit',
  createdAt: '2026-10-26T00:00:00.000Z',
  updatedAt: '2026-10-26T00:00:00.000Z',
};
const row: InventoryHistoryRow = {
  operation: {
    sequence: 1,
    id: 'record',
    operationId: 'edit',
    batchId: 'milk',
    type: 'update',
    amountDelta: '-0.5',
    before: { ...after, amount: '1' },
    after,
    reversesOperationId: null,
    createdAt: after.createdAt,
  },
  currentOperationId: 'edit',
  reversedBy: null,
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(now);
  mocked.mockReturnValue({
    rows: [row],
    hasMore: false,
    loading: false,
    error: false,
    locations: [
      {
        id: 'shelf',
        name: '선반',
        parentId: null,
        spaceId: 'fridge',
        spaceName: '냉장실',
      },
    ],
    repository: {
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      initializeLocations: jest.fn(),
      undo,
    },
  });
});
afterEach(() => jest.restoreAllMocks());

it('previews a change, cancels without writing and requires explicit confirmation', async () => {
  const screen = await render(<InventoryHistoryScreen />);
  expect(screen.getByText('우유 · 수정')).toBeOnTheScreen();
  await fireEvent.press(screen.getByLabelText('우유 변경 내용 보기'));
  expect(screen.getByText('이전: 1 L')).toBeOnTheScreen();
  expect(screen.getByText('변경 후: 0.5 L')).toBeOnTheScreen();
  await fireEvent.press(screen.getByLabelText('우유 수정 실행 취소'));
  expect(undo).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('취소'));
  expect(undo).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('우유 수정 실행 취소'));
  await fireEvent.press(screen.getByText('이 변경 되돌리기'));
  expect(undo).toHaveBeenCalledWith('edit');
  expect(
    screen.getByText('변경을 실행 취소했습니다. 취소 기록도 보관됩니다.'),
  ).toBeOnTheScreen();
});
it('keeps a conflict message visible when the repository rejects stale confirmation', async () => {
  undo.mockImplementationOnce(() => {
    throw new Error('이후 변경이 있어 실행 취소할 수 없습니다.');
  });
  const screen = await render(<InventoryHistoryScreen />);
  await fireEvent.press(screen.getByLabelText('우유 수정 실행 취소'));
  await fireEvent.press(screen.getByText('이 변경 되돌리기'));
  expect(
    screen.getByText('이후 변경이 있어 실행 취소할 수 없습니다.'),
  ).toBeOnTheScreen();
  expect(screen.queryByText('이 변경 되돌리기')).not.toBeOnTheScreen();
});
it('shows the reason for unavailable undo and reads the next page on demand', async () => {
  const initial = mocked(30);
  mocked.mockReturnValue({
    ...initial,
    rows: [{ ...row, reversedBy: 'undo' }],
    hasMore: true,
  });
  const screen = await render(<InventoryHistoryScreen />);
  expect(screen.getByText('이미 실행 취소한 변경입니다.')).toBeOnTheScreen();
  expect(screen.queryByLabelText('우유 수정 실행 취소')).not.toBeOnTheScreen();
  await fireEvent.press(screen.getByText('이전 기록 더 보기'));
  expect(mocked).toHaveBeenLastCalledWith(60);
});
it('distinguishes empty, loading and failed history and allows retry', async () => {
  const initial = mocked(30);
  mocked.mockReturnValue({ ...initial, rows: [], loading: true });
  const screen = await render(<InventoryHistoryScreen />);
  expect(screen.getByText('변경 이력을 불러오고 있어요.')).toBeOnTheScreen();
  expect(
    screen.queryByText('아직 재고 변경 기록이 없어요.'),
  ).not.toBeOnTheScreen();
  mocked.mockReturnValue({ ...initial, rows: [], error: true });
  await screen.rerender(<InventoryHistoryScreen />);
  expect(
    screen.getByText('변경 이력을 불러오지 못했습니다.'),
  ).toBeOnTheScreen();
  mocked.mockReturnValue({ ...initial, rows: [] });
  await fireEvent.press(screen.getByText('다시 시도'));
  expect(screen.getByText('아직 재고 변경 기록이 없어요.')).toBeOnTheScreen();
});
it('disables stale confirmation when live data changes or history fails to load', async () => {
  const initial = mocked(30);
  const screen = await render(<InventoryHistoryScreen />);
  await fireEvent.press(screen.getByLabelText('우유 수정 실행 취소'));
  mocked.mockReturnValue({
    ...initial,
    rows: [{ ...row, currentOperationId: 'later' }],
  });
  await screen.rerender(<InventoryHistoryScreen />);
  expect(screen.getByText('이 변경 되돌리기')).toBeDisabled();
  await fireEvent.press(screen.getByText('이 변경 되돌리기'));
  expect(undo).not.toHaveBeenCalled();
  mocked.mockReturnValue({ ...initial, error: true });
  await screen.rerender(<InventoryHistoryScreen />);
  expect(
    screen.getByText('이력을 다시 불러온 뒤 실행 취소해 주세요.'),
  ).toBeOnTheScreen();
  expect(screen.getByText('이 변경 되돌리기')).toBeDisabled();
});
