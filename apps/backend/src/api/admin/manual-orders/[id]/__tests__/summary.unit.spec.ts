import type { MedusaContainer } from "@medusajs/framework/types"
import { getManualOrderSummary } from "../summary"
import { MANUAL_DEPOSIT_REFERENCE, MANUAL_ORDER_METADATA_KEY } from "../../../../../lib/manual-order-constants"

describe("manual order summary", () => {
  it("shows shipping separately without adding it twice to the balance", async () => {
    const scope = {
      resolve: jest.fn().mockReturnValue({
        graph: jest.fn().mockResolvedValue({
          data: [{
            id: "order_1",
            total: 210000,
            shipping_total: 10000,
            currency_code: "vnd",
            metadata: { [MANUAL_ORDER_METADATA_KEY]: true },
            transactions: [{
              id: "payment_1",
              reference: MANUAL_DEPOSIT_REFERENCE,
              amount: 20000,
              created_at: "2026-10-25T00:00:00.000Z",
            }],
          }],
        }),
      }),
    } as unknown as MedusaContainer

    const summary = await getManualOrderSummary(scope, "order_1")

    expect(summary).toMatchObject({ total: 210000, shipping: 10000, deposit: 20000, paid: 20000, remaining: 190000, tip: 0 })
  })
})
