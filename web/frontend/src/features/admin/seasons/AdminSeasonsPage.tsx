import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { useEffect, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { currentSeasonOptions } from "@/features/ranking/queries"
import { ConfirmDialog } from "../dialogs"
import { CONFIRM_TEXT, fmtDate } from "../format"
import { AdminHeader, AdminTabs, QueryError, SaveBar } from "../ui"
import { HistoryTab } from "./HistoryTab"
import { PreviewTab } from "./PreviewTab"
import {
  seasonConfigOptions,
  seasonCountsOptions,
  seasonPreviewOptions,
  useCloseSeason,
  useOpenSeason,
  usePatchSeason,
  useSaveSeasonConfig,
  type Season,
} from "./queries"
import { SeasonFormView } from "./SeasonFormView"
import {
  formError,
  fromConfig,
  fromSeason,
  resetRule,
  seasonPatch,
  toConfig,
  type SeasonForm,
} from "./seasons"

export const SEASON_TABS = ["active", "preview", "next", "history"] as const
export type SeasonTab = (typeof SEASON_TABS)[number]

export function AdminSeasonsPage({
  tab,
  onTab,
}: {
  tab: SeasonTab
  onTab: (t: SeasonTab) => void
}) {
  const current = useQuery(currentSeasonOptions)
  const config = useQuery(seasonConfigOptions)

  if (current.isError)
    return (
      <QueryError
        error={current.error}
        onRetry={() => void current.refetch()}
      />
    )
  if (config.isError)
    return (
      <QueryError error={config.error} onRetry={() => void config.refetch()} />
    )

  return (
    <section className="flex flex-col gap-5">
      <AdminHeader
        title="Temporadas"
        subtitle="Cada temporada termina con una foto del ranking, medallas para el top y un reinicio del ELO más alto. Al cerrarse se abre la siguiente sola."
      />
      {current.isPending || config.isPending ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <SeasonsBody
          key={current.data?.id ?? "none"}
          season={current.data}
          config={fromConfig(config.data)}
          tab={current.data ? tab : "next"}
          onTab={onTab}
        />
      )}
    </section>
  )
}

function SeasonsBody({
  season,
  config,
  tab,
  onTab,
}: {
  season: Season | null
  config: SeasonForm
  tab: SeasonTab
  onTab: (t: SeasonTab) => void
}) {
  // Los dos borradores viven acá: la vista previa usa el de la temporada activa.
  const [active, setActive] = useState<SeasonForm | null>(null)
  const [next, setNext] = useState<SeasonForm | null>(null)
  const activeForm = active ?? (season ? fromSeason(season) : null)
  const nextForm = next ?? config
  const patch = useSeasonPatch(season)
  const saveConfig = useSaveSeasonConfig()

  const activeDirty =
    !!season && !!active && Object.keys(seasonPatch(season, active)).length > 0
  const nextDirty =
    !!next &&
    JSON.stringify(toConfig(next)) !== JSON.stringify(toConfig(config))
  const editing = tab === "next" ? "next" : tab === "active" ? "active" : null
  const dirty =
    editing === "next" ? nextDirty : editing === "active" && activeDirty
  const err =
    editing === "next"
      ? formError(nextForm, "next")
      : activeForm && formError(activeForm, "active")
  const mutation = editing === "next" ? saveConfig : patch

  return (
    <div className={cn("flex flex-col gap-5", dirty && "pb-24")}>
      {season && activeForm ? <ActiveHero season={season} /> : <NoSeason />}
      <AdminTabs
        label="Secciones de Temporadas"
        value={tab}
        onChange={onTab}
        tabs={
          season
            ? [
                { key: "active", label: "Temporada activa" },
                { key: "preview", label: "Vista previa del cierre" },
                { key: "next", label: "Próxima temporada" },
                { key: "history", label: "Historial" },
              ]
            : [{ key: "next", label: "Próxima temporada" }]
        }
      />

      {tab === "active" && season && activeForm && (
        <>
          <p className="max-w-[820px] text-[13px] leading-relaxed text-muted-foreground">
            Las reglas de la temporada en curso. Cambiarlas no toca las
            temporadas cerradas.
          </p>
          <SeasonFormView
            mode="active"
            value={activeForm}
            onChange={setActive}
            seasonNumber={season.number}
            resetNotice={`Se aplica al terminar la temporada ${season.number} (esta).`}
          />
        </>
      )}
      {tab === "preview" && season && activeForm && (
        <PreviewTab form={activeForm} />
      )}
      {tab === "next" && (
        <>
          <p className="max-w-[820px] text-[13px] leading-relaxed text-muted-foreground">
            Valores con los que se abre la próxima temporada.{" "}
            {season
              ? "No cambian la activa."
              : 'También los de la temporada 1, al tocar "Abrir la temporada 1".'}
          </p>
          <SeasonFormView
            mode="next"
            value={nextForm}
            onChange={setNext}
            seasonNumber={(season?.number ?? 0) + 1}
            resetNotice={
              season ? (
                <>
                  Se aplica al terminar la temporada {season.number + 1}, no la
                  actual. Para el cierre de la temporada {season.number}, cambia
                  el reinicio en <strong>Temporada activa</strong>.
                </>
              ) : (
                "Se aplica al terminar la temporada 1."
              )
            }
          />
        </>
      )}
      {tab === "history" && <HistoryTab />}

      {dirty && (
        <SaveBar
          title="Cambios sin guardar"
          hint={
            err ??
            (mutation.isError
              ? errorMessage(mutation.error)
              : editing === "next"
                ? "Se usan al abrir la próxima temporada."
                : "Cambian la temporada activa. Las cerradas no cambian.")
          }
          error={!!err || mutation.isError}
          pending={mutation.isPending}
          disabled={!!err}
          onDiscard={() => {
            if (editing === "next") setNext(null)
            else setActive(null)
            mutation.reset()
          }}
          onSave={() => {
            const done = () => toast.success("Guardado.")
            if (editing === "next")
              saveConfig.mutate(toConfig(nextForm), {
                onSuccess: () => {
                  setNext(null)
                  done()
                },
              })
            else if (season && active)
              patch.mutate(seasonPatch(season, active), {
                onSuccess: () => {
                  setActive(null)
                  done()
                },
              })
          }}
        />
      )}
    </div>
  )
}

