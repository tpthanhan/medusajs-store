import { MedusaError } from "@medusajs/framework/utils"
import { MANUAL_ORDER_CURRENCY, MANUAL_ORDER_METADATA_KEY } from "./manual-order-constants"

export interface ManualOrderMeta {
  currency_code: string
  metadata: Record<string, unknown> | null
  status: string
}

export const assertManualOrder = (order: ManualOrderMeta | undefined) => {
  if (
    order?.metadata?.[MANUAL_ORDER_METADATA_KEY] !== true ||
    order.currency_code !== MANUAL_ORDER_CURRENCY ||
    order.status === "canceled"
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Đơn hàng không hỗ trợ thao tác thủ công này"
    )
  }
}
