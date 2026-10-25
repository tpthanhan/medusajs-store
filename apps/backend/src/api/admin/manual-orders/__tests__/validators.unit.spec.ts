import { createManualOrderSchema } from "../validators"

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
})
