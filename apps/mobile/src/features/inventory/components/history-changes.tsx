import { StyleSheet, Text, View } from 'react-native';
import type { InventoryTransaction } from '@/db/user/schema';
import { colors } from '@/shared/theme/colors';
import { inventoryChanges } from '../domain/history';

export function HistoryChanges({
  operation,
  locationName,
}: {
  operation: InventoryTransaction;
  locationName: (id: string) => string;
}) {
  const changes = inventoryChanges(operation, locationName);
  return (
    <View style={styles.list}>
      {changes.length ? (
        changes.map((change) => (
          <View key={change.label} style={styles.field}>
            <Text style={styles.label}>{change.label}</Text>
            <Text selectable style={styles.value}>
              이전: {change.before}
            </Text>
            <Text selectable style={styles.value}>
              변경 후: {change.after}
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.value}>입력값의 변경 없이 저장한 기록입니다.</Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  list: { gap: 12 },
  field: { gap: 3 },
  label: { color: colors.text, fontWeight: '600' },
  value: { color: colors.textMuted, lineHeight: 22 },
});
