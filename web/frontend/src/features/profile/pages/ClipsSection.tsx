import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ListChecksIcon,
  SparklesIcon,
  StarIcon,
  XIcon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import type { Schemas } from "@/api/client"
import { errorMessage } from "@/api/errors"
import { QueryState } from "@/components/brand/QueryState"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { mapsOptions } from "@/features/maps/api/queries"
import { mapImage } from "@/features/maps/lib/catalog"
import { fmtLong } from "@/features/player/lib/labels"
import { clipKind } from "@/features/series/lib/series"
import {
  myClipsOptions,
  myProfileOptions,
  useSaveMyClips,
} from "../api/queries"
import { CardTitle, SectionCard } from "../components/ui"

// Mi Perfil › Clips (replanteo 76): los clips que se ven primero en la ficha pública. En automático se eligen
// solos (los mejores con video, según la escala de la liga); con "Elijo yo", los marca el jugador y los ordena.

type Data = Schemas["MyClips"]
type Mode = Data["mode"]
type Item = Data["clips"][number]

const title = (it: Item) =>
  `${clipKind(it.clip.type)}${it.match.map ? ` en ${it.match.map}` : ""}`

export function ClipsSection() {
  return (
    <QueryState q={useQuery(myClipsOptions)}>
      {(data) => (
        // Lo que vuelve de la API al guardar arma el formulario de nuevo.
        <ClipsForm key={`${data.mode}:${data.picked.join()}`} data={data} />
      )}
    </QueryState>
  )
}

