import { z } from 'zod';
import { isCalendarDate } from '@/features/inventory/domain/inventory';

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
export const CURRENT_SCHEMA_VERSION = 3;
const id = z.uuid();
const timestamp = z.iso.datetime({ offset: true });
const date = z.string().refine(isCalendarDate).nullable();
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const integer = z.number().int().min(0).max(1_000_000);
const decimal = z.string().regex(/^\d{1,9}(\.\d{1,6})?$/);
const name = (length: number) =>
  z
    .string()
    .min(1)
    .max(length)
    .refine((v) => v.trim().length > 0);
const times = { createdAt: timestamp, updatedAt: timestamp };
const batchSchema = z
  .object({
    id,
    name: name(100),
    containerId: id,
    amount: decimal.nullable(),
    unit: z.enum(['g', 'kg', 'ml', 'L', '개', '팩', '봉', '병', '캔']),
    quantityKnown: z.boolean(),
    purchasedOn: date,
    expiresOn: date,
    notes: z.string().max(1000),
    status: z.enum(['available', 'exhausted', 'discarded', 'deleted']),
    lastOperationId: id,
    ...times,
  })
  .strict()
  .superRefine((batch, ctx) => {
    if (
      batch.quantityKnown !== (batch.amount !== null) ||
      (batch.status === 'exhausted' && batch.amount !== '0') ||
      (batch.status === 'available' &&
        batch.amount !== null &&
        Number(batch.amount) <= 0)
    ) {
      ctx.addIssue({ code: 'custom', message: 'Invalid inventory quantity.' });
    }
  });
const dataSchema = z
  .object({
    profiles: z
      .array(
        z
          .object({
            id: z.literal('default'),
            locale: z.string().max(60),
            timezone: z.string().max(100),
            preferences: z.record(z.string(), z.json()),
            allergyFlags: z.array(z.string().max(200)).max(100),
            ...times,
          })
          .strict(),
      )
      .max(1),
    spaces: z
      .array(
        z
          .object({
            id,
            name: name(60),
            type: z.enum(['refrigerator', 'freezer', 'pantry']),
            sortOrder: integer,
            ...times,
          })
          .strict(),
      )
      .max(1000),
    containers: z
      .array(
        z
          .object({
            id,
            spaceId: id,
            parentId: id.nullable(),
            name: name(60),
            gridRow: integer,
            gridColumn: integer,
            gridWidth: integer.min(1),
            gridHeight: integer.min(1),
            sortOrder: integer,
            ...times,
          })
          .strict(),
      )
      .max(10000),
    batches: z.array(batchSchema).max(50000),
    transactions: z
      .array(
        z
          .object({
            sequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
            id,
            operationId: id,
            batchId: id,
            type: z.enum(['create', 'update', 'delete', 'undo']),
            amountDelta: z
              .string()
              .regex(/^-?\d{1,9}(\.\d{1,6})?$/)
              .nullable(),
            before: batchSchema.nullable(),
            after: batchSchema,
            reversesOperationId: id.nullable(),
            createdAt: timestamp,
          })
          .strict(),
      )
      .max(100000),
  })
  .strict();
export type BackupData = z.infer<typeof dataSchema>;
export interface BackupManifest {
  format: 'fridge-flow-backup';
  format_version: 1;
  schema_version: number;
  app_version: string;
  owner_sub_sha256: string;
  created_at: string;
  record_counts: Record<keyof BackupData, number>;
  data_sha256: string;
}
const counts = z
  .object({
    profiles: integer,
    spaces: integer,
    containers: integer,
    batches: integer,
    transactions: integer,
  })
  .strict();
const manifestSchema = z
  .object({
    format: z.literal('fridge-flow-backup'),
    format_version: z.literal(1),
    schema_version: z.number().int().min(1),
    app_version: z.string().min(1).max(40),
    owner_sub_sha256: hash,
    created_at: timestamp,
    record_counts: counts,
    data_sha256: hash,
  })
  .strict();
