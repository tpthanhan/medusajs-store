---
name: edit-manual-order
description: Complete or correct a manual VND order in this Medusa store — record/edit/delete payments, mark fully paid (native payment badge), edit the order note, and move delivery status placed→awaiting→delivering→delivered driving real fulfillment. Use when the user wants to collect money, fix a wrong payment, mark an order paid, change the order note, or update shipping/delivery status. Vietnamese VND store.
---

# Edit / complete a manual order

Everything happens on the order detail widget **"Thanh toán đơn hàng thủ công (VND)"**. Full user-facing walkthrough: `docs/huong-dan-san-pham-va-don-hang.md` (read it first).

## Key files

| Concern | Path |
| --- | --- |
| Order-detail widget (payments + delivery buttons) | `apps/backend/src/admin/widgets/manual-order-balance.tsx` |
| Summary (balance + derived delivery status) | `apps/backend/src/api/admin/manual-orders/[id]/summary.ts` + `route.ts` |
| Add payment | `apps/backend/src/api/admin/manual-orders/[id]/payments/route.ts` |
| Edit/Delete payment | `apps/backend/src/api/admin/manual-orders/[id]/payments/[payment_id]/route.ts` |
| Mark fully paid | `apps/backend/src/api/admin/manual-orders/[id]/mark-paid/route.ts` |
| Delivery status (drives fulfillment) | `apps/backend/src/api/admin/manual-orders/[id]/delivery-status/route.ts` |
| Order note (metadata) | `apps/backend/src/api/admin/manual-orders/[id]/note/route.ts` + `apps/backend/src/workflows/update-manual-order-note.ts` |
| Pure helpers | `apps/backend/src/lib/manual-order-balance.ts`, `manual-delivery-status.ts`, `manual-order-guard.ts` |

## Payment endpoints

| Call | Body | Effect |
| --- | --- | --- |
| `POST .../payments` | `{ amount }` positive int | Records a later payment (`manual_vnd_payment`) |
| `POST .../payments/:payment_id` | `{ amount }` | Replaces that payment (add new + delete old); **deposit cannot be edited** |
| `DELETE .../payments/:payment_id` | — | Deletes that payment; **deposit cannot be deleted** |
| `POST .../mark-paid` | none | Records remaining (if any) then marks the order's payment collection paid → native badge turns **Captured** |

The deposit is identified by reference `manual_vnd_deposit` and is read-only. Balance is the source of truth (custom transactions); the native badge follows via mark-paid.

## Order note: `POST .../note` `{ note }`

Sets/updates the order note (≤ 2000 chars) stored in order metadata under `manual_vnd_note`. An **empty string clears** the note. The route guards with `assertManualOrder` then calls `updateManualOrderNoteWorkflow`, which merges metadata via `orderModule.updateOrders` with compensation restoring the previous metadata (never call `updateOrders` directly in the route — `@medusajs/no-service-mutations-in-api-route` forbids it). The note is also settable at creation time via the `note` field on `POST /admin/manual-orders`, and the summary returns it as `note`. The widget shows the note with a "Thêm/Sửa ghi chú" textarea.

## Delivery status: `POST .../delivery-status` `{ status }`

`status ∈ placed | awaiting | delivering | delivered`. **Forward-only.**

| Target | Native action | Badge |
| --- | --- | --- |
| `awaiting` | `createOrderFulfillmentWorkflow` at Kho Q9 | Fulfilled |
| `delivering` | `createOrderShipmentWorkflow` | Shipped |
| `delivered` | `markOrderFulfillmentAsDeliveredWorkflow` | Delivered |

| Rule | Detail |
| --- | --- |
| Backward move | `NOT_ALLOWED` "Không thể lùi trạng thái giao hàng" |
| Skipping steps | Intermediate fulfillment/shipment created automatically |
| Status source | Derived from native fulfillments (`deriveDeliveryStatus`: canceled ignored; delivered_at→delivered; shipped_at→delivering; active→awaiting; else placed) — **not** metadata |

## Summary response (`GET .../:id`)

```jsonc
{
  "delivery_status": "placed|awaiting|delivering|delivered",
  "payment_captured": true,   // native payment badge already Captured?
  "note": "Giao buổi chiều",   // order note (metadata manual_vnd_note), "" when unset
  "total": 320000, "shipping": 20000, "deposit": 50000,
  "paid": 320000, "remaining": 0, "tip": 0,
  "payments": [ { "id": "...", "amount": 50000, "is_deposit": true, "created_at": "..." } ]
}
```

## Native badge cache

The widget calls these custom endpoints, then runs `queryClient.invalidateQueries({ queryKey: ["orders"] })` so Medusa's native payment/fulfillment badges refetch **without a reload**. Keep that invalidation on any new mutating action — do not use `window.location.reload()` (Admin auth token is in memory; reload logs the user out).

## Gotchas

- Fulfillment needs the product on the **default shipping profile** and stock at Kho Q9; otherwise `delivery-status` returns 400.
- Only orders with metadata `manual_vnd_order`, currency VND, and not canceled pass `assertManualOrder`.

## Verify changes

```bash
cd apps/backend && npx tsc --noEmit -p tsconfig.json && npx eslint . && npx medusa build
```

Unit tests live in `apps/backend/src/**/__tests__`; run with `cd apps/backend && npx jest` (or the project test tasks). Avoid unix pipes in `bg_run` (cmd.exe on Windows).
