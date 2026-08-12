import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/shared/theme/colors';

import { userDatabase } from './client';
import migrations from './migrations/migrations';

export function UserDatabaseGate({ children }: PropsWithChildren) {
  const { success, error } = useMigrations(userDatabase, migrations);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text accessibilityRole="alert" style={styles.errorTitle}>
          로컬 데이터베이스를 열 수 없습니다
        </Text>
        <Text style={styles.description}>앱을 다시 시작해 주세요.</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View
        accessibilityLabel="로컬 데이터베이스 준비 중"
        style={styles.centered}
      >
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.description}>로컬 데이터를 준비하고 있습니다.</Text>
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    color: colors.textMuted,
    fontSize: 15,
    marginTop: 12,
    textAlign: 'center',
  },
});
