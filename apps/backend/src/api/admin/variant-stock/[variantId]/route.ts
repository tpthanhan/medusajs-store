import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { z } from "@medusajs/framework/zod"
import { resolveHcmLocationId } from "../../../../lib/hcm-location"
import { setVariantStockWorkflow } from "../../../../workflows/set-variant-stock"
import type { variantStockSchema } from "./validators"

type StockBody = z.infer<typeof variantStockSchema>

const readVariantStock = async (scope: MedusaRequest["scope"], variantId: string, locationId: string) => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: variants } = await query.graph({
    entity: "variant",
    fields: ["id", "manage_inventory", "inventory_items.inventory_item_id"],
    filters: { id: variantId },
  })
  const variant = variants[0]
  if (!variant) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Không tìm thấy biến thể ${variantId}.`)
  }
  const inventoryItemId = variant.inventory_items?.[0]?.inventory_item_id as string | undefined
  if (!inventoryItemId) {
    return { manage_inventory: Boolean(variant.manage_inventory), quantity: null, location_id: locationId }
  }
  const { data: items } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "location_levels.location_id", "location_levels.stocked_quantity"],
    filters: { id: inventoryItemId },
  })
  const levels = (items[0]?.location_levels ?? []) as Array<{ location_id: string; stocked_quantity: number }>
  const level = levels.find((item) => item?.location_id === locationId)
  return {
    manage_inventory: Boolean(variant.manage_inventory),
    quantity: level ? level.stocked_quantity : null,
    location_id: locationId,
  }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const locationId = await resolveHcmLocationId(query)
  res.json(await readVariantStock(req.scope, req.params.variantId, locationId))
}

export const POST = async (req: MedusaRequest<StockBody>, res: MedusaResponse) => {
  const variantId = req.params.variantId
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const locationId = req.validatedBody.location_id ?? (await resolveHcmLocationId(query))

  await setVariantStockWorkflow(req.scope).run({
    input: { variant_id: variantId, quantity: req.validatedBody.quantity, location_id: locationId },
  })

  res.json(await readVariantStock(req.scope, variantId, locationId))
}
