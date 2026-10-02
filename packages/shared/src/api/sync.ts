import { z } from "zod";
import { SYNC_ENTITY_NAMES, SYNC_OPERATIONS, SYNC_RESULTS } from "../constants/sync";
import { isoDateTime } from "./base";

export const entityNameSchema = z.enum(SYNC_ENTITY_NAMES);
export const syncOperationSchema = z.enum(SYNC_OPERATIONS);
export const syncResultStatusSchema = z.enum(SYNC_RESULTS);

export const syncOperationItemSchema = z.object({
  sync_id: z.string().uuid(),
  entity: entityNameSchema,
  operation: syncOperationSchema,
  entity_id: z.string().nullable().optional(),
  payload: z.record(z.unknown()).optional(),
  client_ts: isoDateTime,
});

export const pushRequestSchema = z.object({
  household: z.string(),
  operations: z.array(syncOperationItemSchema).min(1).max(100),
});

export const operationResultSchema = z.object({
  sync_id: z.string(),
  entity: entityNameSchema,
  status: syncResultStatusSchema,
  remote_id: z.string().nullable().optional(),
  conflict: z.boolean().default(false),
  code: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  record: z.record(z.unknown()).nullable().optional(),
});

export const pushResponseSchema = z.object({
  results: z.array(operationResultSchema),
  server_seq: z.number().int(),
});

export const pullChangeSchema = z.object({
  entity: entityNameSchema,
  id: z.string(),
  seq: z.number().int(),
  deleted: z.boolean().default(false),
  record: z.record(z.unknown()).nullable().optional(),
});

export const pullResponseSchema = z.object({
  server_seq: z.number().int(),
  has_more: z.boolean(),
  changes: z.array(pullChangeSchema),
});

export type SyncOperationItem = z.infer<typeof syncOperationItemSchema>;
export type PushRequest = z.infer<typeof pushRequestSchema>;
export type OperationResult = z.infer<typeof operationResultSchema>;
export type PushResponse = z.infer<typeof pushResponseSchema>;
export type PullChange = z.infer<typeof pullChangeSchema>;
export type PullResponse = z.infer<typeof pullResponseSchema>;
