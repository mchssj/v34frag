import { useEffect } from "react"

// Título, descripción y canónica de cada página (bitácora 2026-11-03-seo-web). Se escriben en el
// <head> que ya trae index.html (el que leen los bots sin JavaScript, como Discord) y al salir de la
// página vuelven los de index.html.

export const SITE_NAME = "CM League"
export const SITE_URL = "https://cmleague.lat"

function metaTag(attr: "name" | "property", key: string) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`
  )
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute(attr, key)
    document.head.append(el)
  }
  return el
}

const DEFAULTS =
  typeof document === "undefined"
    ? { title: SITE_NAME, description: "" }
    : {
        title: document.title,
        description: metaTag("name", "description").content,
      }

/** Pone el valor y devuelve cómo dejarlo como estaba. */
function setMeta(attr: "name" | "property", key: string, value: string) {
  const el = metaTag(attr, key)
  const prev = el.content
  el.content = value
  return () => {
    el.content = prev
  }
}

export type PageMeta = {
  /** Sin el nombre del sitio: se agrega solo ("Ranking" → "Ranking · CM League"). */
  title?: string
  description?: string
  /** Páginas que no tienen que aparecer en buscadores (login, registro). */
  noindex?: boolean
}

export function usePageMeta({ title, description, noindex }: PageMeta) {
  useEffect(() => {
    const full = title ? `${title} · ${SITE_NAME}` : DEFAULTS.title
    const desc = description ?? DEFAULTS.description
    const prevTitle = document.title
    document.title = full
    const undo = [
      setMeta("name", "description", desc),
      setMeta("property", "og:title", full),
      setMeta("property", "og:description", desc),
      setMeta("name", "twitter:title", full),
      setMeta("name", "twitter:description", desc),
    ]
    if (noindex) undo.push(setMeta("name", "robots", "noindex"))
    return () => {
      document.title = prevTitle
      undo.forEach((u) => u())
    }
  }, [title, description, noindex])
}

/** Canónica y og:url de la ruta actual, sin parámetros (?tab=, ?page=… son la misma página). */
export function useCanonical(pathname: string) {
  useEffect(() => {
    let link = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    )
    if (!link) {
      link = document.createElement("link")
      link.rel = "canonical"
      document.head.append(link)
    }
    const url =
      SITE_URL + (pathname === "/" ? "/" : pathname.replace(/\/+$/, ""))
    link.href = url
    metaTag("property", "og:url").content = url
  }, [pathname])
}
