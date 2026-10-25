import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { z } from "@medusajs/framework/zod"
import type { updateManualOrderNoteSchema } from "../../validators"
import { assertManualOrder } from "../../../../../lib/manual-order-guard"
import { updateManualOrderNoteWorkflow } from "../../../../../workflows/update-manual-order-note"
import { getManualOrderSummary } from "../summary"

type NoteBody = z.infer<typeof updateManualOrderNoteSchema>

export const POST = async (req: MedusaRequest<NoteBody>, res: MedusaResponse) => {
  const orderId = req.params.id
  const note = req.validatedBody.note
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "orders",
    fields: ["id", "currency_code", "metadata", "status"],
    filters: { id: orderId },
  })
  assertManualOrder(orders[0] as never)

  await updateManualOrderNoteWorkflow(req.scope).run({ input: { orderId, note } })

  res.json(await getManualOrderSummary(req.scope, orderId))
}
