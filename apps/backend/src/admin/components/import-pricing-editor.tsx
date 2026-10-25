import { useEffect, useState, type FormEvent } from "react"
import { btn } from "../lib/button-class"
import { useNavigate } from "react-router-dom"
import { getMarketVndPrice, withMarketVndPrice, type VariantPrice } from "../lib/variant-price-fields"
import { hasPricingInput, validateVariantPricing } from "../lib/variant-pricing-validation"

interface StoredImportPrice {
  original_price: number | null
  import_shipping_price: number | null
  imported_total_price: number
  is_total_overridden: boolean
}

interface ProductVariant {
  id: string
  title: string
  sku?: string | null
  prices: VariantPrice[]
}

interface Product {
  id: string
  title: string
  variants?: ProductVariant[]
}

interface PricingRow {
  id?: string
  title: string
  sku: string
  originalPrice: string
  importShippingPrice: string
  importedTotalPrice: string
  isTotalOverridden: boolean
  marketPrice: string
  prices: VariantPrice[]
}

const MAX_VND_AMOUNT = 2_147_483_647

const blankRow = (): PricingRow => ({
  title: "",
  sku: "",
  originalPrice: "",
  importShippingPrice: "",
  importedTotalPrice: "",
  isTotalOverridden: false,
  marketPrice: "",
  prices: [],
})

const readJson = async <T,>(response: Response): Promise<T> => {
  const body = await response.json() as T & { message?: string }
  if (!response.ok) throw new Error(body.message ?? `Yêu cầu thất bại (${response.status})`)
  return body
}

const fetchDefaultShippingProfileId = async (): Promise<string> => {
  const { shipping_profiles } = await readJson<{ shipping_profiles: Array<{ id: string; type: string }> }>(
    await fetch("/admin/shipping-profiles?limit=100")
  )
  const profile = shipping_profiles.find((item) => item.type === "default") ?? shipping_profiles[0]
  if (!profile) throw new Error("Không tìm thấy shipping profile mặc định để gán cho sản phẩm.")
  return profile.id
}

const loadProduct = async (productId: string) => {
  const { product } = await readJson<{ product: Product }>(await fetch(`/admin/products/${productId}`))
  const rows = await Promise.all((product.variants ?? []).map(async (variant): Promise<PricingRow> => {
    const { pricing } = await readJson<{ pricing: StoredImportPrice | null }>(
      await fetch(`/admin/variant-import-prices/${variant.id}`)
    )
    return {
      id: variant.id,
      title: variant.title,
      sku: variant.sku ?? "",
      prices: variant.prices ?? [],
      marketPrice: getMarketVndPrice(variant.prices ?? [])?.amount.toString() ?? "",
      originalPrice: pricing?.original_price == null ? "" : String(pricing.original_price),
      importShippingPrice: pricing?.import_shipping_price == null ? "" : String(pricing.import_shipping_price),
      importedTotalPrice: pricing ? String(pricing.imported_total_price) : "",
      isTotalOverridden: pricing?.is_total_overridden ?? false,
    }
  }))
  return { product, rows }
}

