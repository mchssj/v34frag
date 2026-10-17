import { cn } from "cn"
import { useEffect, useRef, useState } from "react"

import { errorMessage } from "@/api/errors"
import { LiveDot } from "@/components/brand/LiveDot"
import { Button } from "@/components/ui/button"
import { CLAIM_SERVER } from "@/config/site"
import { AuthHeading, ErrorAlert } from "@/features/auth/ui"
import { useCreateClaimCode, type SteamStatus } from "./queries"

type Code = { code: string; expiresAt: number }

/** El último código si sigue vigente (el POST está limitado a 5 por hora). */
function currentCode(status: SteamStatus | undefined): Code | null {
  const last = status?.last_code
  if (!last || last.status !== "pending") return null
  const expiresAt = Date.parse(last.expires_at)
  return expiresAt > Date.now() ? { code: last.code, expiresAt } : null
}

/** Segundos hasta el vencimiento; null hasta el primer cálculo. */
function useSecondsLeft(expiresAt: number | undefined) {
  const [left, setLeft] = useState<number | null>(null)
  useEffect(() => {
    if (!expiresAt) return
    const tick = () =>
      setLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)))
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, 1000)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [expiresAt])
  return left
}

function expiryText(seconds: number) {
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60)
    return `Vence en ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`
  }
  return `Vence en ${seconds} segundos`
}

export function ClaimStep({ status }: { status: SteamStatus | undefined }) {
  const create = useCreateClaimCode()
  const [code, setCode] = useState<Code | null>(() => currentCode(status))
  const requested = useRef(false)
  const linked = (status?.steam_ids.length ?? 0) > 0
  const seconds = useSecondsLeft(code?.expiresAt)
  const expired = code !== null && seconds === 0

  async function newCode() {
    try {
      const created = await create.mutateAsync()
      setCode({ code: created.code, expiresAt: Date.parse(created.expires_at) })
    } catch {
      // El error se muestra con ErrorAlert.
    }
  }

  // Al entrar: si no hay un código vigente, se pide uno (una sola vez, aunque StrictMode monte dos veces).
  useEffect(() => {
    if (linked || code || requested.current) return
    requested.current = true
    create
      .mutateAsync()
      .then((c) => setCode({ code: c.code, expiresAt: Date.parse(c.expires_at) }))
      .catch(() => {})
  }, [linked, code, create])

  const primary = status?.steam_ids.find((s) => s.is_primary) ?? status?.steam_ids[0]
  const result = status?.last_code?.result
  const steps = [
    { text: "Entra a un servidor de CSSTV:", code: `connect ${CLAIM_SERVER.address}` },
    { text: "Escribe en el chat:", code: code ? `!claim ${code.code}` : "!claim …" },
    { text: "Espera la confirmación aquí. Toma unos segundos.", code: null },
  ]

  return (
    <>
      <AuthHeading
        size="lg"
        title="Vincula tu jugador"
        subtitle="Así tus mixes, stats y ELO llegan a tu perfil. Se hace desde el juego, sin esperar a un admin."
      />

      {!linked && (
        <div className="flex flex-col items-center gap-2.5 rounded-xl border bg-card p-[22px]">
          <span className="text-xs text-muted-foreground">
            Tu código de un solo uso
          </span>
          <span className="flex gap-1.5" aria-label={code ? `Código ${code.code}` : "Generando código"}>
            {(code?.code ?? "······").split("").map((c, i) => (
              <span
                key={i}
                aria-hidden
                className={cn(
                  "grid h-11 w-[34px] place-items-center rounded-lg border bg-background font-mono text-xl font-bold",
                  (!code || expired) && "text-muted-foreground"
                )}
              >
                {c}
              </span>
            ))}
          </span>
          {expired ? (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              El código venció.
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => void newCode()}
                disabled={create.isPending}
              >
                Generar otro código
              </Button>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {code && seconds !== null ? expiryText(seconds) : "Generando código…"}
            </span>
          )}
        </div>
      )}

      {create.error != null && <ErrorAlert message={errorMessage(create.error)} />}

      <ol className="flex flex-col gap-2.5">
        {steps.map((s, i) => {
          const done = linked || i < 2
          return (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold",
                  done ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                )}
              >
                {i + 1}
              </span>
              <span className="pt-0.5 leading-[1.45]">
                {s.text}{" "}
                {s.code && (
                  <code className="rounded-[4px] bg-muted px-1.5 py-px font-mono text-[13px] font-semibold">
                    {s.code}
                  </code>
                )}
              </span>
            </li>
          )
        })}
      </ol>

      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px]",
          linked ? "bg-win/14 text-win" : "bg-muted text-muted-foreground"
        )}
      >
        {linked ? (
          <span className="size-2 shrink-0 rounded-full bg-current" aria-hidden />
        ) : (
          <LiveDot className="bg-current" />
        )}
        <span className="flex-1">
          {linked
            ? `Vinculado: SteamID ${primary ? `${primary.steam_id.slice(0, 13)}…` : ""}`
            : result && status?.last_code?.status === "used"
              ? result
              : "Esperando el comando en el servidor…"}
        </span>
      </div>
    </>
  )
}
