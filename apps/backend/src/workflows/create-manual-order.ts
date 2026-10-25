import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError, OrderStatus, QueryContext } from "@medusajs/framework/utils"
import { createOrderWorkflow } from "@medusajs/medusa/core-flows"
import type { z } from "@medusajs/framework/zod"
import type { createManualOrderSchema } from "../api/admin/manual-orders/validators"
import { MANUAL_DEPOSIT_REFERENCE, MANUAL_ORDER_CURRENCY, MANUAL_ORDER_METADATA_KEY } from "../lib/manual-order-constants"

export type CreateManualOrderInput = z.infer<typeof createManualOrderSchema>

interface PricedVariant {
  id: string
  title: string
  product_id?: string | null
  product?: { title?: string | null } | null
  calculated_price?: { calculated_amount?: number | null } | null
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
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Select a VND region")
    }

    const { data: variants } = await query.graph({
      entity: "variant",
      fields: ["id", "title", "product_id", "product.title", "calculated_price.calculated_amount"],
      filters: { id: input.items.map((item) => item.variant_id) },
      context: { calculated_price: QueryContext({ currency_code: MANUAL_ORDER_CURRENCY }) },
    })
    const byId = new Map((variants as unknown as PricedVariant[]).map((variant) => [variant.id, variant]))
    const items = input.items.map(({ variant_id, quantity }) => {
      const variant = byId.get(variant_id)
      const amount = variant?.calculated_price?.calculated_amount
      if (!variant || typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, `Variant ${variant_id} has no VND market price`)
      }
      return {
        variant_id,
        product_id: variant.product_id ?? undefined,
        title: variant.product?.title ?? variant.title,
        quantity,
        unit_price: amount,
        requires_shipping: false,
      }
    })
    return new StepResponse(items)
  }
)

export const createManualOrderWorkflow = createWorkflow(
  "create-manual-order",
  (input: CreateManualOrderInput) => {
    const items = prepareManualOrderStep(input)
    const orderInput = transform({ input, items }, ({ input, items }) => ({
      email: input.email,
      region_id: input.region_id,
      currency_code: MANUAL_ORDER_CURRENCY,
      status: OrderStatus.PENDING,
      items,
      shipping_methods: input.shipping_fee > 0
        ? [{ name: "Manual shipping fee", amount: input.shipping_fee }]
        : [],
      transactions: input.deposit > 0
        ? [{ amount: input.deposit, currency_code: MANUAL_ORDER_CURRENCY, reference: MANUAL_DEPOSIT_REFERENCE }]
        : [],
      metadata: { [MANUAL_ORDER_METADATA_KEY]: true },
      no_notification: true,
    }))
    const order = createOrderWorkflow.runAsStep({ input: orderInput })
    return new WorkflowResponse(order)
  }
)
