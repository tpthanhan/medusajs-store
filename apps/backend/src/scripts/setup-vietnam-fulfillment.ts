import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  MedusaError,
  ModuleRegistrationName,
  Modules,
} from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createShippingOptionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { VIETNAM_COUNTRY_CODE } from "../lib/vietnam-fulfillment"

const HCM_LOCATION_NAMES = ["kho q9", "ho chi minh", "hồ chí minh", "hcm"]
const VIETNAM_SERVICE_ZONE_NAME = "Việt Nam"
const VIETNAM_FULFILLMENT_SET_NAME = "Giao hàng Việt Nam"
const VIETNAM_SHIPPING_OPTION_NAME = "Giao hàng tiêu chuẩn"
const DEFAULT_STOCKED_QUANTITY = 1_000_000

export default async function setup_vietnam_fulfillment({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(ModuleRegistrationName.FULFILLMENT)

  logger.info("Thiết lập giao hàng Việt Nam...")

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: [
      "id",
      "name",
      "fulfillment_sets.id",
      "fulfillment_sets.service_zones.id",
      "fulfillment_sets.service_zones.geo_zones.country_code",
    ],
  })

  const hcmLocation =
    locations.find((location) =>
      HCM_LOCATION_NAMES.some((name) => location.name?.toLowerCase().includes(name))
    ) ?? locations.find((location) => !location.name?.toLowerCase().includes("european"))

  if (!hcmLocation) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Không tìm thấy kho hàng Hồ Chí Minh. Vui lòng tạo kho trước."
    )
  }
  logger.info(`Dùng kho: ${hcmLocation.name} (${hcmLocation.id})`)

  let serviceZoneId: string | undefined
  for (const set of hcmLocation.fulfillment_sets ?? []) {
    if (!set) continue
    for (const zone of set.service_zones ?? []) {
      if (!zone) continue
      if ((zone.geo_zones ?? []).some((geo) => geo?.country_code === VIETNAM_COUNTRY_CODE)) {
        serviceZoneId = zone.id
      }
    }
  }

  if (!serviceZoneId) {
    logger.info("Tạo fulfillment set + service zone Việt Nam...")
    const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
      name: VIETNAM_FULFILLMENT_SET_NAME,
      type: "shipping",
      service_zones: [
        {
          name: VIETNAM_SERVICE_ZONE_NAME,
          geo_zones: [{ country_code: VIETNAM_COUNTRY_CODE, type: "country" }],
        },
      ],
    })
    serviceZoneId = fulfillmentSet.service_zones[0].id

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: hcmLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    })
    logger.info(`Đã tạo service zone Việt Nam (${serviceZoneId}).`)
  } else {
    logger.info(`Service zone Việt Nam đã tồn tại (${serviceZoneId}).`)
  }

  const { data: existingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "provider_id", "service_zone_id"],
    filters: { service_zone_id: serviceZoneId },
  })
  const manualOption = existingOptions.find((option) => option.provider_id === "manual_manual")

  if (!manualOption) {
    logger.info("Tạo shipping option Việt Nam...")
    const { data: profiles } = await query.graph({
      entity: "shipping_profile",
      fields: ["id"],
      filters: { type: "default" },
    })
    const shippingProfileId = profiles[0]?.id
    if (!shippingProfileId) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Không tìm thấy shipping profile mặc định.")
    }

    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: VIETNAM_SHIPPING_OPTION_NAME,
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: serviceZoneId,
          shipping_profile_id: shippingProfileId,
          type: {
            label: "Tiêu chuẩn",
            description: "Giao hàng thủ công trong nước.",
            code: "vn-standard",
          },
          prices: [{ currency_code: "vnd", amount: 0 }],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
      ],
    })
    logger.info("Đã tạo shipping option Việt Nam.")
  } else {
    logger.info(`Shipping option Việt Nam đã tồn tại (${manualOption.id}).`)
  }

  logger.info("Đồng bộ tồn kho tại kho Hồ Chí Minh...")
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "location_levels.location_id"],
  })
  const missingLevels = inventoryItems.filter(
    (item) => !(item.location_levels ?? []).some((level) => level?.location_id === hcmLocation.id)
  )
  if (missingLevels.length > 0) {
    await createInventoryLevelsWorkflow(container).run({
      input: {
        inventory_levels: missingLevels.map((item) => ({
          location_id: hcmLocation.id,
          inventory_item_id: item.id,
          stocked_quantity: DEFAULT_STOCKED_QUANTITY,
        })),
      },
    })
    logger.info(`Đã tạo ${missingLevels.length} mức tồn kho mới.`)
  } else {
    logger.info("Mọi mục tồn kho đã có mức tại kho này.")
  }

  logger.info("Hoàn tất thiết lập giao hàng Việt Nam.")
}
