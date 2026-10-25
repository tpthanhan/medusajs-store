import { defineRouteConfig } from "@medusajs/admin-sdk"
import { btn } from "../../lib/button-class"
import { useEffect, useRef, useState, type FormEvent } from "react"

interface Region {
  id: string
  name: string
  currency_code: string
}

interface Variant {
  id: string
  title: string
}

interface Product {
  id: string
  title: string
  variants: Variant[]
}

interface OrderItem {
  variant_id: string
  label: string
  quantity: number
}

const PRODUCT_PAGE_LIMIT = 20
const SEARCH_DEBOUNCE_MS = 250

const CreateManualOrder = () => {
  const [regions, setRegions] = useState<Region[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [productCount, setProductCount] = useState(0)
  const [productSearch, setProductSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [productOffset, setProductOffset] = useState(0)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [pickerError, setPickerError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [regionId, setRegionId] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [items, setItems] = useState<OrderItem[]>([])
  const [shippingFee, setShippingFee] = useState(0)
  const [deposit, setDeposit] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    void fetch("/admin/regions?limit=100")
      .then(async (response) => {
        if (!response.ok) throw new Error("Không thể tải khu vực")
        return response.json() as Promise<{ regions: Region[] }>
      })
      .then(({ regions }) => {
        if (active) setRegions(regions.filter((region) => region.currency_code === "vnd"))
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Không thể tải khu vực")
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isPickerOpen && !dialog.open) {
      dialog.showModal()
      searchRef.current?.focus()
    } else if (!isPickerOpen && dialog.open) {
      dialog.close()
    }
  }, [isPickerOpen])

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(productSearch), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [productSearch])

  useEffect(() => {
    if (!isPickerOpen) return
    let active = true
    setIsLoadingProducts(true)
    setPickerError(null)
    const query = new URLSearchParams({ limit: String(PRODUCT_PAGE_LIMIT), offset: String(productOffset), q: debouncedSearch })
    void fetch(`/admin/products?${query}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Không thể tải danh sách sản phẩm")
        return response.json() as Promise<{ products: Product[]; count: number }>
      })
      .then(({ products, count }) => {
        if (active) {
          setProducts(products)
          setProductCount(count)
        }
      })
      .catch((cause: unknown) => {
        if (active) setPickerError(cause instanceof Error ? cause.message : "Không thể tải sản phẩm")
      })
      .finally(() => {
        if (active) setIsLoadingProducts(false)
      })
    return () => { active = false }
  }, [isPickerOpen, debouncedSearch, productOffset])

  const addVariant = (product: Product, variant: Variant) => {
    setItems((current) => current.some((item) => item.variant_id === variant.id)
      ? current
      : [...current, { variant_id: variant.id, label: `${product.title} — ${variant.title}`, quantity: 1 }])
    setError(null)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!items.length) {
      setError("Vui lòng chọn ít nhất một biến thể từ danh sách sản phẩm.")
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch("/admin/manual-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region_id: regionId,
          customer_name: customerName,
          address,
          phone,
          items: items.map(({ variant_id, quantity }) => ({ variant_id, quantity })),
          shipping_fee: shippingFee,
          deposit,
        }),
      })
      if (!response.ok) {
        const body = await response.json() as { message?: string }
        throw new Error(body.message ?? `Không thể tạo đơn hàng (${response.status})`)
      }
      const { order } = await response.json() as { order: { id: string } }
      window.location.assign(`/app/orders/${order.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo đơn hàng")
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-2 text-2xl font-semibold">Tạo đơn hàng thủ công</h1>
      <p className="text-ui-fg-subtle mb-6">Giá được tính theo giá bán VND của từng biến thể. Không tạo phương thức vận chuyển hoặc yêu cầu xử lý đơn.</p>
      {error && <p role="alert" className="text-ui-fg-error mb-4">{error}</p>}
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1">Tên khách hàng
          <input required type="text" className="border-ui-border-base rounded border p-2" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1">Địa chỉ
          <input required type="text" className="border-ui-border-base rounded border p-2" value={address} onChange={(event) => setAddress(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1">Số điện thoại
          <input required type="tel" className="border-ui-border-base rounded border p-2" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1">Khu vực sử dụng VND
          <select required className="border-ui-border-base rounded border p-2" value={regionId} onChange={(event) => setRegionId(event.target.value)}>
            <option value="">Chọn khu vực</option>
            {regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
          </select>
        </label>
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold">Sản phẩm đã chọn</h2>
          {items.length === 0 && <p className="text-ui-fg-subtle text-sm">Chưa chọn sản phẩm nào.</p>}
          {items.map((item) => (
            <div key={item.variant_id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate" title={item.label}>{item.label}</span>
              <input aria-label={`Số lượng ${item.label}`} required type="number" min="1" step="1" className="border-ui-border-base w-24 rounded border p-2" value={item.quantity} onChange={(event) => setItems((current) => current.map((row) => row.variant_id === item.variant_id ? { ...row, quantity: Number(event.target.value) } : row))} />
              <button type="button" onClick={() => setItems((current) => current.filter((row) => row.variant_id !== item.variant_id))} className={btn("danger", "small")}>Xóa</button>
            </div>
          ))}
          <button type="button" onClick={() => setIsPickerOpen(true)} className={btn("secondary", "base", "self-start")}>Chọn sản phẩm</button>
        </div>
        <label className="flex flex-col gap-1">Phí vận chuyển thủ công (VND)
          <input required type="number" min="0" step="1" className="border-ui-border-base rounded border p-2" value={shippingFee} onChange={(event) => setShippingFee(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-1">Tiền đặt cọc đã nhận (VND)
          <input required type="number" min="0" step="1" className="border-ui-border-base rounded border p-2" value={deposit} onChange={(event) => setDeposit(Number(event.target.value))} />
        </label>
        <button type="submit" disabled={isSubmitting} className={btn("primary", "large", "self-start")}>{isSubmitting ? "Đang tạo…" : "Tạo đơn hàng"}</button>
      </form>
      <dialog ref={dialogRef} onClose={() => setIsPickerOpen(false)} aria-labelledby="product-picker-title" className="bg-ui-bg-base text-ui-fg-base border-ui-border-base max-h-[85vh] w-full max-w-2xl rounded-lg border p-0 shadow-xl backdrop:bg-black/50">
        <div className="flex max-h-[85vh] flex-col">
          <div className="border-ui-border-base flex items-center justify-between border-b p-5">
            <h2 id="product-picker-title" className="text-lg font-semibold">Chọn sản phẩm trong hệ thống</h2>
            <button type="button" aria-label="Đóng" onClick={() => setIsPickerOpen(false)} className={btn("ghost", "small")}>Đóng</button>
          </div>
          <div className="flex flex-col gap-3 p-5">
            <label className="flex flex-col gap-1 text-sm">Tìm theo tên sản phẩm
              <input ref={searchRef} type="search" className="border-ui-border-base rounded border p-2" value={productSearch} onChange={(event) => { setProductSearch(event.target.value); setProductOffset(0) }} placeholder="Nhập tên sản phẩm" />
            </label>
            {pickerError && <p role="alert" className="text-ui-fg-error">{pickerError}</p>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
            {isLoadingProducts ? <p>Đang tải sản phẩm…</p> : products.length === 0 ? <p className="text-ui-fg-subtle">Không tìm thấy sản phẩm.</p> : products.map((product) => (
              <div key={product.id} className="border-ui-border-base border-t py-3">
                <h3 className="font-semibold">{product.title}</h3>
                {!product.variants?.length && <p className="text-ui-fg-subtle text-sm">Sản phẩm chưa có biến thể.</p>}
                {(product.variants ?? []).map((variant) => {
                  const isSelected = items.some((item) => item.variant_id === variant.id)
                  return <div key={variant.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>{variant.title}</span>
                    <button type="button" disabled={isSelected} onClick={() => addVariant(product, variant)} className={btn("secondary", "small")}>{isSelected ? "Đã chọn" : "Thêm vào đơn"}</button>
                  </div>
                })}
              </div>
            ))}
          </div>
          <div className="border-ui-border-base flex items-center justify-between border-t p-5 text-sm">
            <span>{productCount} sản phẩm · Đã chọn {items.length} biến thể</span>
            <div className="flex gap-3">
              <button type="button" disabled={productOffset === 0 || isLoadingProducts} onClick={() => setProductOffset((offset) => Math.max(0, offset - PRODUCT_PAGE_LIMIT))} className={btn("secondary", "small")}>Trước</button>
              <button type="button" disabled={productOffset + PRODUCT_PAGE_LIMIT >= productCount || isLoadingProducts} onClick={() => setProductOffset((offset) => offset + PRODUCT_PAGE_LIMIT)} className={btn("secondary", "small")}>Tiếp</button>
              <button type="button" onClick={() => setIsPickerOpen(false)} className={btn("primary", "base")}>Xong</button>
            </div>
          </div>
        </div>
      </dialog>
    </main>
  )
}

export const config = defineRouteConfig({ label: "Tạo đơn hàng thủ công", nested: "/orders" })

export default CreateManualOrder
