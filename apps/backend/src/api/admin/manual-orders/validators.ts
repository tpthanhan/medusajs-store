import { z } from "@medusajs/framework/zod"
import { MANUAL_DELIVERY_STATUSES, MANUAL_NOTE_MAX_LENGTH } from "../../../lib/manual-order-constants"
import { MAX_VND_AMOUNT } from "../variant-import-prices/validators"

export const createManualOrderSchema = z.object({
  customer_name: z.string().trim().min(1),
  address: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  region_id: z.string().min(1),
  items: z.array(z.object({
    variant_id: z.string().min(1),
    quantity: z.number().int().positive(),
    unit_price: z.number().int().nonnegative().max(MAX_VND_AMOUNT).nullish(),
  })).min(1),
  shipping_fee: z.number().int().nonnegative(),
  deposit: z.number().int().nonnegative(),
  note: z.string().trim().max(MANUAL_NOTE_MAX_LENGTH).optional(),
})

export const updateManualOrderNoteSchema = z.object({
  note: z.string().trim().max(MANUAL_NOTE_MAX_LENGTH),
})

export const recordManualPaymentSchema = z.object({
  amount: z.number().int().positive(),
})

export const updateManualDeliveryStatusSchema = z.object({
  status: z.enum(MANUAL_DELIVERY_STATUSES),
})