/** El PATCH necesita el id; sin temporada activa no se usa. */
function useSeasonPatch(season: Season | null) {
  return usePatchSeason(season?.id ?? "")
}

function ActiveHero({ season }: { season: Season }) {
  const counts = useQuery(seasonCountsOptions(season.id))
  const [closing, setClosing] = useState(false)
  const close = useCloseSeason(season.id)
  const preview = useQuery({
    ...seasonPreviewOptions(
      {
        top_n: season.top_n,
        min_matches: season.min_matches,
        reset_pct: season.reset_pct,
        reset_floor: season.reset_floor,
        reset_all: season.reset_all,
      },
      undefined,
      "",
      1
    ),
    enabled: closing,
  })
  const start = new Date(season.starts_at).getTime()
  const end = new Date(season.ends_at).getTime()
  const now = useNow()
  const pct = Math.round(
    Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
  )
  const ms = Math.max(0, end - now)
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  const s = preview.data?.summary

  return (
    <section
      aria-label="Temporada activa"
      className="flex flex-wrap items-center gap-5 rounded-xl border bg-card p-5"
    >
      <div className="flex min-w-[300px] flex-1 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-xl font-bold">
            Temporada {season.number} · {season.name}
          </h2>
          <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-win/15 px-2 text-xs font-medium">
            <span aria-hidden className="size-1.5 rounded-full bg-win" />
            Activa
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Avance de la temporada"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[13px] text-muted-foreground">
          Empezó el {fmtDate(season.starts_at)} · termina el{" "}
          {fmtDate(season.ends_at)} a las 06:00 (Argentina)
        </span>
      </div>
      <div className="flex flex-wrap gap-6">
        <Fact label="Faltan">{days > 0 ? `${days} días` : `${hours} h`}</Fact>
        <Fact label="En el ranking">
          {counts.data ? (
            <>
              {counts.data.ranked}{" "}
              <span className="text-[13px] text-muted-foreground">
                de {counts.data.players}
              </span>
            </>
          ) : (
            "—"
          )}
        </Fact>
      </div>
      <Button
        variant="outline"
        size="md"
        className="border-destructive/50 font-semibold text-destructive hover:text-destructive"
        onClick={() => setClosing(true)}
      >
        Terminar temporada
      </Button>

      <ConfirmDialog
        open={closing}
        onOpenChange={setClosing}
        title={`¿Terminar la temporada ${season.number} ahora?`}
        description="No se puede deshacer."
        confirmLabel="Terminar temporada"
        danger
        typed
        pending={close.isPending}
        error={close.error}
        onConfirm={() =>
          close.mutate(CONFIRM_TEXT, {
            onSuccess: (r) => {
              setClosing(false)
              toast.success(
                `Temporada ${season.number} terminada: ${r.medals} medallas y ${r.reset} reinicios. Empezó la temporada ${season.number + 1}.`
              )
            },
          })
        }
      >
        {s ? (
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>
              Se guarda la foto del ranking final de {s.players} jugadores.
            </li>
            <li>
              {s.medals} reciben medalla (top {season.top_n}).
            </li>
            <li>
              <strong className="text-foreground">
                {resetRule(
                  season.reset_pct,
                  season.reset_floor,
                  season.reset_all
                )}
              </strong>{" "}
              Cambia el ELO de {s.reset}{" "}
              {s.reset === 1 ? "jugador" : "jugadores"}. Si no es lo que
              quieres, cancela y cambia el reinicio en "Temporada activa".
            </li>
            <li>
              Se abre la temporada {season.number + 1} con los valores de
              "Próxima temporada".
            </li>
          </ul>
        ) : (
          <Skeleton className="h-24 rounded-lg" />
        )}
      </ConfirmDialog>
    </section>
  )
}

function NoSeason() {
  const open = useOpenSeason()
  return (
    <section className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-7">
      <h2 className="text-lg font-bold">Todavía no hay temporadas</h2>
      <p className="max-w-[620px] leading-relaxed text-muted-foreground">
        Lo jugado hasta ahora es la pretemporada: cuenta para el ELO, pero no da
        medallas. Al abrir la temporada 1 empieza a contar el ranking de la
        temporada, con los valores de "Próxima temporada".
      </p>
      {open.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(open.error)}
        </p>
      )}
      <Button
        size="md"
        disabled={open.isPending}
        onClick={() =>
          open.mutate(undefined, {
            onSuccess: () => toast.success("Temporada 1 abierta."),
          })
        }
      >
        Abrir la temporada 1
      </Button>
    </section>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-[22px] font-semibold">{children}</span>
    </div>
  )
}

/** La hora, actualizada cada 30 s (como la cuenta regresiva del Ranking). */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}
