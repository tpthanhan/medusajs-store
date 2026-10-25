export interface VariantPrice {
  id?: string
  amount: number
  currency_code: string
  rules?: Record<string, string> | null
  price_list_id?: string | null
  min_quantity?: number | null
  max_quantity?: number | null
}

export const getBaseVndPrice = (prices: VariantPrice[]): VariantPrice | undefined =>
  prices.find((price) => price.currency_code === "vnd" && !price.price_list_id && !Object.keys(price.rules ?? {}).length && !price.min_quantity && !price.max_quantity)

export const getMarketVndPrice = (prices: VariantPrice[]): VariantPrice | undefined =>
  prices.find((price) => price.currency_code === "vnd" && !price.price_list_id && Boolean(price.rules?.region_id)) ?? getBaseVndPrice(prices)

export const withMarketVndPrice = (prices: VariantPrice[], amount: number): VariantPrice[] => {
  const base = getBaseVndPrice(prices)
  const retained = prices.filter((price) => !price.price_list_id).map((price) => ({
    id: price.id,
    amount: price.amount,
    currency_code: price.currency_code,
    ...(price.rules && Object.keys(price.rules).length ? { rules: price.rules } : {}),
    ...(price.min_quantity != null ? { min_quantity: price.min_quantity } : {}),
    ...(price.max_quantity != null ? { max_quantity: price.max_quantity } : {}),
  }))
  const updated = retained.map((price) =>
    price.currency_code === "vnd" && ((base && price.id === base.id) || Boolean(price.rules?.region_id))
      ? { ...price, amount }
      : price
  )
  return base ? updated : [...updated, { amount, currency_code: "vnd" }]
}