export type PreparedBackup = {
  manifest: BackupManifest;
  data: BackupData;
  text: string;
};
export type Sha256 = (value: string) => Promise<string>;
export class BackupError extends Error {}
export function recordCounts(data: BackupData) {
  return {
    profiles: data.profiles.length,
    spaces: data.spaces.length,
    containers: data.containers.length,
    batches: data.batches.length,
    transactions: data.transactions.length,
  };
}
export function validateBackupData(data: unknown): BackupData {
  const result = dataSchema.safeParse(data);
  if (!result.success)
    throw new BackupError('백업의 데이터 형식이 올바르지 않습니다.');
  const parsed = result.data;
  const spaceIds = new Set(parsed.spaces.map((s) => s.id));
  const containers = new Map(parsed.containers.map((c) => [c.id, c]));
  const batches = new Set(parsed.batches.map((b) => b.id));
  for (const container of parsed.containers) {
    if (!spaceIds.has(container.spaceId))
      throw new BackupError('백업의 위치 연결이 올바르지 않습니다.');
    const visited = new Set<string>([container.id]);
    let parentId = container.parentId;
    while (parentId) {
      const parent = containers.get(parentId);
      if (
        !parent ||
        parent.spaceId !== container.spaceId ||
        visited.has(parentId)
      )
        throw new BackupError('백업의 컨테이너 계층이 올바르지 않습니다.');
      visited.add(parentId);
      parentId = parent.parentId;
    }
  }
  for (const batch of parsed.batches)
    if (!containers.has(batch.containerId))
      throw new BackupError('백업의 재료 위치가 올바르지 않습니다.');
  const operations = new Map(
    parsed.transactions.map((t) => [t.operationId, t]),
  );
  for (const transaction of parsed.transactions) {
    if (
      !batches.has(transaction.batchId) ||
      transaction.after.id !== transaction.batchId ||
      transaction.after.lastOperationId !== transaction.operationId ||
      (transaction.before && transaction.before.id !== transaction.batchId)
    )
      throw new BackupError('백업의 변경 기록이 올바르지 않습니다.');
    if (transaction.type === 'undo') {
      const original =
        transaction.reversesOperationId &&
        operations.get(transaction.reversesOperationId);
      if (
        !original ||
        original.type === 'undo' ||
        original.batchId !== transaction.batchId ||
        original.sequence >= transaction.sequence
      )
        throw new BackupError('백업의 실행 취소 기록이 올바르지 않습니다.');
    } else if (transaction.reversesOperationId !== null)
      throw new BackupError('백업의 변경 기록이 올바르지 않습니다.');
  }
  for (const batch of parsed.batches) {
    const operation = operations.get(batch.lastOperationId);
    if (
      !operation ||
      operation.batchId !== batch.id ||
      JSON.stringify(operation.after) !== JSON.stringify(batch)
    )
      throw new BackupError('재료와 마지막 변경 기록이 일치하지 않습니다.');
  }
  return parsed;
}
export async function encodeBackup(
  data: BackupData,
  owner: string,
  sha256: Sha256,
  createdAt = new Date().toISOString(),
): Promise<PreparedBackup> {
  const valid = validateBackupData(data);
  const serialized = JSON.stringify(valid);
  const manifest: BackupManifest = {
    format: 'fridge-flow-backup',
    format_version: 1,
    schema_version: CURRENT_SCHEMA_VERSION,
    app_version: '0.1.0',
    owner_sub_sha256: owner,
    created_at: createdAt,
    record_counts: recordCounts(valid),
    data_sha256: await sha256(serialized),
  };
  const text = JSON.stringify({ manifest, data: serialized });
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
    throw new BackupError('백업 크기가 10MB를 초과합니다.');
  return { manifest, data: valid, text };
}
export async function decodeBackup(
  text: string,
  owner: string,
  sha256: Sha256,
): Promise<PreparedBackup> {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
    throw new BackupError('10MB 이하의 백업 파일만 열 수 있습니다.');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new BackupError('백업 파일을 읽을 수 없습니다.');
  }
  const result = z
    .object({ manifest: manifestSchema, data: z.string() })
    .strict()
    .safeParse(value);
  if (!result.success)
    throw new BackupError('지원하는 Fridge Flow 백업 파일이 아닙니다.');
  const { manifest, data } = result.data;
  if (manifest.schema_version > CURRENT_SCHEMA_VERSION)
    throw new BackupError(
      '더 최신 앱에서 만든 백업입니다. 앱을 업데이트해 주세요.',
    );
  if (manifest.owner_sub_sha256 !== owner)
    throw new BackupError('현재 Google 계정의 백업만 복원할 수 있습니다.');
  if ((await sha256(data)) !== manifest.data_sha256)
    throw new BackupError('백업 파일이 손상되었습니다.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    throw new BackupError('백업 데이터가 손상되었습니다.');
  }
  if (manifest.schema_version === 1) {
    const legacy = z
      .object({
        profiles: z.array(z.unknown()),
        spaces: z.array(z.unknown()),
        containers: z.array(z.unknown()),
      })
      .strict()
      .safeParse(parsed);
    if (!legacy.success)
      throw new BackupError('이전 버전 백업의 형식이 올바르지 않습니다.');
    parsed = { ...legacy.data, batches: [], transactions: [] };
  }
  const valid = validateBackupData(parsed);
  const actual = recordCounts(valid);
  if (
    Object.keys(actual).some(
      (key) =>
        actual[key as keyof BackupData] !==
        manifest.record_counts[key as keyof BackupData],
    )
  )
    throw new BackupError('백업 레코드 수가 일치하지 않습니다.');
  return { manifest, data: valid, text };
}
export function backupFilename(createdAt: string) {
  return `fridge-flow-${createdAt.replace(/[-:]/g, '').replace('T', '-').slice(0, 15)}.ffbackup`;
}
