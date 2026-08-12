import type {
  GoogleAccountCredential,
  GoogleAuthenticationClient,
} from '../services/authentication-service';
import type { OneTapSuccessData } from 'react-native-nitro-google-signin';

export class GoogleAuthenticationConfigurationError extends Error {
  constructor() {
    super('Google server client ID is not configured.');
    this.name = 'GoogleAuthenticationConfigurationError';
  }
}

type GoogleSignInModule = typeof import('react-native-nitro-google-signin');

export function createNativeGoogleAuthenticationClient(
  webClientId = process.env.EXPO_PUBLIC_GOOGLE_SERVER_CLIENT_ID?.trim(),
): GoogleAuthenticationClient {
  let googleModule: GoogleSignInModule | undefined;

  async function loadConfiguredModule() {
    if (!webClientId) {
      throw new GoogleAuthenticationConfigurationError();
    }

    if (!googleModule) {
      googleModule = await import('react-native-nitro-google-signin');
      googleModule.GoogleOneTapSignIn.configure({
        autoSelectOnSignIn: false,
        webClientId,
      });
    }

    return googleModule;
  }

  function toCredential(data: OneTapSuccessData): GoogleAccountCredential {
    if (!data.idToken.trim() || !data.user.id.trim()) {
      throw new Error('Google sign-in returned an incomplete identity.');
    }

    return {
      idToken: data.idToken,
      subject: data.user.id,
    };
  }

  return {
    async restore() {
      const module = await loadConfiguredModule();
      const currentUser = module.GoogleOneTapSignIn.getCurrentUser();

      return currentUser ? toCredential(currentUser) : null;
    },

    async signIn() {
      const module = await loadConfiguredModule();
      await module.GoogleOneTapSignIn.checkPlayServices(true);

      let response = await module.GoogleOneTapSignIn.signIn();

      if (module.isNoSavedCredentialFoundResponse(response)) {
        response = await module.GoogleOneTapSignIn.createAccount();
      }

      if (module.isNoSavedCredentialFoundResponse(response)) {
        response = await module.GoogleOneTapSignIn.presentExplicitSignIn();
      }

      if (module.isCancelledResponse(response)) {
        return null;
      }

      if (!module.isSuccessResponse(response)) {
        throw new Error('Google sign-in did not return an account.');
      }

      return toCredential(response.data);
    },

    async signOut() {
      const module = await loadConfiguredModule();
      await module.GoogleOneTapSignIn.signOut();
    },
  };
}
