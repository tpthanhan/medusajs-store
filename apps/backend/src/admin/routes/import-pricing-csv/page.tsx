import { defineRouteConfig } from "@medusajs/admin-sdk"
import { btn } from "../../lib/button-class"
import { ArrowUpTray } from "@medusajs/icons"
import { useState, type ChangeEvent } from "react"
import {
  buildImportPricingTemplateCsv,
  IMPORT_PRICING_CSV_HEADERS,
  parseImportPricingCsv,
  type ImportPricingProductDraft,
} from "../../../lib/import-pricing-csv"

interface ImportResult {
  created: Array<{ title: string; id: string; variants: number }>
  failed: Array<{ title: string; error: string }>
  created_count: number
  failed_count: number
}

const ImportPricingCsv = () => {
  const [fileName, setFileName] = useState("")
  const [products, setProducts] = useState<ImportPricingProductDraft[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const variantCount = products.reduce((sum, product) => sum + product.variants.length, 0)

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setResult(null)
    setError(null)
    if (!file) { setFileName(""); setProducts([]); setParseErrors([]); return }
    setFileName(file.name)
    const text = await file.text()
    const parsed = parseImportPricingCsv(text)
    setProducts(parsed.products)
    setParseErrors(parsed.errors)
  }

  const downloadTemplate = () => {
    const blob = new Blob(["\uFEFF", buildImportPricingTemplateCsv()], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "import-pricing-template.csv"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const runImport = async () => {
    if (!products.length) return
    setIsImporting(true)
    setError(null)
    setResult(null)
    try {
      const response = await fetch("/admin/import-pricing/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.message ?? `Nhập thất bại (${response.status})`)
      setResult(body as ImportResult)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không nhập được sản phẩm.")
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Nhập sản phẩm từ CSV (kèm giá nhập)</h1>
        <p className="text-ui-fg-subtle text-sm">
          Mỗi dòng là một biến thể. Các dòng cùng <code>product_title</code> gộp thành một sản phẩm.
          Sản phẩm được tạo ở trạng thái đã đăng (published) với shipping profile mặc định.
          Để SP có nhiều option (ví dụ Size × Màu), thêm cột <code>option:Size</code>, <code>option:Màu</code>… — mỗi dòng là một tổ hợp. Nếu không có cột option nào thì dùng <code>variant_title</code>.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={downloadTemplate} className={btn("secondary", "small")}>
          Tải mẫu CSV
        </button>
        <span className="text-ui-fg-subtle text-sm">
          Cột cơ bản: {IMPORT_PRICING_CSV_HEADERS.join(", ")} (+ tùy chọn các cột option:&lt;Tên&gt;)
        </span>
      </div>

      <input type="file" accept=".csv,text/csv" onChange={(event) => void onFile(event)} />

      {fileName && (
        <p className="text-sm">
          <strong>{fileName}</strong> — {products.length} sản phẩm, {variantCount} biến thể
        </p>
      )}

      {parseErrors.length > 0 && (
        <div className="text-ui-fg-error text-sm">
          <p className="font-medium">Lỗi dữ liệu CSV:</p>
          <ul className="list-disc pl-5">
            {parseErrors.map((message, idx) => <li key={idx}>{message}</li>)}
          </ul>
        </div>
      )}

      <button
        type="button"
        disabled={isImporting || !products.length || parseErrors.length > 0}
        onClick={() => void runImport()}
        className={btn("primary", "large", "w-fit")}
      >
        {isImporting ? "Đang nhập..." : `Nhập ${products.length} sản phẩm`}
      </button>

      {error && <p className="text-ui-fg-error text-sm">{error}</p>}

      {result && (
        <div className="text-sm">
          <p className="text-ui-fg-success">Đã tạo {result.created_count} sản phẩm, thất bại {result.failed_count}.</p>
          {result.failed.length > 0 && (
            <ul className="text-ui-fg-error list-disc pl-5">
              {result.failed.map((item, idx) => <li key={idx}>{item.title}: {item.error}</li>)}
            </ul>
          )}
          {result.created.length > 0 && (
            <ul className="list-disc pl-5">
              {result.created.map((item) => (
                <li key={item.id}>
                  <a className="text-ui-fg-interactive underline" href={`/app/products/${item.id}`}>{item.title}</a> — {item.variants} biến thể
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Nhập SP từ CSV",
  icon: ArrowUpTray,
  nested: "/products",
})

export default ImportPricingCsv
