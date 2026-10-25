---
name: create-manual-order
description: Create a manual VND order for a walk-in customer in this Medusa store via the custom "Tạo đơn hàng thủ công" Admin page or POST /admin/manual-orders. Use when the user wants to place an order by hand with customer name/address/phone (no email), an optional per-item custom unit price, manual shipping fee, a deposit, an optional order note, and stock reserved at Kho Q9. A customer record is found-or-created by normalized Vietnamese phone. Vietnamese VND store.
---

# Create a manual order

Staff place orders on behalf of customers who usually have **no email**. Full user-facing walkthrough: `docs/huong-dan-san-pham-va-don-hang.md` (read it first).

## Key files

| Concern | Path |
| --- | --- |
| Admin page (sidebar: Orders → "Tạo đơn hàng thủ công") | `apps/backend/src/admin/routes/manual-orders/page.tsx` |
| Create API | `apps/backend/src/api/admin/manual-orders/route.ts` |
| Validators | `apps/backend/src/api/admin/manual-orders/validators.ts` |
| Creation workflow (reservations + shipping) | `apps/backend/src/workflows/` (create-manual-order) |
| Vietnam fulfillment resolver | `apps/backend/src/lib/vietnam-fulfillment.ts` |
| Vietnamese phone normalizer | `apps/backend/src/lib/vietnam-phone.ts` |
| Shared constants | `apps/backend/src/lib/manual-order-constants.ts` |

## Request: `POST /admin/manual-orders`

```jsonc
{
  "customer_name": "Trần Thị B",          // required, non-empty
  "address": "456 Nguyễn Huệ, Q1, TP.HCM", // required
  "phone": "0912345678",                   // required; normalized to 0xxxxxxxxx before saving
  "region_id": "reg_01M5S3V706PZ48WC2G0Q5P5KR7", // Vietnam (VND)
  "items": [
    { "variant_id": "variant_...", "quantity": 2 },               // uses the variant's default VND price
    { "variant_id": "variant_...", "quantity": 1, "unit_price": 500000 } // optional custom VND unit price
  ],
  "shipping_fee": 20000,                   // int ≥ 0 (VND), added to total
  "deposit": 50000,                        // int ≥ 0 (VND), recorded as first payment
  "note": "Giao buổi chiều"                // optional, ≤ 2000 chars, stored in metadata manual_vnd_note
}
```

Name/address go into the order `shipping_address`. **No fake email is created**, but a **customer record is found-or-created by the normalized phone** and linked via `customer_id`. `unit_price` per item is optional: when omitted the variant's default VND price (region-aware) is used; when provided it overrides the price for that line only. The Admin form pre-fills the custom-price field with the variant's current VND price, letting staff keep or edit it. The response redirect target is the created order.

## Phone normalization

`normalizeVietnamesePhone` (`apps/backend/src/lib/vietnam-phone.ts`) folds `+84`, `84`, `0084`, spaces, dots, and dashes to the canonical `0xxxxxxxxx` 10-digit form (e.g. `+84 358 635 797` → `0358635797`) and throws `MedusaError.INVALID_DATA` for anything that is not a valid Vietnamese 10-digit number. The create workflow runs this before find-or-create, so the stored customer and shipping address always use the canonical form.

## What the workflow does

| Step | Effect |
| --- | --- |
| Resolve customer | Normalize phone, find customer by `phone`, else create one (name + phone, no account); order linked via `customer_id`; compensation deletes a newly-created customer |
| Resolve Vietnam fulfillment | locationId (Kho Q9) + shipping_option_id via `resolveVietnamFulfillment` |
| Build line items | `requires_shipping: true`, custom `unit_price` when given else VND calculated price validated **with region context** |
| Shipping method | Named manual charge carrying the real `shipping_option_id` and `shipping_fee` amount |
| Deposit | `addOrderTransactions` with reference `manual_vnd_deposit` |
| Metadata | `manual_vnd_order` marker (+ `manual_vnd_note` when a note is given) so widgets/summary recognize it |
| Reservations | Creates inventory reservations at Kho Q9 for `manage_inventory` variants (keyed by line_item_id); compensation deletes them on failure |

## Preconditions (common failures)

| Error | Cause / fix |
| --- | --- |
| `Variants ... do not exist or belong to a product that is not published` | Product is a draft → publish it (custom-created products are already published) |
| `No stock` / reservation error | Variant manages inventory but Kho Q9 has no level → run `npx medusa exec ./src/scripts/setup-vietnam-fulfillment.ts` |
| Shipping profile mismatch (later, at fulfillment) | Product lacks the default shipping profile → assign it |

## Totals

`total = Σ(unit_price × qty) + shipping_fee`, where `unit_price` is the custom price when provided else the variant's default VND price. `remaining right after creation = total − deposit`.

## Admin UI buttons

The `/app/manual-orders` page uses the real `@medusajs/ui` Button via a thin typed wrapper at `apps/backend/src/admin/lib/ui.tsx`. Import `Button` from that wrapper, not from `@medusajs/ui` directly: a stray `@types/react@19` (pulled by the analytics plugin) makes `@medusajs/ui` Button fail type-check with TS2786 (`bigint` not assignable to `ReactNode`). The wrapper re-types the component so it type-checks cleanly. Other custom admin screens still use the `btn()` class helper in `apps/backend/src/admin/lib/button-class.ts`.

## Verify changes

```bash
cd apps/backend && npx tsc --noEmit -p tsconfig.json && npx eslint . && npx medusa build
```

Browsing via Playwright: Medusa Admin keeps its auth token **in memory**, so any hard navigation/reload drops the session. Navigate within the SPA via clicks after login; never hard-reload custom routes.
