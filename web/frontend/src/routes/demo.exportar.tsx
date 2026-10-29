import { createFileRoute, notFound } from "@tanstack/react-router"
import { DownloadIcon, FileTextIcon, LockIcon, Share2Icon } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  drawCard,
  FORMATS,
  MAX_STATS,
  STATS,
  THEMES,
  toBlob,
  type CardFormat,
  type CardTheme,
  type StatKey,
} from "@/features/export/card"
import {
  DEMO_STATS,
  PERIOD_LABEL,
  type ExportPeriod,
} from "@/features/export/demo"
import { jpegToPdf } from "@/features/export/pdf"

// Ejemplo de "Exportá tus stats" para VIP sin API ni sesión (docs/bitacora/2026-10-29-exportar-stats en
// kyan/pruebas). Solo en `pnpm dev`: en el build de producción la ruta no existe.
export const Route = createFileRoute("/demo/exportar")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  component: DemoExportar,
})

const DEFAULT_KEYS: StatKey[] = [
  "kd",
  "rating",
  "hs",
  "adr",
  "winrate",
  "matches",
]

function Segmented<K extends string>({
  options,
  value,
  onChange,
  locked,
}: {
  options: Record<K, string>
  value: K
  onChange: (v: K) => void
  locked?: (k: K) => boolean
}) {
  return (
    <span className="inline-flex flex-wrap rounded-lg border p-0.5">
      {(Object.keys(options) as K[]).map((k) => (
        <Button
          key={k}
          size="sm"
          variant={value === k ? "secondary" : "ghost"}
          aria-pressed={value === k}
          onClick={() => onChange(k)}
        >
          {locked?.(k) && <LockIcon aria-hidden className="size-3" />}
          {options[k]}
        </Button>
      ))}
    </span>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold tracking-[0.4px] text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}

const record = <K extends string>(o: Record<K, { label: string }>) =>
  Object.fromEntries(
    Object.entries(o).map(([k, v]) => [k, (v as { label: string }).label])
  ) as Record<K, string>

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function DemoExportar() {
  const [vip, setVip] = useState(true)
  const [format, setFormat] = useState<CardFormat>("square")
  const [period, setPeriod] = useState<ExportPeriod>("season")
  const [theme, setTheme] = useState<CardTheme>("cm")
  const [keys, setKeys] = useState<StatKey[]>(DEFAULT_KEYS)
  const [showAvatar, setShowAvatar] = useState(true)
  // Solo del demo: `undefined` usa la foto de ejemplo, `null` simula un jugador sin foto.
  const [photo, setPhoto] = useState<string | null | undefined>(undefined)
  const canvas = useRef<HTMLCanvasElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const base = DEMO_STATS[period]
  const stats = useMemo(
    () => (photo === undefined ? base : { ...base, avatar_url: photo }),
    [base, photo]
  )
  const watermark = !vip
  useEffect(() => {
    if (canvas.current)
      void drawCard(canvas.current, {
        stats,
        period,
        format,
        theme,
        keys,
        watermark,
        showAvatar,
      })
  }, [stats, period, format, theme, keys, watermark, showAvatar])

  const pickPhoto = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith("image/")) return toast.error("Elegí una imagen.")
    setPhoto((old) => {
      if (old) URL.revokeObjectURL(old)
      return URL.createObjectURL(file)
    })
    setShowAvatar(true)
  }

  const pickTheme = (t: CardTheme) => {
    if (THEMES[t].vip && !vip)
      return toast.error("El tema dorado es solo para VIP.")
    setTheme(t)
  }
  const toggleKey = (k: StatKey, on: boolean) => {
    if (on && keys.length >= MAX_STATS)
      return toast.error(`Elegí hasta ${MAX_STATS} stats.`)
    // Se mantiene el orden de la lista para que la grilla no salte.
    setKeys((ks) =>
      (Object.keys(STATS) as StatKey[]).filter((s) =>
        s === k ? on : ks.includes(s)
      )
    )
  }
  const setVipDemo = (v: boolean) => {
    setVip(v)
    if (!v && THEMES[theme].vip) setTheme("cm")
  }

  const name = `cmleague-${stats.nick.toLowerCase()}-${period}-${format}`
  const png = () => toBlob(canvas.current!, "image/png")
  const needVip = () => {
    if (!vip) toast.error("Descargar tus stats es un beneficio VIP.")
    return !vip
  }
  const downloadPng = async () => {
    if (needVip()) return
    save(await png(), `${name}.png`)
  }
  const downloadPdf = async () => {
    if (needVip()) return
    const c = canvas.current!
    save(
      await jpegToPdf(await toBlob(c, "image/jpeg", 0.92), c.width, c.height),
      `${name}.pdf`
    )
  }
  const canShare = typeof navigator.canShare === "function"
  const share = async () => {
    if (needVip()) return
    const file = new File([await png()], `${name}.png`, { type: "image/png" })
    if (!navigator.canShare({ files: [file] }))
      return toast.error("Este navegador no comparte archivos.")
    await navigator
      .share({ files: [file], title: "Mis stats en CM League" })
      .catch(() => undefined)
  }

  const [w, h] = FORMATS[format].size
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3 text-sm">
        <span className="mr-2 font-mono text-xs font-semibold tracking-[1px] text-primary uppercase">
          Demo
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Switch
            id="demo-vip"
            size="sm"
            checked={vip}
            onCheckedChange={setVipDemo}
          />
          <Label htmlFor="demo-vip" className="text-xs">
            Ser VIP
          </Label>
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInput.current?.click()}
        >
          Probar con mi foto
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            pickPhoto(e.target.files?.[0])
            e.target.value = ""
          }}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setPhoto(null)
            setShowAvatar(true)
          }}
        >
          Jugador sin foto
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setFormat("square")
            setPeriod("season")
            setTheme("cm")
            setKeys(DEFAULT_KEYS)
            setShowAvatar(true)
            setPhoto(undefined)
          }}
        >
          Reiniciar
        </Button>
      </div>

      <section className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold">
          Exportá tus stats
        </h1>
        <p className="text-sm text-muted-foreground">
          Armá una imagen con tus números para subir a Instagram, Twitter o
          donde quieras.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="flex flex-col gap-5 rounded-xl border p-4">
          <Field label="Formato">
            <Segmented
              options={record(FORMATS)}
              value={format}
              onChange={setFormat}
            />
            <span className="text-xs text-muted-foreground">
              {w} × {h} px
              {format === "square" &&
                " · sin gráfico, para que entren las stats"}
            </span>
          </Field>
          <Field label="Período">
            <Segmented
              options={PERIOD_LABEL}
              value={period}
              onChange={setPeriod}
            />
          </Field>
          <Field label="Foto de perfil">
            <span className="flex items-center gap-2">
              <Switch
                id="show-avatar"
                size="sm"
                checked={showAvatar}
                onCheckedChange={setShowAvatar}
              />
              <Label htmlFor="show-avatar" className="text-sm font-normal">
                Mostrar mi foto al lado del nombre
              </Label>
            </span>
            {showAvatar && !stats.avatar_url && (
              <span className="text-xs text-muted-foreground">
                No tenés foto de perfil: va la inicial de tu nick.
              </span>
            )}
          </Field>
          <Field label="Estilo">
            <Segmented
              options={record(THEMES)}
              value={theme}
              onChange={pickTheme}
              locked={(t) => !!THEMES[t].vip && !vip}
            />
          </Field>
          <Field label={`Stats (${keys.length}/${MAX_STATS})`}>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(STATS) as StatKey[]).map((k) => (
                <Label
                  key={k}
                  className="flex items-center gap-2 text-sm font-normal"
                >
                  <Checkbox
                    checked={keys.includes(k)}
                    onCheckedChange={(v) => toggleKey(k, v === true)}
                  />
                  {STATS[k].label}
                </Label>
              ))}
            </div>
          </Field>
          <div className="flex flex-col gap-2 border-t pt-4">
            <Button onClick={downloadPng}>
              {vip ? <DownloadIcon aria-hidden /> : <LockIcon aria-hidden />}
              Descargar imagen (PNG)
            </Button>
            <Button variant="outline" onClick={downloadPdf}>
              {vip ? <FileTextIcon aria-hidden /> : <LockIcon aria-hidden />}
              Descargar PDF
            </Button>
            {canShare && (
              <Button variant="ghost" onClick={share}>
                <Share2Icon aria-hidden />
                Compartir
              </Button>
            )}
            {!vip && (
              <p className="text-xs text-muted-foreground">
                Sin VIP ves la vista previa con marca de agua. Con VIP descargás
                sin marca y tenés el estilo dorado.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-start justify-center rounded-xl border bg-muted/30 p-4">
          <canvas
            ref={canvas}
            aria-label="Vista previa de la tarjeta de stats"
            className="h-auto max-h-[78vh] w-auto max-w-full rounded-lg shadow-lg"
          />
        </div>
      </div>
    </div>
  )
}
