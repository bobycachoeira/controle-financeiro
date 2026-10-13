import { z } from "zod";

// Aceita "YYYY-MM-DD", ISO com "T" (com Z ou offset) e o formato do PocketBase
// ("YYYY-MM-DD HH:MM:SS.sssZ"), que é o que a API retorna.
const dateLike = z
  .string()
  .regex(
    /^(\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?)?$/,
  );

export const isoDateTime = dateLike;
export const isoDate = dateLike;
export const isoMonth = z.string().regex(/^\d{4}-\d{2}$/);
export const nullableDateTime = z.union([dateLike, z.literal("")]).nullable();
export const cents = z.number().int();

export const syncBaseSchema = z.object({
  id: z.string(),
  household: z.string(),
  // sync_id é uma chave de idempotência: o cliente usa UUID, mas registros
  // criados no servidor podem usar string aleatória.
  sync_id: z.string().min(1).max(100),
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
