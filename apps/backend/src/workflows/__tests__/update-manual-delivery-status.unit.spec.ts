import { assertManualOrder } from "../../lib/manual-order-guard"
import { deriveDeliveryStatus, DELIVERY_STATUS_ORDER } from "../../lib/manual-delivery-status"
import { MANUAL_ORDER_CURRENCY, MANUAL_ORDER_METADATA_KEY } from "../../lib/manual-order-constants"

const base = {
  currency_code: MANUAL_ORDER_CURRENCY,
  metadata: { [MANUAL_ORDER_METADATA_KEY]: true },
  status: "pending",
}

describe("assertManualOrder", () => {
  it("accepts a manual VND order", () => {
    expect(() => assertManualOrder(base)).not.toThrow()
  })

  it("rejects a non-manual order", () => {
    expect(() => assertManualOrder({ ...base, metadata: {} })).toThrow()
  })

  it("rejects a canceled order", () => {
    expect(() => assertManualOrder({ ...base, status: "canceled" })).toThrow()
  })
})

describe("deriveDeliveryStatus", () => {
  it("returns placed when there is no fulfillment", () => {
    expect(deriveDeliveryStatus([])).toBe("placed")
    expect(deriveDeliveryStatus(undefined)).toBe("placed")
  })

  it("ignores canceled fulfillments", () => {
    expect(deriveDeliveryStatus([{ canceled_at: "2026-01-01", shipped_at: "2026-01-02" }])).toBe("placed")
  })

  it("returns awaiting for an unshipped fulfillment", () => {
    expect(deriveDeliveryStatus([{ shipped_at: null, delivered_at: null }])).toBe("awaiting")
  })

  it("returns delivering when shipped", () => {
    expect(deriveDeliveryStatus([{ shipped_at: "2026-01-02", delivered_at: null }])).toBe("delivering")
  })

  it("returns delivered when delivered", () => {
    expect(deriveDeliveryStatus([{ shipped_at: "2026-01-02", delivered_at: "2026-01-03" }])).toBe("delivered")
  })

  it("orders statuses forward", () => {
    expect(DELIVERY_STATUS_ORDER.placed).toBeLessThan(DELIVERY_STATUS_ORDER.awaiting)
    expect(DELIVERY_STATUS_ORDER.awaiting).toBeLessThan(DELIVERY_STATUS_ORDER.delivering)
    expect(DELIVERY_STATUS_ORDER.delivering).toBeLessThan(DELIVERY_STATUS_ORDER.delivered)
  })
})
