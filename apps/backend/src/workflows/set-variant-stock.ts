import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import type { IInventoryService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { resolveHcmLocationId } from "../lib/hcm-location"

export interface SetVariantStockInput {
  variant_id: string
  quantity: number
  location_id?: string
}

interface StockCompensation {
  inventory_item_id: string
  location_id: string
  previous_quantity: number | null
}

const setVariantStockStep = createStep(
  "set-variant-stock",
  async ({ variant_id, quantity, location_id }: SetVariantStockInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const { data: variants } = await query.graph({
      entity: "variant",
      fields: ["id", "inventory_items.inventory_item_id"],
      filters: { id: variant_id },
    })
    const inventoryItemId = variants[0]?.inventory_items?.[0]?.inventory_item_id as string | undefined
    if (!inventoryItemId) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Biến thể ${variant_id} chưa có inventory item (có thể đang tắt quản lý tồn kho).`
      )
    }

    const locationId = location_id ?? (await resolveHcmLocationId(query))

    const { data: items } = await query.graph({
      entity: "inventory_item",
      fields: ["id", "location_levels.id", "location_levels.location_id", "location_levels.stocked_quantity"],
      filters: { id: inventoryItemId },
    })
    const levels = (items[0]?.location_levels ?? []) as Array<{ id: string; location_id: string; stocked_quantity: number }>
    const existing = levels.find((level) => level?.location_id === locationId)

    const inventory = container.resolve<IInventoryService>(Modules.INVENTORY)
    if (existing) {
      await inventory.updateInventoryLevels([{ inventory_item_id: inventoryItemId, location_id: locationId, stocked_quantity: quantity }])
    } else {
      await inventory.createInventoryLevels([{ inventory_item_id: inventoryItemId, location_id: locationId, stocked_quantity: quantity }])
    }

    return new StepResponse<null, StockCompensation>(null, {
      inventory_item_id: inventoryItemId,
      location_id: locationId,
      previous_quantity: existing ? existing.stocked_quantity : null,
    })
  },
  async (compensation, { container }) => {
    if (!compensation) return
    const inventory = container.resolve<IInventoryService>(Modules.INVENTORY)
    if (compensation.previous_quantity === null) {
      await inventory.deleteInventoryLevel(compensation.inventory_item_id, compensation.location_id)
    } else {
      await inventory.updateInventoryLevels([
        { inventory_item_id: compensation.inventory_item_id, location_id: compensation.location_id, stocked_quantity: compensation.previous_quantity },
      ])
    }
  }
)

export const setVariantStockWorkflow = createWorkflow(
  "set-variant-stock",
  (input: SetVariantStockInput) => {
    setVariantStockStep(input)
    return new WorkflowResponse(input)
  }
)
