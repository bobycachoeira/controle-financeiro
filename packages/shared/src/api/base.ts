import { z } from "zod";

export const isoDateTime = z.string().datetime({ offset: true }).or(z.string().datetime());
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const isoMonth = z.string().regex(/^\d{4}-\d{2}$/);
export const nullableDateTime = isoDateTime.nullable();
export const cents = z.number().int();

export const syncBaseSchema = z.object({
  id: z.string(),
  household: z.string(),
  sync_id: z.string().uuid(),
  updated_by: z.string().nullable().optional(),
  deleted_at: nullableDateTime.optional(),
  created: isoDateTime.optional(),
  updated: isoDateTime.optional(),
});

export type SyncBase = z.infer<typeof syncBaseSchema>;

export const errorDetailSchema = z.record(z.unknown());

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(errorDetailSchema).optional(),
  }),
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

export const acceptedSchema = z.object({ ok: z.literal(true) });
