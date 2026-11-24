import type { ComponentProps } from "react"
import { cn } from "cn"
import { fieldClass } from "./input"

// 複数行の入力欄。見た目は Input と同じ（fieldClass）
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(fieldClass, "min-h-20 py-2", className)} {...props} />
}
