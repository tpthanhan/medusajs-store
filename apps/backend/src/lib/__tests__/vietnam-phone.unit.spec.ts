import { normalizeVietnamesePhone, isVietnamesePhone } from "../vietnam-phone"

describe("normalizeVietnamesePhone", () => {
  it("keeps a valid leading-zero number", () => {
    expect(normalizeVietnamesePhone("0358635797")).toBe("0358635797")
  })

  it("strips spaces, dots, and dashes", () => {
    expect(normalizeVietnamesePhone(" 035 863 5797 ")).toBe("0358635797")
    expect(normalizeVietnamesePhone("035-863-5797")).toBe("0358635797")
    expect(normalizeVietnamesePhone("035.863.5797")).toBe("0358635797")
  })

  it("converts +84 international format to leading zero", () => {
    expect(normalizeVietnamesePhone("+84358635797")).toBe("0358635797")
    expect(normalizeVietnamesePhone("+84 358 635 797")).toBe("0358635797")
  })

  it("converts 84 and 0084 prefixes to leading zero", () => {
    expect(normalizeVietnamesePhone("84358635797")).toBe("0358635797")
    expect(normalizeVietnamesePhone("0084358635797")).toBe("0358635797")
  })

  it("rejects numbers with the wrong length", () => {
    expect(() => normalizeVietnamesePhone("035863579")).toThrow()
    expect(() => normalizeVietnamesePhone("03586357971")).toThrow()
  })

  it("rejects non-numeric input", () => {
    expect(() => normalizeVietnamesePhone("abc")).toThrow()
    expect(() => normalizeVietnamesePhone("")).toThrow()
  })

  it("isVietnamesePhone reflects validity", () => {
    expect(isVietnamesePhone("0358635797")).toBe(true)
    expect(isVietnamesePhone("12345")).toBe(false)
  })
})
