import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { CreateManualOrderInput } from "../../../workflows/create-manual-order"
import { createManualOrderWorkflow } from "../../../workflows/create-manual-order"

export const POST = async (req: MedusaRequest<CreateManualOrderInput>, res: MedusaResponse) => {
  const { result } = await createManualOrderWorkflow(req.scope).run({ input: req.validatedBody })
  res.status(201).json({ order: result })
}
