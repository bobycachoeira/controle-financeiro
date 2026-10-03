import { z } from "zod";
import { syncBaseSchema, cents, isoDate, isoDateTime } from "../api/base";
import {
  attributionSchema,
  billNatureSchema,
  billPeriodicitySchema,
  billStatusSchema,
  billTypeSchema,
  invoiceStatusSchema,
  transactionStatusSchema,
  transactionTypeSchema,
} from "./enums";

export const transactionSchema = syncBaseSchema.extend({
  account: z.string(),
  credit_card: z.string().nullable().optional(),
  amount_cents: cents.positive(),
  currency: z.string().default("BRL"),
  type: transactionTypeSchema,
  date: isoDate,
  posting_date: isoDate.nullable().optional(),
  attribution: attributionSchema.default("indefinido"),
  payer_user: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  description: z.string().max(200).default(""),
  status: transactionStatusSchema.default("pago"),
  recurrence: z.string().nullable().optional(),
  installment: z.string().nullable().optional(),
  invoice: z.string().nullable().optional(),
  transfer: z.string().nullable().optional(),
  attachment: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  note: z.string().max(1000).default(""),
  origin: z.enum(["manual", "import", "recurrence"]).default("manual"),
  external_ref: z.string().nullable().optional(),
});

export const installmentSchema = syncBaseSchema.extend({
  installment_group_id: z.string(),
  root_transaction: z.string(),
  number: z.number().int().min(1),
  total: z.number().int().min(1),
  amount_cents: cents.positive(),
  expected_date: isoDate,
  invoice: z.string().nullable().optional(),
  paid: z.boolean().default(false),
});

export const invoiceSchema = syncBaseSchema.extend({
  credit_card: z.string(),
  account: z.string(),
  reference_month: z.string().regex(/^\d{4}-\d{2}$/),
  closing_date: isoDate,
  due_date: isoDate,
  total_cents: cents.default(0),
  paid_cents: cents.default(0),
  status: invoiceStatusSchema.default("aberta"),
  closed_at: isoDateTime.nullable().optional(),
  paid_at: isoDateTime.nullable().optional(),
  note: z.string().max(1000).default(""),
});

export const transferSchema = syncBaseSchema.extend({
  source_account: z.string(),
  destination_account: z.string(),
  amount_cents: cents.positive(),
  currency: z.string().default("BRL"),
  date: isoDate,
  description: z.string().max(200).default(""),
  source_transaction: z.string().nullable().optional(),
  destination_transaction: z.string().nullable().optional(),
});

export const billSchema = syncBaseSchema.extend({
  title: z.string().min(1).max(120),
  amount_cents: cents.min(0),
  currency: z.string().default("BRL"),
  type: billTypeSchema,
  nature: billNatureSchema,
  due_date: isoDate,
  periodicity: billPeriodicitySchema.default("unica"),
  status: billStatusSchema.default("pendente"),
  attribution: z.enum(["meu", "dela", "ambos"]).default("ambos"),
  responsible_user: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  recurrence: z.string().nullable().optional(),
  reminder_config: z.record(z.unknown()).default({}),
  last_generation: isoDate.nullable().optional(),
  next_generation: isoDate.nullable().optional(),
  emission_date: isoDate.nullable().optional(),
  confirmed_at: isoDateTime.nullable().optional(),
});

export type Transaction = z.infer<typeof transactionSchema>;
export type Installment = z.infer<typeof installmentSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type Transfer = z.infer<typeof transferSchema>;
export type Bill = z.infer<typeof billSchema>;
