import { z } from "zod";
import { syncBaseSchema, cents } from "../api/base";
import { accountTypeSchema, categoryKindSchema } from "./enums";

export const accountSchema = syncBaseSchema.extend({
  name: z.string().min(1).max(80),
  type: accountTypeSchema,
  currency: z.string().default("BRL"),
  initial_balance_cents: cents.default(0),
  include_in_total: z.boolean().default(true),
  active: z.boolean().default(true),
  order: z.number().int().default(0),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
});

export const creditCardSchema = syncBaseSchema.extend({
  account: z.string(),
  bank: z.string().nullable().optional(),
  limit_cents: cents.min(0).default(0),
  currency: z.string().default("BRL"),
  closing_day: z.number().int().min(1).max(31),
  due_day: z.number().int().min(1).max(31),
  purchase_at_posting: z.boolean().default(false),
  uses_account_balance_for_invoice: z.boolean().default(false),
  active: z.boolean().default(true),
});

export const categorySchema = syncBaseSchema.extend({
  name: z.string().min(1).max(60),
  kind: categoryKindSchema,
  group: z.string().min(1).max(60),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  system: z.boolean().default(false),
  active: z.boolean().default(true),
  order: z.number().int().default(0),
});

export type Account = z.infer<typeof accountSchema>;
export type CreditCard = z.infer<typeof creditCardSchema>;
export type Category = z.infer<typeof categorySchema>;
