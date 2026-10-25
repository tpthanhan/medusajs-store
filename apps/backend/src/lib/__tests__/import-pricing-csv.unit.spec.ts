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
    expect(products[0].options).toEqual([{ title: "Variant", values: ["S", "M"] }])
  })

  it("builds Size x Màu options from option: columns", () => {
    const csv = [
      "product_title,sku,option:Size,option:Màu,market_price",
      "Áo,AO-S-DO,S,Đỏ,150000",
      "Áo,AO-S-XA,S,Xanh,150000",
      "Áo,AO-M-DO,M,Đỏ,160000",
    ].join("\n")
    const { products, errors } = parseImportPricingCsv(csv)
    expect(errors).toEqual([])
    expect(products[0].options).toEqual([
      { title: "Size", values: ["S", "M"] },
      { title: "Màu", values: ["Đỏ", "Xanh"] },
    ])
    expect(products[0].variants[0].options).toEqual({ Size: "S", Màu: "Đỏ" })
    expect(products[0].variants[0].title).toBe("S / Đỏ")
  })

  it("lets each product define its own option set", () => {
    const csv = [
      "product_title,variant_title,option:Size,option:Màu,market_price",
      "Áo,,S,Đỏ,150000",
      "Quần,,29,,250000",
      "Nón,Mặc định,,,90000",
    ].join("\n")
    const { products, errors } = parseImportPricingCsv(csv)
    expect(errors).toEqual([])
    const byTitle = Object.fromEntries(products.map((product) => [product.title, product]))
    expect(byTitle["Áo"].options.map((option) => option.title)).toEqual(["Size", "Màu"])
    expect(byTitle["Quần"].options.map((option) => option.title)).toEqual(["Size"])
    expect(byTitle["Nón"].options).toEqual([{ title: "Variant", values: ["Mặc định"] }])
  })

  it("rejects an inconsistent option set within a product", () => {
    const csv = [
      "product_title,option:Size,option:Màu,market_price",
      "Áo,S,Đỏ,150000",
      "Áo,M,,160000",
    ].join("\n")
    const { errors } = parseImportPricingCsv(csv)
    expect(errors.some((message) => message.includes("không khớp"))).toBe(true)
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

  it("reports missing market_price and duplicate variant combinations", () => {
    const csv = [
      "product_title,option:Size,market_price",
      "Áo,S,",
      "Áo,M,150000",
      "Áo,M,160000",
    ].join("\n")
    const { errors } = parseImportPricingCsv(csv)
    expect(errors.some((message) => message.includes("market_price"))).toBe(true)
    expect(errors.some((message) => message.includes("trùng"))).toBe(true)
  })

  it("creates a single default variant when a product has no option and no variant_title", () => {
    const { products, errors } = parseImportPricingCsv("product_title,market_price\nÁo,150000")
    expect(errors).toEqual([])
    expect(products).toHaveLength(1)
    expect(products[0].variants).toHaveLength(1)
    expect(products[0].variants[0].title).toBe("Mặc định")
    expect(products[0].options).toEqual([{ title: "Variant", values: ["Mặc định"] }])
  })

  it("defaults a blank variant_title to a single default variant", () => {
    const csv = [
      "product_title,brand,variant_title,market_price",
      "Nước hoa,CK,,1450000",
    ].join("\n")
    const { products, errors } = parseImportPricingCsv(csv)
    expect(errors).toEqual([])
    expect(products[0].variants[0].title).toBe("Mặc định")
  })

  it("strips a leading UTF-8 BOM (Excel-saved files)", () => {
    const csv = "\uFEFF" + [header, "Áo,S,AO-S,80000,10000,,150000"].join("\n")
    const { products, errors } = parseImportPricingCsv(csv)
    expect(errors).toEqual([])
    expect(products[0].title).toBe("Áo")
  })

  it("reads an optional brand column and fills it from any row of the product", () => {
    const csv = [
      "product_title,brand,variant_title,market_price",
      "Áo Tommy,Tommy,S,150000",
      "Áo Tommy,,M,160000",
      "Áo thuần,,Only,90000",
    ].join("\n")
    const { products, errors } = parseImportPricingCsv(csv)
    expect(errors).toEqual([])
    const byTitle = Object.fromEntries(products.map((product) => [product.title, product]))
    expect(byTitle["Áo Tommy"].brand).toBe("Tommy")
    expect(byTitle["Áo thuần"].brand).toBeNull()
  })

  it("leaves brand null when the column is absent", () => {
    const csv = [header, "Áo thun,S,AO-S,80000,10000,,150000"].join("\n")
    const { products } = parseImportPricingCsv(csv)
    expect(products[0].brand).toBeNull()
  })

  it("reads an optional stock column and defaults blanks to null", () => {
    const csv = [
      "product_title,variant_title,stock,market_price",
      "Áo,S,50,150000",
      "Áo,M,,160000",
    ].join("\n")
    const { products, errors } = parseImportPricingCsv(csv)
    expect(errors).toEqual([])
    expect(products[0].variants[0].stock).toBe(50)
    expect(products[0].variants[1].stock).toBeNull()
  })

  it("rejects duplicate SKUs across the whole file", () => {
    const csv = [
      "product_title,variant_title,sku,market_price",
      "Áo,S,DUP,150000",
      "Áo,M,DUP,160000",
    ].join("\n")
    const { errors } = parseImportPricingCsv(csv)
    expect(errors.some((message) => message.includes("SKU") && message.includes("trùng"))).toBe(true)
  })

  it("rejects an invalid stock value", () => {
    const csv = [
      "product_title,variant_title,stock,market_price",
      "Áo,S,-5,150000",
    ].join("\n")
    const { errors } = parseImportPricingCsv(csv)
    expect(errors.some((message) => message.includes("stock"))).toBe(true)
  })

  it("parses the generated template without errors", () => {
    const { products, errors } = parseImportPricingCsv(buildImportPricingTemplateCsv())
    expect(errors).toEqual([])
    expect(products).toHaveLength(4)
    const ao = products.find((product) => product.title === "Áo thun basic")
    expect(ao?.brand).toBe("Tommy")
    expect(ao?.variants[0].stock).toBe(50)
    expect(ao?.options.map((option) => option.title)).toEqual(["Gender", "Size", "Màu"])
    expect(ao?.options[0].values).toEqual(["Man"])
    expect(ao?.variants).toHaveLength(4)
    const aoNu = products.find((product) => product.title === "Áo thun nữ")
    expect(aoNu?.brand).toBe("RL")
    expect(aoNu?.options[0].values).toEqual(["Woman"])
    expect(products.find((product) => product.title === "Nón lưỡi trai")?.brand).toBeNull()
  })
})