const saveImportPrice = async (variantId: string, row: PricingRow) => {
  await readJson(await fetch(`/admin/variant-import-prices/${variantId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      original_price: row.originalPrice === "" ? null : Number(row.originalPrice),
      import_shipping_price: row.importShippingPrice === "" ? null : Number(row.importShippingPrice),
      imported_total_price: Number(row.importedTotalPrice),
      is_total_overridden: row.isTotalOverridden,
    }),
  }))
}

export const ImportPricingEditor = ({ productId }: { productId?: string }) => {
  const navigate = useNavigate()
  const [title, setTitle] = useState("")
  const [rows, setRows] = useState<PricingRow[]>([blankRow()])
  const [isLoading, setIsLoading] = useState(Boolean(productId))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [createdProductId, setCreatedProductId] = useState<string | null>(null)

  useEffect(() => {
    if (!productId) return
    let active = true
    void loadProduct(productId).then(({ product, rows: loadedRows }) => {
      if (active) {
        setTitle(product.title)
        setRows(loadedRows)
        setIsLoading(false)
      }
    }).catch((cause: unknown) => {
      if (active) {
        setError(cause instanceof Error ? cause.message : "Không tải được sản phẩm")
        setIsLoading(false)
      }
    })
    return () => { active = false }
  }, [productId])

  const changeRow = (index: number, field: "title" | "sku" | "originalPrice" | "importShippingPrice" | "importedTotalPrice" | "marketPrice", value: string) => {
    setRows((current) => current.map((row, rowIndex) => {
      if (rowIndex !== index) return row
      const next = { ...row, [field]: value }
      if (field === "importedTotalPrice") next.isTotalOverridden = true
      if ((field === "originalPrice" || field === "importShippingPrice") && !next.isTotalOverridden) {
        next.importedTotalPrice = next.originalPrice === "" && next.importShippingPrice === ""
          ? ""
          : String(Number(next.originalPrice || 0) + Number(next.importShippingPrice || 0))
      }
      return next
    }))
    setSavedMessage(null)
  }

  const resetTotal = (index: number) => {
    setRows((current) => current.map((row, rowIndex) => rowIndex !== index ? row : ({
      ...row,
      isTotalOverridden: false,
      importedTotalPrice: row.originalPrice === "" && row.importShippingPrice === ""
        ? "" : String(Number(row.originalPrice || 0) + Number(row.importShippingPrice || 0)),
    })))
    setSavedMessage(null)
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSavedMessage(null)
    if (createdProductId) {
      navigate(`/import-pricing/${createdProductId}`)
      return
    }
    if (!title.trim()) { setError("Tên sản phẩm là bắt buộc."); return }
    if (!rows.length || rows.some((row) => !row.title.trim()) || new Set(rows.map((row) => row.title.trim())).size !== rows.length) {
      setError("Cần ít nhất một biến thể, có tên và không trùng tên.")
      return
    }
    const invalidRow = rows.filter(hasPricingInput).map(validateVariantPricing).find(Boolean)
    if (invalidRow) { setError(invalidRow); return }

    setIsSaving(true)
    let newProductId: string | null = null
    try {
      const shippingProfileId = await fetchDefaultShippingProfileId()
      const { product } = await readJson<{ product: Product }>(await fetch("/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          status: "published",
          shipping_profile_id: shippingProfileId,
          options: [{ title: "Variant", values: rows.map((row) => row.title.trim()) }],
          variants: rows.map((row) => ({
            title: row.title.trim(),
            ...(row.sku.trim() ? { sku: row.sku.trim() } : {}),
            options: { Variant: row.title.trim() },
            prices: hasPricingInput(row) ? [{ currency_code: "vnd", amount: Number(row.marketPrice) }] : [],
          })),
        }),
      }))
      newProductId = product.id
      setCreatedProductId(product.id)
      for (const row of rows.filter(hasPricingInput)) {
        const variant = product.variants?.find((item) => item.title === row.title.trim())
        if (!variant) throw new Error(`Sản phẩm đã tạo, nhưng không tìm được biến thể ${row.title} để lưu giá nhập.`)
        await saveImportPrice(variant.id, row)
      }
      navigate(`/import-pricing/${product.id}`)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Không tạo được sản phẩm."
      setError(newProductId ? `${message} Một số giá có thể đã được lưu; hãy mở sản phẩm đã tạo để kiểm tra.` : message)
    } finally {
      setIsSaving(false)
    }
  }

  const saveVariant = async (index: number) => {
    const row = rows[index]
    if (!productId || !row?.id) return
    setError(null)
    setSavedMessage(null)
    const validationError = validateVariantPricing(row)
    if (validationError) { setError(validationError); return }
    if (row.prices.some((price) => price.price_list_id)) {
      setError("Biến thể có giá thuộc bảng giá nâng cao; hãy chỉnh giá bán bằng công cụ Medusa mặc định để tránh thay đổi bảng giá.")
      return
    }

    setIsSaving(true)
    try {
      await readJson(await fetch(`/admin/products/${productId}/variants/${row.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prices: withMarketVndPrice(row.prices, Number(row.marketPrice)) }),
      }))
      await saveImportPrice(row.id, row)
      const updated = await loadProduct(productId)
      setRows((current) => current.map((item) => item.id === row.id
        ? updated.rows.find((saved) => saved.id === row.id) ?? item
        : item))
      setSavedMessage(`Đã lưu giá cho biến thể ${row.title}.`)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Không lưu được giá."
      setError(`${message} Giá bán có thể đã được lưu; hãy tải lại và kiểm tra trước khi thử tiếp.`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-ui-fg-base text-2xl font-semibold">{productId ? `Giá nhập & giá bán — ${title}` : "Tạo sản phẩm với giá nhập"}</h1>
          <p className="text-ui-fg-subtle mt-1 text-sm">Giá nhập chỉ hiển thị trong Admin. Một giá bán được dùng cho VND cơ bản và các giá khu vực VND (như Vietnam).</p>
        </div>
        {productId && <a className="text-ui-fg-interactive text-sm" href={`/app/products/${productId}`}>Xem sản phẩm</a>}
      </div>
      {error && <p role="alert" className="text-ui-fg-error rounded border border-ui-border-error p-3">{error}</p>}
      {createdProductId && error && <a className="text-ui-fg-interactive" href={`/app/import-pricing/${createdProductId}`}>Sản phẩm đã được tạo — mở lại để hoàn tất giá nhập</a>}
      {savedMessage && <p role="status" className="text-ui-fg-success">{savedMessage}</p>}
      {isLoading ? <p>Đang tải…</p> : (
        <form onSubmit={(event) => productId ? event.preventDefault() : void save(event)} className="bg-ui-bg-base flex flex-col gap-5 rounded-lg border border-ui-border-base p-6">
          {!productId && <label className="flex max-w-md flex-col gap-1 text-sm">Tên sản phẩm *
            <input className="rounded border border-ui-border-base p-2" value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>}
          {productId && !rows.length && <p className="text-ui-fg-subtle text-sm">Sản phẩm chưa có biến thể. Hãy thêm biến thể trong Medusa rồi quay lại chỉnh giá.</p>}
          <div className="overflow-x-auto">
            <div className="min-w-[950px]">
              <div className="grid grid-cols-5 gap-3 border-b border-ui-border-base pb-2 text-sm font-semibold">
                <span>Biến thể</span><span>Giá gốc (VND)</span><span>Giá ship về (VND)</span><span>Tổng giá đã nhập (VND) *</span><span>Giá bán thị trường (VND) *</span>
              </div>
              {rows.map((row, index) => (
                <div key={row.id ?? index} className="grid grid-cols-5 gap-3 border-b border-ui-border-base py-3">
                  <div className="flex flex-col gap-2">
                    {productId ? <a className="text-ui-fg-interactive" href={`/app/products/${productId}/variants/${row.id}`}>{row.title}</a> : <input aria-label={`Tên biến thể ${index + 1}`} placeholder="Tên biến thể" className="rounded border border-ui-border-base p-2" value={row.title} onChange={(event) => changeRow(index, "title", event.target.value)} required />}
                    {!productId && <input aria-label={`SKU ${index + 1}`} placeholder="SKU (không bắt buộc)" className="rounded border border-ui-border-base p-2" value={row.sku} onChange={(event) => changeRow(index, "sku", event.target.value)} />}
                    {!productId && rows.length > 1 && <button type="button" onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))} className={btn("danger", "small")}>Xóa biến thể</button>}
                    {productId && <button type="button" disabled={isSaving} onClick={() => void saveVariant(index)} className={btn("primary", "small")}>{isSaving ? "Đang lưu…" : "Lưu biến thể này"}</button>}
                  </div>
                  {(["originalPrice", "importShippingPrice", "importedTotalPrice", "marketPrice"] as const).map((field) => (
                    <div key={field} className="flex flex-col gap-1">
                      <input aria-label={`${field} ${row.title || index + 1}`} type="number" min="0" max={MAX_VND_AMOUNT} step="1" className="w-full rounded border border-ui-border-base p-2" value={row[field]} onChange={(event) => changeRow(index, field, event.target.value)} />
                      {field === "importedTotalPrice" && <button type="button" onClick={() => resetTotal(index)} className={btn("ghost", "small")}>Tính lại từ giá gốc + ship</button>}
                      {field === "marketPrice" && row.prices.some((price) => price.rules?.region_id) && <span className="text-ui-fg-subtle text-xs">Giá khu vực VND hiện có sẽ được đồng bộ khi lưu.</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          {!productId && <p className="text-ui-fg-subtle text-sm">Có thể để trống giá của biến thể chưa cần định giá. Sản phẩm mới được đăng (published) ngay; sau khi tạo, hãy hoàn thiện ảnh, tồn kho và kênh bán trên trang Medusa.</p>}
          {productId && <p className="text-ui-fg-subtle text-sm">Chỉ lưu biến thể bạn chọn; các biến thể khác không bắt buộc nhập giá.</p>}
          <div className="flex items-center justify-between gap-3">
            {!productId ? <button type="button" onClick={() => setRows((current) => [...current, blankRow()])} className={btn("secondary", "base")}>+ Thêm biến thể</button> : <span />}
            {!productId && <button disabled={isSaving || !rows.length} type="submit" className={btn("primary", "large")}>{isSaving ? "Đang lưu…" : "Tạo sản phẩm"}</button>}
          </div>
        </form>
      )}
    </div>
  )
}
