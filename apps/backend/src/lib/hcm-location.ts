import { MedusaError } from "@medusajs/framework/utils"

export const HCM_LOCATION_NAMES = ["kho q9", "ho chi minh", "hồ chí minh", "hcm"]

type QueryLike = {
  graph: (config: { entity: string; fields: string[]; filters?: Record<string, unknown> }) => Promise<{ data: Array<Record<string, unknown>> }>
}

export const resolveHcmLocationId = async (query: QueryLike): Promise<string> => {
  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const location =
    locations.find((item) => HCM_LOCATION_NAMES.some((name) => String(item.name ?? "").toLowerCase().includes(name))) ??
    locations.find((item) => !String(item.name ?? "").toLowerCase().includes("european")) ??
    locations[0]
  if (!location) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Không tìm thấy kho hàng (Kho Q9). Hãy tạo kho trước.")
  }
  return location.id as string
}
