import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/shared/theme/colors';
import { useForegroundClock } from '@/shared/hooks/use-foreground-clock';
import { HistoryChanges } from '../components/history-changes';
import {
  operationLabels,
  quantityLabel,
  undoUnavailableReason,
} from '../domain/history';
import { useInventoryHistory } from '../hooks/use-inventory-history';
import {
  HISTORY_PAGE_SIZE,
  type InventoryHistoryRow,
} from '../repositories/inventory-history-repository';

export function InventoryHistoryScreen() {
  const [attempt, setAttempt] = useState(0);
  return (
    <HistoryList
      key={attempt}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}
function HistoryList({ onRetry }: { onRetry: () => void }) {
  const router = useRouter();
  const [limit, setLimit] = useState(HISTORY_PAGE_SIZE);
  const history = useInventoryHistory(limit);
  const now = useForegroundClock();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const locationNames = new Map(
    history.locations.map((location) => [
      location.id,
      `${location.spaceName} · ${location.name}`,
    ]),
  );
  const locationName = (id: string) =>
    locationNames.get(id) ?? '현재 없는 보관 위치';
  const reason = (row: InventoryHistoryRow) =>
    undoUnavailableReason(
      row.operation,
      row.currentOperationId,
      now,
      !!row.reversedBy,
    );
  const selected = history.rows.find(
    (row) => row.operation.operationId === selectedId,
  );
  const selectedReason =
    history.error || history.loading
      ? '이력을 다시 불러온 뒤 실행 취소해 주세요.'
      : selected
        ? reason(selected)
        : '기록이 변경되었습니다. 다시 선택해 주세요.';

  function undo() {
    if (!selectedId || selectedReason || lock.current) return;
    lock.current = true;
    try {
      history.repository.undo(selectedId);
      setSelectedId(null);
      setMessage('변경을 실행 취소했습니다. 취소 기록도 보관됩니다.');
    } catch (error) {
      setSelectedId(null);
      setMessage(
        error instanceof Error
          ? error.message
          : '실행 취소하지 못했습니다. 다시 시도해 주세요.',
      );
    } finally {
      lock.current = false;
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={history.error || history.loading ? [] : history.rows}
        keyExtractor={(row) => row.operation.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={styles.button}
            >
              <Text style={styles.link}>← 냉장고로</Text>
            </Pressable>
            <Text accessibilityRole="header" style={styles.title}>
              재고 변경 이력
            </Text>
            <Text style={styles.description}>
              추가·수정·삭제와 실행 취소 기록을 최근 순으로 확인하세요. 이후
              변경이 없는 재료의 기록은 7일 이내에 되돌릴 수 있어요.
            </Text>
            <Text style={styles.description}>
              보관 위치 이름은 현재 이름으로 표시합니다.
            </Text>
            {!!message && (
              <Text accessibilityRole="alert" style={styles.message}>
                {message}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          history.error ? (
            <View style={styles.card}>
              <Text accessibilityRole="alert" style={styles.description}>
                변경 이력을 불러오지 못했습니다.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={onRetry}
                style={styles.button}
              >
                <Text style={styles.link}>다시 시도</Text>
              </Pressable>
            </View>
          ) : history.loading ? (
            <View style={styles.card}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.description}>
                변경 이력을 불러오고 있어요.
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.description}>
                아직 재고 변경 기록이 없어요.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          !history.loading && !history.error && history.hasMore ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setLimit((value) => value + HISTORY_PAGE_SIZE)}
              style={styles.button}
            >
              <Text style={styles.link}>이전 기록 더 보기</Text>
            </Pressable>
          ) : null
        }
        renderItem={({ item }) => (
          <HistoryCard
            row={item}
            reason={reason(item)}
            locationName={locationName}
            onUndo={() => {
              setMessage('');
              setSelectedId(item.operation.operationId);
            }}
          />
        )}
      />
      <Modal
        transparent
        visible={selectedId !== null}
        onRequestClose={() => setSelectedId(null)}
        animationType="fade"
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <ScrollView contentContainerStyle={styles.header}>
              <Text accessibilityRole="header" style={styles.heading}>
                변경 실행 취소 확인
              </Text>
              {selected && (
                <>
                  <Text style={styles.description}>
                    {selected.operation.after.name} ·{' '}
                    {operationLabels[selected.operation.type]}
                  </Text>
                  <Text style={styles.description}>
                    아래 변경의 이전 상태로 되돌립니다. 재료 추가를 취소하면
                    해당 묶음은 목록에서 삭제됩니다. 변경 기록은 보관됩니다.
                  </Text>
                  <HistoryChanges
                    operation={selected.operation}
                    locationName={locationName}
                  />
                </>
              )}
              {selectedReason && (
                <Text accessibilityRole="alert" style={styles.notice}>
                  {selectedReason}
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !!selectedReason }}
                disabled={!!selectedReason}
                onPress={undo}
                style={[styles.primary, !!selectedReason && styles.disabled]}
              >
                <Text style={styles.primaryText}>이 변경 되돌리기</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSelectedId(null)}
                style={styles.button}
              >
                <Text style={styles.link}>취소</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
function HistoryCard({
  row,
  reason,
  locationName,
  onUndo,
}: {
  row: InventoryHistoryRow;
  reason: string | null;
  locationName: (id: string) => string;
  onUndo: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { operation } = row;
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>
        {operation.after.name} · {operationLabels[operation.type]}
      </Text>
      <Text style={styles.description}>
        {new Date(operation.createdAt).toLocaleString()}
      </Text>
      <Text style={styles.description}>
        {operation.before ? `${quantityLabel(operation.before)} → ` : ''}
        {quantityLabel(operation.after)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${operation.after.name} 변경 내용 ${expanded ? '접기' : '보기'}`}
        onPress={() => setExpanded((value) => !value)}
        style={styles.button}
      >
        <Text style={styles.link}>
          {expanded ? '내용 접기' : '변경 내용 보기'}
        </Text>
      </Pressable>
      {expanded && (
        <HistoryChanges operation={operation} locationName={locationName} />
      )}
      {reason ? (
        <Text style={styles.notice}>{reason}</Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${operation.after.name} ${operationLabels[operation.type]} 실행 취소`}
          onPress={onUndo}
          style={styles.button}
        >
          <Text style={styles.link}>실행 취소</Text>
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 48, gap: 12 },
  header: { gap: 14, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  heading: { fontSize: 18, fontWeight: '600', color: colors.text },
  description: { color: colors.textMuted, lineHeight: 23 },
  message: { color: colors.accent, lineHeight: 23 },
  notice: { color: '#8D4514', lineHeight: 22 },
  card: {
    padding: 18,
    gap: 8,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: { minHeight: 48, justifyContent: 'center', paddingVertical: 10 },
  link: { color: colors.accent, fontWeight: '600' },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#00000066',
    padding: 20,
  },
  dialog: {
    maxHeight: '85%',
    padding: 20,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  primary: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
