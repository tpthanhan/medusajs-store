import { Module } from "@medusajs/framework/utils"
import VariantImportPricingService from "./service"

export const VARIANT_IMPORT_PRICING_MODULE = "variant_import_pricing"

export default Module(VARIANT_IMPORT_PRICING_MODULE, {
  service: VariantImportPricingService,
})
