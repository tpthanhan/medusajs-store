import { calculateManualBalance } from "../manual-order-balance"

describe("manual order balance", () => {
  it("starts with the full total due", () => {
    expect(calculateManualBalance(1000, [])).toEqual({ paid: 0, remaining: 1000, tip: 0 })
  })

  it("counts deposit and later payments toward the balance", () => {
    expect(calculateManualBalance(1000, [200, 300])).toEqual({ paid: 500, remaining: 500, tip: 0 })
  })

  it("treats only the excess above the order total as tip", () => {
    expect(calculateManualBalance(1000, [200, 900])).toEqual({ paid: 1100, remaining: 0, tip: 100 })
  })
})
