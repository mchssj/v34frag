export type AuthCallback = "confirmed" | "invalid"

type Loc = Pick<Location, "pathname" | "search" | "hash">
type Hist = Pick<History, "replaceState" | "state">

/**
 * Link de confirmación del email: Supabase vuelve a FRONTEND_URL con los tokens en el fragmento
 * (#access_token=…&type=signup) o con un error. Los tokens se descartan sin usarlos (evita que
 * alguien loguee a otro con su cuenta mediante un link) y la URL se limpia del historial.
 * Devuelve la ruta a la que hay que ir, o null si la URL no es un callback.
 */
export function consumeAuthCallback(
  loc: Loc = window.location,
  history: Hist = window.history
): string | null {
  const hash = new URLSearchParams(loc.hash.replace(/^#/, ""))
  const query = new URLSearchParams(loc.search)

  const hasTokens = hash.has("access_token") || hash.has("refresh_token")
  const hasError =
    hash.has("error_code") || hash.has("error") || query.has("error_code")
  // Flujo PKCE (?code=): solo en la raíz, que es FRONTEND_URL.
  const hasCode = loc.pathname === "/" && query.has("code")
  if (!hasTokens && !hasError && !hasCode) return null

  const type = hash.get("type")
  let result: AuthCallback | null = null
  if (hasError) result = "invalid"
  else if (!type || type === "signup" || type === "email") result = "confirmed"

  const target = result
    ? `/ingresar?aviso=${result === "confirmed" ? "cuenta-confirmada" : "enlace-invalido"}`
    : loc.pathname
  // replaceState: los tokens no quedan en la barra ni al volver atrás.
  history.replaceState(history.state, "", target)
  return target
}
