import { z } from "zod";
import { syncBaseSchema, isoDate, isoDateTime } from "../api/base";
import { memberInviteStatusSchema, roleSchema } from "./enums";

export const householdSchema = syncBaseSchema.extend({
  name: z.string().min(1).max(80),
  base_currency: z.string().default("BRL"),
  supported_currencies: z.array(z.string()).default(["BRL"]),
  settings: z.record(z.unknown()).default({}),
  created_by: z.string(),
});

export const householdMemberSchema = syncBaseSchema.extend({
  user: z.string(),
  role: roleSchema,
  invite_status: memberInviteStatusSchema.default("accepted"),
  permissions: z.record(z.unknown()).default({}),
  joined_at: isoDate.nullable().optional(),
});

export const inviteSchema = z.object({
  id: z.string(),
  household: z.string(),
  role: z.enum(["partner", "teen", "child", "viewer"]),
  email_invited: z.string().email(),
  token_hash: z.string().optional(),
  expires_at: isoDateTime,
  used_at: isoDateTime.nullable().optional(),
  used_by: z.string().nullable().optional(),
  max_uses: z.number().int().default(1),
  single_use: z.boolean().default(true),
  created_by: z.string().optional(),
  created: isoDateTime.optional(),
});

export type Household = z.infer<typeof householdSchema>;
export type HouseholdMember = z.infer<typeof householdMemberSchema>;
export type Invite = z.infer<typeof inviteSchema>;
