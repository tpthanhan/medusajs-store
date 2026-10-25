import { calculateImportedTotal } from "../imported-total"

describe("imported total", () => {
  it("adds both import costs when automatic", () => {
    expect(calculateImportedTotal({ original_price: 100, import_shipping_price: 20, imported_total_price: 0, is_total_overridden: false })).toBe(120)
  })

  it("treats an optional missing cost as zero", () => {
    expect(calculateImportedTotal({ original_price: null, import_shipping_price: 20, imported_total_price: 0, is_total_overridden: false })).toBe(20)
  })

  it("preserves a manually entered total when input costs change", () => {
    expect(calculateImportedTotal({ original_price: 150, import_shipping_price: 30, imported_total_price: 125, is_total_overridden: true })).toBe(125)
  })
})
