import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"
import { useEffect, useState } from "react"

interface ImportPricing {
  originalPrice: string
  importShippingPrice: string
  importedTotalPrice: string
  isTotalOverridden: boolean
}

interface StoredPricing {
  original_price: number | null
  import_shipping_price: number | null
  imported_total_price: number
  is_total_overridden: boolean
}

interface VariantRow {
  id: string
  title: string
  prices?: Array<{ amount: number; currency_code?: string | null }>
}

const emptyPricing = (): ImportPricing => ({
  originalPrice: "",
  importShippingPrice: "",
  importedTotalPrice: "",
  isTotalOverridden: false,
})

const fromStoredPricing = (pricing: StoredPricing | null): ImportPricing => pricing ? ({
  originalPrice: pricing.original_price === null ? "" : String(pricing.original_price),
  importShippingPrice: pricing.import_shipping_price === null ? "" : String(pricing.import_shipping_price),
  importedTotalPrice: String(pricing.imported_total_price),
  isTotalOverridden: pricing.is_total_overridden,
}) : emptyPricing()

const calculatedTotal = (pricing: ImportPricing): string => {
  if (pricing.originalPrice === "" && pricing.importShippingPrice === "") return ""
  return String(Number(pricing.originalPrice || 0) + Number(pricing.importShippingPrice || 0))
}

const VariantImportPricing = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const variants = (data.variants ?? []) as VariantRow[]
  const [values, setValues] = useState<Record<string, ImportPricing>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoadedPrices, setHasLoadedPrices] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const rows = await Promise.all(variants.map(async (variant) => {
          const response = await fetch(`/admin/variant-import-prices/${variant.id}`)
          if (!response.ok) throw new Error(`Could not load import pricing (${response.status})`)
          const body = await response.json() as { pricing: StoredPricing | null }
          return [variant.id, fromStoredPricing(body.pricing)] as const
        }))
        if (active) {
          setValues(Object.fromEntries(rows))
          setHasLoadedPrices(true)
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load import pricing")
      } finally {
        if (active) setIsLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [data.id])

  const change = (id: string, field: "originalPrice" | "importShippingPrice" | "importedTotalPrice", value: string) => {
    setValues((current) => {
      const next = { ...current[id], [field]: value }
      if (field === "importedTotalPrice") {
        next.isTotalOverridden = true
      } else if (!next.isTotalOverridden) {
        next.importedTotalPrice = calculatedTotal(next)
      }
      return { ...current, [id]: next }
    })
  }

  const resetTotal = (id: string) => {
    setValues((current) => {
      const next = { ...current[id], isTotalOverridden: false }
      next.importedTotalPrice = calculatedTotal(next)
      return { ...current, [id]: next }
    })
  }

  const save = async (variant: VariantRow) => {
    const pricing = values[variant.id]
    const amounts = [pricing.originalPrice, pricing.importShippingPrice, pricing.importedTotalPrice]
    if (
      !pricing.importedTotalPrice ||
      amounts.some((amount) => amount !== "" && (!Number.isSafeInteger(Number(amount)) || Number(amount) < 0))
    ) {
      setError("Imported total is required; all prices must be non-negative whole VND amounts.")
      return
    }

    setSavingId(variant.id)
    setError(null)
    setSuccessId(null)
    try {
      const response = await fetch(`/admin/variant-import-prices/${variant.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_price: pricing.originalPrice === "" ? null : Number(pricing.originalPrice),
          import_shipping_price: pricing.importShippingPrice === "" ? null : Number(pricing.importShippingPrice),
          imported_total_price: Number(pricing.importedTotalPrice),
          is_total_overridden: pricing.isTotalOverridden,
        }),
      })
      if (!response.ok) {
        const body = await response.json() as { message?: string }
        throw new Error(body.message ?? `Could not save variant pricing (${response.status})`)
      }
      const body = await response.json() as { pricing: StoredPricing }
      setValues((current) => ({ ...current, [variant.id]: fromStoredPricing(body.pricing) }))
      setSuccessId(variant.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save variant pricing")
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className="bg-ui-bg-base rounded-lg border border-ui-border-base p-6">
      <h2 className="text-ui-fg-base mb-2 text-lg font-semibold">Import pricing (VND)</h2>
      <p className="text-ui-fg-subtle mb-4 text-sm">Set the required market selling price in each variant’s standard Medusa VND price settings. Import costs are private to Admin.</p>
      {error && <p role="alert" className="text-ui-fg-error mb-3">{error}</p>}
      {isLoading && <p>Loading import costs…</p>}
      {!isLoading && hasLoadedPrices && variants.map((variant) => {
        const pricing = values[variant.id] ?? emptyPricing()
        return (
          <div key={variant.id} className="border-ui-border-base border-t py-4">
            <h3 className="mb-3 font-medium">{variant.title}</h3>
            <div className="grid gap-3 md:grid-cols-4">
              {([
                ["originalPrice", "Original price (optional)"],
                ["importShippingPrice", "Import shipping (optional)"],
                ["importedTotalPrice", "Imported total (required)"],
              ] as const).map(([field, label]) => (
                <label key={field} className="text-ui-fg-subtle flex flex-col gap-1 text-sm">
                  {label}
                  <input className="border-ui-border-base rounded border p-2" type="number" min="0" step="1" value={pricing[field]} onChange={(event) => change(variant.id, field, event.target.value)} />
                </label>
              ))}
              <label className="text-ui-fg-subtle flex flex-col gap-1 text-sm">Market price (VND, required)
                <input readOnly className="border-ui-border-base rounded border p-2" value={variant.prices?.find((price) => price.currency_code === "vnd")?.amount ?? "Missing VND price"} />
              </label>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button type="button" className="text-ui-fg-interactive text-sm" onClick={() => resetTotal(variant.id)}>Reset total to calculated</button>
              <button type="button" disabled={savingId === variant.id} className="bg-ui-button-inverted text-ui-fg-on-inverted rounded px-3 py-1 text-sm disabled:opacity-50" onClick={() => void save(variant)}>Save</button>
              {successId === variant.id && <span role="status" className="text-sm">Saved</span>}
            </div>
          </div>
        )
      })}
    </section>
  )
}

export const config = defineWidgetConfig({ zone: "product.details" })

export default VariantImportPricing
