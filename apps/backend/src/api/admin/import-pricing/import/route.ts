import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import type { z } from "@medusajs/framework/zod"
import { saveVariantImportPriceWorkflow } from "../../../../workflows/save-variant-import-price"
import type { importPricingSchema } from "../validators"

type ImportBody = z.infer<typeof importPricingSchema>

const resolveDefaults = async (scope: MedusaRequest["scope"]) => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: salesChannels } = await query.graph({ entity: "sales_channel", fields: ["id"] })
  const { data: shippingProfiles } = await query.graph({ entity: "shipping_profile", fields: ["id", "type"] })
  const salesChannel = salesChannels[0]
  const shippingProfile = shippingProfiles.find((profile) => profile.type === "default") ?? shippingProfiles[0]
  if (!salesChannel || !shippingProfile) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Chưa có sales channel hoặc shipping profile. Hãy chạy seed dữ liệu ban đầu.")
  }
  return { salesChannelId: salesChannel.id as string, shippingProfileId: shippingProfile.id as string }
}

export const POST = async (req: MedusaRequest<ImportBody>, res: MedusaResponse) => {
  const { products } = req.validatedBody
  const { salesChannelId, shippingProfileId } = await resolveDefaults(req.scope)

  const created: Array<{ title: string; id: string; variants: number }> = []
  const failed: Array<{ title: string; error: string }> = []

  for (const draft of products) {
    try {
      const { result } = await createProductsWorkflow(req.scope).run({
        input: {
          products: [{
            title: draft.title,
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: shippingProfileId,
            sales_channels: [{ id: salesChannelId }],
            options: [{ title: "Variant", values: draft.variants.map((variant) => variant.title) }],
            variants: draft.variants.map((variant) => ({
              title: variant.title,
              ...(variant.sku ? { sku: variant.sku } : {}),
              options: { Variant: variant.title },
              prices: [{ currency_code: "vnd", amount: variant.market_price }],
            })),
          }],
        } as never,
      })

      const product = (result as Array<{ id: string; variants?: Array<{ id: string; title: string }> }>)[0]
      for (const draftVariant of draft.variants) {
        if (!draftVariant.import_pricing) continue
        const variant = product.variants?.find((item) => item.title === draftVariant.title)
        if (!variant) continue
        await saveVariantImportPriceWorkflow(req.scope).run({
          input: { variant_id: variant.id, ...draftVariant.import_pricing },
        })
      }
      created.push({ title: draft.title, id: product.id, variants: draft.variants.length })
    } catch (cause) {
      failed.push({ title: draft.title, error: cause instanceof Error ? cause.message : "Lỗi không xác định" })
    }
  }

  res.json({ created, failed, created_count: created.length, failed_count: failed.length })
}
