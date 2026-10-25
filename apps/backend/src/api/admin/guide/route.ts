import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { marked } from "marked"
import { existsSync, readFileSync } from "fs"
import path from "path"

const GUIDE_RELATIVE = path.join("docs", "huong-dan-san-pham-va-don-hang.md")

const resolveGuidePath = (): string => {
  const candidates = [
    path.join(process.cwd(), GUIDE_RELATIVE),
    path.join(process.cwd(), "..", "..", GUIDE_RELATIVE),
    path.join(process.cwd(), "..", GUIDE_RELATIVE),
  ]
  const found = candidates.find((candidate) => existsSync(candidate))
  if (!found) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Không tìm thấy file hướng dẫn (${GUIDE_RELATIVE})`)
  }
  return found
}

export const GET = async (_req: MedusaRequest, res: MedusaResponse): Promise<void> => {
  const markdown = readFileSync(resolveGuidePath(), "utf8")
  const html = await marked.parse(markdown, { gfm: true, breaks: false })
  res.json({ html })
}