function ClipsForm({ data }: { data: Data }) {
  const save = useSaveMyClips()
  const maps = useQuery(mapsOptions).data
  const nick = useQuery(myProfileOptions).data?.player?.nick
  const [mode, setMode] = useState<Mode>(data.mode)
  const [picked, setPicked] = useState<string[]>(data.picked)

  const byId = new Map(data.clips.map((it) => [it.clip.id, it]))
  const auto = mode === "auto"
  // En automático, los que se eligen solos (la API los manda en `shown`).
  const chosen = (auto ? data.shown : picked).filter((id) => byId.has(id))
  const full = !auto && picked.length >= data.max
  const dirty = mode !== data.mode || picked.join() !== data.picked.join()

  const toggle = (id: string) =>
    setPicked((p) =>
      p.includes(id)
        ? p.filter((x) => x !== id)
        : p.length < data.max
          ? [...p, id]
          : p
    )
  const move = (i: number, d: -1 | 1) =>
    setPicked((p) => {
      const n = [...p]
      const j = i + d
      if (j < 0 || j >= n.length) return p
      ;[n[i], n[j]] = [n[j]!, n[i]!]
      return n
    })

  function submit() {
    save.mutate(
      { mode, ids: picked },
      {
        onSuccess: () => toast.success("Clips destacados guardados"),
        onError: (e) => toast.error(errorMessage(e)),
      }
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionCard className="flex flex-col gap-4 p-5">
        <CardTitle
          title="Clips destacados"
          description="Los clips que se ven primero en tu ficha pública. Puedes dejar que se elijan solos o elegirlos tú."
        />
        <div
          role="radiogroup"
          aria-label="Cómo se eligen"
          className="grid gap-3 sm:grid-cols-2"
        >
          <ModeCard
            checked={auto}
            onPick={() => setMode("auto")}
            icon={<SparklesIcon aria-hidden className="size-4" />}
            title="Automático"
            text="Se muestran solos tus mejores clips: ACE, después los clutch más difíciles, 4K y 3K."
          />
          <ModeCard
            checked={!auto}
            onPick={() => setMode("manual")}
            icon={<ListChecksIcon aria-hidden className="size-4" />}
            title="Elijo yo"
            text="Marcas con la estrella los que quieras y los ordenas. El primero va arriba."
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-baseline gap-2">
            <span className="font-mono text-lg font-bold">
              {chosen.length} de {data.max}
            </span>
            <span className="text-sm text-muted-foreground">
              {auto ? "elegidos solos" : "destacados"}
            </span>
          </span>
          {!data.vip && (
            <span className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/8 px-3 py-1.5 text-[13px]">
              <Badge className="bg-amber-400 text-black">VIP</Badge>
              Con VIP destacas hasta {data.max_vip}.
            </span>
          )}
        </div>

        <section
          aria-label="Tus destacados, en orden"
          className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3"
        >
          <h3 className="text-[13px] font-semibold text-muted-foreground">
            En tu ficha, en este orden
          </h3>
          {chosen.length === 0 ? (
            <p className="py-1 text-sm text-muted-foreground">
              {auto
                ? "Cuando tengas clips con video, aparecen acá solos."
                : "Todavía no elegiste ninguno: tu ficha no muestra la pestaña Clips."}
            </p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {chosen.map((id, i) => {
                const it = byId.get(id)!
                return (
                  <li
                    key={id}
                    className="flex flex-wrap items-center gap-3 rounded-lg bg-background px-3 py-2"
                  >
                    <span className="w-4 font-mono font-bold text-primary">
                      {i + 1}
                    </span>
                    <span className="font-semibold">{title(it)}</span>
                    <span className="text-[13px] text-muted-foreground">
                      {it.match.played_at && fmtLong(it.match.played_at)}
                    </span>
                    {!auto && (
                      <span className="ml-auto flex gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          aria-label={`Subir ${title(it)}`}
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        >
                          <ArrowUpIcon aria-hidden />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          aria-label={`Bajar ${title(it)}`}
                          disabled={i === chosen.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDownIcon aria-hidden />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          aria-label={`Quitar ${title(it)}`}
                          onClick={() => toggle(id)}
                        >
                          <XIcon aria-hidden />
                        </Button>
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        <div className="flex flex-wrap gap-2">
          <Button disabled={!dirty || save.isPending} onClick={submit}>
            Guardar
          </Button>
          {nick && (
            <Button variant="outline" asChild>
              <Link
                to="/player/$nick"
                params={{ nick }}
                search={{ tab: "clips" }}
              >
                Ver mi ficha
              </Link>
            </Button>
          )}
        </div>
      </SectionCard>

      <SectionCard className="flex flex-col gap-3 p-5">
        <CardTitle
          title="Todos tus clips"
          description="Solo los que ya tienen video. Los rechazados no aparecen."
        />
        {data.clips.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no tienes clips con video. Salen de tus mejores jugadas en
            los mixes.
          </p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {data.clips.map((it) => {
              const on = chosen.includes(it.clip.id)
              const disabled = auto || (!on && full)
              return (
                <li
                  key={it.clip.id}
                  className={cn(
                    "flex flex-col overflow-hidden rounded-[calc(var(--radius)+2px)] border",
                    on && "border-primary"
                  )}
                >
                  <span
                    className="relative grid h-[118px] place-items-center bg-muted bg-cover bg-center text-white"
                    style={{
                      backgroundImage: mapImage(maps, it.match.map)
                        ? `linear-gradient(to top, rgb(0 0 0 / .65), rgb(0 0 0 / .15)), url("${mapImage(maps, it.match.map)}")`
                        : undefined,
                    }}
                  >
                    <span className="absolute top-2 left-2 rounded-md bg-primary px-2 py-0.5 font-mono text-xs font-bold text-primary-foreground">
                      {clipKind(it.clip.type)}
                    </span>
                    {it.match.map && (
                      <span className="font-mono text-lg font-bold drop-shadow">
                        {it.match.map}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 px-3 py-2.5">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-semibold">
                        {title(it)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Ronda {it.clip.round}
                        {it.match.played_at &&
                          ` · ${fmtLong(it.match.played_at)}`}
                      </span>
                    </span>
                    <Button
                      size="icon"
                      variant={on ? "default" : "outline"}
                      aria-label={
                        on
                          ? `Quitar ${title(it)} de destacados`
                          : `Destacar ${title(it)}`
                      }
                      aria-pressed={on}
                      disabled={disabled}
                      title={
                        auto
                          ? "En automático se eligen solos"
                          : !on && full
                            ? "Llegaste al tope: quita uno para elegir otro"
                            : undefined
                      }
                      onClick={() => toggle(it.clip.id)}
                    >
                      <StarIcon
                        aria-hidden
                        className={cn(on && "fill-current")}
                      />
                    </Button>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        {full && (
          <p className="text-[13px] text-muted-foreground">
            Llegaste al tope. Quita uno para elegir otro.
          </p>
        )}
      </SectionCard>
    </div>
  )
}

function ModeCard({
  checked,
  onPick,
  icon,
  title,
  text,
}: {
  checked: boolean
  onPick: () => void
  icon: React.ReactNode
  title: string
  text: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onPick}
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border-2 px-4 py-3 text-left transition-colors motion-reduce:transition-none",
        checked
          ? "border-primary bg-primary/8"
          : "border-border hover:border-primary/40"
      )}
    >
      <span className="flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </span>
      <span className="text-[13px] leading-snug text-muted-foreground">
        {text}
      </span>
    </button>
  )
}
