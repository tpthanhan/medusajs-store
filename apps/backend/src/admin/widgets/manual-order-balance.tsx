import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types"
import { useEffect, useState, type FormEvent } from "react"
import { MANUAL_ORDER_METADATA_KEY } from "../../lib/manual-order-constants"

interface ManualOrderSummary {
  total: number
  deposit: number
  paid: number
  remaining: number
  tip: number
  payments: Array<{ id: string; amount: number; created_at: string }>
}

const formatVnd = (amount: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount)

const ManualOrderBalance = ({ data }: DetailWidgetProps<AdminOrder>) => {
  const [summary, setSummary] = useState<ManualOrderSummary | null>(null)
  const [amount, setAmount] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const isManualOrder = data.metadata?.[MANUAL_ORDER_METADATA_KEY] === true

  useEffect(() => {
    if (!isManualOrder) return
    let active = true
    const load = async () => {
      try {
        const response = await fetch(`/admin/manual-orders/${data.id}`)
        if (!response.ok) throw new Error("Could not load manual payment balance")
        const result = await response.json() as ManualOrderSummary
        if (active) setSummary(result)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load balance")
      }
    }
    void load()
    return () => { active = false }
  }, [data.id, isManualOrder])

  if (!isManualOrder) return null

  const recordPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch(`/admin/manual-orders/${data.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount) }),
      })
      if (!response.ok) {
        const result = await response.json() as { message?: string }
        throw new Error(result.message ?? "Could not record payment")
      }
      setSummary(await response.json() as ManualOrderSummary)
      setAmount("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record payment")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="bg-ui-bg-base rounded-lg border border-ui-border-base p-6">
      <h2 className="mb-3 text-lg font-semibold">Manual payments (VND)</h2>
      {error && <p role="alert" className="text-ui-fg-error mb-3">{error}</p>}
      {summary && <>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt>Order total</dt><dd>{formatVnd(summary.total)}</dd>
          <dt>Deposit</dt><dd>{formatVnd(summary.deposit)}</dd>
          <dt>Total received</dt><dd>{formatVnd(summary.paid)}</dd>
          <dt>Remaining</dt><dd>{formatVnd(summary.remaining)}</dd>
          <dt>Tip (paid above total)</dt><dd>{formatVnd(summary.tip)}</dd>
        </dl>
        <ul className="my-4 text-sm">{summary.payments.map((payment) => <li key={payment.id}>{formatVnd(payment.amount)} — {new Date(payment.created_at).toLocaleString()}</li>)}</ul>
        <form onSubmit={(event) => void recordPayment(event)} className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">Additional payment received (VND)
            <input required type="number" min="1" step="1" className="border-ui-border-base rounded border p-2" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <button type="submit" disabled={isSaving} className="bg-ui-button-inverted text-ui-fg-on-inverted rounded px-3 py-2 text-sm disabled:opacity-50">Record payment</button>
        </form>
      </>}
    </section>
  )
}

export const config = defineWidgetConfig({ zone: "order.details" })

export default ManualOrderBalance
