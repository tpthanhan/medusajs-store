import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { btn } from "../lib/button-class"
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types"
import { useEffect, useState, type FormEvent } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { DEFAULT_MANUAL_DELIVERY_STATUS, MANUAL_DELIVERY_STATUS_LABELS, MANUAL_DELIVERY_STATUSES, MANUAL_ORDER_METADATA_KEY, type ManualDeliveryStatus } from "../../lib/manual-order-constants"

interface ManualOrderSummary {
  total: number
  shipping: number
  deposit: number
  paid: number
  remaining: number
  tip: number
  delivery_status: ManualDeliveryStatus
  payment_captured: boolean
  payments: Array<{ id: string; amount: number; created_at: string; is_deposit: boolean }>
}

const formatVnd = (amount: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount)

const ManualOrderBalance = ({ data }: DetailWidgetProps<AdminOrder>) => {
  const [summary, setSummary] = useState<ManualOrderSummary | null>(null)
  const [amount, setAmount] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingAmount, setEditingAmount] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const queryClient = useQueryClient()
  const isManualOrder = data.metadata?.[MANUAL_ORDER_METADATA_KEY] === true

  useEffect(() => {
    if (!isManualOrder) return
    let active = true
    const load = async () => {
      try {
        const response = await fetch(`/admin/manual-orders/${data.id}`)
        if (!response.ok) throw new Error("Không thể tải số dư thanh toán của đơn hàng")
        const result = await response.json() as ManualOrderSummary
        if (active) setSummary(result)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Không thể tải số dư")
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
        throw new Error(result.message ?? "Không thể ghi nhận thanh toán")
      }
      setSummary(await response.json() as ManualOrderSummary)
      setAmount("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể ghi nhận thanh toán")
    } finally {
      setIsSaving(false)
    }
  }

  const updatePayment = async (paymentId: string, newAmount: number) => {
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch(`/admin/manual-orders/${data.id}/payments/${paymentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: newAmount }),
      })
      if (!response.ok) {
        const result = await response.json() as { message?: string }
        throw new Error(result.message ?? "Không thể cập nhật thanh toán")
      }
      setSummary(await response.json() as ManualOrderSummary)
      setEditingId(null)
      setEditingAmount("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật thanh toán")
    } finally {
      setIsSaving(false)
    }
  }

  const deletePayment = async (paymentId: string) => {
    if (!window.confirm("Xóa khoản thanh toán này?")) return
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch(`/admin/manual-orders/${data.id}/payments/${paymentId}`, { method: "DELETE" })
      if (!response.ok) {
        const result = await response.json() as { message?: string }
        throw new Error(result.message ?? "Không thể xóa thanh toán")
      }
      setSummary(await response.json() as ManualOrderSummary)
      if (editingId === paymentId) { setEditingId(null); setEditingAmount("") }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xóa thanh toán")
    } finally {
      setIsSaving(false)
    }
  }

  const markFullyPaid = async () => {
    if (!summary) return
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch(`/admin/manual-orders/${data.id}/mark-paid`, { method: "POST" })
      if (!response.ok) {
        const result = await response.json() as { message?: string }
        throw new Error(result.message ?? "Không thể đánh dấu đã thanh toán")
      }
      setSummary(await response.json() as ManualOrderSummary)
      await queryClient.invalidateQueries({ queryKey: ["orders"] })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể đánh dấu đã thanh toán")
    } finally {
      setIsSaving(false)
    }
  }

  const changeDeliveryStatus = async (status: ManualDeliveryStatus) => {
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch(`/admin/manual-orders/${data.id}/delivery-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) {
        const result = await response.json() as { message?: string }
        throw new Error(result.message ?? "Không thể cập nhật trạng thái giao hàng")
      }
      setSummary(await response.json() as ManualOrderSummary)
      await queryClient.invalidateQueries({ queryKey: ["orders"] })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật trạng thái giao hàng")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="bg-ui-bg-base rounded-lg border border-ui-border-base p-6">
      <h2 className="mb-3 text-lg font-semibold">Thanh toán đơn hàng thủ công (VND)</h2>
      {error && <p role="alert" className="text-ui-fg-error mb-3">{error}</p>}
      {summary && <>
        <div className="mb-4 flex flex-col gap-2">
          <span className="text-sm font-medium">Trạng thái giao hàng</span>
          <div className="flex flex-wrap gap-2">
            {MANUAL_DELIVERY_STATUSES.map((status) => {
              const current = summary.delivery_status ?? DEFAULT_MANUAL_DELIVERY_STATUS
              const isActive = current === status
              return <button key={status} type="button" disabled={isSaving || isActive} onClick={() => void changeDeliveryStatus(status)} className={btn(isActive ? "primary" : "secondary", "small")}>
                {MANUAL_DELIVERY_STATUS_LABELS[status]}
              </button>
            })}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt>Phí vận chuyển</dt><dd>{formatVnd(summary.shipping)}</dd>
          <dt>Tổng đơn hàng (đã gồm phí vận chuyển)</dt><dd>{formatVnd(summary.total)}</dd>
          <dt>Tiền đặt cọc</dt><dd>{formatVnd(summary.deposit)}</dd>
          <dt>Tổng đã nhận</dt><dd>{formatVnd(summary.paid)}</dd>
          <dt>Còn phải thu</dt><dd>{formatVnd(summary.remaining)}</dd>
          <dt>Tiền thưởng (số tiền vượt tổng đơn)</dt><dd>{formatVnd(summary.tip)}</dd>
        </dl>
        <ul className="my-4 flex flex-col gap-2 text-sm">{summary.payments.map((payment) => (
          <li key={payment.id} className="flex flex-wrap items-center gap-2">
            {editingId === payment.id ? <>
              <input aria-label="Sửa khoản thanh toán" type="number" min="1" step="1" className="border-ui-border-base w-32 rounded border p-1" value={editingAmount} onChange={(event) => setEditingAmount(event.target.value)} />
              <button type="button" disabled={isSaving || Number(editingAmount) < 1} onClick={() => void updatePayment(payment.id, Number(editingAmount))} className={btn("primary", "small")}>Lưu</button>
              <button type="button" disabled={isSaving} onClick={() => { setEditingId(null); setEditingAmount("") }} className={btn("secondary", "small")}>Hủy</button>
            </> : <>
              <span>{formatVnd(payment.amount)} — {new Date(payment.created_at).toLocaleString("vi-VN")}{payment.is_deposit ? " (đặt cọc)" : ""}</span>
              {!payment.is_deposit && <>
                <button type="button" disabled={isSaving} onClick={() => { setEditingId(payment.id); setEditingAmount(String(payment.amount)) }} className={btn("secondary", "small")}>Sửa</button>
                <button type="button" disabled={isSaving} onClick={() => void deletePayment(payment.id)} className={btn("danger", "small")}>Xóa</button>
              </>}
            </>}
          </li>
        ))}</ul>
        <form onSubmit={(event) => void recordPayment(event)} className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">Khoản thanh toán thêm đã nhận (VND)
            <input required type="number" min="1" step="1" className="border-ui-border-base rounded border p-2" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <button type="submit" disabled={isSaving} className={btn("primary", "base")}>Ghi nhận thanh toán</button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" disabled={isSaving || (summary.remaining <= 0 && summary.payment_captured)} onClick={() => void markFullyPaid()} className={btn("primary", "base")}>
            {summary.payment_captured && summary.remaining <= 0
              ? "Đã thanh toán đủ"
              : summary.remaining > 0
                ? `Đã thanh toán (ghi nhận ${formatVnd(summary.remaining)})`
                : "Đánh dấu đã thanh toán"}
          </button>
          {summary.payment_captured && <span className="text-ui-fg-subtle text-sm">Trạng thái thanh toán gốc: đã thu</span>}
        </div>
      </>}
    </section>
  )
}

export const config = defineWidgetConfig({ zone: "order.details" })

export default ManualOrderBalance
