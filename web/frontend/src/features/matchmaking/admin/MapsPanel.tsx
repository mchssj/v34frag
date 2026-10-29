import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  adminConfigOptions,
  adminMapsOptions,
  useMmAdminMutation,
} from "../queries"
import { useMmSource } from "../source"
import { CatalogPanel } from "./CatalogPanel"
import type { MmAdminMap } from "../types"

// Administración › Matchmaking › Mapas, en dos partes: el catálogo (agregar y editar mapas, imagen
// y fondo) y el veto de cada modo (`mm_mode_maps`, en orden; mínimo 2).

export function MapsPanel() {
  const [part, setPart] = useState<"catalog" | "veto">("catalog")
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1">
        {(
          [
            ["catalog", "Catálogo"],
            ["veto", "Veto por modo"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={part === key ? "secondary" : "ghost"}
            aria-pressed={part === key}
            onClick={() => setPart(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      {part === "catalog" ? <CatalogPanel /> : <VetoMapsPanel />}
    </div>
  )
}

function VetoMapsPanel() {
  const source = useMmSource()
  const { data: config } = useQuery(adminConfigOptions(source))
  const [mode, setMode] = useState("5v5")
  const { data } = useQuery(adminMapsOptions(source, mode))
  return (
    <div className="flex flex-col gap-3">
      <div
        role="radiogroup"
        aria-label="Modo"
        className="inline-flex w-fit rounded-lg border bg-muted/40 p-1"
      >
        {(config?.modes ?? []).map((m) => (
          <button
            key={m.mode}
            type="button"
            role="radio"
            aria-checked={m.mode === mode}
            onClick={() => setMode(m.mode)}
            className={cn(
              "rounded-md px-3.5 py-1 text-sm font-medium text-muted-foreground",
              m.mode === mode && "bg-background text-foreground shadow-sm"
            )}
          >
            {m.mode}
            {!m.enabled && <span className="ml-1 text-xs">(apagado)</span>}
          </button>
        ))}
      </div>
      {data ? (
        <MapsEditor key={mode} mode={mode} initial={data} />
      ) : (
        <Skeleton className="h-72 w-full rounded-xl" />
      )}
    </div>
  )
}

function MapsEditor({
  mode,
  initial,
}: {
  mode: string
  initial: MmAdminMap[]
}) {
  const source = useMmSource()
  const [maps, setMaps] = useState(initial)
  const save = useMmAdminMutation((names: string[]) =>
    source.saveMaps(mode, names)
  )
  const chosen = maps.filter((m) => m.in_mm)
  const dirty =
    chosen.map((m) => m.name).join() !==
    initial
      .filter((m) => m.in_mm)
      .map((m) => m.name)
      .join()

  const toggle = (name: string, on: boolean) =>
    setMaps((list) => {
      const rest = list.filter((m) => m.name !== name)
      const map = { ...list.find((m) => m.name === name)!, in_mm: on }
      // Al sumarlo va al final de los elegidos; al sacarlo, con el resto del catálogo.
      const lastIn = rest.filter((m) => m.in_mm).length
      return on
        ? [...rest.slice(0, lastIn), map, ...rest.slice(lastIn)]
        : [...rest.filter((m) => m.in_mm), map, ...rest.filter((m) => !m.in_mm)]
    })

  const move = (i: number, d: -1 | 1) =>
    setMaps((list) => {
      const next = [...list]
      ;[next[i], next[i + d]] = [next[i + d]!, next[i]!]
      return next
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mapas del veto en {mode}</CardTitle>
        <CardDescription>
          Los marcados entran al veto de capitanes de este modo, en este orden.
          Son aparte de los de Mixes. Mínimo 2.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col divide-y rounded-xl border">
          {maps.map((m, i) => (
            <li
              key={m.name}
              className={cn(
                "flex items-center gap-3 px-3 py-2",
                !m.in_mm && "text-muted-foreground"
              )}
            >
              <Switch
                aria-label={`${m.name} en el veto`}
                checked={m.in_mm}
                onCheckedChange={(on) => toggle(m.name, on)}
              />
              <span className="grid aspect-[4/3] w-10 shrink-0 place-items-center overflow-hidden rounded bg-muted">
                {m.image_url && (
                  <img
                    src={m.image_url}
                    alt=""
                    className="size-full object-cover"
                  />
                )}
              </span>
              <span className="text-sm font-medium">{m.label}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {m.name}
              </span>
              {m.in_mm && (
                <span className="ml-auto flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Subir ${m.name}`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Bajar ${m.name}`}
                    disabled={i === chosen.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDownIcon />
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-end gap-3">
          <span className="mr-auto text-sm text-muted-foreground">
            {chosen.length} en el veto
          </span>
          <Button
            variant="ghost"
            disabled={!dirty}
            onClick={() => setMaps(initial)}
          >
            Descartar
          </Button>
          <Button
            disabled={!dirty || chosen.length < 2 || save.isPending}
            onClick={() =>
              save.mutate(
                chosen.map((m) => m.name),
                {
                  onSuccess: () => toast.success("Mapas guardados"),
                  onError: (e) => toast.error(errorMessage(e)),
                }
              )
            }
          >
            Guardar mapas
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
