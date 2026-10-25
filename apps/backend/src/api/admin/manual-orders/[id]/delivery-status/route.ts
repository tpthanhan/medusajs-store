import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
  markOrderFulfillmentAsDeliveredWorkflow,
} from "@medusajs/medusa/core-flows"
import type { z } from "@medusajs/framework/zod"
import type { updateManualDeliveryStatusSchema } from "../../validators"
import { assertManualOrder } from "../../../../../lib/manual-order-guard"
import {
  DELIVERY_STATUS_ORDER,
  deriveDeliveryStatus,
  type FulfillmentState,
} from "../../../../../lib/manual-delivery-status"
import { resolveVietnamFulfillment } from "../../../../../lib/vietnam-fulfillment"
import { getManualOrderSummary } from "../summary"

type StatusBody = z.infer<typeof updateManualDeliveryStatusSchema>

export const POST = async (req: MedusaRequest<StatusBody>, res: MedusaResponse) => {
  const orderId = req.params.id
  const target = req.validatedBody.status
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "orders",
    fields: [
      "id",
      "currency_code",
      "metadata",
      "status",
      "items.id",
      "items.quantity",
      "fulfillments.id",
      "fulfillments.canceled_at",
      "fulfillments.shipped_at",
      "fulfillments.delivered_at",
    ],
    filters: { id: orderId },
  })
  const order = orders[0]
  assertManualOrder(order as never)

  const fulfillments = (order.fulfillments ?? []) as (FulfillmentState & { id: string })[]
  const current = deriveDeliveryStatus(fulfillments)

  if (DELIVERY_STATUS_ORDER[target] < DELIVERY_STATUS_ORDER[current]) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Không thể lùi trạng thái giao hàng. Trạng thái chỉ tiến về phía trước."
    )
  }
  if (target === current) {
    res.json(await getManualOrderSummary(req.scope, orderId))
    return
  }

  const items = (order.items ?? [])
    .filter((item): item is NonNullable<typeof item> => item != null)
    .map((item) => ({ id: item.id, quantity: Number(item.quantity) }))
  if (items.length === 0) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Đơn hàng không có sản phẩm để giao")
  }

  const activeFulfillment = fulfillments.find((fulfillment) => !fulfillment.canceled_at)

  let fulfillmentId = activeFulfillment?.id

  if (!fulfillmentId) {
    const { locationId } = await resolveVietnamFulfillment(req.scope)
    const { result: fulfillment } = await createOrderFulfillmentWorkflow(req.scope).run({
      input: { order_id: orderId, items, location_id: locationId },
    })
    fulfillmentId = fulfillment.id
  }

  const needsShipment =
    DELIVERY_STATUS_ORDER[target] >= DELIVERY_STATUS_ORDER.delivering &&
    !activeFulfillment?.shipped_at
  if (needsShipment && fulfillmentId) {
    await createOrderShipmentWorkflow(req.scope).run({
      input: { order_id: orderId, fulfillment_id: fulfillmentId, items },
    })
  }

  const needsDelivered =
    target === "delivered" && !activeFulfillment?.delivered_at
  if (needsDelivered && fulfillmentId) {
    await markOrderFulfillmentAsDeliveredWorkflow(req.scope).run({
      input: { orderId, fulfillmentId },
    })
  }

  res.json(await getManualOrderSummary(req.scope, orderId))
}
