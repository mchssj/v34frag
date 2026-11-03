import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { useState } from "react"

import { ConfirmDialog } from "@/components/brand/ConfirmDialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { fmtDateTime } from "../labels"
import {
  adminBansOptions,
  adminPenaltiesOptions,
  useMmAdminMutation,
} from "../queries"
import { useMmSource } from "../source"
import type { MmAdminPenalty } from "../types"

// Administración › Baneos › Matchmaking: las sanciones automáticas de la cola (replanteo 61) y las exclusiones
// que ponen los moderadores desde un reporte. Se levantan acá (bitácora 2026-11-02-mm-sanciones-admin).

/** Las dos tarjetas, una debajo de la otra. */
export function SanctionsPanel() {
  return (
    <div className="flex flex-col gap-4">
      <PenaltiesCard />
      <BansCard />
    </div>
  )
}

export function PenaltiesCard() {
  const source = useMmSource()
  const { data } = useQuery(adminPenaltiesOptions(source))
  const [target, setTarget] = useState<MmAdminPenalty | null>(null)
  const lift = useMmAdminMutation(
    ({ userId, reason }: { userId: string; reason: string }) =>
      source.liftPenalty(userId, reason)
  )
  const name = (p: MmAdminPenalty) => p.nick ?? "Jugador sin ficha"
  return (
    <Card variant="outline" className="flex flex-col gap-3 p-4">
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold">
          Sanciones de la cola
        </CardTitle>
        <CardDescription className="text-[13px] leading-relaxed">
          Las pone el matchmaking solo, por no aceptar, rechazar, no conectarse
          o abandonar. Cada falta sube un nivel de la escalera. Levantar una
          corta la espera y baja un nivel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!data && <Skeleton className="h-12 w-full" />}
        {data?.length === 0 && (
          <p className="text-sm text-muted-foreground">Nadie sancionado.</p>
        )}
        <ul className="flex flex-col divide-y">
          {data?.map((p) => (
            <li
              key={p.user_id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
            >
              <span className="font-medium">{name(p)}</span>
              <span className="text-muted-foreground">
                {p.reason ?? "Sin motivo"} · Nivel {p.level} de {p.max_level} ·
                hasta {fmtDateTime(p.until)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => {
                  lift.reset()
                  setTarget(p)
                }}
              >
                Levantar
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
      <ConfirmDialog
        open={!!target}
        onOpenChange={(open) => !open && setTarget(null)}
        title={`Levantar la sanción de ${target ? name(target) : ""}`}
        description={
          target && (
            <p>
              Puede volver a la cola enseguida y su nivel baja de {target.level}{" "}
              a {Math.max(0, target.level - 1)}, como si esa falta no hubiera
              pasado.
            </p>
          )
        }
        confirmLabel="Levantar"
        reason={{
          label: "Motivo",
          help: "Queda registrado. Por ejemplo: se cayó Steam.",
          required: true,
        }}
        pending={lift.isPending}
        error={lift.error}
        onConfirm={(reason) =>
          target &&
          lift.mutate(
            { userId: target.user_id, reason },
            {
              onSuccess: () => {
                toast.success(`Sanción de ${name(target)} levantada`)
                setTarget(null)
              },
            }
          )
        }
      />
    </Card>
  )
}

export function BansCard() {
  const source = useMmSource()
  const { data } = useQuery(adminBansOptions(source))
  const unban = useMmAdminMutation((userId: string) => source.unban(userId))
  return (
    <Card variant="outline" className="flex flex-col gap-3 p-4">
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold">
          Excluidos del matchmaking
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data?.length === 0 && (
          <p className="text-sm text-muted-foreground">Nadie excluido.</p>
        )}
        <ul className="flex flex-col divide-y">
          {data?.map((b) => (
            <li
              key={b.user_id}
              className="flex items-center gap-3 py-2 text-sm"
            >
              <span className="font-medium">{b.nick}</span>
              <span className="text-muted-foreground">
                {b.reason} · hasta {fmtDateTime(b.until)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                disabled={unban.isPending}
                onClick={() => unban.mutate(b.user_id)}
              >
                Levantar
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
