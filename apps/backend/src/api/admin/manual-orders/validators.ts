import { z } from "@medusajs/framework/zod"
import { MANUAL_DELIVERY_STATUSES } from "../../../lib/manual-order-constants"

export const createManualOrderSchema = z.object({
  customer_name: z.string().trim().min(1),
  address: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  region_id: z.string().min(1),
  items: z.array(z.object({
    variant_id: z.string().min(1),
    quantity: z.number().int().positive(),
  })).min(1),
  shipping_fee: z.number().int().nonnegative(),
  deposit: z.number().int().nonnegative(),
})

export const recordManualPaymentSchema = z.object({
  amount: z.number().int().positive(),
})

export const updateManualDeliveryStatusSchema = z.object({
  status: z.enum(MANUAL_DELIVERY_STATUSES),
})
