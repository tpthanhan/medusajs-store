import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function inspect_fulfillment_setup({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "name", "default_sales_channel_id", "supported_currencies.currency_code", "supported_currencies.is_default"],
  })
  logger.info("STORES: " + JSON.stringify(stores, null, 2))

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "countries.iso_2", "payment_providers.id"],
  })
  logger.info("REGIONS: " + JSON.stringify(regions, null, 2))

  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })
  logger.info("SALES_CHANNELS: " + JSON.stringify(salesChannels, null, 2))

  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name", "sales_channels.id", "fulfillment_sets.id", "fulfillment_sets.name", "fulfillment_providers.id"],
  })
  logger.info("STOCK_LOCATIONS: " + JSON.stringify(stockLocations, null, 2))

  const { data: fulfillmentSets } = await query.graph({
    entity: "fulfillment_set",
    fields: [
      "id",
      "name",
      "type",
      "service_zones.id",
      "service_zones.name",
      "service_zones.geo_zones.country_code",
      "service_zones.geo_zones.type",
    ],
  })
  logger.info("FULFILLMENT_SETS: " + JSON.stringify(fulfillmentSets, null, 2))

  const { data: shippingOptions } = await query.graph({
    entity: "shipping_option",
    fields: [
      "id",
      "name",
      "provider_id",
      "price_type",
      "service_zone_id",
      "shipping_profile_id",
      "type.code",
    ],
  })
  logger.info("SHIPPING_OPTIONS: " + JSON.stringify(shippingOptions, null, 2))

  const { data: profiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "name", "type"],
  })
  logger.info("SHIPPING_PROFILES: " + JSON.stringify(profiles, null, 2))

  const { data: fulfillmentProviders } = await query.graph({
    entity: "fulfillment_provider",
    fields: ["id", "is_enabled"],
  })
  logger.info("FULFILLMENT_PROVIDERS: " + JSON.stringify(fulfillmentProviders, null, 2))

  const { data: paymentProviders } = await query.graph({
    entity: "payment_provider",
    fields: ["id", "is_enabled"],
  })
  logger.info("PAYMENT_PROVIDERS: " + JSON.stringify(paymentProviders, null, 2))
}
