import type { ManualDeliveryStatus } from "./manual-order-constants"

export interface FulfillmentState {
  canceled_at?: string | Date | null
  shipped_at?: string | Date | null
  delivered_at?: string | Date | null
}

export const DELIVERY_STATUS_ORDER: Record<ManualDeliveryStatus, number> = {
  placed: 0,
  awaiting: 1,
  delivering: 2,
  delivered: 3,
}

export const deriveDeliveryStatus = (
  fulfillments: FulfillmentState[] | undefined
): ManualDeliveryStatus => {
  const active = (fulfillments ?? []).filter((fulfillment) => !fulfillment.canceled_at)
  if (active.length === 0) return "placed"
  if (active.some((fulfillment) => fulfillment.delivered_at)) return "delivered"
  if (active.some((fulfillment) => fulfillment.shipped_at)) return "delivering"
  return "awaiting"
}
