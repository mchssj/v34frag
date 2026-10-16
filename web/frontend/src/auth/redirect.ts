const BASE = "http://csstv.invalid"

// Caracteres de control y "\": los navegadores descartan tabs y saltos de línea,
// así que "/\t/evil.com" termina siendo "//evil.com".
function hasUnsafeChars(value: string) {
  for (const ch of value) {
    const code = ch.charCodeAt(0)
    if (code < 0x20 || code === 0x7f || ch === "\\") return true
  }
  return false
}

/**
 * Devuelve `value` solo si es una ruta interna; si no, `fallback`.
 * Evita redirecciones abiertas con `?redirect=` (//evil.com, /\evil.com, https:, javascript:…).
 */
export function safeRedirect(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048)
    return fallback
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  )
    return fallback
  if (hasUnsafeChars(value)) return fallback
  try {
    const url = new URL(value, BASE)
    if (url.origin !== BASE) return fallback
    const path = url.pathname + url.search + url.hash
    // "/..//evil.com" se normaliza a "//evil.com", que el navegador toma como otro dominio.
    return path.startsWith("//") ? fallback : path
  } catch {
    return fallback
  }
}
