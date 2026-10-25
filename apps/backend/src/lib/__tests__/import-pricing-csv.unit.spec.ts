import { parseImportPricingCsv, buildImportPricingTemplateCsv } from "../import-pricing-csv"

describe("parseImportPricingCsv", () => {
  const header = "product_title,variant_title,sku,original_price,import_shipping_price,imported_total_price,market_price"

  it("groups rows sharing a product_title into one product", () => {
    const csv = [
      header,
      "Áo thun,S,AO-S,80000,10000,,150000",
      "Áo thun,M,AO-M,80000,10000,,150000",
    ].join("\n")
    const { products, errors } = parseImportPricingCsv(csv)
    expect(errors).toEqual([])
    expect(products).toHaveLength(1)
    expect(products[0].variants.map((variant) => variant.title)).toEqual(["S", "M"])
  })

  it("computes imported total from original + shipping when blank", () => {
    const csv = [header, "Áo,S,,80000,10000,,150000"].join("\n")
    const { products } = parseImportPricingCsv(csv)
    expect(products[0].variants[0].import_pricing).toEqual({
      original_price: 80000,
      import_shipping_price: 10000,
      imported_total_price: 90000,
      is_total_overridden: false,
    })
  })

  it("uses a provided imported total as a manual override", () => {
    const csv = [header, "Áo,L,,,,95000,160000"].join("\n")
    const { products } = parseImportPricingCsv(csv)
    expect(products[0].variants[0].import_pricing).toEqual({
      original_price: null,
      import_shipping_price: null,
      imported_total_price: 95000,
      is_total_overridden: true,
    })
  })

  it("leaves import_pricing null when no import columns are given", () => {
    const csv = [header, "Nón,Mặc định,NON,,,,90000"].join("\n")
    const { products } = parseImportPricingCsv(csv)
    expect(products[0].variants[0].import_pricing).toBeNull()
    expect(products[0].variants[0].market_price).toBe(90000)
  })

  it("reports missing market_price and duplicate variant titles", () => {
    const csv = [
      header,
      "Áo,S,,,,,",
      "Áo,M,,,,,150000",
      "Áo,M,,,,,160000",
    ].join("\n")
    const { errors } = parseImportPricingCsv(csv)
    expect(errors.some((message) => message.includes("market_price"))).toBe(true)
    expect(errors.some((message) => message.includes("trùng"))).toBe(true)
  })

  it("rejects a CSV missing required headers", () => {
    const { products, errors } = parseImportPricingCsv("product_title,variant_title\nÁo,S")
    expect(products).toEqual([])
    expect(errors[0]).toContain("Thiếu cột bắt buộc")
  })

  it("parses the generated template without errors", () => {
    const { products, errors } = parseImportPricingCsv(buildImportPricingTemplateCsv())
    expect(errors).toEqual([])
    expect(products).toHaveLength(2)
  })
})
