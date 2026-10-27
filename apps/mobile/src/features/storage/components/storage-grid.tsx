import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Container } from '@/db/user/schema';
import { colors } from '@/shared/theme/colors';
import { GRID_COLUMNS, GRID_ROWS } from '../domain/layout';

export function StorageGrid({
  containers,
  onContainer,
  onCell,
  preview,
}: {
  containers: Container[];
  onContainer?: (container: Container) => void;
  onCell?: (row: number, column: number) => void;
  preview?: {
    gridRow: number;
    gridColumn: number;
    gridWidth: number;
    gridHeight: number;
  };
}) {
  return (
    <View style={styles.grid} accessibilityLabel="보관함 배치 지도">
      {Array.from({ length: GRID_COLUMNS * GRID_ROWS }, (_, index) => {
        const row = Math.floor(index / GRID_COLUMNS);
        const column = index % GRID_COLUMNS;
        return (
          <Pressable
            key={index}
            accessibilityRole="button"
            accessibilityLabel={`${row + 1}행 ${column + 1}열`}
            disabled={!onCell}
            onPress={() => onCell?.(row, column)}
            style={[
              styles.cell,
              { left: `${(column / GRID_COLUMNS) * 100}%`, top: row * 44 },
            ]}
          />
        );
      })}
      {containers
        .filter(
          (container) =>
            container.gridRow < GRID_ROWS &&
            container.gridColumn < GRID_COLUMNS,
        )
        .map((container) => (
          <Pressable
            key={container.id}
            accessibilityRole="button"
            accessibilityLabel={`${container.name} 배치 수정`}
            disabled={!onContainer}
            onPress={() => onContainer?.(container)}
            style={[
              styles.block,
              {
                left: `${(container.gridColumn / GRID_COLUMNS) * 100}%`,
                top: container.gridRow * 44,
                width: `${(Math.min(container.gridWidth, GRID_COLUMNS - container.gridColumn) / GRID_COLUMNS) * 100}%`,
                height:
                  Math.min(
                    container.gridHeight,
                    GRID_ROWS - container.gridRow,
                  ) * 44,
              },
            ]}
          >
            <Text numberOfLines={2} style={styles.name}>
              {container.name}
            </Text>
          </Pressable>
        ))}
      {preview &&
        [
          preview.gridRow,
          preview.gridColumn,
          preview.gridWidth,
          preview.gridHeight,
        ].every(Number.isFinite) &&
        preview.gridWidth > 0 &&
        preview.gridHeight > 0 &&
        preview.gridRow >= 0 &&
        preview.gridColumn >= 0 &&
        preview.gridRow < GRID_ROWS &&
        preview.gridColumn < GRID_COLUMNS && (
          <View
            pointerEvents="none"
            style={[
              styles.preview,
              {
                left: `${(preview.gridColumn / GRID_COLUMNS) * 100}%`,
                top: preview.gridRow * 44,
                width: `${(Math.max(1, Math.min(preview.gridWidth, GRID_COLUMNS - preview.gridColumn)) / GRID_COLUMNS) * 100}%`,
                height:
                  Math.max(
                    1,
                    Math.min(preview.gridHeight, GRID_ROWS - preview.gridRow),
                  ) * 44,
              },
            ]}
          />
        )}
    </View>
  );
}
const styles = StyleSheet.create({
  grid: {
    height: GRID_ROWS * 44,
    position: 'relative',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cell: {
    position: 'absolute',
    width: `${100 / GRID_COLUMNS}%`,
    height: 44,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  block: {
    position: 'absolute',
    padding: 6,
    backgroundColor: '#E5EDDF',
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: colors.accent, fontWeight: '600', fontSize: 12 },
  preview: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#B56C20',
    backgroundColor: '#B56C2022',
  },
});
