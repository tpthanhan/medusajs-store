import { MAX_VND_AMOUNT } from "../api/admin/variant-import-prices/validators"
import { calculateImportedTotal } from "./imported-total"

export const IMPORT_PRICING_CSV_HEADERS = [
  "product_title",
  "variant_title",
  "sku",
  "original_price",
  "import_shipping_price",
  "imported_total_price",
  "market_price",
] as const

export interface ImportPricingVariantDraft {
  title: string
  sku: string | null
  market_price: number
  import_pricing: {
    original_price: number | null
    import_shipping_price: number | null
    imported_total_price: number
    is_total_overridden: boolean
  } | null
}

export interface ImportPricingProductDraft {
  title: string
  variants: ImportPricingVariantDraft[]
}

export interface ParseImportPricingResult {
  products: ImportPricingProductDraft[]
  errors: string[]
}

const parseCsv = (text: string): string[][] => {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let inQuotes = false
  const pushCell = () => { row.push(cell); cell = "" }
  const pushRow = () => { pushCell(); rows.push(row); row = [] }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ } else { inQuotes = false }
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') { inQuotes = true; continue }
    if (char === ",") { pushCell(); continue }
    if (char === "\r") continue
    if (char === "\n") { pushRow(); continue }
    cell += char
  }
  if (cell.length > 0 || row.length > 0) pushRow()
  return rows.filter((cells) => cells.some((value) => value.trim() !== ""))
}

const parseVndCell = (raw: string, label: string, line: number, required: boolean): { value: number | null; error?: string } => {
  const trimmed = raw.trim()
  if (trimmed === "") {
    return required ? { value: null, error: `Dòng ${line}: thiếu ${label}` } : { value: null }
  }
  const normalized = trimmed.replace(/[,._\s]/g, "")
  const value = Number(normalized)
  if (!Number.isInteger(value) || value < 0 || value > MAX_VND_AMOUNT) {
    return { value: null, error: `Dòng ${line}: ${label} không hợp lệ (${trimmed}) — phải là số nguyên VND 0..${MAX_VND_AMOUNT}` }
  }
  return { value }
}

export const parseImportPricingCsv = (text: string): ParseImportPricingResult => {
  const rows = parseCsv(text)
  const errors: string[] = []
  if (!rows.length) {
    return { products: [], errors: ["File CSV trống"] }
  }

  const header = rows[0].map((value) => value.trim().toLowerCase())
  const index = (name: string) => header.indexOf(name)
  const missing = IMPORT_PRICING_CSV_HEADERS.filter((name) => index(name) === -1)
  if (missing.length) {
    return { products: [], errors: [`Thiếu cột bắt buộc: ${missing.join(", ")}`] }
  }

  const productsByTitle = new Map<string, ImportPricingProductDraft>()
  const order: string[] = []

  rows.slice(1).forEach((cells, rowIndex) => {
    const line = rowIndex + 2
    const get = (name: string) => (cells[index(name)] ?? "").trim()

    const productTitle = get("product_title")
    const variantTitle = get("variant_title")
    if (!productTitle) { errors.push(`Dòng ${line}: thiếu product_title`); return }
    if (!variantTitle) { errors.push(`Dòng ${line}: thiếu variant_title`); return }

    const market = parseVndCell(get("market_price"), "market_price", line, true)
    const original = parseVndCell(get("original_price"), "original_price", line, false)
    const shipping = parseVndCell(get("import_shipping_price"), "import_shipping_price", line, false)
    const total = parseVndCell(get("imported_total_price"), "imported_total_price", line, false)
    for (const result of [market, original, shipping, total]) {
      if (result.error) errors.push(result.error)
    }
    if (market.value === null) return

    const hasImportInput = original.value !== null || shipping.value !== null || total.value !== null
    const importPricing = hasImportInput
      ? (() => {
          const isOverridden = total.value !== null
          const importedTotal = isOverridden
            ? total.value as number
            : calculateImportedTotal({ original_price: original.value, import_shipping_price: shipping.value, imported_total_price: 0, is_total_overridden: false })
          return {
            original_price: original.value,
            import_shipping_price: shipping.value,
            imported_total_price: importedTotal,
            is_total_overridden: isOverridden,
          }
        })()
      : null

    let product = productsByTitle.get(productTitle)
    if (!product) {
      product = { title: productTitle, variants: [] }
      productsByTitle.set(productTitle, product)
      order.push(productTitle)
    }
    if (product.variants.some((variant) => variant.title === variantTitle)) {
      errors.push(`Dòng ${line}: biến thể "${variantTitle}" bị trùng trong sản phẩm "${productTitle}"`)
      return
    }
    product.variants.push({
      title: variantTitle,
      sku: get("sku") || null,
      market_price: market.value,
      import_pricing: importPricing,
    })
  })

  return { products: order.map((title) => productsByTitle.get(title) as ImportPricingProductDraft), errors }
}

export const buildImportPricingTemplateCsv = (): string => {
  const header = IMPORT_PRICING_CSV_HEADERS.join(",")
  const examples = [
    ["Áo thun basic", "S", "AO-BASIC-S", "80000", "10000", "", "150000"],
    ["Áo thun basic", "M", "AO-BASIC-M", "80000", "10000", "", "150000"],
    ["Áo thun basic", "L", "AO-BASIC-L", "", "", "95000", "160000"],
    ["Nón lưỡi trai", "Mặc định", "NON-LT", "", "", "", "90000"],
  ]
  return [header, ...examples.map((cells) => cells.join(","))].join("\n") + "\n"
}
