import process from "node:process"

const [methodArg, pathArg, ...flags] = process.argv.slice(2)
const method = methodArg?.toUpperCase()
const baseUrl = process.env.MEDUSA_BACKEND_URL
const apiKey = process.env.MEDUSA_ADMIN_API_KEY

if (!method || !pathArg || !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
  console.error("Usage: medusa-admin-api.mjs METHOD /admin/path [--confirm] (JSON body on stdin)")
  process.exit(2)
}
if (!baseUrl || !apiKey) {
  console.error("MEDUSA_BACKEND_URL and MEDUSA_ADMIN_API_KEY must be configured in the OpenClaw skill environment.")
  process.exit(2)
}

const url = new URL(pathArg, baseUrl)
if (url.origin !== new URL(baseUrl).origin || !(url.pathname === "/admin" || url.pathname.startsWith("/admin/"))) {
  console.error("Only same-origin /admin API paths are allowed.")
  process.exit(2)
}

const needsConfirmation = method === "DELETE" || /\/(mark-paid|payments|cancel|refund)(\/|$)/i.test(url.pathname)
if (needsConfirmation && !flags.includes("--confirm")) {
  console.error("This destructive or financial endpoint requires explicit user confirmation and the --confirm flag.")
  process.exit(2)
}

const chunks = []
for await (const chunk of process.stdin) chunks.push(chunk)
const bodyText = Buffer.concat(chunks).toString("utf8").trim()
const headers = {
  Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
  Accept: "application/json",
}
const request = { method, headers }
if (bodyText && method !== "GET") {
  headers["Content-Type"] = "application/json"
  request.body = bodyText
}

try {
  const response = await fetch(url, request)
  const responseText = await response.text()
  if (!response.ok) {
    console.error(`Medusa API returned ${response.status} ${response.statusText}`)
    if (responseText) console.error(responseText)
    process.exitCode = 1
  } else if (responseText) {
    try {
      console.log(JSON.stringify(JSON.parse(responseText), null, 2))
    } catch {
      console.log(responseText)
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Medusa API request failed")
  process.exitCode = 1
}
