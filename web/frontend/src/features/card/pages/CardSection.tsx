import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  DownloadIcon,
  FileTextIcon,
  ImageIcon,
  LockIcon,
  Share2Icon,
} from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { isApiError } from "@/api/errors"
import { EmptyState } from "@/components/brand/EmptyState"
import { QueryErrorMessage } from "@/components/brand/QueryState"
import { Segmented } from "@/components/brand/Segmented"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useVip } from "@/features/vip/useVip"
import { VipDialog } from "@/features/vip/VipDialog"
import { VipLock } from "@/features/vip/VipLock"
import { cardOptions } from "../api/queries"
import {
  drawCard,
  FORMATS,
  MAX_STATS,
  PERIODS,
  periodLabel,
  STATS,
  THEMES,
  toBlob,
  type CardFormat,
  type CardTheme,
  type StatKey,
} from "../lib/draw"
import { jpegToPdf } from "../lib/pdf"
import type { CardPeriod, CardStats } from "../types"

// Mi perfil › Tarjeta (bitácora 2026-11-24-exportar-stats-y-buscador-vip): la vista previa es para todos, con marca de agua;
// descargar, compartir y el estilo dorado, con VIP.

const DEFAULT_KEYS: StatKey[] = [
  "kd",
  "rating",
  "hs",
  "adr",
  "winrate",
  "matches",
]
const FORMAT_KEYS = Object.keys(FORMATS) as CardFormat[]
const THEME_KEYS = Object.keys(THEMES) as CardTheme[]
const STAT_KEYS = Object.keys(STATS) as StatKey[]

