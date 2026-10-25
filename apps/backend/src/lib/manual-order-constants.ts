export const MANUAL_ORDER_CURRENCY = "vnd"
export const MANUAL_ORDER_METADATA_KEY = "manual_vnd_order"
export const MANUAL_DEPOSIT_REFERENCE = "manual_vnd_deposit"
export const MANUAL_PAYMENT_REFERENCE = "manual_vnd_payment"

export const MANUAL_DELIVERY_STATUSES = ["placed", "awaiting", "delivering", "delivered"] as const
export type ManualDeliveryStatus = (typeof MANUAL_DELIVERY_STATUSES)[number]

export const MANUAL_DELIVERY_STATUS_LABELS: Record<ManualDeliveryStatus, string> = {
  placed: "Đã lên đơn",
  awaiting: "Đang chờ giao",
  delivering: "Đang giao",
  delivered: "Đã giao",
}

export const DEFAULT_MANUAL_DELIVERY_STATUS: ManualDeliveryStatus = "placed"
