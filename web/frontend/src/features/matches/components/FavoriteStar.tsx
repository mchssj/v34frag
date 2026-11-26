import { cn } from "cn"
import { StarIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { VipDialog } from "@/features/vip/VipDialog"
import { useVip } from "@/features/vip/useVip"
import { useFavorite } from "../api/queries"

/**
 * Marca o saca una partida de las favoritas (bitácora 2026-11-24-comparador-y-favoritas-vip). Marcar es VIP: sin VIP abre
 * "Cómo ser VIP". Sacar una ya marcada se puede siempre.
 */
export function FavoriteStar({ id, on }: { id: string; on: boolean }) {
  const { vip, ready } = useVip()
  const favorite = useFavorite()
  const [dialog, setDialog] = useState(false)
  return (
    // La fila abre la partida: el clic y Enter en la estrella no llegan a ella.
    <span
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-pressed={on}
        aria-label={on ? "Sacar de favoritas" : "Marcar como favorita"}
        title={on ? "Sacar de favoritas" : "Marcar como favorita"}
        disabled={!ready || favorite.isPending}
        onClick={() => {
          if (!on && !vip) return setDialog(true)
          favorite.mutate(
            { id, on: !on },
            { onError: (e) => toast.error(errorMessage(e)) }
          )
        }}
      >
        <StarIcon
          aria-hidden
          className={cn(
            "text-muted-foreground",
            on && "fill-yellow-400 text-yellow-500 dark:text-yellow-300"
          )}
        />
      </Button>
      <VipDialog open={dialog} onOpenChange={setDialog} />
    </span>
  )
}
