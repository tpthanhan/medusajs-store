export interface VariantPricingInput {
  title: string
  originalPrice: string
  importShippingPrice: string
  importedTotalPrice: string
  isTotalOverridden: boolean
  marketPrice: string
}

const MAX_VND_AMOUNT = 2_147_483_647

const isValidVndAmount = (value: string) =>
  value !== "" && Number.isSafeInteger(Number(value)) && Number(value) >= 0 && Number(value) <= MAX_VND_AMOUNT

export const hasPricingInput = (row: VariantPricingInput) =>
  [row.originalPrice, row.importShippingPrice, row.importedTotalPrice, row.marketPrice].some((value) => value !== "")

export const validateVariantPricing = (row: VariantPricingInput): string | null => {
  const amounts = [row.originalPrice, row.importShippingPrice, row.importedTotalPrice, row.marketPrice]
  if (!isValidVndAmount(row.importedTotalPrice) || !isValidVndAmount(row.marketPrice) ||
    amounts.some((amount) => amount !== "" && !isValidVndAmount(amount))) {
    return `Kiểm tra giá của ${row.title || "biến thể"}: tổng giá nhập và giá bán bắt buộc, mọi giá phải là số nguyên VND không âm.`
  }
  if (!row.isTotalOverridden && Number(row.originalPrice || 0) + Number(row.importShippingPrice || 0) !== Number(row.importedTotalPrice)) {
    return `Tổng giá nhập của ${row.title || "biến thể"} không khớp giá tự tính.`
  }
  return null
}
