import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/shared/theme/colors';

export function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text accessibilityRole="header" style={styles.eyebrow}>
          FRIDGE FLOW
        </Text>
        <Text style={styles.title}>
          냉장고에서 식탁까지,{`\n`}하나의 흐름으로
        </Text>
        <Text style={styles.description}>
          로컬 재고를 기준으로 보관 위치, 유통기한, 식단과 장보기를 연결합니다.
        </Text>
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>개발 준비 상태</Text>
          <Text style={styles.statusValue}>하네스 구성 완료</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 16,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 42,
  },
  description: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 25,
    marginTop: 18,
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 40,
    padding: 20,
  },
  statusLabel: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 8,
  },
  statusValue: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
  },
});
