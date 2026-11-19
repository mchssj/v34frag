import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { CrownIcon } from "lucide-react"
import { toast } from "sonner"

import { buttonVariants } from "@/components/ui/button"

// La puerta de entrada a "Hacete VIP" (docs/bitacora/2026-10-29-hacete-vip en kyan/pruebas). Cada candado o
// aviso de "es para VIP" de los prototipos lleva acá. En la web real, VIP_URL pasa a ser la ruta `/vip`.

export const VIP_URL = "/demo/vip"

/** Botón "Hacete VIP" para los carteles de los beneficios con candado. */
export function HaceteVipButton({ className }: { className?: string }) {
  return (
    <Link
      to={VIP_URL}
      className={cn(
        buttonVariants({ size: "sm" }),
        "bg-amber-400 text-black hover:bg-amber-300",
        className
      )}
    >
      <CrownIcon aria-hidden />
      Hacete VIP
    </Link>
  )
}

/** El aviso de "es para VIP" con un botón que lleva a la página de VIP. */
export function vipToast(message: string) {
  toast.error(message, {
    action: {
      label: "Hacete VIP",
      onClick: () => {
        window.location.href = VIP_URL
      },
    },
  })
}
