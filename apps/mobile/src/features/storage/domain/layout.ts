import type { Container } from '@/db/user/schema';

export const GRID_COLUMNS = 4;
export const GRID_ROWS = 8;
export class StorageError extends Error {}
export interface ContainerInput {
  name: string;
  spaceId: string;
  parentId: string | null;
  gridRow: number;
  gridColumn: number;
  gridWidth: number;
  gridHeight: number;
}
export function storageName(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (!normalized || normalized.length > 60)
    throw new StorageError('이름은 1~60자로 입력해 주세요.');
  return normalized;
}
export function descendants(id: string, containers: Container[]) {
  const result = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const container of containers)
      if (
        container.parentId &&
        result.has(container.parentId) &&
        !result.has(container.id)
      ) {
        result.add(container.id);
        changed = true;
      }
  }
  return result;
}
export function overlaps(
  a: Pick<Container, 'gridRow' | 'gridColumn' | 'gridWidth' | 'gridHeight'>,
  b: Pick<Container, 'gridRow' | 'gridColumn' | 'gridWidth' | 'gridHeight'>,
) {
  return (
    a.gridColumn < b.gridColumn + b.gridWidth &&
    a.gridColumn + a.gridWidth > b.gridColumn &&
    a.gridRow < b.gridRow + b.gridHeight &&
    a.gridRow + a.gridHeight > b.gridRow
  );
}
export function validatePlacement(
  input: ContainerInput,
  containers: Container[],
  editingId?: string,
) {
  const normalized: ContainerInput = {
    name: storageName(input.name),
    spaceId: input.spaceId,
    parentId: input.parentId,
    gridRow: input.gridRow,
    gridColumn: input.gridColumn,
    gridWidth: input.gridWidth,
    gridHeight: input.gridHeight,
  };
  const {
    gridRow: row,
    gridColumn: column,
    gridWidth: width,
    gridHeight: height,
  } = normalized;
  if (
    ![row, column, width, height].every(Number.isInteger) ||
    row < 0 ||
    column < 0 ||
    width < 1 ||
    height < 1 ||
    row + height > GRID_ROWS ||
    column + width > GRID_COLUMNS
  )
    throw new StorageError('배치는 4열 × 8행 안에 들어가야 합니다.');
  if (input.parentId) {
    const parent = containers.find(
      (container) => container.id === input.parentId,
    );
    if (!parent || parent.spaceId !== input.spaceId)
      throw new StorageError('같은 공간의 보관함을 상위 위치로 선택해 주세요.');
    if (editingId && descendants(editingId, containers).has(input.parentId))
      throw new StorageError('자신이나 하위 보관함 안으로 이동할 수 없습니다.');
  }
  const siblings = containers.filter(
    (container) =>
      container.spaceId === input.spaceId &&
      container.parentId === input.parentId &&
      container.id !== editingId,
  );
  if (siblings.some((container) => container.name === normalized.name))
    throw new StorageError('같은 위치에 같은 이름의 보관함이 있습니다.');
  if (siblings.some((container) => overlaps(container, normalized)))
    throw new StorageError('다른 보관함과 겹칩니다. 빈 칸을 선택해 주세요.');
  return normalized;
}
export function firstFreeCell(
  containers: Container[],
  spaceId: string,
  parentId: string | null,
) {
  const siblings = containers.filter(
    (container) =>
      container.spaceId === spaceId && container.parentId === parentId,
  );
  for (let gridRow = 0; gridRow < GRID_ROWS; gridRow++)
    for (let gridColumn = 0; gridColumn < GRID_COLUMNS; gridColumn++) {
      if (
        !siblings.some((container) =>
          overlaps(container, {
            gridRow,
            gridColumn,
            gridWidth: 1,
            gridHeight: 1,
          }),
        )
      )
        return { gridRow, gridColumn };
    }
  throw new StorageError(
    '빈 칸이 없습니다. 보관함 크기를 조정하거나 다른 위치를 선택해 주세요.',
  );
}
export function containerPath(
  id: string,
  containers: Pick<Container, 'id' | 'name' | 'parentId'>[],
): string {
  const names: string[] = [];
  const visited = new Set<string>();
  let next: string | null = id;
  while (next && !visited.has(next)) {
    visited.add(next);
    const container = containers.find((entry) => entry.id === next);
    if (!container) break;
    names.unshift(container.name);
    next = container.parentId;
  }
  return names.join(' / ');
}
