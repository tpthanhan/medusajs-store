import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import type { IOrderModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { MANUAL_ORDER_CURRENCY, MANUAL_ORDER_METADATA_KEY, MANUAL_PAYMENT_REFERENCE } from "../lib/manual-order-constants"

export interface RecordManualPaymentInput {
  orderId: string
  amount: number
}

const recordManualPaymentStep = createStep(
  "record-manual-payment",
  async ({ orderId, amount }: RecordManualPaymentInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "orders",
      fields: ["id", "currency_code", "metadata", "status"],
      filters: { id: orderId },
    })
    const order = orders[0]
    if (order?.metadata?.[MANUAL_ORDER_METADATA_KEY] !== true || order.currency_code !== MANUAL_ORDER_CURRENCY || order.status === "canceled") {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "This order does not accept manual VND payments")
    }

    const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
    const transaction = await orderService.addOrderTransactions({
      order_id: orderId,
      amount,
      currency_code: MANUAL_ORDER_CURRENCY,
      reference: MANUAL_PAYMENT_REFERENCE,
    })
    return new StepResponse(transaction, transaction.id)
  },
  async (transactionId: string | undefined, { container }) => {
    if (transactionId) {
      await container.resolve<IOrderModuleService>(Modules.ORDER).deleteOrderTransactions(transactionId)
    }
  }
)

export const recordManualPaymentWorkflow = createWorkflow(
  "record-manual-payment",
  (input: RecordManualPaymentInput) => new WorkflowResponse(recordManualPaymentStep(input))
)
