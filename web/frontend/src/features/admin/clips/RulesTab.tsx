import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { useId, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { fmtDate } from "../format"
import { Card, Chip, QueryError, SaveBar } from "../ui"
import {
  CAPS,
  CLIP_TYPES,
  FACTORY_PRIORITIES,
  SAMPLE_PLAYS,
  clipConfigError,
  clipLabel,
  clipPatch,
  pickClips,
} from "./clips"
import {
  clipConfigOptions,
  useSaveClipConfig,
  type ClipConfig,
} from "./queries"

const num = (v: string) => (v === "" ? -1 : Number(v))

export function RulesTab() {
  const id = useId()
  const q = useQuery(clipConfigOptions)
  const save = useSaveClipConfig()
  const [draft, setDraft] = useState<ClipConfig | null>(null)
  if (q.isError)
    return <QueryError error={q.error} onRetry={() => void q.refetch()} />
  if (q.isPending) return <Skeleton className="h-96 rounded-xl" />

  const saved = q.data.config
  const c = draft ?? saved
  const patch = clipPatch(saved, c)
  const dirty = Object.keys(patch).length > 0
  const err = clipConfigError(c)
  const sample = pickClips(SAMPLE_PLAYS, err ? saved : c)
  const edit = (next: ClipConfig) => setDraft(next)

  return (
    <div className={cn("flex flex-wrap items-start gap-5", dirty && "pb-24")}>
      <Card className="min-w-0 flex-[999_1_520px] gap-3.5">
        <div className="flex flex-col gap-1">
          <h2 className="text-[17px] font-bold">Qué jugada vale más</h2>
          <span className="text-[13px] leading-relaxed text-muted-foreground">
            1 es lo más valioso. Dos tipos pueden valer lo mismo: ahí gana la
            jugada de una ronda ganada y después la más tardía.
          </span>
        </div>
        <ol className="flex flex-col gap-1.5">
          {CLIP_TYPES.map((t) => {
            const v = c.priorities[t.type]
            const before = saved.priorities[t.type]
            return (
              <li
                key={t.type}
                className="flex flex-wrap items-center gap-3 rounded-lg border px-2.5 py-2"
              >
                <Chip
                  tone={v <= 2 ? "primary" : "neutral"}
                  className="min-w-11 justify-center font-mono font-bold"
                >
                  {t.label}
                </Chip>
                <span className="flex-1 text-[13px] text-muted-foreground">
                  {t.desc}
                </span>
                {v !== before && (
                  <span className="text-xs text-amber-700 dark:text-amber-400">
                    antes {before}
                  </span>
                )}
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Prioridad
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    aria-label={`Prioridad de ${t.label}`}
                    value={v < 0 ? "" : v}
                    onChange={(e) =>
                      edit({
                        ...c,
                        priorities: {
                          ...c.priorities,
                          [t.type]: num(e.target.value),
                        },
                      })
                    }
                    className="w-16 text-center font-mono"
                  />
                </label>
              </li>
            )
          })}
        </ol>
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => edit({ ...c, priorities: { ...FACTORY_PRIORITIES } })}
        >
          Volver a la escala de fábrica
        </Button>
      </Card>

      <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-4">
        <Card className="gap-3.5">
          <h2 className="text-[17px] font-bold">Cuántos se muestran</h2>
          {CAPS.map((k) => (
            <div key={k.key} className="flex items-center gap-3">
              <span className="flex flex-1 flex-col gap-0.5">
                <label htmlFor={`${id}-${k.key}`} className="font-medium">
                  {k.label}
                </label>
                <span className="text-xs leading-snug text-muted-foreground">
                  {k.help}
                </span>
              </span>
              <Input
                id={`${id}-${k.key}`}
                type="number"
                min={k.min}
                max={k.max}
                value={c[k.key] < 0 ? "" : c[k.key]}
                onChange={(e) => edit({ ...c, [k.key]: num(e.target.value) })}
                className="w-[72px] text-center font-mono"
              />
            </div>
          ))}
        </Card>

        <Card>
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[15px] font-bold">Así quedaría un mix</h2>
            <span className="text-xs text-muted-foreground">
              Un ejemplo con jugadas inventadas y estas reglas.
            </span>
          </div>
          <ol className="flex flex-col gap-1">
            {sample.top.map((p, i) => (
              <SampleRow
                key={`${p.player}-${p.round}`}
                pos={String(i + 1)}
                type={clipLabel(p.type)}
                player={p.player}
                note={`ronda ${p.round}${p.roundWon ? "" : " · perdida"}`}
              />
            ))}
            {sample.vip.map((p) => (
              <SampleRow
                key={`vip-${p.player}-${p.round}`}
                pos="+"
                type={clipLabel(p.type)}
                player={p.player}
                note="por ser VIP"
                vip
              />
            ))}
          </ol>
        </Card>

        <section className="flex flex-col gap-2.5 rounded-xl border border-dashed p-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-bold">Video</h2>
            <Chip>Próximamente</Chip>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Cortar el clip si pasan más de {c.split_gap_seconds} s entre dos
            kills, con {c.pre_seconds} s antes y {c.post_seconds} s después. Se
            van a poder cambiar cuando el corte del video use estos valores.
          </p>
        </section>

        {q.data.updated_at && (
          <p className="text-xs text-muted-foreground">
            Última vez cambiado el {fmtDate(q.data.updated_at)}
            {q.data.updated_by?.alias && ` por ${q.data.updated_by.alias}`}.
          </p>
        )}
      </div>

      {dirty && (
        <SaveBar
          title="Cambios sin guardar"
          hint={
            err ??
            (save.isError
              ? errorMessage(save.error)
              : "Valen al instante para todas las partidas, también las viejas: cambia qué clips se muestran y en qué orden.")
          }
          error={!!err || save.isError}
          pending={save.isPending}
          disabled={!!err}
          onDiscard={() => {
            setDraft(null)
            save.reset()
          }}
          onSave={() =>
            save.mutate(patch, {
              onSuccess: () => {
                setDraft(null)
                toast.success("Reglas de los clips guardadas.")
              },
            })
          }
        />
      )}
    </div>
  )
}

function SampleRow({
  pos,
  type,
  player,
  note,
  vip,
}: {
  pos: string
  type: string
  player: string
  note: string
  vip?: boolean
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-2.5 px-1 py-1.5 text-[13px]",
        vip && "border-t border-dashed"
      )}
    >
      <span className="w-5 font-mono text-muted-foreground">{pos}</span>
      <Chip className="min-w-11 justify-center font-mono font-bold">
        {type}
      </Chip>
      <span className="flex-1">{player}</span>
      <span className="text-xs text-muted-foreground">{note}</span>
    </li>
  )
}
