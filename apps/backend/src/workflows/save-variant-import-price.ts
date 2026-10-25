import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { z } from "@medusajs/framework/zod"
import { MAX_VND_AMOUNT, type updateVariantImportPriceSchema } from "../api/admin/variant-import-prices/validators"
import { VARIANT_IMPORT_PRICING_MODULE } from "../modules/variant-import-pricing"
import { calculateImportedTotal } from "../lib/imported-total"
import type VariantImportPricingService from "../modules/variant-import-pricing/service"

export type ImportPriceInput = z.infer<typeof updateVariantImportPriceSchema> & { variant_id: string }

type PreviousPrice = {
  id: string
  original_price: number | null
  import_shipping_price: number | null
  imported_total_price: number
  is_total_overridden: boolean
}

const saveVariantImportPriceStep = createStep(
  "save-variant-import-price",
  async (input: ImportPriceInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: variants } = await query.graph({
      entity: "variant",
      fields: ["id"],
      filters: { id: input.variant_id },
    })
    if (!variants.length) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Variant not found")
    }
    if (!input.is_total_overridden && input.original_price === null && input.import_shipping_price === null) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Enter an import cost or manually override the total")
    }

    const importedTotal = calculateImportedTotal(input)
    if (importedTotal > MAX_VND_AMOUNT) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Calculated import total exceeds the maximum supported amount")
    }

    const service = container.resolve<VariantImportPricingService>(VARIANT_IMPORT_PRICING_MODULE)
    const [previous] = await service.listVariantImportPrices({ variant_id: input.variant_id })
    const pricing = {
      original_price: input.original_price,
      import_shipping_price: input.import_shipping_price,
      imported_total_price: importedTotal,
      is_total_overridden: input.is_total_overridden,
    }
    const saved = previous
      ? await service.updateVariantImportPrices({ id: previous.id, ...pricing })
      : await service.createVariantImportPrices({ variant_id: input.variant_id, ...pricing })

    return new StepResponse(saved, {
      id: saved.id,
      previous: previous ? {
        id: previous.id,
        original_price: previous.original_price,
        import_shipping_price: previous.import_shipping_price,
        imported_total_price: previous.imported_total_price,
        is_total_overridden: previous.is_total_overridden,
      } : null,
    })
  },
  async (rollback: { id: string; previous: PreviousPrice | null } | undefined, { container }) => {
    if (!rollback) return
    const service = container.resolve<VariantImportPricingService>(VARIANT_IMPORT_PRICING_MODULE)
    if (rollback.previous) {
      await service.updateVariantImportPrices(rollback.previous)
    } else {
      await service.deleteVariantImportPrices(rollback.id)
    }
  }
)

export const saveVariantImportPriceWorkflow = createWorkflow(
  "save-variant-import-price",
  (input: ImportPriceInput) => new WorkflowResponse(saveVariantImportPriceStep(input))
)
