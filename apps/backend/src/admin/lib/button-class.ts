export type AdminButtonVariant = "primary" | "secondary" | "danger" | "ghost"
export type AdminButtonSize = "small" | "base" | "large"

const BASE =
  "inline-flex items-center justify-center gap-1 rounded-md font-medium transition enabled:cursor-pointer enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"

const VARIANTS: Record<AdminButtonVariant, string> = {
  primary: "bg-ui-button-inverted text-ui-fg-on-inverted",
  secondary: "border border-ui-border-base bg-ui-bg-base text-ui-fg-base",
  danger: "border border-ui-border-base bg-ui-bg-base text-ui-fg-error",
  ghost: "text-ui-fg-interactive",
}

const SIZES: Record<AdminButtonSize, string> = {
  small: "px-2 py-1 text-xs",
  base: "px-3 py-1.5 text-sm",
  large: "px-4 py-2 text-sm",
}

export const btn = (
  variant: AdminButtonVariant = "secondary",
  size: AdminButtonSize = "base",
  extra = "",
): string => `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`.trim()
