import { defineRouteConfig } from "@medusajs/admin-sdk"
import { TagSolid } from "@medusajs/icons"
import { ImportPricingEditor } from "../../components/import-pricing-editor"

export const config = defineRouteConfig({
  label: "Tạo SP với giá nhập",
  icon: TagSolid,
  nested: "/products",
})

export default ImportPricingEditor
