import type { InventoryBatch } from '@/db/user/schema';

export const UNITS = [
  'g',
  'kg',
  'ml',
  'L',
  '개',
  '팩',
  '봉',
  '병',
  '캔',
] as const;
export interface InventoryInput {
  name: string;
  containerId: string;
  amount: string;
  unit: InventoryBatch['unit'];
  quantityKnown: boolean;
  purchasedOn: string;
  expiresOn: string;
  notes: string;
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function normalizeInventory(input: InventoryInput) {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 100)
    throw new Error('재료명은 1~100자로 입력해 주세요.');
  if (!input.containerId) throw new Error('보관 위치를 선택해 주세요.');
  if (!UNITS.includes(input.unit))
    throw new Error('지원하는 단위를 선택해 주세요.');
  const raw = input.amount.trim();
  if (input.quantityKnown && !/^\d{1,9}(\.\d{1,6})?$/.test(raw)) {
    throw new Error(
      '수량은 0 이상의 숫자로, 정수 9자리·소수 6자리까지 입력해 주세요.',
    );
  }
  const amount = input.quantityKnown ? normalizeDecimal(raw) : null;
  const purchasedOn = input.purchasedOn.trim() || null;
  const expiresOn = input.expiresOn.trim() || null;
  for (const date of [purchasedOn, expiresOn]) {
    if (date && !isCalendarDate(date))
      throw new Error('날짜는 YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요.');
  }
  if (input.notes.length > 1000)
    throw new Error('메모는 1,000자 이내로 입력해 주세요.');
  return {
    name,
    containerId: input.containerId,
    amount,
    unit: input.unit,
    quantityKnown: input.quantityKnown,
    purchasedOn,
    expiresOn,
    notes: input.notes.trim(),
    status: amount === '0' ? ('exhausted' as const) : ('available' as const),
  };
}

function normalizeDecimal(value: string) {
  const [integer, fraction = ''] = value.split('.');
  const whole = integer.replace(/^0+(?=\d)/, '');
  const decimal = fraction.replace(/0+$/, '');
  return decimal ? `${whole}.${decimal}` : whole;
}

// All supported amounts fit safely in scaled integer arithmetic (9+6 digits).
export function amountDelta(
  before: InventoryBatch | null,
  after: InventoryBatch,
): string | null {
  if (
    !after.quantityKnown ||
    (before && (!before.quantityKnown || before.unit !== after.unit))
  )
    return null;
  const scaled = (value: string) => {
    const [whole, decimal = ''] = value.split('.');
    return Number(whole) * 1_000_000 + Number(decimal.padEnd(6, '0'));
  };
  const delta = scaled(after.amount!) - (before ? scaled(before.amount!) : 0);
  return `${delta < 0 ? '-' : ''}${normalizeDecimal(`${Math.floor(Math.abs(delta) / 1_000_000)}.${String(Math.abs(delta) % 1_000_000).padStart(6, '0')}`)}`;
}

export function localToday(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function expiryInfo(expiresOn: string | null, today: string) {
  if (!expiresOn)
    return { label: '유통기한 없음/모름', urgent: false, days: null };
  const days = Math.round(
    (Date.parse(`${expiresOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86_400_000,
  );
  return {
    label:
      days < 0
        ? `${-days}일 경과`
        : days === 0
          ? '오늘까지'
          : days <= 7
            ? `${days}일 남음`
            : expiresOn,
    urgent: days <= 3,
    days,
  };
}
