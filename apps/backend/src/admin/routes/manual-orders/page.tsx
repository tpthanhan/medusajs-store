import { defineRouteConfig } from "@medusajs/admin-sdk"
import { useEffect, useState, type FormEvent } from "react"

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
  quantity: number
}

const CreateManualOrder = () => {
  const [regions, setRegions] = useState<Region[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState("")
  const [regionId, setRegionId] = useState("")
  const [email, setEmail] = useState("")
  const [items, setItems] = useState<OrderItem[]>([{ variant_id: "", quantity: 1 }])
  const [shippingFee, setShippingFee] = useState(0)
  const [deposit, setDeposit] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [regionsResponse, productsResponse] = await Promise.all([
          fetch("/admin/regions?limit=100"),
          fetch(`/admin/products?limit=100&q=${encodeURIComponent(productSearch)}`),
        ])
        if (!regionsResponse.ok || !productsResponse.ok) {
          throw new Error("Could not load regions or products")
        }
        const regionsBody = await regionsResponse.json() as { regions: Region[] }
        const productsBody = await productsResponse.json() as { products: Product[] }
        if (active) {
          setRegions(regionsBody.regions.filter((region) => region.currency_code === "vnd"))
          setProducts((previous) => {
            const byId = new Map(previous.map((product) => [product.id, product]))
            productsBody.products.forEach((product) => byId.set(product.id, product))
            return [...byId.values()]
          })
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load order form")
      }
    }
    void load()
    return () => { active = false }
  }, [productSearch])

  const variants = products.flatMap((product) =>
    (product.variants ?? []).map((variant) => ({ ...variant, label: `${product.title} — ${variant.title}` }))
  )

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const response = await fetch("/admin/manual-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region_id: regionId,
          email,
          items,
          shipping_fee: shippingFee,
          deposit,
        }),
      })
      if (!response.ok) {
        const body = await response.json() as { message?: string }
        throw new Error(body.message ?? `Could not create order (${response.status})`)
      }
      const { order } = await response.json() as { order: { id: string } }
      window.location.assign(`/app/orders/${order.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create order")
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-2 text-2xl font-semibold">Create manual order</h1>
      <p className="text-ui-fg-subtle mb-6">Prices are calculated from each variant’s VND market price. No shipping option or fulfillment is created.</p>
      {error && <p role="alert" className="text-ui-fg-error mb-4">{error}</p>}
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1">Customer email
          <input required type="email" className="border-ui-border-base rounded border p-2" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1">VND region
          <select required className="border-ui-border-base rounded border p-2" value={regionId} onChange={(event) => setRegionId(event.target.value)}>
            <option value="">Select region</option>
            {regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
          </select>
        </label>
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold">Items</h2>
          <label className="flex flex-col gap-1 text-sm">Search more products
            <input type="search" className="border-ui-border-base rounded border p-2" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Product name" />
          </label>
          {items.map((item, index) => (
            <div key={index} className="flex gap-2">
              <select required className="border-ui-border-base min-w-0 flex-1 rounded border p-2" value={item.variant_id} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, variant_id: event.target.value } : row))}>
                <option value="">Select variant</option>
                {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}
              </select>
              <input aria-label="Quantity" required type="number" min="1" step="1" className="border-ui-border-base w-24 rounded border p-2" value={item.quantity} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: Number(event.target.value) } : row))} />
              <button type="button" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Remove</button>
            </div>
          ))}
          <button type="button" className="text-ui-fg-interactive self-start" onClick={() => setItems((current) => [...current, { variant_id: "", quantity: 1 }])}>Add item</button>
        </div>
        <label className="flex flex-col gap-1">Manual shipping fee (VND)
          <input required type="number" min="0" step="1" className="border-ui-border-base rounded border p-2" value={shippingFee} onChange={(event) => setShippingFee(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-1">Deposit already received (VND)
          <input required type="number" min="0" step="1" className="border-ui-border-base rounded border p-2" value={deposit} onChange={(event) => setDeposit(Number(event.target.value))} />
        </label>
        <button type="submit" disabled={isSubmitting} className="bg-ui-button-inverted text-ui-fg-on-inverted self-start rounded px-4 py-2 disabled:opacity-50">{isSubmitting ? "Creating…" : "Create order"}</button>
      </form>
    </main>
  )
}

export const config = defineRouteConfig({ label: "Create manual order", nested: "/orders" })

export default CreateManualOrder
