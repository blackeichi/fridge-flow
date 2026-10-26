import { useRef, useState } from 'react';
import { BackupFreshness } from '../components/backup-freshness';
import { useForegroundClock } from '@/shared/hooks/use-foreground-clock';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/shared/theme/colors';
import { BackupError, type PreparedBackup } from '../domain/backup-format';
import { nativeBackupService } from '../services/native-backup-service';
import { useBackupStatus } from '../services/use-backup-status';

export function BackupScreen() {
  const router = useRouter();
  const lastExport = useBackupStatus();
  const now = useForegroundClock();
  const [pending, setPending] = useState<PreparedBackup | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  async function run(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    try {
      await work();
    } catch (error) {
      setMessage(
        error instanceof BackupError
          ? error.message
          : '백업 작업을 완료하지 못했습니다. 파일과 저장 공간을 확인하고 다시 시도해 주세요.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.button}
        >
          <Text style={styles.link}>← 냉장고로</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          백업·복원
        </Text>
        <Text style={styles.description}>
          기기 안의 재고와 보관 위치, 변경 기록을 파일로 보관합니다. Google
          Drive 또는 기기 저장소를 직접 선택할 수 있어요.
        </Text>
        <View style={styles.card}>
          <Text style={styles.heading}>내 데이터를 보관하기</Text>
          <BackupFreshness status={lastExport} now={now} />
          <Text style={styles.notice}>
            백업은 암호화되지 않습니다. 개인 폴더에 보관하고 다른 사람에게
            공유하지 마세요.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy || !!pending}
            onPress={() =>
              run(async () => {
                const saved = await nativeBackupService.export();
                setMessage(
                  saved
                    ? '백업을 저장하고 파일 내용을 확인했습니다.'
                    : '백업 저장을 취소했습니다.',
                );
              })
            }
            style={styles.primary}
          >
            <Text style={styles.primaryText}>백업 내보내기</Text>
          </Pressable>
        </View>
        <View style={styles.card}>
          <Text style={styles.heading}>파일에서 복원하기</Text>
          <Text style={styles.description}>
            같은 Google 계정의 .ffbackup 파일만 복원할 수 있습니다. 복원하면
            현재 기기의 데이터를 모두 교체합니다.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy || !!pending}
            onPress={() =>
              run(async () => {
                const backup = await nativeBackupService.prepareRestore();
                setPending(backup);
                if (!backup) setMessage('파일 선택을 취소했습니다.');
              })
            }
            style={styles.secondary}
          >
            <Text style={styles.link}>백업 파일 선택</Text>
          </Pressable>
        </View>
        {pending && (
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.heading}>
              복원 내용 확인
            </Text>
            <Text style={styles.description}>
              백업 시각:{' '}
              {new Date(pending.manifest.created_at).toLocaleString()}
            </Text>
            <Text style={styles.description}>
              재료 {pending.data.batches.length}묶음 · 보관 위치{' '}
              {pending.data.containers.length}개 · 변경 기록{' '}
              {pending.data.transactions.length}건
            </Text>
            <Text style={styles.notice}>
              현재 데이터와 병합하지 않고 전체 교체합니다. 복원 직전 현재 DB의
              안전 사본을 기기에 남깁니다.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() =>
                run(async () => {
                  await nativeBackupService.restore(pending);
                  setPending(null);
                  setMessage(
                    '복원했습니다. 냉장고에서 데이터를 확인해 주세요.',
                  );
                })
              }
              style={styles.primary}
            >
              <Text style={styles.primaryText}>현재 데이터 전체 교체 복원</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => setPending(null)}
              style={styles.button}
            >
              <Text style={styles.link}>복원 취소</Text>
            </Pressable>
          </View>
        )}
        {!!message && (
          <Text accessibilityRole="alert" style={styles.description}>
            {message}
          </Text>
        )}
        <Text style={styles.description}>
          자동 백업·다중 기기 동기화는 제공하지 않습니다. 앱 삭제 전 또는 중요한
          변경 후 백업을 내보내세요.
        </Text>
      </ScrollView>
      <Modal transparent visible={busy} onRequestClose={() => {}}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <ActivityIndicator color={colors.accent} />
            <Text accessibilityLiveRegion="polite">
              백업 작업 중입니다. 잠시 기다려 주세요.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 20, paddingBottom: 48 },
  title: { fontSize: 30, color: colors.text, fontWeight: '700' },
  heading: { fontSize: 19, color: colors.text, fontWeight: '600' },
  description: { color: colors.textMuted, fontSize: 15, lineHeight: 24 },
  notice: { color: '#8D4514', lineHeight: 23 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 14,
  },
  primary: {
    backgroundColor: colors.accent,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '600' },
  secondary: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  button: { minHeight: 44, justifyContent: 'center', paddingVertical: 12 },
  link: { color: colors.accent, fontWeight: '600' },
  overlay: {
    flex: 1,
    backgroundColor: '#00000066',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});
