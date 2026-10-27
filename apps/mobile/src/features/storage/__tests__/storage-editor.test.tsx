import { fireEvent, render } from '@testing-library/react-native';
import type { Container } from '@/db/user/schema';
import { StorageEditorForm } from '../components/storage-editor';
import { StorageError } from '../domain/layout';

const first: Container = {
  id: 'shelf',
  name: '선반',
  spaceId: 'fridge',
  parentId: null,
  gridRow: 0,
  gridColumn: 0,
  gridWidth: 1,
  gridHeight: 1,
  sortOrder: 0,
  createdAt: '2026-10-26T00:00:00Z',
  updatedAt: '2026-10-26T00:00:00Z',
};
it('edits a container using a grid cell and preserves input after failed validation', async () => {
  const save = jest.fn().mockImplementationOnce(() => {
    throw new StorageError('다른 보관함과 겹칩니다.');
  });
  const screen = await render(
    <StorageEditorForm
      editor={{ kind: 'container', current: first, initial: first }}
      containers={[first]}
      onSaveSpace={jest.fn()}
      onSaveContainer={save}
      onClose={jest.fn()}
    />,
  );
  await fireEvent.changeText(screen.getByLabelText('이름'), '우유 선반');
  await fireEvent.press(screen.getByLabelText('4행 3열'));
  await fireEvent.changeText(screen.getByLabelText('가로 칸 수'), '2');
  await fireEvent.press(screen.getByText('저장'));
  expect(screen.getByText('다른 보관함과 겹칩니다.')).toBeOnTheScreen();
  expect(screen.getByLabelText('이름')).toHaveDisplayValue('우유 선반');
  await fireEvent.press(screen.getByText('저장'));
  expect(save).toHaveBeenLastCalledWith(
    expect.objectContaining({
      name: '우유 선반',
      gridRow: 3,
      gridColumn: 2,
      gridWidth: 2,
    }),
    'shelf',
  );
});
it('creates a custom space and exposes its storage type', async () => {
  const save = jest.fn();
  const screen = await render(
    <StorageEditorForm
      editor={{ kind: 'space', current: null }}
      containers={[]}
      onSaveSpace={save}
      onSaveContainer={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  await fireEvent.changeText(screen.getByLabelText('이름'), '작은 냉동고');
  await fireEvent.press(screen.getByText('냉동'));
  await fireEvent.press(screen.getByText('저장'));
  expect(save).toHaveBeenCalledWith(
    { name: '작은 냉동고', type: 'freezer' },
    undefined,
  );
});
