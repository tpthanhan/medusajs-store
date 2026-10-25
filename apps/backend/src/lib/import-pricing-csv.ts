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

export const OPTION_COLUMN_PREFIX = "option:"
export const DEFAULT_OPTION_TITLE = "Variant"

export interface ImportPricingVariantDraft {
  title: string
  sku: string | null
  options: Record<string, string>
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
  options: Array<{ title: string; values: string[] }>
  variants: ImportPricingVariantDraft[]
}

export interface ParseImportPricingResult {
  products: ImportPricingProductDraft[]
  errors: string[]
}

interface ProductAccumulator {
  draft: ImportPricingProductDraft
  optionNames: string[] | null
  optionValues: Map<string, string[]>
  variantKeys: Set<string>
}

const parseCsv = (input: string): string[][] => {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
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

const addOptionValue = (values: Map<string, string[]>, name: string, value: string) => {
  const list = values.get(name) ?? []
  if (!list.includes(value)) list.push(value)
  values.set(name, list)
}

export const parseImportPricingCsv = (text: string): ParseImportPricingResult => {
  const rows = parseCsv(text)
  const errors: string[] = []
  if (!rows.length) {
    return { products: [], errors: ["File CSV trống"] }
  }

  const rawHeader = rows[0].map((value) => value.trim())
  const header = rawHeader.map((value) => value.toLowerCase())
  const index = (name: string) => header.indexOf(name)

  const optionColumns = rawHeader
    .map((label, columnIndex) => ({ label, columnIndex }))
    .filter(({ label }) => label.toLowerCase().startsWith(OPTION_COLUMN_PREFIX))
    .map(({ label, columnIndex }) => ({ name: label.slice(OPTION_COLUMN_PREFIX.length).trim(), columnIndex }))
    .filter(({ name }) => name !== "")

  const hasVariantTitleColumn = index("variant_title") !== -1
  const missing = (["product_title", "market_price"] as const).filter((name) => index(name) === -1)
  if (missing.length) {
    return { products: [], errors: [`Thiếu cột bắt buộc: ${missing.join(", ")}`] }
  }
  if (optionColumns.length === 0 && !hasVariantTitleColumn) {
    return { products: [], errors: [`Cần cột variant_title hoặc ít nhất một cột ${OPTION_COLUMN_PREFIX}<Tên> (vd ${OPTION_COLUMN_PREFIX}Size)`] }
  }

  const productsByTitle = new Map<string, ProductAccumulator>()
  const order: string[] = []

  rows.slice(1).forEach((cells, rowIndex) => {
    const line = rowIndex + 2
    const get = (name: string) => (cells[index(name)] ?? "").trim()
    const getAt = (columnIndex: number) => (cells[columnIndex] ?? "").trim()

    const productTitle = get("product_title")
    if (!productTitle) { errors.push(`Dòng ${line}: thiếu product_title`); return }

    const activeOptions = optionColumns
      .map(({ name, columnIndex }) => ({ name, value: getAt(columnIndex) }))
      .filter(({ value }) => value !== "")
    const activeNames = activeOptions.map(({ name }) => name)

    let product = productsByTitle.get(productTitle)
    if (!product) {
      product = {
        draft: { title: productTitle, options: [], variants: [] },
        optionNames: activeOptions.length > 0 ? activeNames : null,
        optionValues: new Map(),
        variantKeys: new Set(),
      }
      productsByTitle.set(productTitle, product)
      order.push(productTitle)
    }

    const usesOptions = product.optionNames !== null
    if (usesOptions) {
      const expected = product.optionNames as string[]
      const sameNames = activeNames.length === expected.length && expected.every((name) => activeNames.includes(name))
      if (!sameNames) {
        errors.push(`Dòng ${line}: bộ option không khớp với sản phẩm "${productTitle}" (cần ${expected.map((name) => OPTION_COLUMN_PREFIX + name).join(", ")})`)
        return
      }
    } else if (activeOptions.length > 0) {
      errors.push(`Dòng ${line}: sản phẩm "${productTitle}" dùng variant_title nhưng dòng này lại có cột option`)
      return
    }

    const variantTitleCell = get("variant_title")
    let variantOptions: Record<string, string>
    let variantTitle: string
    let variantKey: string
    if (usesOptions) {
      variantOptions = Object.fromEntries((product.optionNames as string[]).map((name) => {
        const match = activeOptions.find((option) => option.name === name)
        return [name, match ? match.value : ""]
      }))
      variantTitle = variantTitleCell || (product.optionNames as string[]).map((name) => variantOptions[name]).join(" / ")
      variantKey = (product.optionNames as string[]).map((name) => variantOptions[name]).join("\u0000")
    } else {
      if (!variantTitleCell) { errors.push(`Dòng ${line}: thiếu variant_title`); return }
      variantOptions = { [DEFAULT_OPTION_TITLE]: variantTitleCell }
      variantTitle = variantTitleCell
      variantKey = variantTitleCell
    }

    const market = parseVndCell(get("market_price"), "market_price", line, true)
    const original = parseVndCell(get("original_price"), "original_price", line, false)
    const shipping = parseVndCell(get("import_shipping_price"), "import_shipping_price", line, false)
    const total = parseVndCell(get("imported_total_price"), "imported_total_price", line, false)
    for (const result of [market, original, shipping, total]) {
      if (result.error) errors.push(result.error)
    }
    if (market.value === null) return

    if (product.variantKeys.has(variantKey)) {
      errors.push(`Dòng ${line}: biến thể "${variantTitle}" bị trùng trong sản phẩm "${productTitle}"`)
      return
    }
    product.variantKeys.add(variantKey)

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

    if (usesOptions) {
      for (const name of product.optionNames as string[]) addOptionValue(product.optionValues, name, variantOptions[name])
    } else {
      addOptionValue(product.optionValues, DEFAULT_OPTION_TITLE, variantTitle)
    }

    product.draft.variants.push({
      title: variantTitle,
      sku: get("sku") || null,
      options: variantOptions,
      market_price: market.value,
      import_pricing: importPricing,
    })
  })

  const products = order.map((title) => {
    const accumulator = productsByTitle.get(title) as ProductAccumulator
    const names = accumulator.optionNames ?? [DEFAULT_OPTION_TITLE]
    accumulator.draft.options = names.map((name) => ({ title: name, values: accumulator.optionValues.get(name) ?? [] }))
    return accumulator.draft
  }).filter((product) => product.variants.length > 0)

  return { products, errors }
}

export const buildImportPricingTemplateCsv = (): string => {
  const header = ["product_title", "variant_title", "sku", "option:Gender", "option:Size", "option:Màu", "original_price", "import_shipping_price", "imported_total_price", "market_price"].join(",")
  const examples = [
    ["Áo thun basic", "", "AO-M-S-DO", "Man", "S", "Đỏ", "80000", "10000", "", "150000"],
    ["Áo thun basic", "", "AO-M-S-XA", "Man", "S", "Xanh", "80000", "10000", "", "150000"],
    ["Áo thun basic", "", "AO-M-M-DO", "Man", "M", "Đỏ", "80000", "10000", "", "160000"],
    ["Áo thun basic", "", "AO-M-M-XA", "Man", "M", "Xanh", "80000", "10000", "", "160000"],
    ["Áo thun nữ", "", "AO-W-S-DO", "Woman", "S", "Đỏ", "80000", "10000", "", "150000"],
    ["Áo thun nữ", "", "AO-W-M-DO", "Woman", "M", "Đỏ", "80000", "10000", "", "160000"],
    ["Quần jean", "29", "QJ-29", "", "", "", "", "", "250000", "320000"],
    ["Quần jean", "30", "QJ-30", "", "", "", "", "", "250000", "320000"],
    ["Nón lưỡi trai", "Mặc định", "NON-LT", "", "", "", "", "", "", "90000"],
  ]
  return [header, ...examples.map((cells) => cells.join(","))].join("\n") + "\n"
}
