import { MedusaError } from "@medusajs/framework/utils"

const VIETNAM_PHONE_PATTERN = /^0\d{9}$/

export const normalizeVietnamesePhone = (input: string): string => {
  const trimmed = input.trim()
  const hasPlus = trimmed.startsWith("+")
  const digits = trimmed.replace(/\D/g, "")

  let national = digits
  if (hasPlus && national.startsWith("84")) {
    national = national.slice(2)
  } else if (national.startsWith("0084")) {
    national = national.slice(4)
  } else if (national.length === 11 && national.startsWith("84")) {
    national = national.slice(2)
  }

  if (!national.startsWith("0")) {
    national = `0${national}`
  }

  if (!VIETNAM_PHONE_PATTERN.test(national)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Số điện thoại không hợp lệ. Vui lòng nhập số di động Việt Nam gồm 10 chữ số, ví dụ 0358635797.")
  }

  return national
}

export const isVietnamesePhone = (input: string): boolean => {
  try {
    normalizeVietnamesePhone(input)
    return true
  } catch {
    return false
  }
}
