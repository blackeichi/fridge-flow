import {
  expiryInfo,
  isCalendarDate,
  normalizeInventory,
  type InventoryInput,
} from '../inventory';

export const input: InventoryInput = {
  name: ' 우유 ',
  containerId: 'shelf',
  amount: '01.250000',
  unit: 'L',
  quantityKnown: true,
  purchasedOn: '',
  expiresOn: '2026-10-29',
  notes: '',
};

describe('inventory rules', () => {
  it('preserves decimals, distinguishes unknown from zero, and validates real dates', () => {
    expect(normalizeInventory(input)).toMatchObject({
      name: '우유',
      amount: '1.25',
      status: 'available',
    });
    expect(
      normalizeInventory({ ...input, quantityKnown: false, amount: '' }),
    ).toMatchObject({ amount: null, status: 'available' });
    expect(normalizeInventory({ ...input, amount: '0.000' })).toMatchObject({
      amount: '0',
      status: 'exhausted',
    });
    for (const amount of [
      '-1',
      'NaN',
      '1e3',
      '1,2',
      '.5',
      '1.1234567',
      '1000000000',
    ]) {
      expect(() => normalizeInventory({ ...input, amount })).toThrow();
    }
    expect(isCalendarDate('2024-02-29')).toBe(true);
    for (const date of ['2026-02-29', '2026-04-31', '2026-2-01', 'abc']) {
      expect(() => normalizeInventory({ ...input, expiresOn: date })).toThrow();
    }
  });
  it('uses calendar dates across leap days and daylight saving boundaries', () => {
    expect(expiryInfo('2024-03-01', '2024-02-28')).toMatchObject({
      days: 2,
      urgent: true,
    });
    expect(expiryInfo('2026-03-09', '2026-03-08').days).toBe(1);
    expect(expiryInfo('2026-10-25', '2026-10-26').label).toBe('1일 경과');
    expect(expiryInfo('2026-10-26', '2026-10-26').label).toBe('오늘까지');
    expect(expiryInfo(null, '2026-10-26')).toMatchObject({
      days: null,
      urgent: false,
    });
  });
});
