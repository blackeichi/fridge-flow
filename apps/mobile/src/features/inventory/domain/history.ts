import type { InventoryBatch, InventoryTransaction } from '@/db/user/schema';

export const operationLabels = {
  create: '추가',
  update: '수정',
  delete: '삭제',
  undo: '실행 취소',
} as const;

export function undoUnavailableReason(
  operation: Pick<InventoryTransaction, 'type' | 'operationId' | 'createdAt'>,
  currentOperationId: string | null,
  now: number,
  reversed = false,
): string | null {
  if (operation.type === 'undo')
    return '실행 취소 기록은 다시 취소할 수 없습니다.';
  if (reversed) return '이미 실행 취소한 변경입니다.';
  if (currentOperationId !== operation.operationId)
    return '이후 변경이 있어 실행 취소할 수 없습니다.';
  const elapsed = now - Date.parse(operation.createdAt);
  if (!Number.isFinite(elapsed) || elapsed < 0)
    return '기기 날짜와 변경 시각을 확인해 주세요.';
  if (elapsed > 7 * 86_400_000) return '실행 취소 기간(7일)이 지났습니다.';
  return null;
}

const statusLabels = {
  available: '보유',
  exhausted: '소진',
  discarded: '폐기',
  deleted: '삭제',
};
export function quantityLabel(batch: InventoryBatch) {
  return batch.quantityKnown ? `${batch.amount} ${batch.unit}` : '수량 모름';
}

export function inventoryChanges(
  operation: Pick<InventoryTransaction, 'before' | 'after'>,
  locationName: (id: string) => string,
) {
  const fields: {
    label: string;
    value: (batch: InventoryBatch) => string;
    key: (batch: InventoryBatch) => string | null;
  }[] = [
    { label: '재료명', value: (b) => b.name, key: (b) => b.name },
    { label: '수량', value: quantityLabel, key: quantityLabel },
    {
      label: '보관 위치',
      value: (b) => locationName(b.containerId),
      key: (b) => b.containerId,
    },
    {
      label: '구매일',
      value: (b) => b.purchasedOn ?? '없음/모름',
      key: (b) => b.purchasedOn,
    },
    {
      label: '유통기한',
      value: (b) => b.expiresOn ?? '없음/모름',
      key: (b) => b.expiresOn,
    },
    { label: '메모', value: (b) => b.notes || '없음', key: (b) => b.notes },
    {
      label: '상태',
      value: (b) => statusLabels[b.status],
      key: (b) => b.status,
    },
  ];
  return fields
    .filter(
      (field) =>
        !operation.before ||
        field.key(operation.before) !== field.key(operation.after),
    )
    .map((field) => ({
      label: field.label,
      before: operation.before ? field.value(operation.before) : '없음',
      after: field.value(operation.after),
    }));
}
