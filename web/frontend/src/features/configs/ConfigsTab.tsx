import { cn } from "cn"
import {
  AlertTriangleIcon,
  DownloadIcon,
  FileTextIcon,
  FolderUpIcon,
  KeyRoundIcon,
  LockIcon,
  ShieldAlertIcon,
  UploadIcon,
  XCircleIcon,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { HaceteVipButton } from "@/features/vip/upsell"

import {
  baseName,
  checkConfig,
  stripSecrets,
  type CheckResult,
  type ConfigFile,
} from "./check"
import type { PublishedConfig } from "./demo"
import { isRar, isZip, readZip, writeZip } from "./zip"

// La pestaña Config del perfil (docs/bitacora/2026-10-29-configs-jugadores en kyan/pruebas): cualquiera
// sube la suya; solo los VIP ven el contenido y descargan las de los demás. La pestaña es del perfil, así que
// la versión real la lleva Esteban.

const PLACEHOLDER = Array.from(
  { length: 18 },
  (_, i) =>
    `bind "${"wasdqerfgbcvxz"[i % 14]}" "+${["forward", "jump", "attack", "reload", "use", "duck"][i % 6]}"`
).join("\n")

const kb = (n: number) =>
  n < 1024 ? `${n} B` : `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`
const fmtDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
  })

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Lo que el jugador eligió, ya leído: archivos con su texto, o un .rar que solo puede abrir el servidor. */
type Picked =
  | {
      kind: "files"
      name: string
      fromArchive: boolean
      files: ConfigFile[]
      result: CheckResult
    }
  | { kind: "rar"; name: string; size: number }
  | { kind: "error"; name: string; message: string }

async function readPicked(list: FileList): Promise<Picked> {
  const files = [...list]
  const dec = new TextDecoder()
  if (files.length === 1) {
    const f = files[0]!
    const buf = new Uint8Array(await f.arrayBuffer())
    if (isRar(buf)) return { kind: "rar", name: f.name, size: f.size }
    if (isZip(buf)) {
      try {
        const entries = await readZip(buf)
        const cfg = entries.map((e) => ({
          path: e.path,
          size: e.size,
          text: e.data ? dec.decode(e.data) : "",
        }))
        return {
          kind: "files",
          name: f.name,
          fromArchive: true,
          files: cfg,
          result: checkConfig(cfg, true),
        }
      } catch (e) {
        return {
          kind: "error",
          name: f.name,
          message: e instanceof Error ? e.message : "No se pudo abrir.",
        }
      }
    }
  }
  const cfg = await Promise.all(
    files.map(async (f) => ({
      path:
        (f as File & { webkitRelativePath?: string }).webkitRelativePath ||
        f.name,
      size: f.size,
      text: f.size < 512 * 1024 ? await f.text() : "",
    }))
  )
  return {
    kind: "files",
    name: files.length === 1 ? files[0]!.name : `${files.length} archivos`,
    fromArchive: false,
    files: cfg,
    result: checkConfig(cfg, false),
  }
}

