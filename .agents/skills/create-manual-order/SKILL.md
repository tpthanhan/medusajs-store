---
name: create-manual-order
description: Create a manual VND order for a walk-in customer in this Medusa store via the custom "Tạo đơn hàng thủ công" Admin page or POST /admin/manual-orders. Use when the user wants to place an order by hand with customer name/address/phone (no email), manual shipping fee, a deposit, and stock reserved at Kho Q9. Vietnamese VND store.
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
| Shared constants | `apps/backend/src/lib/manual-order-constants.ts` |

## Request: `POST /admin/manual-orders`

```jsonc
{
  "customer_name": "Trần Thị B",          // required, non-empty
  "address": "456 Nguyễn Huệ, Q1, TP.HCM", // required
  "phone": "0912345678",                   // required
  "region_id": "reg_01M5S3V706PZ48WC2G0Q5P5KR7", // Vietnam (VND)
  "items": [{ "variant_id": "variant_...", "quantity": 2 }], // ≥1, qty positive int
  "shipping_fee": 20000,                   // int ≥ 0 (VND), added to total
  "deposit": 50000                         // int ≥ 0 (VND), recorded as first payment
}
```

Name/address/phone go into the order `shipping_address`; **no customer record or fake email is created**. The response redirect target is the created order.

## What the workflow does

| Step | Effect |
| --- | --- |
| Resolve Vietnam fulfillment | locationId (Kho Q9) + shipping_option_id via `resolveVietnamFulfillment` |
| Build line items | `requires_shipping: true`, VND calculated price validated **with region context** |
| Shipping method | Named manual charge carrying the real `shipping_option_id` and `shipping_fee` amount |
| Deposit | `addOrderTransactions` with reference `manual_vnd_deposit` |
| Metadata | `manual_vnd_order` marker so widgets/summary recognize it |
| Reservations | Creates inventory reservations at Kho Q9 for `manage_inventory` variants (keyed by line_item_id); compensation deletes them on failure |

## Preconditions (common failures)

| Error | Cause / fix |
| --- | --- |
| `Variants ... do not exist or belong to a product that is not published` | Product is a draft → publish it (custom-created products are already published) |
| `No stock` / reservation error | Variant manages inventory but Kho Q9 has no level → run `npx medusa exec ./src/scripts/setup-vietnam-fulfillment.ts` |
| Shipping profile mismatch (later, at fulfillment) | Product lacks the default shipping profile → assign it |

## Totals

`total = Σ(giá bán × qty) + shipping_fee`. `remaining right after creation = total − deposit`.

## Verify changes

```bash
cd apps/backend && npx tsc --noEmit -p tsconfig.json && npx eslint . && npx medusa build
```

Browsing via Playwright: Medusa Admin keeps its auth token **in memory**, so any hard navigation/reload drops the session. Navigate within the SPA via clicks after login; never hard-reload custom routes.
