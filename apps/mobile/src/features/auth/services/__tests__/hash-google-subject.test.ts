import { hashGoogleSubject } from '../hash-google-subject';

describe('hashGoogleSubject', () => {
  it('creates a lowercase SHA-256 hash after trimming the subject', async () => {
    const digestSubject = jest.fn(async () => 'a'.repeat(64));

    await expect(
      hashGoogleSubject(' google-subject-123 ', digestSubject),
    ).resolves.toBe(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    expect(digestSubject).toHaveBeenCalledWith('google-subject-123');
  });

  it('rejects an empty subject', () => {
    expect(() => hashGoogleSubject('   ')).toThrow(
      'Google account subject must not be empty',
    );
  });
});
