import { z } from "@medusajs/framework/zod"

export const createManualOrderSchema = z.object({
  email: z.email(),
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
