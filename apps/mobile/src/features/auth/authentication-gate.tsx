import { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { drizzleLocalOwnerRepository } from '@/db/user/repositories/drizzle-local-owner-repository';
import { colors } from '@/shared/theme/colors';

import {
  createNativeGoogleAuthenticationClient,
  GoogleAuthenticationConfigurationError,
} from './clients/native-google-authentication-client';
import { AuthenticationScreen } from './screens/authentication-screen';
import { createAuthenticationService } from './services/authentication-service';
import { hashGoogleSubject } from './services/hash-google-subject';

type GateState =
  | { status: 'loading' }
  | { status: 'authenticated' }
  | { status: 'signed-out'; message?: string; ownerMismatch?: boolean };

export function AuthenticationGate({ children }: PropsWithChildren) {
  const service = useMemo(
    () =>
      createAuthenticationService({
        googleClient: createNativeGoogleAuthenticationClient(),
        hashSubject: hashGoogleSubject,
        ownerRepository: drizzleLocalOwnerRepository,
      }),
    [],
  );
  const [state, setState] = useState<GateState>({ status: 'loading' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    service
      .restore()
      .then((result) => {
        if (active) {
          setState(toGateState(result.status));
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({ status: 'signed-out', message: errorMessage(error) });
        }
      });

    return () => {
      active = false;
    };
  }, [service]);

  async function signIn() {
    setBusy(true);
    setState({ status: 'signed-out' });

    try {
      const result = await service.signIn();
      setState(toGateState(result.status));
    } catch (error) {
      setState({ status: 'signed-out', message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  if (state.status === 'loading') {
    return (
      <View accessibilityLabel="Google 로그인 확인 중" style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.description}>계정 연결을 확인하고 있습니다.</Text>
      </View>
    );
  }

  if (state.status === 'signed-out') {
    return (
      <AuthenticationScreen
        busy={busy}
        message={state.message}
        onSignIn={signIn}
        ownerMismatch={state.ownerMismatch}
      />
    );
  }

  return children;
}

function toGateState(
  status: 'authenticated' | 'owner-mismatch' | 'signed-out',
): GateState {
  if (status === 'authenticated') {
    return { status };
  }

  if (status === 'owner-mismatch') {
    return { status: 'signed-out', ownerMismatch: true };
  }

  return { status: 'signed-out' };
}

function errorMessage(error: unknown) {
  if (error instanceof GoogleAuthenticationConfigurationError) {
    return 'Google 로그인을 사용하려면 앱의 server client ID 설정이 필요합니다.';
  }

  return 'Google 로그인 상태를 확인할 수 없습니다. 네트워크 연결과 앱 빌드를 확인해 주세요.';
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  description: {
    color: colors.textMuted,
    fontSize: 15,
    marginTop: 12,
    textAlign: 'center',
  },
});
