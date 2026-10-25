import { createManualOrderSchema, updateManualOrderNoteSchema } from "../validators"

const order = {
  customer_name: "Nguyễn Văn An",
  address: "12 Nguyễn Huệ, Quận 1",
  phone: "090 123 4567",
  region_id: "reg_vn",
  items: [{ variant_id: "variant_1", quantity: 1 }],
  shipping_fee: 0,
  deposit: 0,
}

describe("manual order input", () => {
  it("accepts a name, address and phone without an email", () => {
    expect(createManualOrderSchema.safeParse(order).success).toBe(true)
  })

  it.each(["customer_name", "address", "phone"])("requires %s", (field) => {
    expect(createManualOrderSchema.safeParse({ ...order, [field]: "  " }).success).toBe(false)
  })

  it("accepts an optional note and a custom unit_price", () => {
    const result = createManualOrderSchema.safeParse({
      ...order,
      note: "Giao buổi chiều",
      items: [{ variant_id: "variant_1", quantity: 2, unit_price: 500000 }],
    })
    expect(result.success).toBe(true)
  })

  it("accepts a note update and rejects an over-long note", () => {
    expect(updateManualOrderNoteSchema.safeParse({ note: "" }).success).toBe(true)
    expect(updateManualOrderNoteSchema.safeParse({ note: "a".repeat(2001) }).success).toBe(false)
  })
})
