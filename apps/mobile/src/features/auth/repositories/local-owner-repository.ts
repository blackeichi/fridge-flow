import type { LocalOwnerBinding } from '../services/authentication-service';

export function resolveLocalOwnerBinding(
  existingOwnerHashes: string[],
  candidateOwnerHash: string,
): LocalOwnerBinding {
  if (existingOwnerHashes.length === 0) {
    return 'created';
  }

  if (existingOwnerHashes.length > 1) {
    throw new Error('The local database contains multiple owners.');
  }

  return existingOwnerHashes[0] === candidateOwnerHash ? 'matched' : 'mismatch';
}
