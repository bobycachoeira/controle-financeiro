import { z } from "zod";
import { cents, isoDate, isoMonth, syncBaseSchema } from "../api/base";
import { attributionSchema, transactionStatusSchema, transactionTypeSchema } from "./enums";

export const RECURRENCE_TARGETS = ["transaction", "bill"] as const;
export const BUDGET_PERIODS = ["mensal", "trimestral", "anual"] as const;

export const recurrenceTemplateSchema = z.object({
  amount_cents: z.number().int().min(0),
  type: transactionTypeSchema,
  account: z.string().nullable().optional(),
  credit_card: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  attribution: attributionSchema.default("indefinido"),
  nature: z.enum(["entrada", "saida"]).nullable().optional(),
  description: z.string().max(200).default(""),
  payer_user: z.string().nullable().optional(),
  emission_day: z.number().int().min(1).max(31).nullable().optional(),
  due_day: z.number().int().min(1).max(31).nullable().optional(),
  default_amount_cents: z.number().int().min(0).nullable().optional(),
  confirm_required: z.boolean().optional(),
});

export const recurrenceSchema = syncBaseSchema
  .extend({
    name: z.string().min(1).max(80),
    rrule: z.string().refine((value) => /^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/i.test(value), {
      message: "RRULE inválida",
    }),
    timezone: z.string().default("America/Sao_Paulo"),
    start_date: isoDate,
    end_date: isoDate.nullable().optional(),
    count: z.number().int().min(1).nullable().optional(),
    active: z.boolean().default(true),
    last_run: isoDate.nullable().optional(),
    next_run: isoDate.nullable().optional(),
    target: z.enum(RECURRENCE_TARGETS).default("transaction"),
    creates_status: transactionStatusSchema.default("a_pagar"),
    template: recurrenceTemplateSchema,
  })
  .superRefine((value, ctx) => {
    if (value.target === "bill" && !value.template.nature) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Conta recorrente exige natureza" });
    }
    if (value.target === "transaction" && !value.template.account) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Lançamento recorrente exige conta" });
    }
    if (value.target === "transaction" && value.template.amount_cents <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valor deve ser maior que zero" });
    }
    if (value.target === "bill" && !value.template.confirm_required && value.template.amount_cents <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valor deve ser maior que zero" });
    }
  });

export const budgetCategorySchema = z.object({
  category: z.string(),
  limit_cents: cents.optional(),
});

export const budgetSchema = syncBaseSchema.extend({
  name: z.string().min(1).max(80),
  period: z.enum(BUDGET_PERIODS).default("mensal"),
  currency: z.string().default("BRL"),
  total_cents: cents.positive(),
  alert_pct: z.number().int().min(1).max(100).default(80),
  active: z.boolean().default(true),
  reference_month: isoMonth,
  categories: z.array(budgetCategorySchema).min(1),
});

export type Recurrence = z.infer<typeof recurrenceSchema>;
export type Budget = z.infer<typeof budgetSchema>;
export type RecurrenceTemplate = z.infer<typeof recurrenceTemplateSchema>;
