import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';

type DigestSubject = (subject: string) => Promise<string>;

export function hashGoogleSubject(
  subject: string,
  digestSubject: DigestSubject = (value) =>
    digestStringAsync(CryptoDigestAlgorithm.SHA256, value),
) {
  const normalizedSubject = subject.trim();

  if (!normalizedSubject) {
    throw new Error('Google account subject must not be empty.');
  }

  return digestSubject(normalizedSubject);
}
