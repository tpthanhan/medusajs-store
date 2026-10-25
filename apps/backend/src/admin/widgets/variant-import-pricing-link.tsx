import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminProductVariant, DetailWidgetProps } from "@medusajs/framework/types"
import { useEffect, useState, type FormEvent } from "react"
import { getMarketVndPrice, withMarketVndPrice, type VariantPrice } from "../lib/variant-price-fields"
import { validateVariantPricing } from "../lib/variant-pricing-validation"

interface ImportPrice {
  original_price: number | null
  import_shipping_price: number | null
  imported_total_price: number
  is_total_overridden: boolean
}

interface VariantResponse {
  variant: { title: string; prices: VariantPrice[] }
}

interface PricingFields {
  originalPrice: string
  importShippingPrice: string
  importedTotalPrice: string
  isTotalOverridden: boolean
  marketPrice: string
}

const MAX_VND_AMOUNT = 2_147_483_647

const readJson = async <T,>(response: Response): Promise<T> => {
  const body = await response.json() as T & { message?: string }
  if (!response.ok) throw new Error(body.message ?? `Yêu cầu thất bại (${response.status})`)
  return body
}

const loadPricing = async (productId: string, variantId: string) => {
  const [{ variant }, { pricing }] = await Promise.all([
    readJson<VariantResponse>(await fetch(`/admin/products/${productId}/variants/${variantId}`)),
    readJson<{ pricing: ImportPrice | null }>(await fetch(`/admin/variant-import-prices/${variantId}`)),
  ])
  return {
    prices: variant.prices ?? [],
    fields: {
      originalPrice: pricing?.original_price == null ? "" : String(pricing.original_price),
      importShippingPrice: pricing?.import_shipping_price == null ? "" : String(pricing.import_shipping_price),
      importedTotalPrice: pricing ? String(pricing.imported_total_price) : "",
      isTotalOverridden: pricing?.is_total_overridden ?? false,
      marketPrice: getMarketVndPrice(variant.prices ?? [])?.amount.toString() ?? "",
    },
  }
}

const VariantImportPricing = ({ data }: DetailWidgetProps<AdminProductVariant>) => {
  const [fields, setFields] = useState<PricingFields>({
    originalPrice: "", importShippingPrice: "", importedTotalPrice: "", isTotalOverridden: false, marketPrice: "",
  })
  const [prices, setPrices] = useState<VariantPrice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  useEffect(() => {
    const productId = data.product_id
    if (!productId) {
      setError("Không tìm thấy sản phẩm của biến thể.")
      setIsLoading(false)
      return
    }
    let active = true
    setIsLoading(true)
    void loadPricing(productId, data.id).then((result) => {
      if (active) {
        setPrices(result.prices)
        setFields(result.fields)
        setIsLoading(false)
      }
    }).catch((cause: unknown) => {
      if (active) {
        setError(cause instanceof Error ? cause.message : "Không tải được giá")
        setIsLoading(false)
      }
    })
    return () => { active = false }
  }, [data.id, data.product_id])

  const changeField = (field: "originalPrice" | "importShippingPrice" | "importedTotalPrice" | "marketPrice", value: string) => {
    setFields((current) => {
      const next = { ...current, [field]: value }
      if (field === "importedTotalPrice") next.isTotalOverridden = true
      if ((field === "originalPrice" || field === "importShippingPrice") && !next.isTotalOverridden) {
        next.importedTotalPrice = next.originalPrice === "" && next.importShippingPrice === ""
          ? "" : String(Number(next.originalPrice || 0) + Number(next.importShippingPrice || 0))
      }
      return next
    })
    setSavedMessage(null)
  }

  const resetTotal = () => {
    setFields((current) => ({
      ...current,
      isTotalOverridden: false,
      importedTotalPrice: current.originalPrice === "" && current.importShippingPrice === ""
        ? "" : String(Number(current.originalPrice || 0) + Number(current.importShippingPrice || 0)),
    }))
    setSavedMessage(null)
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSavedMessage(null)
    const productId = data.product_id
    if (!productId) { setError("Không tìm thấy sản phẩm của biến thể."); return }
    const validationError = validateVariantPricing({ ...fields, title: data.title ?? "biến thể" })
    if (validationError) { setError(validationError); return }
    if (prices.some((price) => price.price_list_id)) {
      setError("Biến thể có giá thuộc bảng giá nâng cao; hãy chỉnh giá bán bằng công cụ Medusa mặc định để tránh thay đổi bảng giá.")
      return
    }
    setIsSaving(true)
    try {
      await readJson(await fetch(`/admin/products/${productId}/variants/${data.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prices: withMarketVndPrice(prices, Number(fields.marketPrice)) }),
      }))
      await readJson(await fetch(`/admin/variant-import-prices/${data.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_price: fields.originalPrice === "" ? null : Number(fields.originalPrice),
          import_shipping_price: fields.importShippingPrice === "" ? null : Number(fields.importShippingPrice),
          imported_total_price: Number(fields.importedTotalPrice),
          is_total_overridden: fields.isTotalOverridden,
        }),
      }))
      const updated = await loadPricing(productId, data.id)
      setPrices(updated.prices)
      setFields(updated.fields)
      setSavedMessage("Đã lưu giá của biến thể. Tải lại trang để cập nhật phần Giá mặc định của Medusa.")
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Không lưu được giá."
      setError(`${message} Giá bán có thể đã được lưu; hãy tải lại và kiểm tra trước khi thử tiếp.`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="bg-ui-bg-base rounded-lg border border-ui-border-base p-6">
      <h2 className="text-ui-fg-base text-lg font-semibold">Giá nhập & giá bán (VND)</h2>
      <p className="text-ui-fg-subtle my-2 text-sm">Giá nhập chỉ hiển thị trong Admin. Giá bán VND cơ bản và giá khu vực VND được đồng bộ khi lưu.</p>
      {error && <p role="alert" className="text-ui-fg-error my-3">{error}</p>}
      {savedMessage && <p role="status" className="text-ui-fg-success my-3">{savedMessage}</p>}
      {isLoading ? <p>Đang tải giá…</p> : data.product_id && <form onSubmit={(event) => void save(event)} className="mt-4 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            ["originalPrice", "Giá nhập gốc (VND)"],
            ["importShippingPrice", "Giá ship về (VND)"],
            ["importedTotalPrice", "Tổng giá đã nhập (VND) *"],
            ["marketPrice", "Giá sẽ bán (VND) *"],
          ] as const).map(([field, label]) => (
            <label key={field} className="flex flex-col gap-1 text-sm">{label}
              <input type="number" min="0" max={MAX_VND_AMOUNT} step="1" value={fields[field]} onChange={(event) => changeField(field, event.target.value)} className="border-ui-border-base rounded border p-2" />
            </label>
          ))}
        </div>
        <button type="button" className="text-ui-fg-interactive self-start text-sm" onClick={resetTotal}>Tính lại tổng từ giá gốc + ship</button>
        <div className="flex items-center justify-between gap-3">
          <a className="text-ui-fg-interactive text-sm" href={`/app/import-pricing/${data.product_id}`}>Chỉnh giá các biến thể khác →</a>
          <button type="submit" disabled={isSaving} className="bg-ui-button-inverted text-ui-fg-on-inverted rounded px-4 py-2 disabled:opacity-50">{isSaving ? "Đang lưu…" : "Lưu giá"}</button>
        </div>
      </form>}
    </section>
  )
}

export const config = defineWidgetConfig({ zone: "product_variant.details" })

export default VariantImportPricing
