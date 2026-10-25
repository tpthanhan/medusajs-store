import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { calculateManualBalance } from "../../../../lib/manual-order-balance"
import { MANUAL_DEPOSIT_REFERENCE, MANUAL_ORDER_CURRENCY, MANUAL_ORDER_METADATA_KEY, MANUAL_PAYMENT_REFERENCE } from "../../../../lib/manual-order-constants"

export const getManualOrderSummary = async (scope: MedusaContainer, orderId: string) => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "orders",
    fields: ["id", "total", "currency_code", "metadata", "transactions.*"],
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
  const payments = (order.transactions ?? [])
    .filter((transaction): transaction is NonNullable<typeof transaction> => transaction != null && (transaction.reference === MANUAL_DEPOSIT_REFERENCE || transaction.reference === MANUAL_PAYMENT_REFERENCE))
    .map((transaction) => ({ id: transaction.id, amount: Number(transaction.amount), created_at: transaction.created_at, is_deposit: transaction.reference === MANUAL_DEPOSIT_REFERENCE }))
    .sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)) || left.id.localeCompare(right.id))
  const balance = calculateManualBalance(total, payments.map((payment) => payment.amount))

  return {
    order_id: order.id,
    currency_code: MANUAL_ORDER_CURRENCY,
    total,
    deposit: payments.find((payment) => payment.is_deposit)?.amount ?? 0,
    ...balance,
    payments,
  }
}
