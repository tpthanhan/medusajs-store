import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { calculateManualBalance } from "../../../../lib/manual-order-balance"
import { deriveDeliveryStatus, type FulfillmentState } from "../../../../lib/manual-delivery-status"
import { MANUAL_DEPOSIT_REFERENCE, MANUAL_ORDER_CURRENCY, MANUAL_ORDER_METADATA_KEY, MANUAL_PAYMENT_REFERENCE } from "../../../../lib/manual-order-constants"

export const getManualOrderSummary = async (scope: MedusaContainer, orderId: string) => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "orders",
    fields: [
      "id",
      "total",
      "shipping_total",
      "currency_code",
      "metadata",
      "transactions.*",
      "fulfillments.canceled_at",
      "fulfillments.shipped_at",
      "fulfillments.delivered_at",
      "payment_collections.status",
    ],
    filters: { id: orderId },
  })
  const order = orders[0]
  if (order?.metadata?.[MANUAL_ORDER_METADATA_KEY] !== true || order.currency_code !== MANUAL_ORDER_CURRENCY) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Manual VND order not found")
  }

  const total = Number(order.total)
  if (!Number.isFinite(total)) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Order total is unavailable")
  }
  const shipping = Number(order.shipping_total ?? 0)
  if (!Number.isFinite(shipping)) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Order shipping total is unavailable")
  }
  const payments = (order.transactions ?? [])
    .filter((transaction): transaction is NonNullable<typeof transaction> => transaction != null && (transaction.reference === MANUAL_DEPOSIT_REFERENCE || transaction.reference === MANUAL_PAYMENT_REFERENCE))
    .map((transaction) => ({ id: transaction.id, amount: Number(transaction.amount), created_at: transaction.created_at, is_deposit: transaction.reference === MANUAL_DEPOSIT_REFERENCE }))
    .sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)) || left.id.localeCompare(right.id))
  const balance = calculateManualBalance(total, payments.map((payment) => payment.amount))

  const deliveryStatus = deriveDeliveryStatus((order.fulfillments ?? []) as FulfillmentState[])
  const isPaidNatively = (order.payment_collections ?? []).some(
    (collection) => collection?.status === "completed" || collection?.status === "authorized"
  )

  return {
    order_id: order.id,
    currency_code: MANUAL_ORDER_CURRENCY,
    delivery_status: deliveryStatus,
    payment_captured: isPaidNatively,
    total,
    shipping,
    deposit: payments.find((payment) => payment.is_deposit)?.amount ?? 0,
    ...balance,
    payments,
  }
}