export function CardSection() {
  const [period, setPeriod] = useState<CardPeriod>("season")
  const q = useQuery(cardOptions(period))
  const { vip, ready } = useVip()

  if (q.isPending || !ready)
    return <Skeleton className="h-[560px] rounded-xl" />
  if (q.isError)
    return isApiError(q.error, "PLAYER_NOT_LINKED") ? (
      <EmptyState
        icon={ImageIcon}
        title="Vincula tu SteamID para tener tu tarjeta"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/profile/link">Ir a Vinculación</Link>
          </Button>
        }
      >
        La tarjeta se arma con tus mixes del servidor.
      </EmptyState>
    ) : (
      <div className="rounded-xl border px-4 py-10 text-center">
        <QueryErrorMessage error={q.error} onRetry={q.refetch} />
      </div>
    )
  return (
    <CardEditor
      stats={q.data}
      period={period}
      onPeriod={setPeriod}
      loading={q.isPlaceholderData}
      vip={vip}
    />
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function CardEditor({
  stats,
  period,
  onPeriod,
  loading,
  vip,
}: {
  stats: CardStats
  period: CardPeriod
  onPeriod: (p: CardPeriod) => void
  /** Se ve el período anterior mientras llega el nuevo: no se descarga. */
  loading: boolean
  vip: boolean
}) {
  const [format, setFormat] = useState<CardFormat>("square")
  const [theme, setTheme] = useState<CardTheme>("cm")
  const [keys, setKeys] = useState<StatKey[]>(DEFAULT_KEYS)
  const [showAvatar, setShowAvatar] = useState(true)
  const [dialog, setDialog] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  // Si el VIP vence con la página abierta, el dorado vuelve al normal.
  const look = THEMES[theme].vip && !vip ? "cm" : theme

  useEffect(() => {
    if (!canvas.current || loading) return
    let stale = false
    void drawCard(
      canvas.current,
      { stats, period, format, theme: look, keys, watermark: !vip, showAvatar },
      () => stale
    )
    return () => {
      stale = true
    }
  }, [stats, period, format, look, keys, vip, showAvatar, loading])

  const toggleKey = (k: StatKey, on: boolean) =>
    // Se mantiene el orden de la lista para que la grilla no salte.
    setKeys((ks) => STAT_KEYS.filter((s) => (s === k ? on : ks.includes(s))))

  const name = `cmleague-${stats.nick.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${period}-${format}`
  /** Sin VIP no se descarga: se abre "Cómo ser VIP". */
  const run = (action: () => Promise<void>) => {
    if (!vip) return setDialog(true)
    action().catch(() => toast.error("No se pudo generar la imagen."))
  }
  const png = () => toBlob(canvas.current!, "image/png")
  const downloadPng = async () => save(await png(), `${name}.png`)
  const downloadPdf = async () => {
    const c = canvas.current!
    save(
      await jpegToPdf(await toBlob(c, "image/jpeg", 0.92), c.width, c.height),
      `${name}.pdf`
    )
  }
  const share = async () => {
    const file = new File([await png()], `${name}.png`, { type: "image/png" })
    if (!navigator.canShare({ files: [file] })) {
      toast.error("Este navegador no comparte archivos.")
      return
    }
    // Cerrar el menú de compartir no es un error.
    await navigator
      .share({ files: [file], title: "Mis stats en CM League" })
      .catch(() => undefined)
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Tu tarjeta de stats</h2>
        <p className="text-[13px] text-muted-foreground">
          Arma una imagen con tus números de los mixes para subir a tus redes.
        </p>
      </div>
      {!vip && (
        <VipLock>
          La vista previa lleva marca de agua. Con VIP descargas la imagen o el
          PDF sin marca y tienes el estilo dorado.
        </VipLock>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex justify-center rounded-xl border bg-muted/30 p-3">
          <canvas
            ref={canvas}
            role="img"
            aria-label={`Tarjeta de stats de ${stats.nick}`}
            className="h-auto max-h-[70vh] w-auto max-w-full rounded-lg shadow-lg"
          />
        </div>
        <Card variant="outline" className="flex flex-col gap-4 p-4">
          <Field label="Formato">
            <Segmented
              size="sm"
              label="Formato"
              value={format}
              options={FORMAT_KEYS.map((k) => ({
                value: k,
                label: FORMATS[k].label,
              }))}
              onChange={setFormat}
            />
          </Field>
          <Field label="Período">
            <Segmented
              size="sm"
              label="Período"
              value={period}
              options={PERIODS.filter(
                (p) => p !== "season" || stats.season !== null || p === period
              ).map((p) => ({
                value: p,
                label: p === "30d" ? "30 días" : periodLabel(p, stats.season),
              }))}
              onChange={onPeriod}
            />
          </Field>
          <Field label="Estilo">
            <Segmented
              size="sm"
              label="Estilo"
              value={look}
              options={THEME_KEYS.map((k) => ({
                value: k,
                label: THEMES[k].label,
              }))}
              onChange={(t) =>
                THEMES[t].vip && !vip ? setDialog(true) : setTheme(t)
              }
            />
          </Field>
          <Field label="Foto de perfil">
            <span className="flex items-center gap-2">
              <Switch
                id="card-avatar"
                size="sm"
                checked={showAvatar}
                onCheckedChange={setShowAvatar}
              />
              <Label htmlFor="card-avatar" className="text-[13px] font-normal">
                Mostrar mi foto
              </Label>
            </span>
            {showAvatar && !stats.photo_url && (
              <span className="text-xs text-muted-foreground">
                No tienes foto: va la inicial de tu nick.
              </span>
            )}
          </Field>
          <Field label={`Stats (${keys.length}/${MAX_STATS})`}>
            <div className="grid grid-cols-2 gap-2">
              {STAT_KEYS.map((k) => (
                <Label
                  key={k}
                  className="flex items-center gap-2 text-[13px] font-normal"
                >
                  <Checkbox
                    checked={keys.includes(k)}
                    // Al llegar al tope solo se pueden sacar.
                    disabled={!keys.includes(k) && keys.length >= MAX_STATS}
                    onCheckedChange={(v) => toggleKey(k, v === true)}
                  />
                  {STATS[k].label}
                </Label>
              ))}
            </div>
          </Field>
          <div className="flex flex-col gap-2 border-t pt-4">
            <Button onClick={() => run(downloadPng)} disabled={loading}>
              {vip ? <DownloadIcon aria-hidden /> : <LockIcon aria-hidden />}
              Descargar imagen
            </Button>
            <Button
              variant="outline"
              onClick={() => run(downloadPdf)}
              disabled={loading}
            >
              {vip ? <FileTextIcon aria-hidden /> : <LockIcon aria-hidden />}
              Descargar PDF
            </Button>
            {typeof navigator.canShare === "function" && (
              <Button
                variant="ghost"
                onClick={() => run(share)}
                disabled={loading}
              >
                {vip ? <Share2Icon aria-hidden /> : <LockIcon aria-hidden />}
                Compartir
              </Button>
            )}
          </div>
        </Card>
      </div>
      <VipDialog open={dialog} onOpenChange={setDialog} />
    </>
  )
}
