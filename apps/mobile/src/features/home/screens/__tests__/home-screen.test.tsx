import { fireEvent, render } from '@testing-library/react-native';
import { HomeScreen } from '../home-screen';
import { useInventory } from '@/features/inventory/hooks/use-inventory';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/features/backup/services/use-backup-status', () => ({
  useBackupStatus: () => ({ lastExport: null, loading: false, error: false }),
}));
jest.mock('@/features/inventory/hooks/use-inventory', () => ({
  useInventory: jest.fn(),
}));
const mockedInventory = jest.mocked(useInventory);
const create = jest.fn();
const update = jest.fn();
const locations = [
  {
    id: 'shelf',
    name: '냉장 선반',
    spaceName: '냉장실',
    spaceId: 'fridge',
    parentId: null,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockedInventory.mockReturnValue({
    batches: [],
    locations,
    latest: undefined,
    loading: false,
    error: false,
    repository: {
      create,
      update,
      remove: jest.fn(),
      undo: jest.fn(),
      initializeLocations: jest.fn(),
    },
  });
});

describe('HomeScreen inventory flow', () => {
  it('shows an empty fridge, validates input and saves a batch', async () => {
    const screen = await render(<HomeScreen />);
    expect(screen.getByText('첫 재료를 추가해 보세요')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('+ 재료'));
    await fireEvent.press(screen.getByText('저장'));
    expect(create).not.toHaveBeenCalled();
    expect(
      screen.getByText('재료명은 1~100자로 입력해 주세요.'),
    ).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('재료명'), '두부');
    await fireEvent.changeText(screen.getByLabelText('유통기한'), '2026-02-30');
    await fireEvent.press(screen.getByText('저장'));
    expect(create).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('유통기한'), '2026-10-29');
    await fireEvent.press(screen.getByText('저장'));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '두부',
        containerId: 'shelf',
        expiresOn: '2026-10-29',
      }),
    );
    expect(screen.queryByLabelText('재료명')).not.toBeOnTheScreen();
  });
  it('keeps the form open after storage errors and allows retry', async () => {
    create.mockImplementationOnce(() => {
      throw new Error('저장 실패');
    });
    const screen = await render(<HomeScreen />);
    await fireEvent.press(screen.getByText('+ 재료'));
    await fireEvent.changeText(screen.getByLabelText('재료명'), '달걀');
    await fireEvent.press(screen.getByText('저장'));
    expect(
      screen.getByText(
        '기기에 저장하지 못했습니다. 입력은 유지됩니다. 다시 시도해 주세요.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('저장'));
    expect(create).toHaveBeenCalledTimes(2);
  });
  it('filters saved batches and edits quantity, notes and location', async () => {
    const initial = mockedInventory();
    mockedInventory.mockReturnValue({
      ...initial,
      batches: [
        {
          id: 'milk',
          name: '우유',
          containerId: 'shelf',
          amount: '1.2',
          unit: 'L',
          quantityKnown: true,
          expiresOn: null,
          purchasedOn: null,
          notes: '개봉 전',
          status: 'available',
          lastOperationId: 'operation',
          createdAt: '2026-10-26T00:00:00Z',
          updatedAt: '2026-10-26T00:00:00Z',
        },
      ],
      locations: [
        ...locations,
        {
          id: 'drawer',
          parentId: null,
          name: '야채 서랍',
          spaceId: 'fridge',
          spaceName: '냉장실',
        },
      ],
    });
    const screen = await render(<HomeScreen />);
    expect(screen.getByText('1.2 L')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('재료 검색'), '두부');
    expect(screen.queryByText('우유')).not.toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('재료 검색'), '우유');
    await fireEvent.press(screen.getByLabelText('우유 수정'));
    await fireEvent.changeText(screen.getByLabelText('수량'), '0');
    await fireEvent.changeText(screen.getByLabelText('메모'), '다 먹었음');
    await fireEvent.press(screen.getByText('냉장실 · 야채 서랍'));
    await fireEvent.press(screen.getByText('저장'));
    expect(update).toHaveBeenCalledWith(
      'milk',
      expect.objectContaining({
        amount: '0',
        containerId: 'drawer',
        notes: '다 먹었음',
      }),
    );
  });
});

it('opens inventory history from the fridge', async () => {
  const screen = await render(<HomeScreen />);
  await fireEvent.press(screen.getByText('재고 변경 이력'));
  expect(mockPush).toHaveBeenCalledWith('/history');
});