function Report({
  p,
  onPublish,
  onCancel,
}: {
  p: Picked
  onPublish: (files: ConfigFile[], flagged: string[]) => void
  onCancel: () => void
}) {
  if (p.kind === "error")
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/50 px-3 py-2 text-sm">
        <XCircleIcon aria-hidden className="size-4 text-destructive" />
        {p.name}: {p.message}
      </div>
    )
  if (p.kind === "rar")
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <FileTextIcon aria-hidden className="size-4" />
          {p.name} · {kb(p.size)}
        </span>
        <span className="text-muted-foreground">
          Los .rar los abre el servidor, que hace la misma revisión (tipos de
          archivo, contraseñas y scripts). En este prototipo no se pueden abrir:
          probá con un .zip o con la carpeta cfg.
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="self-start"
          onClick={onCancel}
        >
          Cancelar
        </Button>
      </div>
    )
  const r = p.result
  return (
    <div className="flex flex-col gap-3 rounded-lg border px-3 py-3 text-sm">
      <span className="font-medium">
        {p.name} · {r.accepted.length} archivos aceptados · {kb(r.total)}
      </span>
      {r.rejected.length > 0 && (
        <div className="flex flex-col gap-1 text-destructive">
          <span className="flex items-center gap-1.5 font-medium">
            <XCircleIcon aria-hidden className="size-4" />
            {p.fromArchive
              ? "No se puede publicar: tiene archivos que no son de config"
              : "Estos no se suben"}
          </span>
          {r.rejected.map((x) => (
            <span key={x.path + x.reason} className="pl-6 font-mono text-xs">
              {x.path} — {x.reason}
            </span>
          ))}
        </div>
      )}
      {r.secrets.length > 0 && (
        <div className="flex flex-col gap-1 text-amber-600 dark:text-amber-400">
          <span className="flex items-center gap-1.5 font-medium">
            <KeyRoundIcon aria-hidden className="size-4" />
            Encontramos contraseñas guardadas. Se sacan esas líneas antes de
            publicar:
          </span>
          {r.secrets.map((s) => (
            <span key={s.path + s.line} className="pl-6 font-mono text-xs">
              {baseName(s.path)}, línea {s.line}: {s.key} "••••••"
            </span>
          ))}
        </div>
      )}
      {r.scripts.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 font-medium">
            <ShieldAlertIcon aria-hidden className="size-4" />
            Parece tener scripts. Se publica, pero la revisa un admin:
          </span>
          {r.scripts.map((s) => (
            <span
              key={s.path}
              className="pl-6 font-mono text-xs text-muted-foreground"
            >
              {baseName(s.path)} — {s.reason}
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!r.ok}
          onClick={() =>
            onPublish(
              r.accepted.map((f) => ({ ...f, text: stripSecrets(f.text) })),
              r.scripts.map((s) => s.path)
            )
          }
        >
          <UploadIcon aria-hidden />
          Publicar
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

function Uploader({
  onPublish,
}: {
  onPublish: (files: ConfigFile[], flagged: string[]) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const dirRef = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<Picked | null>(null)
  // `webkitdirectory` no está en los tipos de React: se pone a mano.
  useEffect(() => dirRef.current?.setAttribute("webkitdirectory", ""), [])
  const onChange = async (list: FileList | null) => {
    if (list?.length) setPicked(await readPicked(list))
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed p-4">
      <div>
        <p className="font-medium">Subí tu config</p>
        <p className="text-sm text-muted-foreground">
          Un .rar o .zip con tu carpeta{" "}
          <code className="font-mono text-xs">cstrike/cfg</code>, o la carpeta
          directo. Solo se aceptan .cfg, .vdf, .scr, .rc y .txt, hasta 2 MB.
          Subir otra reemplaza la anterior.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileRef.current?.click()}
        >
          <UploadIcon aria-hidden />
          Elegir .rar o .zip
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => dirRef.current?.click()}
        >
          <FolderUpIcon aria-hidden />
          Elegir la carpeta cfg
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        hidden
        accept=".rar,.zip,.cfg,.vdf,.scr,.rc,.txt"
        multiple
        onChange={(e) =>
          void onChange(e.target.files).then(() => (e.target.value = ""))
        }
      />
      <input
        ref={dirRef}
        type="file"
        hidden
        multiple
        onChange={(e) =>
          void onChange(e.target.files).then(() => (e.target.value = ""))
        }
      />
      {picked && (
        <Report
          p={picked}
          onCancel={() => setPicked(null)}
          onPublish={(files, flagged) => {
            onPublish(files, flagged)
            setPicked(null)
          }}
        />
      )}
    </div>
  )
}

/** Una config publicada: la lista para todos; el contenido y la descarga, para VIP. */
export function ConfigView({
  c,
  vip,
  mine,
}: {
  c: PublishedConfig
  vip: boolean
  mine: boolean
}) {
  const [open, setOpen] = useState<string | null>(null)
  const canSee = vip || mine
  const total = c.files.reduce((s, f) => s + f.size, 0)
  const shown = c.files.find((f) => f.path === open)
  const download = () => {
    const enc = new TextEncoder()
    save(
      writeZip(
        c.files.map((f) => ({ path: f.path, data: enc.encode(f.text) }))
      ),
      `cmleague-config-${c.nick.toLowerCase()}.zip`
    )
    toast.success("Config descargada.")
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <p className="font-medium">
            {mine ? "Tu config" : `Config de ${c.nick}`}
          </p>
          <p className="text-xs text-muted-foreground">
            Subida el {fmtDate(c.uploaded_at)} · {c.files.length} archivos ·{" "}
            {kb(total)}
          </p>
        </div>
        {c.flagged.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-400/15 px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            <AlertTriangleIcon aria-hidden className="size-3.5" />
            En revisión: puede tener scripts
          </span>
        )}
        {vip &&
          !mine &&
          (c.flagged.length > 0 ? (
            // Si se pudiera bajar mientras está en revisión, la revisión no serviría de nada.
            <span className="text-xs text-muted-foreground">
              Se puede descargar cuando la apruebe un admin
            </span>
          ) : (
            <Button size="sm" onClick={download}>
              <DownloadIcon aria-hidden />
              Descargar .zip
            </Button>
          ))}
      </div>

      <div className="grid gap-3 md:grid-cols-[260px_1fr]">
        <ul className="flex flex-col rounded-xl border bg-card py-1 text-sm">
          {c.files.map((f) => (
            <li key={f.path}>
              <button
                type="button"
                aria-pressed={open === f.path}
                onClick={() => setOpen(f.path)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted",
                  open === f.path && "bg-muted"
                )}
              >
                <FileTextIcon
                  aria-hidden
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                <span className="flex-1 truncate font-mono text-xs">
                  {baseName(f.path)}
                </span>
                {c.flagged.includes(f.path) && (
                  <AlertTriangleIcon
                    aria-label="Puede ser un script"
                    className="size-3.5 text-amber-500"
                  />
                )}
                <span className="font-mono text-[11px] text-muted-foreground">
                  {kb(f.size)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="relative min-h-[220px] overflow-hidden rounded-xl border bg-card">
          {canSee ? (
            shown ? (
              <pre className="max-h-[420px] overflow-auto p-4 font-mono text-xs leading-relaxed">
                {shown.text || "(vacío)"}
              </pre>
            ) : (
              <p className="p-4 text-sm text-muted-foreground">
                Elegí un archivo para ver qué tiene.
              </p>
            )
          ) : (
            <>
              <pre
                aria-hidden
                className="pointer-events-none p-4 font-mono text-xs leading-relaxed blur-[5px] select-none"
              >
                {/* Texto de relleno: sin VIP la API no manda el contenido, así que acá tampoco se usa. */}
                {PLACEHOLDER}
              </pre>
              <div className="absolute inset-0 grid place-items-center">
                <div className="flex max-w-sm flex-col items-center gap-2 rounded-xl border bg-background/95 p-5 text-center shadow-lg">
                  <LockIcon aria-hidden className="size-5 text-amber-400" />
                  <p className="font-semibold">
                    Ver y descargar configs es para VIP
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Mirá los binds, la sensi y los rates de cualquiera, y bajate
                    su carpeta cfg entera.
                  </p>
                  <HaceteVipButton className="mt-1" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function ConfigsTab({
  config,
  vip,
  mine,
  onPublish,
}: {
  config: PublishedConfig | null
  vip: boolean
  mine: boolean
  onPublish?: (files: ConfigFile[], flagged: string[]) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      {mine && onPublish && <Uploader onPublish={onPublish} />}
      {config ? (
        <ConfigView c={config} vip={vip} mine={mine} />
      ) : (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {mine
            ? "Todavía no subiste tu config."
            : "Este jugador todavía no subió su config."}
        </p>
      )}
    </div>
  )
}
