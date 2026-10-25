import { z } from "@medusajs/framework/zod"

export const MAX_VND_AMOUNT = 2_147_483_647
const vndAmount = z.number().int().nonnegative().max(MAX_VND_AMOUNT)

export const updateVariantImportPriceSchema = z.object({
  original_price: vndAmount.nullable(),
  import_shipping_price: vndAmount.nullable(),
  imported_total_price: vndAmount,
  is_total_overridden: z.boolean(),
})
