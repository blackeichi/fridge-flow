import { useRouter } from 'expo-router';
import { useBackupStatus } from '@/features/backup/services/use-backup-status';
import { useState } from 'react';
import { BackupFreshness } from '@/features/backup/components/backup-freshness';
import { useForegroundClock } from '@/shared/hooks/use-foreground-clock';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { InventoryBatch } from '@/db/user/schema';
import {
  InventoryForm,
  Choice,
} from '@/features/inventory/components/inventory-form';
import {
  expiryInfo,
  localToday,
  type InventoryInput,
} from '@/features/inventory/domain/inventory';
import { useInventory } from '@/features/inventory/hooks/use-inventory';
import { colors } from '@/shared/theme/colors';

export function HomeScreen() {
  const [attempt, setAttempt] = useState(0);
  return (
    <InventoryScreen
      key={attempt}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}

function InventoryScreen({ onRetry }: { onRetry: () => void }) {
  const inventory = useInventory();
  const router = useRouter();
  const lastBackup = useBackupStatus();
  const [editor, setEditor] = useState<{ batch: InventoryBatch | null } | null>(
    null,
  );
  const [search, setSearch] = useState('');
  const [space, setSpace] = useState('all');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [showExhausted, setShowExhausted] = useState(false);
  const [message, setMessage] = useState('');
  const clock = useForegroundClock();
  const today = localToday(new Date(clock));

  const spaces = Array.from(
    new Map(
      inventory.locations.map((location) => [
        location.spaceId,
        location.spaceName,
      ]),
    ).entries(),
  );
  const active = inventory.batches.filter(
    (batch) => batch.status === 'available',
  );
  const urgentCount = active.filter(
    (batch) => expiryInfo(batch.expiresOn, today).urgent,
  ).length;
  const rows = inventory.batches
    .filter((batch) => {
      const location = inventory.locations.find(
        (item) => item.id === batch.containerId,
      );
      return (
        (showExhausted || batch.status === 'available') &&
        (space === 'all' || location?.spaceId === space) &&
        batch.name
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase()) &&
        (!urgentOnly ||
          (batch.status === 'available' &&
            expiryInfo(batch.expiresOn, today).urgent))
      );
    })
    .sort(
      (a, b) =>
        (a.expiresOn ?? '9999').localeCompare(b.expiresOn ?? '9999') ||
        a.name.localeCompare(b.name),
    );
  const latest = inventory.latest;
  const canUndo =
    latest &&
    latest.type !== 'undo' &&
    clock - Date.parse(latest.createdAt) <= 7 * 86_400_000;

  function save(input: InventoryInput) {
    try {
      if (editor?.batch) inventory.repository.update(editor.batch.id, input);
      else inventory.repository.create(input);
    } catch {
      throw new Error(
        '기기에 저장하지 못했습니다. 입력은 유지됩니다. 다시 시도해 주세요.',
      );
    }
    setEditor(null);
    setMessage('저장했습니다.');
  }
  function remove(batch: InventoryBatch) {
    Alert.alert(
      '재료 삭제',
      `${batch.name}을(를) 목록에서 삭제할까요? 변경 기록은 보관되며 실행 취소할 수 있습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            try {
              inventory.repository.remove(batch.id);
              setMessage('삭제했습니다.');
            } catch {
              setMessage('삭제하지 못했습니다. 다시 시도해 주세요.');
            }
          },
        },
      ],
    );
  }
  function undo() {
    if (!latest) return;
    try {
      inventory.repository.undo(latest.operationId);
      setMessage('변경을 실행 취소했습니다.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '실행 취소하지 못했습니다.',
      );
    }
  }

  if (inventory.error)
    return (
      <SafeAreaView style={styles.center}>
        <Text accessibilityRole="alert">
          냉장고 데이터를 불러오지 못했습니다.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={styles.action}
        >
          <Text>다시 시도</Text>
        </Pressable>
      </SafeAreaView>
    );
  if (inventory.loading)
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.accent} />
        <Text>냉장고를 준비하고 있습니다.</Text>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={rows}
        keyExtractor={(batch) => batch.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>FRIDGE FLOW</Text>
            <View style={styles.titleRow}>
              <View style={styles.titleText}>
                <Text accessibilityRole="header" style={styles.title}>
                  나의 냉장고
                </Text>
                <Text style={styles.subtitle}>
                  어디에, 얼마나 남았는지 한눈에
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setEditor({ batch: null })}
                style={styles.add}
              >
                <Text style={styles.addText}>+ 재료</Text>
              </Pressable>
            </View>
            <View style={styles.summary}>
              <Text style={styles.summaryText}>보유 {active.length}묶음</Text>
              <Text style={styles.summaryText}>
                3일 이내·경과 {urgentCount}묶음
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/backup')}
              style={styles.undo}
            >
              <View style={styles.titleText}>
                <Text style={styles.link}>백업·복원</Text>
                <BackupFreshness status={lastBackup} now={clock} />
              </View>
            </Pressable>
            <TextInput
              accessibilityLabel="재료 검색"
              placeholder="재료 이름으로 검색"
              value={search}
              onChangeText={setSearch}
              style={styles.search}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
            >
              <Choice
                label="전체 공간"
                selected={space === 'all'}
                onPress={() => setSpace('all')}
              />
              {spaces.map(([id, name]) => (
                <Choice
                  key={id}
                  label={name}
                  selected={space === id}
                  onPress={() => setSpace(id)}
                />
              ))}
            </ScrollView>
            <View style={styles.filters}>
              <Choice
                label="임박·경과만"
                selected={urgentOnly}
                onPress={() => setUrgentOnly(!urgentOnly)}
              />
              <Choice
                label="소진 포함"
                selected={showExhausted}
                onPress={() => setShowExhausted(!showExhausted)}
              />
            </View>
            <Text style={styles.hint}>
              유통기한이 빠른 순서 · 날짜는 관리용이며 안전 판정이 아닙니다.
            </Text>
            {!!message && (
              <Text accessibilityLiveRegion="polite" style={styles.message}>
                {message}
              </Text>
            )}
            {canUndo && (
              <View style={styles.undo}>
                <Text style={styles.undoText}>
                  {latest.after.name} ·{' '}
                  {latest.type === 'create'
                    ? '추가'
                    : latest.type === 'delete'
                      ? '삭제'
                      : '수정'}{' '}
                  기록
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={undo}
                  style={styles.action}
                >
                  <Text style={styles.link}>실행 취소</Text>
                </Pressable>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {inventory.batches.length
                ? '조건에 맞는 재료가 없어요'
                : '첫 재료를 추가해 보세요'}
            </Text>
            <Text style={styles.subtitle}>
              이름, 수량, 위치만 입력하면 바로 보관됩니다.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const location = inventory.locations.find(
            (entry) => entry.id === item.containerId,
          );
          const expiry = expiryInfo(item.expiresOn, today);
          return (
            <View style={styles.card}>
              <View style={styles.titleRow}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.quantity}>
                  {item.quantityKnown
                    ? `${item.amount} ${item.unit}`
                    : '수량 모름'}
                </Text>
              </View>
              <Text style={styles.subtitle}>
                {location?.spaceName} · {location?.name}
              </Text>
              <Text style={[styles.expiry, expiry.urgent && styles.urgent]}>
                {item.status === 'exhausted' ? '소진 · ' : ''}
                {expiry.label}
              </Text>
              {!!item.notes && <Text style={styles.notes}>{item.notes}</Text>}
              <View style={styles.cardActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name} 수정`}
                  onPress={() => setEditor({ batch: item })}
                  style={styles.action}
                >
                  <Text style={styles.link}>수정 · 위치 변경</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name} 삭제`}
                  onPress={() => remove(item)}
                  style={styles.action}
                >
                  <Text style={styles.danger}>삭제</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
      {editor && (
        <InventoryForm
          batch={editor.batch}
          locations={inventory.locations}
          onSave={save}
          onClose={() => setEditor(null)}
        />
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: colors.background,
  },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  header: { gap: 16, marginBottom: 8 },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleText: { flex: 1 },
  title: { fontSize: 30, fontWeight: '700', color: colors.text },
  subtitle: { color: colors.textMuted, lineHeight: 22, marginTop: 4 },
  add: {
    backgroundColor: colors.accent,
    padding: 14,
    borderRadius: 14,
    minHeight: 48,
  },
  addText: { color: '#FFFFFF', fontWeight: '700' },
  summary: {
    backgroundColor: '#E5EDDF',
    borderRadius: 16,
    padding: 18,
    gap: 8,
  },
  summaryText: { color: colors.accent, fontWeight: '600', fontSize: 16 },
  search: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: colors.text,
  },
  filters: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 19 },
  message: { color: colors.accent, lineHeight: 22 },
  undo: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  undoText: { flex: 1, color: colors.text, paddingLeft: 8 },
  action: { padding: 12, minHeight: 44, justifyContent: 'center' },
  link: { color: colors.accent, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    gap: 4,
  },
  name: { flex: 1, fontWeight: '700', fontSize: 19, color: colors.text },
  quantity: { fontWeight: '600', fontSize: 16, color: colors.accent },
  expiry: { color: colors.textMuted, marginTop: 8, lineHeight: 22 },
  urgent: { color: '#9A4B17', fontWeight: '600' },
  notes: { color: colors.text, lineHeight: 22, marginTop: 6 },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  danger: { color: '#9D2828' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 19, fontWeight: '600', color: colors.text },
});
