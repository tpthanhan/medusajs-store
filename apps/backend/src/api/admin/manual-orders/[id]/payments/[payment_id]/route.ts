import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { z } from "@medusajs/framework/zod"
import type { recordManualPaymentSchema } from "../../../validators"
import { reviseManualPaymentWorkflow } from "../../../../../../workflows/revise-manual-payment"
import { getManualOrderSummary } from "../../summary"

type PaymentBody = z.infer<typeof recordManualPaymentSchema>

export const POST = async (req: MedusaRequest<PaymentBody>, res: MedusaResponse) => {
  await reviseManualPaymentWorkflow(req.scope).run({
    input: { orderId: req.params.id, paymentId: req.params.payment_id, amount: req.validatedBody.amount },
  })
  res.json(await getManualOrderSummary(req.scope, req.params.id))
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  await reviseManualPaymentWorkflow(req.scope).run({
    input: { orderId: req.params.id, paymentId: req.params.payment_id },
  })
  res.json(await getManualOrderSummary(req.scope, req.params.id))
}
