import { configureStoreSearch, defineMiddlewares, validateAndTransformBody } from '@medusajs/framework/http'
import { createManualOrderSchema, recordManualPaymentSchema, updateManualDeliveryStatusSchema } from './admin/manual-orders/validators'
import { updateVariantImportPriceSchema } from './admin/variant-import-prices/validators'
import { importPricingSchema } from './admin/import-pricing/validators'

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  routes: [
    {
      matcher: '/admin/variant-import-prices/:id',
      methods: ['POST'],
      middlewares: [validateAndTransformBody(updateVariantImportPriceSchema)],
    },
    {
      matcher: '/admin/import-pricing/import',
      methods: ['POST'],
      middlewares: [validateAndTransformBody(importPricingSchema)],
    },
    {
      matcher: '/admin/manual-orders',
      methods: ['POST'],
      middlewares: [validateAndTransformBody(createManualOrderSchema)],
    },
    {
      matcher: '/admin/manual-orders/:id/payments',
      methods: ['POST'],
      middlewares: [validateAndTransformBody(recordManualPaymentSchema)],
    },
    {
      matcher: '/admin/manual-orders/:id/payments/:payment_id',
      methods: ['POST'],
      middlewares: [validateAndTransformBody(recordManualPaymentSchema)],
    },
    {
      matcher: '/admin/manual-orders/:id/delivery-status',
      methods: ['POST'],
      middlewares: [validateAndTransformBody(updateManualDeliveryStatusSchema)],
    },
    {
      method: ['POST'],
      matcher: '/store/search',
      middlewares: [
        configureStoreSearch({
          allowed_indexes: {
            product: true,
          },
        }),
      ],
    },
  ],
})
