import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"

const VariantImportPricing = ({ data }: DetailWidgetProps<AdminProduct>) => (
  <section className="bg-ui-bg-base rounded-lg border border-ui-border-base p-6">
    <h2 className="text-ui-fg-base text-lg font-semibold">Giá nhập & giá bán</h2>
    <p className="text-ui-fg-subtle my-2 text-sm">Chỉnh giá gốc, ship về, tổng giá nhập và giá bán VND của các biến thể trong cùng một màn hình.</p>
    <a className="text-ui-fg-interactive text-sm" href={`/app/import-pricing/${data.id}`}>Mở màn hình chỉnh giá →</a>
  </section>
)

export const config = defineWidgetConfig({ zone: "product.details" })

export default VariantImportPricing
