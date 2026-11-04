export type AuthCallback = "confirmed" | "invalid"

type Loc = Pick<Location, "pathname" | "search" | "hash">
type Hist = Pick<History, "replaceState" | "state">

/**
 * Link de confirmación del email: Supabase vuelve a FRONTEND_URL con los tokens en el fragmento
 * (#access_token=…&type=signup) o con un error. Los tokens se descartan sin usarlos (evita que
 * alguien loguee a otro con su cuenta mediante un link) y la URL se limpia del historial.
 * Los links de recuperación con tokens en el fragmento (plantilla vieja) también se descartan:
 * llevan a pedir otro correo. El link bueno trae ?token_hash=…&type=recovery y lo canjea la API.
 * Devuelve la ruta a la que hay que ir, o null si la URL no es un callback.
 */
export function consumeAuthCallback(
  loc: Loc = window.location,
  history: Hist = window.history
): string | null {
  const hash = new URLSearchParams(loc.hash.replace(/^#/, ""))
  const query = new URLSearchParams(loc.search)

  // Correo de recuperación armado con el Site URL pelado: el token sigue a la página que lo usa.
  const recoveryHash = query.get("token_hash")
  if (
    loc.pathname === "/" &&
    recoveryHash &&
    query.get("type") === "recovery"
  ) {
    const target = `/reset-password?${new URLSearchParams({ token_hash: recoveryHash, type: "recovery" })}`
    history.replaceState(history.state, "", target)
    return target
  }

  const hasTokens = hash.has("access_token") || hash.has("refresh_token")
  const hasError =
    hash.has("error_code") || hash.has("error") || query.has("error_code")
  // Flujo PKCE (?code=): solo en la raíz, que es FRONTEND_URL.
  const hasCode = loc.pathname === "/" && query.has("code")
  if (!hasTokens && !hasError && !hasCode) return null

  const type = hash.get("type")
  let target: string
  if (type === "recovery") target = "/forgot-password?aviso=enlace-viejo"
  else if (hasError) target = "/login?aviso=enlace-invalido"
  else if (!type || type === "signup" || type === "email")
    target = "/login?aviso=cuenta-confirmada"
  else target = loc.pathname
  // replaceState: los tokens no quedan en la barra ni al volver atrás.
  history.replaceState(history.state, "", target)
  return target
}
