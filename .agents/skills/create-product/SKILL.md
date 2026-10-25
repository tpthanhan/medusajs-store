---
name: create-product
description: Create a product in this Medusa VND store with import costs and market price, via the custom "Tạo SP với giá nhập" Admin flow or its APIs. Use when the user wants to add a product, set per-variant giá gốc / giá ship về / tổng giá đã nhập / giá bán thị trường, or edit import pricing. Vietnamese VND store.
---

# Create a product (with import pricing)

This project adds a custom product-creation flow on top of Medusa Admin that captures **private import costs** plus the **VND market price** per variant. Full user-facing walkthrough: `docs/huong-dan-san-pham-va-don-hang.md` (read it before guiding a human).

## Key files

| Concern | Path |
| --- | --- |
| Editor component (create + edit) | `apps/backend/src/admin/components/import-pricing-editor.tsx` |
| Create route (sidebar: Products → "Tạo SP với giá nhập") | `apps/backend/src/admin/routes/import-pricing/page.tsx` |
| Edit route | `apps/backend/src/admin/routes/import-pricing/[id]/page.tsx` |
| Inline variant pricing widget | `apps/backend/src/admin/widgets/variant-import-pricing.tsx` |
| Private import-price API | `apps/backend/src/api/admin/variant-import-prices/[id]/route.ts` + `validators.ts` |
| Private pricing module | `apps/backend/src/modules/variant-import-pricing/` |
| CSV bulk import (parser) | `apps/backend/src/lib/import-pricing-csv.ts` |
| CSV import API | `apps/backend/src/api/admin/import-pricing/import/route.ts` + `../validators.ts` |
| CSV upload page (Products → "Nhập SP từ CSV") | `apps/backend/src/admin/routes/import-pricing-csv/page.tsx` |
| CSV template | `docs/templates/import-pricing-template.csv` |

## How creation works (do NOT reinvent)

The editor calls plain Admin APIs in sequence:

1. Resolve the default shipping profile: `GET /admin/shipping-profiles?limit=100` → pick `type === "default"`.
2. `POST /admin/products` with `status: "published"`, `shipping_profile_id`, `options`, and `variants[]`. A variant gets a VND price only when the row has pricing input: `prices: [{ currency_code: "vnd", amount }]`.
3. For each priced variant: `POST /admin/variant-import-prices/:variant_id`.

**Both `status: "published"` and `shipping_profile_id` are required** — a draft product can't be ordered, and a missing shipping profile blocks fulfillment later (`"Shipping profile ... does not match the shipping profile of the order item"`).

## Validation rules

| Rule | Detail |
| --- | --- |
| Blank variant | Leave ALL price fields empty → skipped, no VND price, no import-price record |
| Any price input on a row | `imported_total_price` (Tổng giá đã nhập) and `marketPrice` (Giá bán thị trường) become required |
| Import-price body | `original_price` nullable int, `import_shipping_price` nullable int, `imported_total_price` required int, `is_total_overridden` boolean; each VND amount `0..2_147_483_647` |
| Manual total override | Keep `is_total_overridden: true` so a hand-edited total survives input changes |

## Bulk CSV import

For many products at once use `POST /admin/import-pricing/import` with `{ products: ImportPricingProductDraft[] }` (see the parser's exported types). The Admin page parses a CSV client-side via `parseImportPricingCsv`, groups rows sharing `product_title`, then posts. The route resolves the default sales channel + shipping profile and runs `createProductsWorkflow` **per product** (one failure doesn't abort the rest), then saves import prices for priced variants.

CSV columns (one row per variant): `product_title, variant_title, sku, original_price, import_shipping_price, imported_total_price, market_price` plus optional dynamic `option:<Name>` columns. `market_price` is required per row; a blank `imported_total_price` is computed as original + shipping; import record is created only when a row has any import-cost column.

**Multi-option products (Gender × Size × Màu):** add `option:Gender`, `option:Size`, `option:Màu`… columns — each row is one combination; the parser derives each product's `options[]` (title + distinct values) and each variant's `options` map, auto-deriving `variant_title` when blank. Use the exact option names and values configured in the product catalog: the CSV template demonstrates `Gender` values `Man` and `Woman`. The parser does not translate `Nam`/`Nữ`; map those to `Man`/`Woman` before importing if the source CSV uses Vietnamese labels. Every row of one product must have values for the same option set; different products may use different option sets. With no `option:*` columns, it falls back to a single `Variant` option using `variant_title`. The import route passes `draft.options` and `variant.options` straight into `createProductsWorkflow`.

Template: `docs/templates/import-pricing-template.csv` (or the page's "Tải mẫu CSV" button); it includes Gender, Size, and Màu examples. Parser unit tests: `apps/backend/src/lib/__tests__/import-pricing-csv.unit.spec.ts`.

## Inventory gotcha

If a variant manages inventory, it needs stock at **Kho Q9** (`sloc_01M5S3XVSM5KNXJGATE5J9BCQS`) before it can be ordered/fulfilled. Backfill with the idempotent script:

```bash
cd apps/backend && npx medusa exec ./src/scripts/setup-vietnam-fulfillment.ts
```

## Editing existing products

Use the inline variant-pricing widget (per-variant save) or the edit route. Preserve the Vietnam **regional** VND price and its price id — sync base + regional VND prices together, never overwrite one.

## Verify a change

```bash
cd apps/backend && npx tsc --noEmit -p tsconfig.json && npx eslint . && npx medusa build
```

Do not use unix pipes (`tail`) in `bg_run` — the supervisor uses cmd.exe on Windows.
