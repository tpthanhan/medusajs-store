import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

export const VIETNAM_COUNTRY_CODE = "vn"

export interface VietnamFulfillment {
  locationId: string
  shippingOptionId: string
  serviceZoneId: string
}

export const resolveVietnamFulfillment = async (
  scope: MedusaContainer
): Promise<VietnamFulfillment> => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: [
      "id",
      "fulfillment_sets.id",
      "fulfillment_sets.service_zones.id",
      "fulfillment_sets.service_zones.geo_zones.country_code",
      "fulfillment_sets.service_zones.shipping_options.id",
      "fulfillment_sets.service_zones.shipping_options.provider_id",
    ],
  })

  for (const location of stockLocations) {
    for (const set of location.fulfillment_sets ?? []) {
      if (!set) continue
      for (const zone of set.service_zones ?? []) {
        if (!zone) continue
        const coversVietnam = (zone.geo_zones ?? []).some(
          (geo) => geo?.country_code === VIETNAM_COUNTRY_CODE
        )
        if (!coversVietnam) continue
        const option = (zone.shipping_options ?? []).find(
          (shippingOption) => shippingOption?.provider_id === "manual_manual"
        )
        if (!option) continue
        return { locationId: location.id, serviceZoneId: zone.id, shippingOptionId: option.id }
      }
    }
  }

  throw new MedusaError(
    MedusaError.Types.NOT_FOUND,
    "Chưa thiết lập giao hàng Việt Nam. Vui lòng chạy script src/scripts/setup-vietnam-fulfillment.ts"
  )
}
