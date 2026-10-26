import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/shared/theme/colors';
import { backupFreshness, type BackupStatus } from '../domain/backup-freshness';

const messages = {
  loading: '백업 기록을 확인하고 있어요.',
  error: '백업 기록을 확인하지 못했습니다. 화면을 다시 열어 주세요.',
  missing: '아직 백업이 없어요. 데이터를 보관해 주세요.',
  overdue: '마지막 백업 후 7일이 지났어요. 새 백업을 저장해 주세요.',
  unknown: '백업 시각과 기기 날짜를 확인해 주세요.',
  recent: '중요한 변경 후에는 새 백업을 저장해 주세요.',
};

export function BackupFreshness({
  status,
  now,
}: {
  status: BackupStatus;
  now: number;
}) {
  const freshness = backupFreshness(status, now);
  const showTime = freshness === 'recent' || freshness === 'overdue';
  return (
    <View style={styles.container}>
      {showTime && (
        <Text style={styles.text}>
          마지막 성공 백업: {new Date(status.lastExport!).toLocaleString()}
        </Text>
      )}
      <Text
        accessibilityLiveRegion="polite"
        style={[
          styles.text,
          freshness !== 'recent' && freshness !== 'loading' && styles.notice,
        ]}
      >
        {messages[freshness]}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: 4 },
  text: { color: colors.textMuted, fontSize: 14, lineHeight: 22 },
  notice: { color: '#8D4514' },
});
