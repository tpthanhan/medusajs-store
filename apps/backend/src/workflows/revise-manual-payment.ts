import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import type { IOrderModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { MANUAL_ORDER_CURRENCY, MANUAL_ORDER_METADATA_KEY, MANUAL_PAYMENT_REFERENCE } from "../lib/manual-order-constants"

export interface ReviseManualPaymentInput {
  orderId: string
  paymentId: string
  amount?: number
}

interface ManualPayment {
  id: string
  amount: number
  currency_code: string
  reference: string | null
}

interface ManualOrder {
  currency_code: string
  metadata: Record<string, unknown> | null
  status: string
  transactions: ManualPayment[] | null
}

export const findEditableManualPayment = (order: ManualOrder | undefined, paymentId: string): ManualPayment => {
  if (order?.metadata?.[MANUAL_ORDER_METADATA_KEY] !== true || order.currency_code !== MANUAL_ORDER_CURRENCY || order.status === "canceled") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Đơn hàng không cho phép chỉnh sửa khoản thanh toán thủ công")
  }
  const payment = order.transactions?.find((transaction) => transaction.id === paymentId &&
    transaction.reference === MANUAL_PAYMENT_REFERENCE && transaction.currency_code === MANUAL_ORDER_CURRENCY)
  if (!payment) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Không tìm thấy khoản thanh toán thêm của đơn hàng")
  }
  return payment
}

const reviseManualPaymentStep = createStep(
  "revise-manual-payment",
  async ({ orderId, paymentId, amount }: ReviseManualPaymentInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "orders",
      fields: ["id", "currency_code", "metadata", "status", "transactions.*"],
      filters: { id: orderId },
    })
    findEditableManualPayment(orders[0] as unknown as ManualOrder | undefined, paymentId)

    const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
    if (amount === undefined) {
      await orderService.deleteOrderTransactions(paymentId)
      return new StepResponse({ deleted: true })
    }

    const replacement = await orderService.addOrderTransactions({
      order_id: orderId,
      amount,
      currency_code: MANUAL_ORDER_CURRENCY,
      reference: MANUAL_PAYMENT_REFERENCE,
    })
    try {
      await orderService.deleteOrderTransactions(paymentId)
    } catch (cause) {
      await orderService.deleteOrderTransactions(replacement.id)
      throw cause
    }
    return new StepResponse({ deleted: false })
  }
)

export const reviseManualPaymentWorkflow = createWorkflow(
  "revise-manual-payment",
  (input: ReviseManualPaymentInput) => new WorkflowResponse(reviseManualPaymentStep(input))
)
