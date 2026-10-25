export interface ImportCosts {
  original_price: number | null
  import_shipping_price: number | null
  imported_total_price: number
  is_total_overridden: boolean
}

export const calculateImportedTotal = (costs: ImportCosts): number =>
  costs.is_total_overridden
    ? costs.imported_total_price
    : (costs.original_price ?? 0) + (costs.import_shipping_price ?? 0)
