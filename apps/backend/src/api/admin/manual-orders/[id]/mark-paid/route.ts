import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createOrderPaymentCollectionWorkflow,
  markPaymentCollectionAsPaid,
} from "@medusajs/medusa/core-flows"
import { assertManualOrder } from "../../../../../lib/manual-order-guard"
import { recordManualPaymentWorkflow } from "../../../../../workflows/record-manual-payment"
import { getManualOrderSummary } from "../summary"

interface PaymentCollection {
  id: string
  status: string
  amount: number
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const orderId = req.params.id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "orders",
    fields: [
      "id",
      "total",
      "currency_code",
      "metadata",
      "status",
      "payment_collections.id",
      "payment_collections.status",
      "payment_collections.amount",
    ],
    filters: { id: orderId },
  })
  const order = orders[0]
  assertManualOrder(order as never)

  const summary = await getManualOrderSummary(req.scope, orderId)
  if (summary.remaining > 0) {
    await recordManualPaymentWorkflow(req.scope).run({
      input: { orderId, amount: summary.remaining },
    })
  }

  let collections = (order.payment_collections ?? []) as PaymentCollection[]
  let pending = collections.find(
    (collection) => collection.status !== "completed" && collection.status !== "authorized"
  )

  if (!pending && collections.length === 0) {
    await createOrderPaymentCollectionWorkflow(req.scope).run({
      input: { order_id: orderId, amount: Number(order.total) },
    })
    const { data: refreshed } = await query.graph({
      entity: "orders",
      fields: ["payment_collections.id", "payment_collections.status"],
      filters: { id: orderId },
    })
    collections = (refreshed[0]?.payment_collections ?? []) as PaymentCollection[]
    pending = collections.find(
      (collection) => collection.status !== "completed" && collection.status !== "authorized"
    )
  }

  if (pending) {
    await markPaymentCollectionAsPaid(req.scope).run({
      input: { order_id: orderId, payment_collection_id: pending.id },
    })
  }

  res.json(await getManualOrderSummary(req.scope, orderId))
}
