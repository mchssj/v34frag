import { CopyIcon, DownloadIcon, LockIcon } from "lucide-react"
import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { THEMES, toBlob, type CardTheme } from "@/features/export/card"
import { vipToast } from "@/features/vip/upsell"

import { BIO_FORMATS, drawBio, type BioData, type BioFormat } from "./draw"

// Generador del widget para la bio (docs/bitacora/2026-10-29-widget-bio en kyan/pruebas).

const ORIGIN = "https://cmleague.lat"

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Lo que el jugador copia para cada formato. En la versión real, la imagen la sirve el backend. */
export function snippetsFor(format: BioFormat, nick: string, theme: CardTheme) {
  const slug = encodeURIComponent(nick.toLowerCase())
  const profile = `${ORIGIN}/${slug}`
  const png = `${ORIGIN}/api/v1/players/${slug}/card.png?f=${format}&tema=${theme}`
  if (format === "twitch")
    return [
      { label: "Link del panel", value: profile },
      { label: "Imagen que se actualiza sola", value: png },
    ]
  if (format === "og")
    return [{ label: "Pegá esto en tu bio o en un tweet", value: profile }]
  return [
    {
      label: "Código para webs",
      value: `<iframe src="${ORIGIN}/embed/${slug}?tema=${theme}" width="400" height="120" style="border:0" title="${nick} en CM League"></iframe>`,
    },
    {
      label: "Sin iframe (imagen con link)",
      value: `<a href="${profile}"><img src="${png}" width="400" height="120" alt="${nick} en CM League"></a>`,
    },
  ]
}

function Preview({
  format,
  data,
  theme,
  vip,
}: {
  format: BioFormat
  data: BioData
  theme: CardTheme
  vip: boolean
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const f = BIO_FORMATS[format]
  useEffect(() => {
    if (canvas.current)
      void drawBio(canvas.current, { data, format, theme, watermark: !vip })
  }, [data, format, theme, vip])

  const copy = (v: string) => {
    if (!vip) return vipToast("El widget para la bio es un beneficio VIP.")
    navigator.clipboard.writeText(v).then(
      () => toast.success("Copiado."),
      () => toast.error("Copialo con Ctrl+C.")
    )
  }
  const download = async () => {
    if (!vip) return vipToast("El widget para la bio es un beneficio VIP.")
    save(
      await toBlob(canvas.current!, "image/png"),
      `cmleague-${data.nick.toLowerCase()}-${format}.png`
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <div>
        <h2 className="font-heading text-base font-semibold">{f.label}</h2>
        <p className="text-xs text-muted-foreground">
          {f.size[0]} × {f.size[1]} · {f.hint}
        </p>
      </div>
      <div className="flex justify-center rounded-lg bg-muted/40 p-4">
        <canvas
          ref={canvas}
          aria-label={`Vista previa: ${f.label}`}
          className="h-auto max-w-full rounded-md shadow-md"
          style={{ width: format === "og" ? 600 : f.size[0] }}
        />
      </div>
      {format === "og" && (
        <p className="text-xs text-muted-foreground">
          Al pegar el link, Twitter, Discord y WhatsApp arman la vista previa
          con esta imagen. Se actualiza sola cuando cambian tus stats.
        </p>
      )}
      {snippetsFor(format, data.nick, theme).map((s) => (
        <div key={s.label} className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{s.label}</span>
          <div className="flex gap-2">
            <Input
              readOnly
              value={vip ? s.value : "Solo VIP"}
              aria-label={s.label}
              className="font-mono text-xs"
              onFocus={(e) => e.target.select()}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-9"
              onClick={() => copy(s.value)}
              aria-label={`Copiar ${s.label}`}
            >
              {vip ? <CopyIcon aria-hidden /> : <LockIcon aria-hidden />}
            </Button>
          </div>
        </div>
      ))}
      {format !== "og" && (
        <Button size="sm" onClick={download} className="self-start">
          {vip ? <DownloadIcon aria-hidden /> : <LockIcon aria-hidden />}
          Descargar PNG
        </Button>
      )}
    </section>
  )
}

export function BioWidget({
  data,
  theme,
  vip,
}: {
  data: BioData
  theme: CardTheme
  vip: boolean
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Preview format="twitch" data={data} theme={theme} vip={vip} />
      <Preview format="firma" data={data} theme={theme} vip={vip} />
      <div className="lg:col-span-2">
        <Preview format="og" data={data} theme={theme} vip={vip} />
      </div>
    </div>
  )
}

export { THEMES }
