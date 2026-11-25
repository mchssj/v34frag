import { cn } from "cn"
import { BanIcon, CheckIcon, LockIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { VipDialog } from "@/features/vip/VipDialog"
import { useMmMutation } from "./queries"
import { useMmSource } from "./source"
import type { MmState } from "./types"

// Preveto de mapas (VIP, replanteo 146, bitácora 2026-11-25-preveto-vip): el mapa que el VIP quiere fuera de sus salas. Al
// empezar el veto caen los más votados de la sala. Con la función apagada, o un pool sin mapas de sobra, no se muestra.

export function PrevetoPicker({
  preveto,
  mode,
}: {
  preveto: MmState["preveto"]
  mode: string
}) {
  const source = useMmSource()
  const set = useMmMutation((map: string | null) =>
    source.setPreveto(mode, map)
  )
  const [open, setOpen] = useState(false)
  const [vipOpen, setVipOpen] = useState(false)
  if (!preveto) return null
  const info = preveto.modes.find((m) => m.mode === mode)
  if (preveto.allowed && !info?.max) return null
  const chosen = info?.pool.find((m) => m.name === info.map)

  const pick = (map: string | null) =>
    set.mutate(map, {
      onSuccess: () => {
        setOpen(false)
        toast.success(map ? "Preveto guardado" : "Sacaste tu preveto")
      },
      onError: (e) => toast.error(errorMessage(e)),
    })

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        Preveto <Badge variant="vip">VIP</Badge>
      </span>
      <Button
        variant="outline"
        size="sm"
        className="max-w-40"
        aria-label={
          chosen
            ? `Preveto de mapas: ${chosen.label}`
            : "Elegir mapa a prevetar"
        }
        onClick={() => (preveto.allowed ? setOpen(true) : setVipOpen(true))}
      >
        {preveto.allowed ? (
          <BanIcon aria-hidden className={cn(chosen && "text-destructive")} />
        ) : (
          <LockIcon aria-hidden className="text-muted-foreground" />
        )}
        <span className="truncate">{chosen?.label ?? "Elegir mapa"}</span>
      </Button>
      <VipDialog open={vipOpen} onOpenChange={setVipOpen} />
      {info && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Preveto de mapas · {mode}</DialogTitle>
              <DialogDescription>
                Elige un mapa que no quieras jugar. Antes del veto de capitanes{" "}
                {info.max === 1
                  ? "cae el mapa más votado por los VIP de la sala"
                  : `caen hasta ${info.max} mapas, los más votados por los VIP de la sala`}
                ; si empatan, se elige al azar.
              </DialogDescription>
            </DialogHeader>
            <ul className="grid max-h-[55dvh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {info.pool.map((m) => {
                const on = m.name === info.map
                return (
                  <li key={m.name}>
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={set.isPending}
                      onClick={() => pick(on ? null : m.name)}
                      className={cn(
                        "flex w-full flex-col overflow-hidden rounded-lg border bg-muted/40 text-left outline-none hover:border-destructive focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                        on && "border-destructive"
                      )}
                    >
                      <span className="aspect-video w-full bg-muted">
                        {m.image_url && (
                          <img
                            src={m.image_url}
                            alt=""
                            className={cn(
                              "size-full object-cover",
                              on && "grayscale"
                            )}
                          />
                        )}
                      </span>
                      <span className="flex items-center gap-1.5 px-2 py-1.5 text-[13px] font-medium">
                        <span className={cn("truncate", on && "line-through")}>
                          {m.label}
                        </span>
                        {on && (
                          <CheckIcon
                            aria-hidden
                            className="ml-auto size-3.5 shrink-0 text-destructive"
                          />
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Queda guardado para tus próximas partidas. La sala no muestra
                quién votó.
              </p>
              <Button
                variant="ghost"
                size="sm"
                disabled={!info.map || set.isPending}
                onClick={() => pick(null)}
              >
                Sin preveto
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
