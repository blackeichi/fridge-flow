import type { InventoryBatch, InventoryTransaction } from '@/db/user/schema';
import { inventoryChanges, undoUnavailableReason } from '../domain/history';

const batch: InventoryBatch = {
  id: 'batch',
  name: '우유',
  containerId: 'fridge',
  amount: '1.2',
  unit: 'L',
  quantityKnown: true,
  purchasedOn: null,
  expiresOn: '2026-10-30',
  notes: '',
  status: 'available',
  lastOperationId: 'operation',
  createdAt: '2026-10-26T00:00:00.000Z',
  updatedAt: '2026-10-26T00:00:00.000Z',
};
const operation: InventoryTransaction = {
  sequence: 1,
  id: 'record',
  operationId: 'operation',
  batchId: batch.id,
  type: 'update',
  amountDelta: null,
  before: batch,
  after: {
    ...batch,
    amount: null,
    quantityKnown: false,
    containerId: 'freezer',
    notes: '개봉',
    expiresOn: null,
  },
  reversesOperationId: null,
  createdAt: batch.createdAt,
};
it('shows precise before/after values for unknown quantities, changed locations, dates and notes', () => {
  expect(
    inventoryChanges(operation, (id) =>
      id === 'fridge' ? '냉장실' : '냉동실',
    ),
  ).toEqual([
    { label: '수량', before: '1.2 L', after: '수량 모름' },
    { label: '보관 위치', before: '냉장실', after: '냉동실' },
    { label: '유통기한', before: '2026-10-30', after: '없음/모름' },
    { label: '메모', before: '없음', after: '개봉' },
  ]);
});
it('preserves units and compares location IDs even when their current names match', () => {
  const changes = inventoryChanges(
    { before: batch, after: { ...batch, unit: 'ml', containerId: 'other' } },
    () => '같은 이름',
  );
  expect(changes).toEqual([
    { label: '수량', before: '1.2 L', after: '1.2 ml' },
    { label: '보관 위치', before: '같은 이름', after: '같은 이름' },
  ]);
});
it('explains additions and deletion without treating them as consumption', () => {
  expect(
    inventoryChanges({ before: null, after: batch }, () => '냉장실')[0],
  ).toEqual({ label: '재료명', before: '없음', after: '우유' });
  expect(
    inventoryChanges(
      { before: batch, after: { ...batch, status: 'deleted' } },
      () => '냉장실',
    ),
  ).toEqual([{ label: '상태', before: '보유', after: '삭제' }]);
});
it('rejects reversing undo events and invalid clocks and prioritizes existing reversal status', () => {
  const now = Date.parse(batch.createdAt);
  expect(
    undoUnavailableReason({ ...operation, type: 'undo' }, 'operation', now),
  ).toContain('다시 취소');
  expect(undoUnavailableReason(operation, 'newer', now, true)).toContain(
    '이미 실행 취소',
  );
  expect(undoUnavailableReason(operation, 'operation', Number.NaN)).toContain(
    '변경 시각',
  );
});
