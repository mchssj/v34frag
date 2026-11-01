// Revisión de una config antes de publicarla (docs/bitacora/2026-10-29-configs-jugadores en kyan/pruebas).
// En la versión real esto lo hace el servidor (y además abre los .rar); acá corre en el navegador para el
// prototipo. Las reglas son las mismas en los dos lados.

export const ALLOWED_EXT = ["cfg", "vdf", "scr", "rc", "txt"] as const
export const MAX_TOTAL = 2 * 1024 * 1024
export const MAX_FILES = 100

export interface ConfigFile {
  path: string
  size: number
  text: string
}

export interface Problem {
  path: string
  reason: string
}
export interface Secret {
  path: string
  line: number
  key: string
}

export interface CheckResult {
  /** Se puede publicar (no hay archivos prohibidos ni se pasa del tamaño). */
  ok: boolean
  accepted: ConfigFile[]
  rejected: Problem[]
  secrets: Secret[]
  /** Parecen scripts: se publica, pero queda marcada para que la revise un admin. */
  scripts: Problem[]
  total: number
}

const ext = (p: string) => p.split(".").pop()?.toLowerCase() ?? ""
export const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p

// Contraseñas guardadas: `rcon_password "abc"`, `password abc`, `sv_password "x"`. Vacías no cuentan.
const SECRET =
  /^\s*(rcon_password|sv_password|password)\s+("([^"]+)"|([^\s;"/]+))/i

// Señales de scripts que el reglamento puede prohibir. No es una lista cerrada: marca para que lo vea un admin.
const SCRIPT_NAMES =
  /(no_?recoil|aimbot|aim_?lock|trigger|bhop|autofire|rapid_?fire|anti_?recoil)/i
const ATTACK_LOOP =
  /\+attack[^\n]*wait[^\n]*-attack|-attack[^\n]*wait[^\n]*\+attack/i
const RECOIL_CVARS =
  /\b(cl_pitchspeed|cl_pitchup|cl_pitchdown|m_pitch)\b[^\n]*;[^\n]*wait/i

/** Saca las líneas con contraseñas. Devuelve el texto limpio. */
export const stripSecrets = (text: string) =>
  text
    .split(/\r?\n/)
    .filter((l) => !SECRET.test(l))
    .join("\n")

export function checkConfig(
  files: ConfigFile[],
  fromArchive: boolean
): CheckResult {
  const accepted: ConfigFile[] = []
  const rejected: Problem[] = []
  const secrets: Secret[] = []
  const scripts: Problem[] = []
  for (const f of files) {
    if (!(ALLOWED_EXT as readonly string[]).includes(ext(f.path))) {
      rejected.push({
        path: f.path,
        reason: `.${ext(f.path) || "sin extensión"} no está permitido`,
      })
      continue
    }
    accepted.push(f)
    f.text.split(/\r?\n/).forEach((l, i) => {
      const m = SECRET.exec(l)
      if (m)
        secrets.push({ path: f.path, line: i + 1, key: m[1]!.toLowerCase() })
    })
    if (SCRIPT_NAMES.test(baseName(f.path)))
      scripts.push({ path: f.path, reason: "El nombre parece de un script" })
    else if (ATTACK_LOOP.test(f.text))
      scripts.push({
        path: f.path,
        reason: "Tiene un alias que dispara en bucle con wait",
      })
    else if (RECOIL_CVARS.test(f.text))
      scripts.push({
        path: f.path,
        reason: "Mueve la mira con wait (control de retroceso)",
      })
  }
  const total = accepted.reduce((s, f) => s + f.size, 0)
  const tooBig = total > MAX_TOTAL
  const tooMany = accepted.length > MAX_FILES
  if (tooBig) rejected.push({ path: "(total)", reason: "Pesa más de 2 MB" })
  if (tooMany)
    rejected.push({
      path: "(total)",
      reason: `Tiene más de ${MAX_FILES} archivos`,
    })
  // Un archivo comprimido con algo prohibido adentro se rechaza entero: puede esconder un ejecutable.
  // Sueltos, los prohibidos simplemente no se suben.
  const ok =
    accepted.length > 0 &&
    !tooBig &&
    !tooMany &&
    !(fromArchive && rejected.length > 0)
  return { ok, accepted, rejected, secrets, scripts, total }
}
