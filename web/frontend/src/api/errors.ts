import type { FieldValues, Path, UseFormSetError } from "react-hook-form"

// Códigos del backend (web/backend/src/lib/errors.ts) más NETWORK, que es propio del frontend.
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "INVALID_CREDENTIALS"
  | "WRONG_PASSWORD"
  | "SAME_PASSWORD"
  | "EMAIL_NOT_CONFIRMED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "BUSINESS_RULE"
  | "RATE_LIMITED"
  | "INVALID_FILE"
  | "FILE_TOO_LARGE"
  | "CONFIG_INVALID"
  | "NOT_AVAILABLE"
  | "ROSTER_FULL"
  | "NOT_A_MEMBER"
  | "COACH_NOT_ALLOWED"
  | "REGISTRATION_CLOSED"
  | "PLAYER_NOT_LINKED"
  | "INTERNAL"
  | "NETWORK"

export type FieldIssue = { path: string; message: string }

type ApiErrorInit = {
  status: number
  code: ApiErrorCode
  message: string
  details?: FieldIssue[]
  requestId?: string | null
  retryAfter?: number | null
}

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly details: FieldIssue[]
  readonly requestId: string | null
  /** Segundos de espera (header Retry-After), solo en RATE_LIMITED. */
  readonly retryAfter: number | null

  constructor(init: ApiErrorInit) {
    super(init.message)
    this.name = "ApiError"
    this.status = init.status
    this.code = init.code
    this.details = init.details ?? []
    this.requestId = init.requestId ?? null
    this.retryAfter = init.retryAfter ?? null
  }
}

const KNOWN_CODES = new Set<string>([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "INVALID_CREDENTIALS",
  "WRONG_PASSWORD",
  "SAME_PASSWORD",
  "EMAIL_NOT_CONFIRMED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "BUSINESS_RULE",
  "RATE_LIMITED",
  "INVALID_FILE",
  "FILE_TOO_LARGE",
  "CONFIG_INVALID",
  "NOT_AVAILABLE",
  "ROSTER_FULL",
  "NOT_A_MEMBER",
  "COACH_NOT_ALLOWED",
  "REGISTRATION_CLOSED",
  "PLAYER_NOT_LINKED",
  "INTERNAL",
])

const CODE_BY_STATUS: Record<number, ApiErrorCode> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "FILE_TOO_LARGE",
  429: "RATE_LIMITED",
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds)
  const date = Date.parse(value)
  if (Number.isNaN(date)) return null
  return Math.max(0, Math.ceil((date - Date.now()) / 1000))
}

function parseDetails(value: unknown): FieldIssue[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((d) =>
    d && typeof d === "object" && typeof d.path === "string"
      ? [{ path: d.path, message: String(d.message ?? "") }]
      : []
  )
}

/** Arma un ApiError desde una respuesta con error. `body` es el JSON ya leído, si lo hay. */
export function errorFromResponse(response: Response, body: unknown): ApiError {
  const err =
    body && typeof body === "object" && "error" in body
      ? (body as { error: Record<string, unknown> }).error
      : null
  const rawCode = typeof err?.code === "string" ? err.code : ""
  const code: ApiErrorCode = KNOWN_CODES.has(rawCode)
    ? (rawCode as ApiErrorCode)
    : (CODE_BY_STATUS[response.status] ?? "INTERNAL")

  return new ApiError({
    status: response.status,
    code,
    message: typeof err?.message === "string" ? err.message : "",
    details: parseDetails(err?.details),
    requestId:
      (typeof err?.requestId === "string" ? err.requestId : null) ??
      response.headers.get("X-Request-Id"),
    retryAfter: parseRetryAfter(response.headers.get("Retry-After")),
  })
}

export function networkError(): ApiError {
  return new ApiError({
    status: 0,
    code: "NETWORK",
    message: "No se pudo conectar con el servidor.",
  })
}

export function isApiError(e: unknown, code?: ApiErrorCode): e is ApiError {
  return e instanceof ApiError && (code === undefined || e.code === code)
}

/** Mensaje para mostrar al usuario según el code (nunca según el texto). */
export function errorMessage(
  e: unknown,
  opts: { retryIn?: number } = {}
): string {
  if (!isApiError(e)) return "Ocurrió un error inesperado."
  switch (e.code) {
    case "INVALID_CREDENTIALS":
      return "Email o contraseña incorrectos."
    case "WRONG_PASSWORD":
      return "La contraseña actual no es correcta."
    case "SAME_PASSWORD":
      return "Tiene que ser distinta de la actual."
    case "EMAIL_NOT_CONFIRMED":
      return "Confirma tu email. Te enviamos un link al registrarte."
    case "RATE_LIMITED": {
      // retryIn: segundos que faltan según la cuenta regresiva de la pantalla.
      const seconds = opts.retryIn ?? e.retryAfter
      return seconds
        ? `Demasiados intentos. Espera ${seconds} segundos y vuelve a probar.`
        : "Demasiados intentos. Espera un momento y vuelve a probar."
    }
    case "UNAUTHORIZED":
      return "Tu sesión venció. Inicia sesión de nuevo."
    case "FORBIDDEN":
      return e.message || "No tienes permiso para hacer esto."
    case "NOT_FOUND":
      return e.message || "No se encontró lo que buscas."
    case "NOT_AVAILABLE":
      return e.message || "Esto todavía no está disponible."
    case "ROSTER_FULL":
      return e.message || "El equipo ya tiene el roster completo."
    case "NOT_A_MEMBER":
      return e.message || "Ese jugador ya no está en el roster."
    case "COACH_NOT_ALLOWED":
      return e.message || "El coach no se puede inscribir."
    case "REGISTRATION_CLOSED":
      return e.message || "Las inscripciones de este torneo ya cerraron."
    case "PLAYER_NOT_LINKED":
      return (
        e.message ||
        "Todos los inscritos tienen que tener su SteamID vinculado."
      )
    case "NETWORK":
      return "No se pudo conectar con el servidor. Revisa tu conexión."
    case "INTERNAL":
    case "CONFIG_INVALID":
      return e.requestId
        ? `Algo salió mal. Código de seguimiento: ${e.requestId}`
        : "Algo salió mal. Intenta de nuevo en un momento."
    // Mensajes escritos para el usuario por el backend.
    case "BUSINESS_RULE":
    case "CONFLICT":
    case "VALIDATION_ERROR":
    case "INVALID_FILE":
    case "FILE_TOO_LARGE":
      return e.message || "Revisa los datos e intenta de nuevo."
  }
}

/** Errores pasajeros en los que tiene sentido ofrecer "Reintentar". */
export function isRetryable(e: unknown): boolean {
  return (
    isApiError(e) &&
    (e.code === "INTERNAL" ||
      e.code === "CONFIG_INVALID" ||
      e.code === "NETWORK")
  )
}

/**
 * Marca en el formulario los campos que vienen en details[].path.
 * `map` traduce nombres de la API a nombres del formulario. Devuelve si marcó alguno.
 */
export function applyFieldErrors<T extends FieldValues>(
  e: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
  map: Partial<Record<string, Path<T>>> = {}
): boolean {
  if (!isApiError(e) || e.details.length === 0) return false
  let marked = false
  for (const d of e.details) {
    const name = map[d.path] ?? (d.path as Path<T>)
    if (!fields.includes(name)) continue
    setError(name, { type: "server", message: d.message })
    marked = true
  }
  return marked
}
