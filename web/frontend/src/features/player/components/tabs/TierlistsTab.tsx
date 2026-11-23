import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  EyeIcon,
  HeartIcon,
  ListOrderedIcon,
  MessageSquareIcon,
  PencilIcon,
  PlusIcon,
  StarIcon,
} from "lucide-react"
import { useState } from "react"

import { EmptyState } from "@/components/brand/EmptyState"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import {
  tierlistOptions,
  tierlistsOfOptions,
  useCreateTierlist,
} from "@/features/tierlists/api/queries"
import { TierBoard } from "@/features/tierlists/components/TierBoard"
import { NAME_MAX } from "@/features/tierlists/lib/board"

// Pestaña Tierlists del perfil (replanteo 137): arriba la destacada (o, si no hay, la última editada) entera y abajo
// todas, para abrir cada una.

export function Tierlists({
  playerId,
  owner,
}: {
  playerId: string
  owner: boolean
}) {
  const list = useQuery(tierlistsOfOptions(playerId))
  const [creating, setCreating] = useState(false)
  const data = list.data
  const top = data?.items[0]

  if (!data)
    return (
      <div className="flex flex-col gap-3 py-4" aria-busy>
        <Skeleton className="h-64 w-full" />
      </div>
    )

  const canCreate = owner && data.count < data.limit
  const newButton = owner && (
    <Button size="sm" disabled={!canCreate} onClick={() => setCreating(true)}>
      <PlusIcon aria-hidden />
      Nueva tierlist
    </Button>
  )

  return (
    <div className="flex flex-col gap-6 py-4">
      {data.items.length === 0 ? (
        <EmptyState
          icon={ListOrderedIcon}
          title="Sin tierlists"
          action={newButton || undefined}
        >
          {owner
            ? "Arma tu ranking de jugadores o de equipos, de CMLeague o de afuera."
            : "Este jugador todavía no armó ninguna tierlist."}
        </EmptyState>
      ) : (
        <>
          {owner && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground tabular-nums">
                {data.count}/{data.limit} tierlists
              </span>
              {newButton}
            </div>
          )}
          {top && <Featured id={top.id} featured={top.featured} />}
          {data.items.length > 1 && (
            <section
              className="flex flex-col gap-2"
              aria-label="Todas las tierlists"
            >
              <h3 className="text-sm font-semibold">Ver otras tierlists</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.items.slice(1).map((t) => (
                  <li key={t.id}>
                    <Card
                      variant="outline"
                      asChild
                      className="flex flex-col gap-1 p-4 hover:bg-muted/50"
                    >
                      <Link to="/tierlists/$id" params={{ id: t.id }}>
                        <span className="font-semibold break-words">
                          {t.name}
                        </span>
                        <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            {t.kind === "players" ? "Jugadores" : "Equipos"}
                          </span>
                          <span>{t.items} ítems</span>
                          <span className="inline-flex items-center gap-1">
                            <HeartIcon aria-hidden className="size-3.5" />
                            {t.likes}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MessageSquareIcon
                              aria-hidden
                              className="size-3.5"
                            />
                            {t.comments}
                          </span>
                        </span>
                      </Link>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {creating && <CreateDialog onClose={() => setCreating(false)} />}
    </div>
  )
}

function Featured({ id, featured }: { id: string; featured: boolean }) {
  const { data } = useQuery(tierlistOptions(id))
  if (!data) return <Skeleton className="h-64 w-full" />
  return (
    <section className="flex flex-col gap-3" aria-label="Tierlist destacada">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          {featured && (
            <StarIcon
              aria-label="Destacada"
              className="size-4 fill-current text-primary"
            />
          )}
          {data.name}
          <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
            <HeartIcon aria-hidden className="size-3.5" />
            {data.likes}
            <span className="sr-only">me gusta</span>
          </span>
        </h3>
        <div className="flex gap-2">
          {/* Ver: la página completa, con comentarios. Editar: el editor directo (solo el dueño). */}
          <Button variant="outline" size="sm" asChild>
            <Link to="/tierlists/$id" params={{ id }}>
              <EyeIcon aria-hidden />
              Ver tierlist
            </Link>
          </Button>
          {data.is_owner && (
            <Button size="sm" asChild>
              <Link
                to="/tierlists/$id"
                params={{ id }}
                search={{ editar: true }}
              >
                <PencilIcon aria-hidden />
                Editar
              </Link>
            </Button>
          )}
        </div>
      </div>
      <TierBoard tierlist={data} />
    </section>
  )
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const create = useCreateTierlist()
  const [name, setName] = useState("")
  const [kind, setKind] = useState<"players" | "teams">("players")
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            create.mutate(
              { name: name.trim(), kind },
              {
                onSuccess: (r) =>
                  void navigate({
                    to: "/tierlists/$id",
                    params: { id: r.id },
                    search: { editar: true },
                  }),
              }
            )
          }}
        >
          <DialogHeader>
            <DialogTitle>Nueva tierlist</DialogTitle>
            <DialogDescription>
              Arranca con los tiers S, A, B, C y D: después los puedes cambiar.
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Nombre"
            placeholder="Nombre (por ejemplo, Mejores AWP)"
            maxLength={NAME_MAX}
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
          <RadioGroup
            aria-label="Tipo"
            value={kind}
            onValueChange={(v) => setKind(v as "players" | "teams")}
            className="gap-2"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="players" />
              Jugadores
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="teams" />
              Equipos
            </label>
          </RadioGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              Crear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
