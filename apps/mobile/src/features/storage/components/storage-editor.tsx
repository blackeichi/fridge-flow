import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Container, StorageSpace } from '@/db/user/schema';
import { colors } from '@/shared/theme/colors';
import {
  containerPath,
  descendants,
  StorageError,
  type ContainerInput,
} from '../domain/layout';
import type { StorageSpaceType } from '../repositories/storage-space-repository';
import { StorageGrid } from './storage-grid';

export type StorageEditor =
  | { kind: 'space'; current: StorageSpace | null }
  | { kind: 'container'; current: Container | null; initial: ContainerInput };
export function StorageEditorForm({
  editor,
  containers,
  onSaveSpace,
  onSaveContainer,
  onClose,
}: {
  editor: StorageEditor;
  containers: Container[];
  onSaveSpace: (
    input: { name: string; type: StorageSpaceType },
    id?: string,
  ) => void;
  onSaveContainer: (input: ContainerInput, id?: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(editor.current?.name ?? '');
  const [type, setType] = useState<StorageSpaceType>(
    editor.kind === 'space'
      ? (editor.current?.type ?? 'refrigerator')
      : 'refrigerator',
  );
  const initial = editor.kind === 'container' ? editor.initial : null;
  const [parentId, setParent] = useState(initial?.parentId ?? null);
  const [row, setRow] = useState(String((initial?.gridRow ?? 0) + 1));
  const [column, setColumn] = useState(String((initial?.gridColumn ?? 0) + 1));
  const [width, setWidth] = useState(String(initial?.gridWidth ?? 1));
  const [height, setHeight] = useState(String(initial?.gridHeight ?? 1));
  const [error, setError] = useState('');
  const lock = useRef(false);
  const siblings = initial
    ? containers.filter(
        (container) =>
          container.spaceId === initial.spaceId &&
          container.parentId === parentId &&
          container.id !== editor.current?.id,
      )
    : [];
  const excluded =
    editor.current && editor.kind === 'container'
      ? descendants(editor.current.id, containers)
      : new Set<string>();
  const parents = initial
    ? containers.filter(
        (container) =>
          container.spaceId === initial.spaceId && !excluded.has(container.id),
      )
    : [];
  const geometry = {
    gridRow: Number(row) - 1,
    gridColumn: Number(column) - 1,
    gridWidth: Number(width),
    gridHeight: Number(height),
  };
  function save() {
    if (lock.current) return;
    lock.current = true;
    try {
      if (editor.kind === 'space')
        onSaveSpace({ name, type }, editor.current?.id);
      else
        onSaveContainer(
          { ...editor.initial, ...geometry, name, parentId },
          editor.current?.id,
        );
    } catch (error) {
      setError(
        error instanceof StorageError
          ? error.message
          : '저장하지 못했습니다. 입력을 확인하고 다시 시도해 주세요.',
      );
      lock.current = false;
    }
  }
  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {editor.kind === 'space' ? '보관 공간' : '보관함'}{' '}
              {editor.current ? '수정' : '추가'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.button}
            >
              <Text>닫기</Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>이름</Text>
            <TextInput
              accessibilityLabel="이름"
              value={name}
              onChangeText={setName}
              maxLength={60}
              placeholder={
                editor.kind === 'space' ? '예: 작은 냉장고' : '예: 채소 바구니'
              }
              style={styles.input}
            />
            {editor.kind === 'space' ? (
              <>
                <Text style={styles.label}>공간 종류</Text>
                <View style={styles.choices}>
                  {(['refrigerator', 'freezer', 'pantry'] as const).map(
                    (value, index) => (
                      <StorageChoice
                        key={value}
                        label={['냉장', '냉동', '실온/팬트리'][index]}
                        selected={value === type}
                        onPress={() => setType(value)}
                      />
                    ),
                  )}
                </View>
                {!editor.current && (
                  <Text style={styles.hint}>
                    새 공간에는 바로 사용할 수 있는 기본 보관함을 함께 만듭니다.
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text style={styles.label}>상위 위치</Text>
                <View style={styles.choices}>
                  <StorageChoice
                    label="공간 바로 아래"
                    selected={parentId === null}
                    onPress={() => setParent(null)}
                  />
                  {parents.map((parent) => (
                    <StorageChoice
                      key={parent.id}
                      label={containerPath(parent.id, containers)}
                      selected={parent.id === parentId}
                      onPress={() => setParent(parent.id)}
                    />
                  ))}
                </View>
                <Text style={styles.hint}>
                  빈 칸을 눌러 왼쪽 위 위치를 정하세요. 주황색 테두리는 저장할
                  배치입니다.
                </Text>
                <StorageGrid
                  containers={siblings}
                  onCell={(r, c) => {
                    setRow(String(r + 1));
                    setColumn(String(c + 1));
                  }}
                  preview={geometry}
                />
                <View style={styles.fields}>
                  {[
                    { label: '행 (1~8)', value: row, change: setRow },
                    { label: '열 (1~4)', value: column, change: setColumn },
                    { label: '가로 칸 수', value: width, change: setWidth },
                    { label: '세로 칸 수', value: height, change: setHeight },
                  ].map((field) => (
                    <View key={field.label} style={styles.field}>
                      <Text style={styles.label}>{field.label}</Text>
                      <TextInput
                        accessibilityLabel={field.label}
                        value={field.value}
                        onChangeText={field.change}
                        keyboardType="number-pad"
                        maxLength={6}
                        style={styles.input}
                      />
                    </View>
                  ))}
                </View>
                <Text style={styles.hint}>
                  상위 보관함별로 별도의 4열 × 8행 격자를 사용합니다.
                  위치·크기를 바꿔도 연결된 재료와 수량은 그대로 보관됩니다.
                </Text>
              </>
            )}
            {!!error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={save}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>저장</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
export function StorageChoice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.selected]}
    >
      <Text style={selected ? styles.primaryText : styles.label}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  label: { color: colors.text, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    minHeight: 48,
    padding: 14,
    color: colors.text,
    fontSize: 16,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.accent },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 21 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  field: { width: '46%', gap: 8 },
  primary: {
    padding: 16,
    backgroundColor: colors.accent,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '600' },
  button: { minHeight: 44, padding: 12, justifyContent: 'center' },
  error: { color: '#9D2828', lineHeight: 22 },
});
