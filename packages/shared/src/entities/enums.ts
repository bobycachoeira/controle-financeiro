import { z } from "zod";
import {
  ACCOUNT_TYPES,
  ATTRIBUTIONS,
  BILL_NATURES,
  BILL_PERIODICITIES,
  BILL_STATUS,
  BILL_TYPES,
  CATEGORY_KINDS,
  INVOICE_STATUS,
  MEMBER_INVITE_STATUS,
  ROLES,
  TRANSACTION_STATUS,
  TRANSACTION_TYPES,
} from "../constants/domain";

export const roleSchema = z.enum(ROLES);
export const accountTypeSchema = z.enum(ACCOUNT_TYPES);
export const transactionTypeSchema = z.enum(TRANSACTION_TYPES);
export const transactionStatusSchema = z.enum(TRANSACTION_STATUS);
export const attributionSchema = z.enum(ATTRIBUTIONS);
export const billTypeSchema = z.enum(BILL_TYPES);
export const billNatureSchema = z.enum(BILL_NATURES);
export const billPeriodicitySchema = z.enum(BILL_PERIODICITIES);
export const billStatusSchema = z.enum(BILL_STATUS);
export const categoryKindSchema = z.enum(CATEGORY_KINDS);
export const invoiceStatusSchema = z.enum(INVOICE_STATUS);
export const memberInviteStatusSchema = z.enum(MEMBER_INVITE_STATUS);
