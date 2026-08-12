import { eq } from 'drizzle-orm';

import { resolveLocalOwnerBinding } from '@/features/auth/repositories/local-owner-repository';
import type { LocalOwnerRepository } from '@/features/auth/services/authentication-service';

import { userDatabase } from '../client';
import { localOwners } from '../schema';

export const drizzleLocalOwnerRepository: LocalOwnerRepository = {
  async bindOrVerify(ownerSubSha256) {
    return userDatabase.transaction(async (transaction) => {
      const existingOwners = await transaction
        .select({ ownerSubSha256: localOwners.ownerSubSha256 })
        .from(localOwners);
      const binding = resolveLocalOwnerBinding(
        existingOwners.map((owner) => owner.ownerSubSha256),
        ownerSubSha256,
      );
      const timestamp = new Date().toISOString();

      if (binding === 'created') {
        await transaction.insert(localOwners).values({
          ownerSubSha256,
          createdAt: timestamp,
          lastLoginAt: timestamp,
        });
      } else if (binding === 'matched') {
        await transaction
          .update(localOwners)
          .set({ lastLoginAt: timestamp })
          .where(eq(localOwners.ownerSubSha256, ownerSubSha256));
      }

      return binding;
    });
  },
};
