// Links y capturas dentro del texto del manual (formato en docs/manual/README.md).

/** `internal`: una ruta de la web; `external`: http(s) o mailto; `other`: lo demás (no se enlaza). */
export function linkKind(href: string): "internal" | "external" | "other" {
  if (/^\/(?!\/)/.test(href)) return "internal"
  if (/^(https?:|mailto:)/i.test(href)) return "external"
  return "other"
}

/** El archivo de una captura (`img/<archivo>`), o null si no tiene esa forma. */
export function imageFile(src: string): string | null {
  return /^img\/([a-z0-9][a-z0-9_-]*\.(?:webp|png|jpg))$/.exec(src)?.[1] ?? null
}

/** Para buscar sin tildes ni mayúsculas. */
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
