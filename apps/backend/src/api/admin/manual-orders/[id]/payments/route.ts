import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { z } from "@medusajs/framework/zod"
import type { recordManualPaymentSchema } from "../../validators"
import { recordManualPaymentWorkflow } from "../../../../../workflows/record-manual-payment"
import { getManualOrderSummary } from "../summary"

type PaymentBody = z.infer<typeof recordManualPaymentSchema>

export const POST = async (req: MedusaRequest<PaymentBody>, res: MedusaResponse) => {
  await recordManualPaymentWorkflow(req.scope).run({
    input: { orderId: req.params.id, amount: req.validatedBody.amount },
  })
  res.status(201).json(await getManualOrderSummary(req.scope, req.params.id))
}
