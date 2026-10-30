import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { XIcon } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "../dialogs"
import { Card, Chip, EmptyState, QueryError } from "../ui"
import {
  hitsOptions,
  useAddWord,
  useDeleteWord,
  wordsOptions,
  type BlockedHit,
} from "./queries"

const KIND: Record<BlockedHit["kind"], string> = {
  alias: "Alias",
  player: "Ficha sin cuenta",
  team: "Equipo",
}

export function WordsTab({
  onEditAlias,
}: {
  onEditAlias: (hit: { id: string; name: string }) => void
}) {
  const id = useId()
  const words = useQuery(wordsOptions)
  const hits = useQuery(hitsOptions)
  const add = useAddWord()
  const del = useDeleteWord()
  const [word, setWord] = useState("")
  const [target, setTarget] = useState<{ id: string; word: string } | null>(
    null
  )
  const w = word.trim()

  return (
    <div className="flex flex-wrap items-start gap-5">
      <Card className="min-w-0 flex-[1_1_340px] gap-3.5">
        <div className="flex flex-col gap-1">
          <h2 className="text-[17px] font-bold">Palabras bloqueadas</h2>
          <span className="text-[13px] leading-relaxed text-muted-foreground">
            Nadie puede usarlas en su alias ni en el nombre o la sigla de un
            equipo. Se comparan sin mayúsculas, tildes, espacios ni leetspeak
            (h4ck = hack).
          </span>
        </div>
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (w.length < 2) return
            add.mutate(w, {
              onSuccess: () => {
                setWord("")
                toast.success(
                  "Palabra bloqueada. Revisa los nombres que ya la usan."
                )
              },
            })
          }}
        >
          <Label htmlFor={`${id}-w`} className="sr-only">
            Palabra nueva
          </Label>
          <div className="flex gap-2">
            <Input
              id={`${id}-w`}
              value={word}
              maxLength={40}
              placeholder="Agregar palabra"
              onChange={(e) => {
                setWord(e.target.value)
                add.reset()
              }}
            />
            <Button
              type="submit"
              className="h-9"
              disabled={w.length < 2 || add.isPending}
            >
              Agregar
            </Button>
          </div>
          {add.isError && (
            <span role="alert" className="text-xs text-destructive">
              {errorMessage(add.error)}
            </span>
          )}
        </form>
        {words.isError ? (
          <QueryError
            error={words.error}
            onRetry={() => void words.refetch()}
          />
        ) : words.isPending ? (
          <Skeleton className="h-16 rounded-lg" />
        ) : words.data.items.length === 0 ? (
          <span className="text-[13px] text-muted-foreground">
            No hay palabras bloqueadas.
          </span>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {words.data.items.map((x) => (
              <li
                key={x.id}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border pr-1 pl-3 text-[13px]"
              >
                <span className="font-mono">{x.word}</span>
                <button
                  type="button"
                  aria-label={`Desbloquear ${x.word}`}
                  onClick={() => setTarget(x)}
                  className="grid size-6 place-items-center rounded-full bg-muted"
                >
                  <XIcon aria-hidden className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section
        aria-label="Nombres que contienen una palabra bloqueada"
        className="flex min-w-0 flex-[999_1_480px] flex-col gap-3"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-[17px] font-bold">
            Nombres actuales que la contienen
          </h2>
          <span className="text-[13px] text-muted-foreground">
            Ya existían antes de bloquear la palabra. Revísalos uno por uno.
          </span>
        </div>
        {hits.isError ? (
          <QueryError error={hits.error} onRetry={() => void hits.refetch()} />
        ) : hits.isPending ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : hits.data.items.length === 0 ? (
          <EmptyState>Ningún nombre contiene una palabra bloqueada.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {hits.data.items.map((h) => (
              <li
                key={`${h.kind}-${h.id}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3"
              >
                <Chip tone={h.kind === "alias" ? "primary" : "neutral"}>
                  {KIND[h.kind]}
                </Chip>
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="font-semibold">{h.name}</span>
                  <span className="text-xs text-muted-foreground">
                    Contiene «{h.word}»
                  </span>
                </span>
                {h.kind === "alias" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEditAlias(h)}
                  >
                    Cambiar alias
                  </Button>
                )}
                {h.kind === "player" && (
                  <Link
                    to="/admin/players"
                    className="text-[13px] text-primary hover:underline"
                  >
                    Editar ficha
                  </Link>
                )}
                {h.kind === "team" && (
                  <Link
                    to="/teams/$id"
                    params={{ id: h.id }}
                    className="text-[13px] text-primary hover:underline"
                  >
                    Ver equipo
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`¿Desbloquear «${target?.word ?? ""}»?`}
        description="Se va a poder usar en alias y nombres de equipos."
        confirmLabel="Desbloquear"
        pending={del.isPending}
        error={del.error}
        onConfirm={() =>
          target &&
          del.mutate(target.id, {
            onSuccess: () => {
              setTarget(null)
              toast.success("Palabra desbloqueada.")
            },
          })
        }
      />
    </div>
  )
}
