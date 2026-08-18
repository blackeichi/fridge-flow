import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/shared/theme/colors';

interface AuthenticationScreenProps {
  busy?: boolean;
  message?: string;
  ownerMismatch?: boolean;
  onSignIn: () => void;
}

export function AuthenticationScreen({
  busy = false,
  message,
  ownerMismatch = false,
  onSignIn,
}: AuthenticationScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text accessibilityRole="header" style={styles.title}>
          Fridge Flow 시작하기
        </Text>
        <Text style={styles.description}>
          Google 계정은 이 기기의 로컬 데이터를 보호하고 AI 기능의 접근 권한을
          확인할 때만 사용합니다.
        </Text>

        {ownerMismatch ? (
          <View accessibilityRole="alert" style={styles.notice}>
            <Text style={styles.noticeTitle}>
              다른 계정의 로컬 데이터입니다
            </Text>
            <Text style={styles.noticeBody}>
              이 데이터와 처음 연결한 Google 계정으로 다시 로그인해 주세요.
              데이터 초기화는 백업 기능이 준비된 뒤 별도 확인 절차로 제공됩니다.
            </Text>
          </View>
        ) : null}

        {message ? (
          <Text accessibilityRole="alert" style={styles.errorMessage}>
            {message}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onSignIn}
          style={({ pressed }) => [
            styles.button,
            (pressed || busy) && styles.buttonDisabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.buttonLabel}>Google로 계속하기</Text>
          )}
        </Pressable>

        <Text style={styles.privacyNote}>
          Google ID token과 계정 원문은 일반 SQLite, 로그 또는 백업에 저장하지
          않습니다.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '700',
  },
  description: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 25,
    marginTop: 16,
  },
  notice: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 24,
    padding: 16,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  noticeBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  errorMessage: {
    color: '#A33A2B',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 20,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 28,
    minHeight: 52,
    paddingHorizontal: 20,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonLabel: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  privacyNote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 16,
    textAlign: 'center',
  },
});
