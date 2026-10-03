import { z } from "zod";
import { syncBaseSchema } from "../api/base";
import { isoDate } from "../api/base";

export const exchangeRateSchema = syncBaseSchema.extend({
  currency: z.string().min(1).max(8),
  date: isoDate,
  rate_micros: z.number().int().positive(),
});

export type ExchangeRate = z.infer<typeof exchangeRateSchema>;
