import { model } from "@medusajs/framework/utils"

const VariantImportPrice = model.define("variant_import_price", {
  id: model.id().primaryKey(),
  variant_id: model.text(),
  original_price: model.number().nullable(),
  import_shipping_price: model.number().nullable(),
  imported_total_price: model.number(),
  is_total_overridden: model.boolean().default(false),
}).indexes([{ on: ["variant_id"], unique: true }])

export default VariantImportPrice
