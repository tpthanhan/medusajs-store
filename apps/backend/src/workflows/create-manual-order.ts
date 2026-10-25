import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import type { IInventoryService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules, OrderStatus, QueryContext } from "@medusajs/framework/utils"
import { createOrderWorkflow } from "@medusajs/medusa/core-flows"
import type { z } from "@medusajs/framework/zod"
import type { createManualOrderSchema } from "../api/admin/manual-orders/validators"
import { MANUAL_DEPOSIT_REFERENCE, MANUAL_ORDER_CURRENCY, MANUAL_ORDER_METADATA_KEY } from "../lib/manual-order-constants"
import { resolveVietnamFulfillment } from "../lib/vietnam-fulfillment"

export type CreateManualOrderInput = z.infer<typeof createManualOrderSchema>

interface PricedVariant {
  id: string
  title: string
  product_id?: string | null
  product?: { title?: string | null } | null
  calculated_price?: { calculated_amount?: number | null } | null
}

interface PreparedManualOrder {
  items: Array<{
    variant_id: string
    product_id?: string
    title: string
    quantity: number
    unit_price: number
    requires_shipping: boolean
  }>
  locationId: string
  shippingOptionId: string
}

const prepareManualOrderStep = createStep(
  "prepare-manual-order",
  async (input: CreateManualOrderInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: regions } = await query.graph({
      entity: "region",
      fields: ["id", "currency_code"],
      filters: { id: input.region_id },
    })
    if (regions[0]?.currency_code !== MANUAL_ORDER_CURRENCY) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Vui lòng chọn khu vực sử dụng VND")
    }

    const { locationId, shippingOptionId } = await resolveVietnamFulfillment(container)

    const { data: variants } = await query.graph({
      entity: "variant",
      fields: ["id", "title", "product_id", "product.title", "calculated_price.calculated_amount"],
      filters: { id: input.items.map((item) => item.variant_id) },
      context: { calculated_price: QueryContext({ currency_code: MANUAL_ORDER_CURRENCY, region_id: input.region_id }) },
    })
    const byId = new Map((variants as unknown as PricedVariant[]).map((variant) => [variant.id, variant]))
    const items = input.items.map(({ variant_id, quantity }) => {
      const variant = byId.get(variant_id)
      const amount = variant?.calculated_price?.calculated_amount
      if (!variant || typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, `Biến thể ${variant_id} chưa có giá bán VND`)
      }
      return {
        variant_id,
        product_id: variant.product_id ?? undefined,
        title: variant.product?.title ?? variant.title,
        quantity,
        unit_price: amount,
        requires_shipping: true,
      }
    })
    return new StepResponse<PreparedManualOrder>({ items, locationId, shippingOptionId })
  }
)

interface ReserveInput {
  orderId: string
  locationId: string
}

interface ReservableOrderItem {
  id: string
  variant_id?: string | null
  quantity: number
}

const reserveManualInventoryStep = createStep(
  "reserve-manual-inventory",
  async ({ orderId, locationId }: ReserveInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "orders",
      fields: ["id", "items.id", "items.variant_id", "items.quantity"],
      filters: { id: orderId },
    })
    const orderItems = (orders[0]?.items ?? []) as ReservableOrderItem[]
    const variantIds = orderItems.map((item) => item.variant_id).filter((id): id is string => Boolean(id))
    if (variantIds.length === 0) {
      return new StepResponse<string[]>([], [])
    }

    const { data: variants } = await query.graph({
      entity: "variant",
      fields: ["id", "manage_inventory", "inventory_items.inventory_item_id"],
      filters: { id: variantIds },
    })
    const byVariant = new Map(variants.map((variant) => [variant.id, variant]))

    const reservationInput = orderItems.flatMap((item) => {
      const variant = item.variant_id ? byVariant.get(item.variant_id) : undefined
      if (!variant?.manage_inventory) return []
      const inventoryItemId = variant.inventory_items?.[0]?.inventory_item_id
      if (!inventoryItemId) return []
      return [{
        inventory_item_id: inventoryItemId,
        location_id: locationId,
        quantity: Number(item.quantity),
        line_item_id: item.id,
      }]
    })
    if (reservationInput.length === 0) {
      return new StepResponse<string[]>([], [])
    }

    const inventoryService = container.resolve<IInventoryService>(Modules.INVENTORY)
    const created = await inventoryService.createReservationItems(reservationInput)
    const ids = created.map((reservation) => reservation.id)
    return new StepResponse(ids, ids)
  },
  async (ids, { container }) => {
    if (!ids?.length) return
    const inventoryService = container.resolve<IInventoryService>(Modules.INVENTORY)
    await inventoryService.deleteReservationItems(ids)
  }
)

export const createManualOrderWorkflow = createWorkflow(
  "create-manual-order",
  (input: CreateManualOrderInput) => {
    const prepared = prepareManualOrderStep(input)
    const orderInput = transform({ input, prepared }, ({ input, prepared }) => ({
      shipping_address: {
        first_name: input.customer_name,
        address_1: input.address,
        phone: input.phone,
        country_code: "vn",
      },
      region_id: input.region_id,
      currency_code: MANUAL_ORDER_CURRENCY,
      status: OrderStatus.PENDING,
      items: prepared.items,
      shipping_methods: [
        {
          name: "Phí vận chuyển",
          amount: input.shipping_fee,
          shipping_option_id: prepared.shippingOptionId,
        },
      ],
      transactions: input.deposit > 0
        ? [{ amount: input.deposit, currency_code: MANUAL_ORDER_CURRENCY, reference: MANUAL_DEPOSIT_REFERENCE }]
        : [],
      metadata: { [MANUAL_ORDER_METADATA_KEY]: true },
      no_notification: true,
    }))
    const order = createOrderWorkflow.runAsStep({ input: orderInput })
    const reserveInput = transform({ order, prepared }, ({ order, prepared }) => ({
      orderId: order.id,
      locationId: prepared.locationId,
    }))
    reserveManualInventoryStep(reserveInput)
    return new WorkflowResponse(order)
  }
)
