import { hasPricingInput, validateVariantPricing, type VariantPricingInput } from "../variant-pricing-validation"

const blankRow: VariantPricingInput = {
  title: "M",
  originalPrice: "",
  importShippingPrice: "",
  importedTotalPrice: "",
  isTotalOverridden: false,
  marketPrice: "",
}

describe("variant pricing validation", () => {
  it("allows a new variant to be left without any pricing", () => {
    expect(hasPricingInput(blankRow)).toBe(false)
  })

  it("requires both total cost and selling price if pricing is entered", () => {
    const row = { ...blankRow, originalPrice: "100", importedTotalPrice: "100" }
    expect(hasPricingInput(row)).toBe(true)
    expect(validateVariantPricing(row)).toContain("giá bán bắt buộc")
  })

  it("validates only the selected variant's complete pricing", () => {
    const row = { ...blankRow, importedTotalPrice: "100", marketPrice: "200", isTotalOverridden: true }
    expect(validateVariantPricing(row)).toBeNull()
  })
})
