import { asc, eq } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import type { UserDatabase } from '@/db/user/client';
import {
  appProfiles,
  containers,
  storageSpaces,
  type Container,
  type StorageSpace,
} from '@/db/user/schema';
import {
  STORAGE_SPACE_TYPES,
  type StorageSpaceType,
} from './storage-space-repository';
import {
  storageName,
  StorageError,
  validatePlacement,
  type ContainerInput,
} from '../domain/layout';

export type StorageEdit =
  | { kind: 'space'; before: StorageSpace; after: StorageSpace }
  | { kind: 'container'; before: Container; after: Container };
const containerKeys: (keyof Container)[] = [
  'id',
  'spaceId',
  'parentId',
  'name',
  'gridRow',
  'gridColumn',
  'gridWidth',
  'gridHeight',
  'sortOrder',
  'createdAt',
  'updatedAt',
];
const spaceKeys: (keyof StorageSpace)[] = [
  'id',
  'name',
  'type',
  'sortOrder',
  'createdAt',
  'updatedAt',
];
export function createStorageManagementRepository(
  database: UserDatabase,
  {
    createId = randomUUID,
    now = () => new Date().toISOString(),
  }: { createId?: () => string; now?: () => string } = {},
) {
  function saveSpace(
    input: { name: string; type: StorageSpaceType },
    id?: string,
    expected?: StorageSpace,
  ): StorageEdit | null {
    const name = storageName(input.name);
    if (!STORAGE_SPACE_TYPES.includes(input.type))
      throw new StorageError('공간 종류를 선택해 주세요.');
    return database.transaction((tx) => {
      const spaces = tx.select().from(storageSpaces).all();
      if (spaces.some((space) => space.name === name && space.id !== id))
        throw new StorageError('같은 이름의 공간이 있습니다.');
      const before = spaces.find((space) => space.id === id);
      if (id && !before)
        throw new StorageError(
          '공간을 찾을 수 없습니다. 화면을 다시 열어 주세요.',
        );
      if (
        expected &&
        (!before || spaceKeys.some((key) => before[key] !== expected[key]))
      )
        throw new StorageError('이후 변경이 있어 실행 취소할 수 없습니다.');
      const timestamp = now();
      if (before) {
        const after = {
          ...before,
          name,
          type: input.type,
          updatedAt: timestamp,
        };
        tx.update(storageSpaces)
          .set(after)
          .where(eq(storageSpaces.id, before.id))
          .run();
        return { kind: 'space' as const, before, after };
      }
      const spaceId = createId();
      tx.insert(storageSpaces)
        .values({
          id: spaceId,
          name,
          type: input.type,
          sortOrder:
            Math.max(-1, ...spaces.map((space) => space.sortOrder)) + 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();
      tx.insert(containers)
        .values({
          id: createId(),
          spaceId,
          name: '기본 보관함',
          gridRow: 0,
          gridColumn: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();
      return null;
    });
  }
  function saveContainer(
    input: ContainerInput,
    id?: string,
    expected?: Container,
  ): StorageEdit | null {
    return database.transaction((tx) => {
      if (
        !tx
          .select()
          .from(storageSpaces)
          .where(eq(storageSpaces.id, input.spaceId))
          .get()
      )
        throw new StorageError('보관 공간을 선택해 주세요.');
      const rows = tx.select().from(containers).all();
      const before = rows.find((container) => container.id === id);
      if (id && !before)
        throw new StorageError(
          '보관함을 찾을 수 없습니다. 화면을 다시 열어 주세요.',
        );
      if (
        expected &&
        (!before || containerKeys.some((key) => before[key] !== expected[key]))
      )
        throw new StorageError('이후 변경이 있어 실행 취소할 수 없습니다.');
      if (before && before.spaceId !== input.spaceId)
        throw new StorageError(
          '보관함의 공간은 바꿀 수 없습니다. 재료 상세에서 위치를 변경해 주세요.',
        );
      const normalized = validatePlacement(input, rows, id);
      const timestamp = now();
      if (before) {
        const after = { ...before, ...normalized, updatedAt: timestamp };
        tx.update(containers)
          .set(after)
          .where(eq(containers.id, before.id))
          .run();
        return { kind: 'container' as const, before, after };
      }
      tx.insert(containers)
        .values({
          ...normalized,
          id: createId(),
          sortOrder:
            Math.max(
              -1,
              ...rows
                .filter((row) => row.spaceId === input.spaceId)
                .map((row) => row.sortOrder),
            ) + 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();
      return null;
    });
  }
  return {
    initializeDefaults() {
      database.transaction((tx) => {
        const timestamp = now();
        const profile = tx.select().from(appProfiles).get();
        if (profile?.preferences.storageTemplateVersion === 1) return;
        const templates = [
          {
            type: 'refrigerator' as const,
            name: '냉장실',
            names: ['냉장 선반', '문 선반', '야채 서랍'],
          },
          { type: 'freezer' as const, name: '냉동실', names: ['냉동 선반'] },
          { type: 'pantry' as const, name: '실온/팬트리', names: ['팬트리'] },
        ];
        for (const [sortOrder, template] of templates.entries()) {
          let space = tx
            .select()
            .from(storageSpaces)
            .where(eq(storageSpaces.type, template.type))
            .orderBy(asc(storageSpaces.sortOrder))
            .get();
          if (!space) {
            // Existing user names are preserved; avoid a collision with another type.
            const names = tx
              .select()
              .from(storageSpaces)
              .all()
              .map((item) => item.name);
            let name = template.name;
            let suffix = 2;
            while (names.includes(name)) name = `${template.name} ${suffix++}`;
            space = {
              id: createId(),
              name,
              type: template.type,
              sortOrder,
              createdAt: timestamp,
              updatedAt: timestamp,
            };
            tx.insert(storageSpaces).values(space).run();
          }
          if (
            tx
              .select()
              .from(containers)
              .where(eq(containers.spaceId, space.id))
              .get()
          )
            continue;
          for (const [index, name] of template.names.entries()) {
            tx.insert(containers)
              .values({
                id: createId(),
                spaceId: space.id,
                name,
                gridRow: index,
                gridColumn: 0,
                sortOrder: index,
                createdAt: timestamp,
                updatedAt: timestamp,
              })
              .run();
          }
        }
        const preferences = {
          ...profile?.preferences,
          storageTemplateVersion: 1,
        };
        if (profile)
          tx.update(appProfiles)
            .set({ preferences, updatedAt: timestamp })
            .where(eq(appProfiles.id, 'default'))
            .run();
        else
          tx.insert(appProfiles)
            .values({
              id: 'default',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              preferences,
              createdAt: timestamp,
              updatedAt: timestamp,
            })
            .run();
      });
    },
    saveSpace,
    saveContainer,
    undo(edit: StorageEdit) {
      if (edit.kind === 'space')
        saveSpace(edit.before, edit.before.id, edit.after);
      else saveContainer(edit.before, edit.before.id, edit.after);
    },
  };
}
export function storageQueries(database: UserDatabase) {
  return {
    spaces: database
      .select()
      .from(storageSpaces)
      .orderBy(asc(storageSpaces.sortOrder), asc(storageSpaces.name)),
    containers: database
      .select()
      .from(containers)
      .orderBy(asc(containers.sortOrder), asc(containers.name)),
  };
}
