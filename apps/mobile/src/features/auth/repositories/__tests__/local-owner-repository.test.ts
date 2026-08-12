import { resolveLocalOwnerBinding } from '../local-owner-repository';

describe('resolveLocalOwnerBinding', () => {
  it('binds the first account', () => {
    expect(resolveLocalOwnerBinding([], 'a'.repeat(64))).toBe('created');
  });

  it('accepts the existing owner', () => {
    const ownerHash = 'a'.repeat(64);

    expect(resolveLocalOwnerBinding([ownerHash], ownerHash)).toBe('matched');
  });

  it('rejects a different owner', () => {
    expect(resolveLocalOwnerBinding(['a'.repeat(64)], 'b'.repeat(64))).toBe(
      'mismatch',
    );
  });

  it('rejects a database with multiple owner rows', () => {
    expect(() =>
      resolveLocalOwnerBinding(
        ['a'.repeat(64), 'b'.repeat(64)],
        'a'.repeat(64),
      ),
    ).toThrow('multiple owners');
  });
});
