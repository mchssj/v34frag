import { LAUNCHER } from "@/config/site"

/** La última versión publicada del launcher, de `latest.json` (el mismo que usa la actualización automática). */
export type LauncherRelease = {
  version: string
  url: string
  date: string | null
}

export async function fetchLatestLauncher(
  signal?: AbortSignal
): Promise<LauncherRelease | null> {
  const res = await fetch(LAUNCHER.latestUrl, { signal, cache: "no-cache" })
  if (!res.ok) return null
  const json = (await res.json().catch(() => null)) as {
    version?: unknown
    pub_date?: unknown
    platforms?: Record<string, { url?: unknown }>
  } | null
  const url = json?.platforms?.["windows-x86_64"]?.url
  if (typeof json?.version !== "string" || typeof url !== "string") return null
  // Solo instaladores de nuestro dominio.
  if (
    !/^https:\/\/(www\.)?cmleague\.lat\/descargas\/launcher\/[^/?#]+\.exe$/.test(
      url
    )
  )
    return null
  return {
    version: json.version,
    url,
    date: typeof json.pub_date === "string" ? json.pub_date : null,
  }
}
