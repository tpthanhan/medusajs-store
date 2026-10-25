import { Button as MedusaButton } from "@medusajs/ui"
import type { ButtonHTMLAttributes, FC } from "react"

export interface UiButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "transparent" | "danger"
  size?: "base" | "small" | "large"
  isLoading?: boolean
  asChild?: boolean
}

export const Button = MedusaButton as unknown as FC<UiButtonProps>
