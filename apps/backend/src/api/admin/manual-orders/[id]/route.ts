import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getManualOrderSummary } from "./summary"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  res.json(await getManualOrderSummary(req.scope, req.params.id))
}
