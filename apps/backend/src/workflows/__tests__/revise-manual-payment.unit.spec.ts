import { findEditableManualPayment } from "../revise-manual-payment"
import { MANUAL_DEPOSIT_REFERENCE, MANUAL_ORDER_CURRENCY, MANUAL_ORDER_METADATA_KEY, MANUAL_PAYMENT_REFERENCE } from "../../lib/manual-order-constants"

const order = {
  currency_code: MANUAL_ORDER_CURRENCY,
  metadata: { [MANUAL_ORDER_METADATA_KEY]: true },
  status: "pending",
  transactions: [
    { id: "dep_1", amount: 20000, currency_code: MANUAL_ORDER_CURRENCY, reference: MANUAL_DEPOSIT_REFERENCE },
    { id: "pay_1", amount: 50000, currency_code: MANUAL_ORDER_CURRENCY, reference: MANUAL_PAYMENT_REFERENCE },
  ],
}

describe("findEditableManualPayment", () => {
  it("returns a later manual payment", () => {
    expect(findEditableManualPayment(order, "pay_1").id).toBe("pay_1")
  })

  it("rejects editing the deposit", () => {
    expect(() => findEditableManualPayment(order, "dep_1")).toThrow()
  })

  it("rejects an unknown payment", () => {
    expect(() => findEditableManualPayment(order, "missing")).toThrow()
  })

  it("rejects a non-manual or canceled order", () => {
    expect(() => findEditableManualPayment({ ...order, status: "canceled" }, "pay_1")).toThrow()
    expect(() => findEditableManualPayment({ ...order, metadata: {} }, "pay_1")).toThrow()
  })
})
