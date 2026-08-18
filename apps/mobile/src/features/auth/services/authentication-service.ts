export interface GoogleAccountCredential {
  idToken: string;
  subject: string;
}

export interface GoogleAuthenticationClient {
  restore(): Promise<GoogleAccountCredential | null>;
  signIn(): Promise<GoogleAccountCredential | null>;
  signOut(): Promise<void>;
}

export type LocalOwnerBinding = 'created' | 'matched' | 'mismatch';

export interface LocalOwnerRepository {
  bindOrVerify(ownerSubSha256: string): Promise<LocalOwnerBinding>;
}

export type AuthenticationState =
  | { status: 'authenticated'; idToken: string }
  | { status: 'signed-out' }
  | { status: 'owner-mismatch' };

interface AuthenticationServiceDependencies {
  googleClient: GoogleAuthenticationClient;
  hashSubject: (subject: string) => Promise<string>;
  ownerRepository: LocalOwnerRepository;
}

export function createAuthenticationService({
  googleClient,
  hashSubject,
  ownerRepository,
}: AuthenticationServiceDependencies) {
  async function openLocalDatabase(
    credential: GoogleAccountCredential,
  ): Promise<AuthenticationState> {
    const ownerSubSha256 = await hashSubject(credential.subject);
    const binding = await ownerRepository.bindOrVerify(ownerSubSha256);

    if (binding === 'mismatch') {
      await googleClient.signOut();
      return { status: 'owner-mismatch' };
    }

    return { status: 'authenticated', idToken: credential.idToken };
  }

  return {
    async restore(): Promise<AuthenticationState> {
      const credential = await googleClient.restore();

      if (!credential) {
        return { status: 'signed-out' };
      }

      return openLocalDatabase(credential);
    },

    async signIn(): Promise<AuthenticationState> {
      const credential = await googleClient.signIn();

      if (!credential) {
        return { status: 'signed-out' };
      }

      return openLocalDatabase(credential);
    },

    async signOut(): Promise<AuthenticationState> {
      await googleClient.signOut();
      return { status: 'signed-out' };
    },
  };
}

export type AuthenticationService = ReturnType<
  typeof createAuthenticationService
>;
