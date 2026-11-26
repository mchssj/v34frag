import { useQuery } from "@tanstack/react-query"
import { DownloadIcon, ExternalLinkIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { LAUNCHER } from "@/config/site"
import { inLauncher } from "@/lib/launcher"
import { fetchLatestLauncher } from "../lib/latest"

export const latestLauncherOptions = {
  queryKey: ["launcher", "latest"] as const,
  queryFn: ({ signal }: { signal?: AbortSignal }) =>
    fetchLatestLauncher(signal),
  staleTime: 5 * 60_000,
  retry: 1,
}

/** "Descargar para Windows" con la última versión publicada (latest.json), o por qué todavía no se puede. */
export function DownloadButtons({ size = "xl" }: { size?: "lg" | "xl" }) {
  // Sin publicar no se pide latest.json: no hay nada que mostrar.
  const latest = useQuery({
    ...latestLauncherOptions,
    enabled: LAUNCHER.published,
  })
  const release = latest.data ?? null

  if (inLauncher())
    return (
      <p className="text-sm font-medium text-primary">
        Ya lo estás usando: esta página se ve dentro del launcher.
      </p>
    )
  if (LAUNCHER.published && latest.isPending)
    return (
      <span
        className="h-12 w-56 animate-pulse rounded-lg bg-muted"
        aria-label="Cargando la última versión"
      />
    )
  if (!LAUNCHER.published || !release)
    return (
      <p className="max-w-[460px] text-sm text-pretty text-muted-foreground">
        Todavía no está publicado. Lo anunciamos en el Discord de CMLeague
        cuando se pueda descargar.
      </p>
    )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <a href={release.url} className={buttonVariants({ size })}>
          <DownloadIcon aria-hidden />
          Descargar para Windows
        </a>
        <a
          href={LAUNCHER.openUrl}
          className={buttonVariants({ size, variant: "outline" })}
        >
          <ExternalLinkIcon aria-hidden />
          Ya lo tengo: abrirlo
        </a>
      </div>
      <span className="font-mono text-xs text-muted-foreground">
        Versión {release.version} · Windows 10 y 11 · unos 3 MB
      </span>
    </div>
  )
}
