import {
  createAuthenticationService,
  type GoogleAuthenticationClient,
  type LocalOwnerRepository,
} from '../authentication-service';

const credential = {
  idToken: 'signed-google-id-token',
  subject: 'google-subject-123',
};

function createDependencies(
  binding: Awaited<
    ReturnType<LocalOwnerRepository['bindOrVerify']>
  > = 'matched',
) {
  const googleClient: GoogleAuthenticationClient = {
    restore: jest.fn(async () => credential),
    signIn: jest.fn(async () => credential),
    signOut: jest.fn(async () => undefined),
  };
  const ownerRepository: LocalOwnerRepository = {
    bindOrVerify: jest.fn(async () => binding),
  };
  const hashSubject = jest.fn(async () => 'a'.repeat(64));

  return { googleClient, hashSubject, ownerRepository };
}

describe('authenticationService', () => {
  it('restores a matching Google account without persisting raw identity', async () => {
    const dependencies = createDependencies();
    const service = createAuthenticationService(dependencies);

    await expect(service.restore()).resolves.toEqual({
      status: 'authenticated',
      idToken: credential.idToken,
    });
    expect(dependencies.hashSubject).toHaveBeenCalledWith(credential.subject);
    expect(dependencies.ownerRepository.bindOrVerify).toHaveBeenCalledWith(
      'a'.repeat(64),
    );
  });

  it('opens the database after binding the first account', async () => {
    const service = createAuthenticationService(createDependencies('created'));

    await expect(service.signIn()).resolves.toEqual({
      status: 'authenticated',
      idToken: credential.idToken,
    });
  });

  it('signs out a Google account that does not own the local database', async () => {
    const dependencies = createDependencies('mismatch');
    const service = createAuthenticationService(dependencies);

    await expect(service.signIn()).resolves.toEqual({
      status: 'owner-mismatch',
    });
    expect(dependencies.googleClient.signOut).toHaveBeenCalledTimes(1);
  });

  it('keeps the app signed out when no saved credential exists', async () => {
    const dependencies = createDependencies();
    jest.mocked(dependencies.googleClient.restore).mockResolvedValue(null);
    const service = createAuthenticationService(dependencies);

    await expect(service.restore()).resolves.toEqual({
      status: 'signed-out',
    });
    expect(dependencies.ownerRepository.bindOrVerify).not.toHaveBeenCalled();
  });

  it('treats a cancelled interactive login as signed out', async () => {
    const dependencies = createDependencies();
    jest.mocked(dependencies.googleClient.signIn).mockResolvedValue(null);
    const service = createAuthenticationService(dependencies);

    await expect(service.signIn()).resolves.toEqual({
      status: 'signed-out',
    });
  });
});
