import { useEffect, useState } from "react"

import { medalSrc, type MedalDef } from "@/lib/medals"
import { withSeasonLabel } from "@/lib/medalSeasonLabel"

// Cache por archivo y temporada: cada SVG se baja una vez y cada combinación se arma una vez.
const texts = new Map<string, Promise<string>>()
const urls = new Map<string, Promise<string>>()

function seasonedUrl(src: string, label: string) {
  const key = `${src}|${label}`
  let url = urls.get(key)
  if (!url) {
    let text = texts.get(src)
    if (!text) {
      text = fetch(src).then((r) => r.text())
      texts.set(src, text)
    }
    url = text.then((t) =>
      URL.createObjectURL(
        new Blob([withSeasonLabel(t, label)], { type: "image/svg+xml" })
      )
    )
    urls.set(key, url)
  }
  return url
}

/**
 * Imagen de una medalla. Si es de temporada y se pasa `season`, la etiqueta de arriba muestra esa
 * temporada en lugar del "S1" del archivo.
 */
export function MedalImage({
  medal,
  season,
  locked = false,
  className,
}: {
  medal: MedalDef
  season?: string
  locked?: boolean
  className?: string
}) {
  const src = medalSrc(medal, locked)
  const custom = medal.temporada && season ? season : null
  const [url, setUrl] = useState<{ key: string; url: string } | null>(null)
  const key = `${src}|${custom}`

  useEffect(() => {
    if (!custom) return
    let alive = true
    void seasonedUrl(src, custom).then((u) => alive && setUrl({ key, url: u }))
    return () => {
      alive = false
    }
  }, [src, custom, key])

  // Mientras arma la versión con la temporada, muestra la original.
  const shown = custom && url?.key === key ? url.url : src
  return <img src={shown} alt="" className={className} loading="lazy" />
}
