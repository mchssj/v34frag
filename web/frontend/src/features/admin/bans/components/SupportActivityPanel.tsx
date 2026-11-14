import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ago, fmtDateTime } from "../../lib/format"
import { EmptyState, QueryError } from "../../components/ui"
import { SUPPORT_ACTIONS_PER, supportActionsOptions } from "../api/queries"
import {
  SUPPORT_ACTION_LABEL,
  supportActionQuote,
  supportActionText,
} from "../lib/support"
import type { SupportAction, SupportActionKind } from "../types"

// Administración › Baneos › Actividad del soporte (replanteo 117, bitácora 2026-11-13-rol-soporte): todo lo que hizo
// cada cuenta de soporte. Solo moderadores y admins. La API pagina, filtra y ordena.

const ALL = "all"

export function SupportActivityPanel() {
  const [action, setAction] = useState<SupportActionKind | undefined>()
  const [page, setPage] = useState(1)
  const list = useQuery(supportActionsOptions({ action }, page))
  const pages = list.data
    ? Math.max(1, Math.ceil(list.data.total / SUPPORT_ACTIONS_PER))
    : 1

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Lo que hizo cada cuenta de soporte: baneos de hasta 120 minutos, clips
        reprocesados, fotos y logos quitados, comentarios borrados y sanciones
        de la cola levantadas. Lo tuyo y lo de los admins no aparece acá: queda
        en cada lista.
      </p>
      <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
        Acción
        <Select
          value={action ?? ALL}
          onValueChange={(v) => {
            setAction(v === ALL ? undefined : (v as SupportActionKind))
            setPage(1)
          }}
        >
          <SelectTrigger aria-label="Acción" className="h-9 w-[230px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {(Object.keys(SUPPORT_ACTION_LABEL) as SupportActionKind[]).map(
              (k) => (
                <SelectItem key={k} value={k}>
                  {SUPPORT_ACTION_LABEL[k]}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </span>

      {list.isError ? (
        <QueryError error={list.error} onRetry={() => void list.refetch()} />
      ) : !list.data ? (
        <div className="flex flex-col gap-2" aria-busy>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : list.data.items.length === 0 ? (
        <EmptyState>
          {action
            ? "Ninguna acción de ese tipo."
            : "El soporte todavía no hizo nada."}
        </EmptyState>
      ) : (
        <ul aria-label="Actividad del soporte" className="flex flex-col gap-2">
          {list.data.items.map((a) => (
            <ActionRow key={a.id} a={a} />
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground tabular-nums">
            {page} de {pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  )
}

function ActionRow({ a }: { a: SupportAction }) {
  const quote = supportActionQuote(a)
  const match = typeof a.target.match_id === "string" ? a.target.match_id : null
  return (
    <li>
      <Card variant="outline" className="flex flex-col gap-1.5 p-3.5">
        <p className="text-sm">
          {a.actor ? (
            <Link
              to="/player/$nick"
              params={{ nick: a.actor.alias }}
              className="font-semibold hover:text-primary"
            >
              {a.actor.alias}
            </Link>
          ) : (
            <span className="font-semibold">Una cuenta de soporte</span>
          )}{" "}
          {supportActionText(a, fmtDateTime)}
          {match && (
            <>
              {" · "}
              <Link
                to="/match/$id"
                params={{ id: match }}
                className="text-primary hover:underline"
              >
                ver el mix
              </Link>
            </>
          )}
        </p>
        {quote && (
          <blockquote className="rounded-md border-l-2 bg-muted/50 px-3 py-1.5 text-[13px] break-words whitespace-pre-line">
            {quote}
          </blockquote>
        )}
        {a.reason && (
          <p className="text-[13px]">
            <span className="text-muted-foreground">Motivo:</span> {a.reason}
          </p>
        )}
        <span
          className="text-xs text-muted-foreground"
          title={fmtDateTime(a.created_at)}
        >
          {ago(a.created_at)}
        </span>
      </Card>
    </li>
  )
}
