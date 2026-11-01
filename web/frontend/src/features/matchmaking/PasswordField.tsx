import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { maskPassword } from "./labels"

/** Contraseña oculta con revelar y copiar. La usan la sala y la vista de admin. */
export function PasswordField({
  value,
  label = "Contraseña",
  revealed: initial = false,
}: {
  value: string
  label?: string
  revealed?: boolean
}) {
  const [revealed, setRevealed] = useState(initial)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("No se pudo copiar")
    }
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span
        aria-label={revealed ? undefined : `${label} oculta`}
        className="min-w-[7ch] font-mono text-sm tabular-nums"
      >
        {revealed ? value : maskPassword(value)}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={
          revealed
            ? `Ocultar ${label.toLowerCase()}`
            : `Mostrar ${label.toLowerCase()}`
        }
        onClick={() => setRevealed((r) => !r)}
      >
        {revealed ? <EyeOffIcon /> : <EyeIcon />}
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Copiar ${label.toLowerCase()}`}
        onClick={() => void copy()}
      >
        {copied ? <CheckIcon className="text-win" /> : <CopyIcon />}
      </Button>
    </span>
  )
}
