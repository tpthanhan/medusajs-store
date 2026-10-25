import { z } from "@medusajs/framework/zod"
import { MAX_VND_AMOUNT } from "../variant-import-prices/validators"

const vndAmount = z.number().int().nonnegative().max(MAX_VND_AMOUNT)

export const importPricingSchema = z.object({
  products: z.array(z.object({
    title: z.string().trim().min(1),
    variants: z.array(z.object({
      title: z.string().trim().min(1),
      sku: z.string().trim().min(1).nullable(),
      market_price: vndAmount,
      import_pricing: z.object({
        original_price: vndAmount.nullable(),
        import_shipping_price: vndAmount.nullable(),
        imported_total_price: vndAmount,
        is_total_overridden: z.boolean(),
      }).nullable(),
    })).min(1),
  })).min(1),
})
