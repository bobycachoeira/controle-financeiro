import { z } from "zod";
import { cents, isoDate, syncBaseSchema } from "../api/base";
import { attributionSchema } from "./enums";

export const goalEntrySchema = z.object({
  id: z.string().min(1).max(60),
  /** Positivo = guardou; negativo = resgatou. */
  amount_cents: cents,
  date: isoDate,
  note: z.string().max(200).default(""),
  /** Conta de origem (guardar) ou destino (resgatar), quando o dinheiro se move. */
  account: z.string().nullable().optional(),
  /** Transferência criada para o movimento, quando houver. */
  transfer: z.string().nullable().optional(),
});

export const goalSchema = syncBaseSchema.extend({
  name: z.string().min(1).max(80),
  target_cents: cents.positive(),
  deadline: isoDate.nullable().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  owner: attributionSchema.default("indefinido"),
  active: z.boolean().default(true),
  /** Conta interna ("cofrinho") usada quando o dinheiro é movimentado. */
  cofrinho_account: z.string().nullable().optional(),
  entries: z.array(goalEntrySchema).max(500).default([]),
});

export type GoalEntry = z.infer<typeof goalEntrySchema>;
export type Goal = z.infer<typeof goalSchema>;
