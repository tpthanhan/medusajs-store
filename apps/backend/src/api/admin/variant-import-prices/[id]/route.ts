import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { z } from "@medusajs/framework/zod"
import type VariantImportPricingService from "../../../../modules/variant-import-pricing/service"
import { VARIANT_IMPORT_PRICING_MODULE } from "../../../../modules/variant-import-pricing"
import { saveVariantImportPriceWorkflow } from "../../../../workflows/save-variant-import-price"
import type { updateVariantImportPriceSchema } from "../validators"

type PriceBody = z.infer<typeof updateVariantImportPriceSchema>

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service = req.scope.resolve<VariantImportPricingService>(VARIANT_IMPORT_PRICING_MODULE)
  const [pricing] = await service.listVariantImportPrices({ variant_id: req.params.id })
  res.json({ pricing: pricing ?? null })
}

export const POST = async (req: MedusaRequest<PriceBody>, res: MedusaResponse) => {
  const { result } = await saveVariantImportPriceWorkflow(req.scope).run({
    input: { ...req.validatedBody, variant_id: req.params.id },
  })
  res.json({ pricing: result })
}
