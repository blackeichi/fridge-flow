import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Container } from '@/db/user/schema';
import { colors } from '@/shared/theme/colors';
import {
  StorageChoice,
  StorageEditorForm,
  type StorageEditor,
} from '../components/storage-editor';
import { StorageGrid } from '../components/storage-grid';
import {
  containerPath,
  firstFreeCell,
  GRID_COLUMNS,
  GRID_ROWS,
  StorageError,
} from '../domain/layout';
import { useStorage } from '../hooks/use-storage';
import type { StorageEdit } from '../repositories/storage-management-repository';

export function StorageScreen() {
  const [attempt, setAttempt] = useState(0);
  return (
    <StorageContent
      key={attempt}
      retry={() => setAttempt((value) => value + 1)}
    />
  );
}
function StorageContent({ retry }: { retry: () => void }) {
  const router = useRouter();
  const storage = useStorage();
  const [spaceId, setSpace] = useState<string | null>(null);
  const [parent, setParent] = useState<string | null>(null);
  const [editor, setEditor] = useState<StorageEditor | null>(null);
  const [undo, setUndo] = useState<StorageEdit | null>(null);
  const [message, setMessage] = useState('');
  const selected =
    storage.spaces.find((space) => space.id === spaceId) ?? storage.spaces[0];
  const spaceContainers = storage.containers.filter(
    (container) => container.spaceId === selected?.id,
  );
  const parentId = spaceContainers.some((container) => container.id === parent)
    ? parent
    : null;
  const siblings = spaceContainers.filter(
    (container) => container.parentId === parentId,
  );
  function editContainer(container: Container) {
    setEditor({ kind: 'container', current: container, initial: container });
  }
  function addContainer() {
    if (!selected) return;
    try {
      const position = firstFreeCell(storage.containers, selected.id, parentId);
      setEditor({
        kind: 'container',
        current: null,
        initial: {
          name: '',
          spaceId: selected.id,
          parentId,
          ...position,
          gridWidth: 1,
          gridHeight: 1,
        },
      });
    } catch (error) {
      setMessage(
        error instanceof StorageError
          ? error.message
          : '보관함을 추가할 수 없습니다.',
      );
    }
  }
  if (storage.error)
    return (
      <SafeAreaView style={styles.center}>
        <Text accessibilityRole="alert">보관 위치를 불러오지 못했습니다.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={retry}
          style={styles.action}
        >
          <Text>다시 시도</Text>
        </Pressable>
      </SafeAreaView>
    );
  if (storage.loading)
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.accent} />
        <Text>보관 위치를 불러오고 있습니다.</Text>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.action}
        >
          <Text style={styles.link}>← 냉장고로</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          보관 위치 편집
        </Text>
        <Text style={styles.description}>
          냉장고·냉동고·팬트리를 추가하고 선반, 서랍, 용기의 이름과 배치를
          정하세요.
        </Text>
        <View style={styles.choices}>
          {storage.spaces.map((space) => (
            <StorageChoice
              key={space.id}
              label={space.name}
              selected={space.id === selected?.id}
              onPress={() => {
                setSpace(space.id);
                setParent(null);
              }}
            />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setEditor({ kind: 'space', current: null })}
          style={styles.secondary}
        >
          <Text style={styles.link}>+ 보관 공간</Text>
        </Pressable>
        {selected && (
          <>
            <View style={styles.row}>
              <Text accessibilityRole="header" style={styles.heading}>
                {selected.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setEditor({ kind: 'space', current: selected })}
                style={styles.action}
              >
                <Text style={styles.link}>공간 수정</Text>
              </Pressable>
            </View>
            <Text style={styles.description}>
              보기 위치:{' '}
              {parentId
                ? containerPath(parentId, spaceContainers)
                : '공간 바로 아래'}
            </Text>
            {parentId && (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  setParent(
                    spaceContainers.find(
                      (container) => container.id === parentId,
                    )?.parentId ?? null,
                  )
                }
                style={styles.action}
              >
                <Text style={styles.link}>상위 위치 보기</Text>
              </Pressable>
            )}
            <StorageGrid containers={siblings} onContainer={editContainer} />
            <Text style={styles.hint}>
              보관함을 누르면 이름·위치·크기를 수정합니다. 각 보관함 안쪽도
              별도의 4열 × 8행 격자로 편집할 수 있습니다.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={addContainer}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>+ 보관함</Text>
            </Pressable>
            {!siblings.length && (
              <Text style={styles.description}>
                아직 보관함이 없습니다. 첫 선반이나 용기를 추가해 보세요.
              </Text>
            )}
            {siblings.map((container) => (
              <View key={container.id} style={styles.card}>
                <Text style={styles.heading}>{container.name}</Text>
                <Text style={styles.description}>
                  {container.gridRow + 1}행 {container.gridColumn + 1}열 · 가로{' '}
                  {container.gridWidth}칸 × 세로 {container.gridHeight}칸
                  {container.gridRow + container.gridHeight > GRID_ROWS ||
                  container.gridColumn + container.gridWidth > GRID_COLUMNS
                    ? ' · 현재 격자 범위 밖'
                    : ''}
                </Text>
                <View style={styles.row}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${container.name} 수정`}
                    onPress={() => editContainer(container)}
                    style={styles.action}
                  >
                    <Text style={styles.link}>수정</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${container.name} 안쪽 보기`}
                    onPress={() => setParent(container.id)}
                    style={styles.action}
                  >
                    <Text style={styles.link}>안쪽 보기</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}
        {undo && (
          <View style={styles.card}>
            <Text style={styles.description}>{undo.after.name} 수정 기록</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                try {
                  storage.repository.undo(undo);
                  setUndo(null);
                  setMessage('수정을 실행 취소했습니다.');
                } catch (error) {
                  setMessage(
                    error instanceof StorageError
                      ? error.message
                      : '실행 취소하지 못했습니다. 다시 시도해 주세요.',
                  );
                }
              }}
              style={styles.action}
            >
              <Text style={styles.link}>최근 수정 실행 취소</Text>
            </Pressable>
          </View>
        )}
        {!!message && (
          <Text accessibilityLiveRegion="polite" style={styles.description}>
            {message}
          </Text>
        )}
      </ScrollView>
      {editor && (
        <StorageEditorForm
          editor={editor}
          containers={storage.containers}
          onClose={() => setEditor(null)}
          onSaveSpace={(input, id) => {
            const edit = storage.repository.saveSpace(input, id);
            setUndo(edit);
            setEditor(null);
            setMessage('공간을 저장했습니다.');
          }}
          onSaveContainer={(input, id) => {
            const edit = storage.repository.saveContainer(input, id);
            setUndo(edit);
            setEditor(null);
            setParent(input.parentId);
            setMessage(
              '보관함을 저장했습니다. 연결된 재료는 그대로 보관됩니다.',
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    gap: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  title: { fontSize: 30, fontWeight: '700', color: colors.text },
  heading: {
    fontSize: 19,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
  description: { color: colors.textMuted, fontSize: 15, lineHeight: 23 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 21 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: {
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  action: { padding: 12, minHeight: 44, justifyContent: 'center' },
  link: { color: colors.accent, fontWeight: '600' },
  primary: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 12,
  },
  primaryText: { color: '#FFFFFF', fontWeight: '600' },
  secondary: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    alignItems: 'center',
  },
});
