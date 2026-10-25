import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import type { z } from "@medusajs/framework/zod"
import { saveVariantImportPriceWorkflow } from "../../../../workflows/save-variant-import-price"
import { setVariantStockWorkflow } from "../../../../workflows/set-variant-stock"
import { resolveHcmLocationId } from "../../../../lib/hcm-location"
import type { importPricingSchema } from "../validators"

type ImportBody = z.infer<typeof importPricingSchema>

const extractErrorMessage = (cause: unknown): string => {
  if (cause instanceof Error && cause.message) return cause.message
  if (typeof cause === "string" && cause) return cause
  if (cause && typeof cause === "object" && "message" in cause) {
    const message = (cause as { message?: unknown }).message
    if (typeof message === "string" && message) return message
  }
  return "Lỗi không xác định"
}

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
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const hasStock = products.some((draft) => draft.variants.some((variant) => variant.stock != null))
  const locationId = hasStock ? await resolveHcmLocationId(query) : null

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
            ...(draft.brand ? { metadata: { brand: draft.brand } } : {}),
            options: draft.options.map((option) => ({ title: option.title, values: option.values })),
            variants: draft.variants.map((variant) => ({
              title: variant.title,
              ...(variant.sku ? { sku: variant.sku } : {}),
              options: variant.options,
              prices: [{ currency_code: "vnd", amount: variant.market_price }],
            })),
          }],
        } as never,
      })

      const product = (result as Array<{ id: string; variants?: Array<{ id: string; title: string }> }>)[0]
      for (const draftVariant of draft.variants) {
        const variant = product.variants?.find((item) => item.title === draftVariant.title)
        if (!variant) continue
        if (draftVariant.import_pricing) {
          await saveVariantImportPriceWorkflow(req.scope).run({
            input: { variant_id: variant.id, ...draftVariant.import_pricing },
          })
        }
        if (draftVariant.stock != null && locationId) {
          await setVariantStockWorkflow(req.scope).run({
            input: { variant_id: variant.id, quantity: draftVariant.stock, location_id: locationId },
          })
        }
      }
      created.push({ title: draft.title, id: product.id, variants: draft.variants.length })
    } catch (cause) {
      failed.push({ title: draft.title, error: extractErrorMessage(cause) })
    }
  }

  res.json({ created, failed, created_count: created.length, failed_count: failed.length })
}
