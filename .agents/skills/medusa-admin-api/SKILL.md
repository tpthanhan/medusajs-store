---
name: medusa-admin-api
description: Use the configured Medusa Admin Secret API key to inspect and manage this store through authenticated Admin APIs. Use when the user asks OpenClaw to create or update products, variants, inventory, manual orders, payments, or related Medusa data.
metadata: { "openclaw": { "primaryEnv": "MEDUSA_ADMIN_API_KEY", "requires": { "env": ["MEDUSA_ADMIN_API_KEY", "MEDUSA_BACKEND_URL"], "bins": ["node"] } } }
---

# Medusa Admin API

Call this store's Admin API through the helper at `{baseDir}/scripts/medusa-admin-api.mjs`. It reads `MEDUSA_ADMIN_API_KEY` from the OpenClaw host-run environment; never print, echo, inspect, or include that value in a prompt, command argument, response, or log.

## Request format

Run the helper with HTTP method and a same-origin `/admin/...` path. For JSON bodies, pipe JSON on stdin; do not put credentials in arguments. Example:

```sh
printf '%s' '{"title":"Example"}' | node "{baseDir}/scripts/medusa-admin-api.mjs" POST /admin/products
node "{baseDir}/scripts/medusa-admin-api.mjs" GET '/admin/products?limit=10'
```

The helper sends the key using Medusa Secret API key Basic authentication and prints only the API response. It rejects non-Admin paths and cross-origin URLs.

## Safety

- Prefer GET to inspect before writing. Check whether a resource already exists before creating it to avoid duplicates.
- Before deleting products/orders, cancelling orders, recording/capturing payments, refunds, or any bulk/destructive operation, explain the exact scope and get explicit user confirmation in the current conversation. After confirmation, pass `--confirm` to the helper.
- Do not treat a general request to manage data as confirmation for destructive or financial actions.
- Never use this key from a browser, storefront, or client-side code. Do not write it to files or repository configuration.
- If the key is missing or rejected, stop and ask the operator to rotate/reconfigure it; never fall back to an unprotected request.
- Use the store's existing custom APIs for manual VND orders and import pricing where appropriate. Follow `create-product`, `create-manual-order`, and `edit-manual-order` skills for those domain workflows.
