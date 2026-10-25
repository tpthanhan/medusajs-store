import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import type { IOrderModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MANUAL_NOTE_KEY } from "../lib/manual-order-constants"

export interface UpdateManualOrderNoteInput {
  orderId: string
  note: string
}

interface NoteCompensation {
  orderId: string
  previousMetadata: Record<string, unknown>
}

const updateManualOrderNoteStep = createStep(
  "update-manual-order-note",
  async ({ orderId, note }: UpdateManualOrderNoteInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "orders",
      fields: ["id", "metadata"],
      filters: { id: orderId },
    })
    const previousMetadata = (orders[0]?.metadata ?? {}) as Record<string, unknown>

    const nextMetadata = { ...previousMetadata }
    if (note.length > 0) {
      nextMetadata[MANUAL_NOTE_KEY] = note
    } else {
      delete nextMetadata[MANUAL_NOTE_KEY]
    }

    const orderModule = container.resolve<IOrderModuleService>(Modules.ORDER)
    await orderModule.updateOrders(orderId, { metadata: nextMetadata })
    return new StepResponse<null, NoteCompensation>(null, { orderId, previousMetadata })
  },
  async (compensation, { container }) => {
    if (!compensation) return
    const orderModule = container.resolve<IOrderModuleService>(Modules.ORDER)
    await orderModule.updateOrders(compensation.orderId, { metadata: compensation.previousMetadata })
  }
)

export const updateManualOrderNoteWorkflow = createWorkflow(
  "update-manual-order-note",
  (input: UpdateManualOrderNoteInput) => {
    updateManualOrderNoteStep(input)
    return new WorkflowResponse(input)
  }
)
