import { getBaseVndPrice, getMarketVndPrice, withMarketVndPrice } from "../variant-price-fields"

describe("variant price fields", () => {
  const prices = [
    { id: "base", currency_code: "vnd", amount: 100 },
    { id: "region", currency_code: "vnd", amount: 200, rules: { region_id: "reg_vn" } },
    { id: "other", currency_code: "usd", amount: 5 },
  ]

  it("shows the Vietnam regional selling price instead of the fallback VND price", () => {
    expect(getBaseVndPrice(prices)?.amount).toBe(100)
    expect(getMarketVndPrice(prices)?.amount).toBe(200)
  })

  it("updates both VND base and region prices without changing other currencies", () => {
    expect(withMarketVndPrice(prices, 300)).toEqual([
      { id: "base", currency_code: "vnd", amount: 300 },
      { id: "region", currency_code: "vnd", amount: 300, rules: { region_id: "reg_vn" } },
      { id: "other", currency_code: "usd", amount: 5 },
    ])
  })

  it("adds a base price when only the regional VND price exists", () => {
    expect(withMarketVndPrice(prices.slice(1), 300)).toEqual([
      { id: "region", currency_code: "vnd", amount: 300, rules: { region_id: "reg_vn" } },
      { id: "other", currency_code: "usd", amount: 5 },
      { amount: 300, currency_code: "vnd" },
    ])
  })
})
