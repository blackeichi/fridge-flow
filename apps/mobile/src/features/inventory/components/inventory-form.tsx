import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { InventoryBatch } from '@/db/user/schema';
import { colors } from '@/shared/theme/colors';
import {
  normalizeInventory,
  UNITS,
  type InventoryInput,
} from '../domain/inventory';
import type { InventoryLocation } from '../repositories/inventory-repository';

export function InventoryForm({
  batch,
  locations,
  onSave,
  onClose,
}: {
  batch: InventoryBatch | null;
  locations: InventoryLocation[];
  onSave: (input: InventoryInput) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState<InventoryInput>({
    name: batch?.name ?? '',
    containerId: batch?.containerId ?? locations[0]?.id ?? '',
    amount: batch?.amount ?? '1',
    unit: batch?.unit ?? '개',
    quantityKnown: batch?.quantityKnown ?? true,
    purchasedOn: batch?.purchasedOn ?? '',
    expiresOn: batch?.expiresOn ?? '',
    notes: batch?.notes ?? '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  function change<K extends keyof InventoryInput>(
    key: K,
    value: InventoryInput[K],
  ) {
    setInput((previous) => ({ ...previous, [key]: value }));
  }
  function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      normalizeInventory(input);
      onSave(input);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '저장하지 못했습니다. 다시 시도해 주세요.',
      );
      saving.current = false;
      setBusy(false);
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
              {batch ? '재료 수정' : '재료 추가'}
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
            <Text style={styles.label}>재료명</Text>
            <TextInput
              accessibilityLabel="재료명"
              value={input.name}
              onChangeText={(value) => change('name', value)}
              placeholder="예: 우유"
              maxLength={100}
              style={styles.input}
            />
            <View style={styles.row}>
              <Text style={styles.label}>수량 모름</Text>
              <Switch
                accessibilityLabel="수량 모름"
                value={!input.quantityKnown}
                onValueChange={(value) => change('quantityKnown', !value)}
              />
            </View>
            {input.quantityKnown && (
              <TextInput
                accessibilityLabel="수량"
                keyboardType="decimal-pad"
                value={input.amount}
                onChangeText={(value) => change('amount', value)}
                style={styles.input}
              />
            )}
            <Text style={styles.label}>단위</Text>
            <View style={styles.choices}>
              {UNITS.map((unit) => (
                <Choice
                  key={unit}
                  label={unit}
                  selected={input.unit === unit}
                  onPress={() => change('unit', unit)}
                />
              ))}
            </View>
            <Text style={styles.label}>보관 위치</Text>
            <View style={styles.choices}>
              {locations.map((location) => (
                <Choice
                  key={location.id}
                  label={`${location.spaceName} · ${location.name}`}
                  selected={input.containerId === location.id}
                  onPress={() => change('containerId', location.id)}
                />
              ))}
            </View>
            <Text style={styles.label}>유통기한 (선택)</Text>
            <TextInput
              accessibilityLabel="유통기한"
              placeholder="YYYY-MM-DD · 비우면 없음/모름"
              value={input.expiresOn}
              onChangeText={(value) => change('expiresOn', value)}
              autoCapitalize="none"
              maxLength={10}
              style={styles.input}
            />
            <Text style={styles.hint}>
              관리용 날짜이며 음식의 실제 안전을 보증하지 않습니다.
            </Text>
            <Text style={styles.label}>구매일 (선택)</Text>
            <TextInput
              accessibilityLabel="구매일"
              placeholder="YYYY-MM-DD"
              value={input.purchasedOn}
              onChangeText={(value) => change('purchasedOn', value)}
              maxLength={10}
              style={styles.input}
            />
            <Text style={styles.label}>메모 (선택)</Text>
            <TextInput
              accessibilityLabel="메모"
              multiline
              value={input.notes}
              onChangeText={(value) => change('notes', value)}
              maxLength={1000}
              style={[styles.input, styles.notes]}
            />
            <Text style={styles.hint}>
              수량 0은 소진으로 보관됩니다. 같은 재료도 구매 묶음별로 따로
              추가할 수 있어요.
            </Text>
            {!!error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={save}
              style={styles.save}
            >
              <Text style={styles.saveText}>저장</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export function Choice({
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
      <Text style={selected ? styles.saveText : styles.choiceText}>
        {label}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  content: { padding: 20, gap: 12, paddingBottom: 48 },
  label: { color: colors.text, fontWeight: '600', fontSize: 15 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: 16,
    minHeight: 48,
  },
  notes: { minHeight: 96, textAlignVertical: 'top' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 44,
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  choiceText: { color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  error: { color: '#9D2828', lineHeight: 22 },
  button: { padding: 14, minHeight: 48 },
  save: {
    backgroundColor: colors.accent,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveText: { color: '#FFFFFF', fontWeight: '600' },
});
