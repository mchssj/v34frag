import { cn } from "cn"
import { CheckIcon, LockIcon } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { MAX_POOL, defaultPool, poolChoices, poolError } from "./pool"
import type { MapEntry } from "./queries"

/**
 * "Mapas del veto" de los formularios de Torneos y PCW: el pool por defecto (`null`) o los mapas
 * elegidos. `minMaps` es el BO más alto del torneo o el BO de la PCW.
 */
export function MapPoolPicker({
  maps,
  value,
  onChange,
  minMaps,
  kind,
  locked = false,
}: {
  maps: MapEntry[]
  value: string[] | null
  onChange: (v: string[] | null) => void
  minMaps: number
  kind: "torneo" | "anuncio"
  /** En un torneo, después del primer veto el pool ya no cambia. */
  locked?: boolean
}) {
  const defaults = defaultPool(maps)
  const custom = value !== null
  const chosen = value ?? []
  const err = poolError(value, maps, minMaps)
  const count = custom ? chosen.length : defaults.length

  return (
    <section
      aria-labelledby="map-pool-h"
      className="flex flex-col gap-4 rounded-xl border bg-card p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="map-pool-h" className="text-[17px] font-bold">
          Mapas del veto
        </h2>
        <span
          className={cn(
            "text-[13px]",
            err ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {custom ? `${count} elegidos` : `${count} mapas`} · mínimo {minMaps} ·
          máximo {MAX_POOL}
        </span>
      </div>

      {locked && (
        <Alert variant="warning">
          <LockIcon aria-hidden />
          <AlertDescription>
            Ya empezó el veto de una partida del torneo: el pool no se puede
            cambiar.
          </AlertDescription>
        </Alert>
      )}

      <div
        role="radiogroup"
        aria-label="Qué mapas se vetan"
        className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-2"
      >
        <Choice
          on={!custom}
          disabled={locked}
          title="Pool por defecto"
          text={`${defaults.length} mapas que define un admin. Es el de siempre.`}
          onClick={() => onChange(null)}
        />
        <Choice
          on={custom}
          disabled={locked}
          title="Elegir los mapas"
          text="Entre todos los disponibles, también los que no están en el pool por defecto."
          onClick={() => !custom && onChange([...defaults])}
        />
      </div>

      {!custom ? (
        <>
          <ul className="flex flex-wrap gap-1.5">
            {defaults.map((m) => (
              <li
                key={m}
                className="inline-flex h-7.5 items-center rounded-full border px-2.5 font-mono text-xs"
              >
                {m}
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Si un admin cambia el pool por defecto, este {kind} usa el nuevo.
          </p>
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={locked}
              onClick={() => onChange([...defaults])}
            >
              Empezar con el pool por defecto
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={locked}
              onClick={() => onChange([])}
            >
              Quitar todos
            </Button>
          </div>
          <div
            role="group"
            aria-label="Mapas"
            className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2.5"
          >
            {poolChoices(maps, chosen).map((m) => {
              const on = chosen.includes(m.name)
              const full = !on && chosen.length >= MAX_POOL
              return (
                <button
                  key={m.name}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  disabled={locked || full || (!m.active && !on)}
                  onClick={() =>
                    onChange(
                      on
                        ? chosen.filter((x) => x !== m.name)
                        : [...chosen, m.name]
                    )
                  }
                  className={cn(
                    "flex flex-col overflow-hidden rounded-xl border-2 bg-background text-left disabled:cursor-not-allowed disabled:opacity-50",
                    on ? "border-primary" : "border-border"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "relative block aspect-video bg-muted",
                      !on && "opacity-70"
                    )}
                  >
                    {m.image_url && (
                      <img
                        src={m.image_url}
                        alt=""
                        className="size-full object-cover"
                      />
                    )}
                    <span
                      className={cn(
                        "absolute top-2 right-2 grid size-6 place-items-center rounded-full",
                        on
                          ? "bg-primary text-primary-foreground"
                          : "bg-black/35 text-transparent ring-2 ring-white/70 ring-inset"
                      )}
                    >
                      <CheckIcon className="size-3.5" strokeWidth={3} />
                    </span>
                  </span>
                  <span className="flex flex-col gap-0.5 px-2.5 pt-2 pb-2.5">
                    <span className="font-mono text-[13px] font-semibold">
                      {m.name}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        m.active
                          ? "text-muted-foreground"
                          : "text-amber-700 dark:text-amber-400"
                      )}
                    >
                      {!m.active
                        ? "Retirado: se conserva"
                        : m.veto_default
                          ? "En el pool por defecto"
                          : "Fuera del pool por defecto"}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            El veto los muestra en el orden del catálogo. Un mapa que un admin
            retire después se conserva en este pool.
          </p>
        </>
      )}
      {err && (
        <p role="alert" className="text-[13px] text-destructive">
          {err}
        </p>
      )}
    </section>
  )
}

function Choice({
  on,
  disabled,
  title,
  text,
  onClick,
}: {
  on: boolean
  disabled: boolean
  title: string
  text: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-16 flex-col items-start gap-1 rounded-xl border px-3.5 py-3 text-left disabled:cursor-not-allowed disabled:opacity-50",
        on ? "border-primary bg-primary/10" : "hover:bg-muted"
      )}
    >
      <span className="font-semibold">{title}</span>
      <span className="text-xs leading-snug text-muted-foreground">{text}</span>
    </button>
  )
}
