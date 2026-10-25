import { z } from "@medusajs/framework/zod"

const MAX_STOCK = 1_000_000_000

export const variantStockSchema = z.object({
  quantity: z.number().int().nonnegative().max(MAX_STOCK),
  location_id: z.string().trim().min(1).optional(),
})
