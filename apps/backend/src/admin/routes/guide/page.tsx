import { defineRouteConfig } from "@medusajs/admin-sdk"
import { DocumentText } from "@medusajs/icons"
import { useEffect, useState } from "react"

const GUIDE_STYLES = `
.md-guide { line-height: 1.6; font-size: 14px; }
.md-guide h1 { font-size: 1.6rem; font-weight: 700; margin: 0 0 1rem; }
.md-guide h2 { font-size: 1.3rem; font-weight: 700; margin: 2rem 0 .75rem; padding-bottom: .3rem; border-bottom: 1px solid rgba(128,128,128,.25); }
.md-guide h3 { font-size: 1.1rem; font-weight: 600; margin: 1.5rem 0 .5rem; }
.md-guide h4 { font-size: 1rem; font-weight: 600; margin: 1.2rem 0 .5rem; }
.md-guide p { margin: .6rem 0; }
.md-guide ul, .md-guide ol { margin: .6rem 0; padding-left: 1.5rem; }
.md-guide li { margin: .25rem 0; }
.md-guide a { color: #3b82f6; text-decoration: underline; }
.md-guide code { background: rgba(128,128,128,.16); padding: .1rem .35rem; border-radius: 4px; font-size: .85em; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.md-guide pre { background: rgba(128,128,128,.14); padding: 1rem; border-radius: 8px; overflow-x: auto; margin: .8rem 0; }
.md-guide pre code { background: none; padding: 0; }
.md-guide blockquote { margin: .8rem 0; padding: .4rem 1rem; border-left: 3px solid rgba(128,128,128,.4); color: inherit; opacity: .9; }
.md-guide hr { border: none; border-top: 1px solid rgba(128,128,128,.25); margin: 2rem 0; }
.md-guide table { border-collapse: collapse; width: 100%; margin: .8rem 0; display: block; overflow-x: auto; }
.md-guide th, .md-guide td { border: 1px solid rgba(128,128,128,.3); padding: .5rem .75rem; text-align: left; vertical-align: top; }
.md-guide th { background: rgba(128,128,128,.12); font-weight: 600; }
.md-guide tr:nth-child(even) td { background: rgba(128,128,128,.05); }
`

const GuidePage = () => {
  const [html, setHtml] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const response = await fetch("/admin/guide")
        const body = await response.json()
        if (!response.ok) throw new Error(body.message ?? `Không tải được (${response.status})`)
        if (active) setHtml(body.html as string)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Không tải được hướng dẫn.")
      } finally {
        if (active) setIsLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  return (
    <div className="p-6">
      <style>{GUIDE_STYLES}</style>
      {isLoading && <p className="text-ui-fg-subtle">Đang tải hướng dẫn…</p>}
      {error && <p className="text-ui-fg-error">{error}</p>}
      {!isLoading && !error && (
        <div
          className="md-guide bg-ui-bg-base border-ui-border-base text-ui-fg-base rounded-lg border p-6 shadow-elevation-card-rest"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Hướng dẫn sử dụng",
  icon: DocumentText,
})

export default GuidePage
