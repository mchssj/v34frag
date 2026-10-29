import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { XIcon } from "lucide-react"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "../dialogs"
import { daysUntil, fmtDate } from "../format"
import { Chip, PanelSection } from "../ui"
import { BanDialog, type BanTarget } from "./BanDialog"
import { BAN_STATUS, banLabel, banSteps, canEditBan } from "./bans"
import { useLiftBan, type Ban } from "./queries"

/** Detalle de un baneo: qué pasó, las acciones y los otros baneos de esa persona. */
export function BanPanel({
  ban,
  others,
  canPermanent,
  onClose,
  onPick,
  onChanged,
}: {
  ban: Ban
  /** Todos los baneos de esa persona (este incluido); undefined mientras cargan. */
  others: Ban[] | undefined
  canPermanent: boolean
  onClose: () => void
  /** Abrir otro baneo (por id si no está en la lista de esa persona). */
  onPick: (b: Ban | string) => void
  /** Un baneo cambiado, levantado o puesto desde el panel. */
  onChanged: (b: Ban) => void
}) {
  const [editing, setEditing] = useState(false)
  const [lifting, setLifting] = useState(false)
  const [rebanning, setRebanning] = useState(false)
  const lift = useLiftBan()

  const active = ban.status === "active"
  const label = banLabel(ban)
  const rest = others?.filter((b) => b.id !== ban.id)
  const hasOtherActive = !!rest?.some((b) => b.status === "active")
  const target: BanTarget | null = ban.player
    ? { kind: "player", id: ban.player.id, label: ban.player.alias }
    : ban.steam_id
      ? { kind: "steam", steamId: ban.steam_id }
      : null
  const steps = banSteps(ban)
  const days = ban.expires_at ? daysUntil(ban.expires_at) : 0

  return (
    <>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold">
            <span
              className={cn(
                "break-all",
                !ban.player && !ban.nick && "font-mono text-base"
              )}
            >
              {label}
            </span>
            <Chip tone={BAN_STATUS[ban.status].tone}>
              {active && ban.permanent
                ? "Activo · permanente"
                : BAN_STATUS[ban.status].label}
            </Chip>
          </h2>
          <span className="text-[13px] text-muted-foreground">
            {ban.player ? (
              <>
                Ficha: vale para todos sus SteamID y los que sume después.{" "}
                <Link
                  to="/player/$nick"
                  params={{ nick: ban.player.alias }}
                  className="text-primary hover:underline"
                >
                  Ver ficha
                </Link>
              </>
            ) : ban.nick ? (
              "SteamID sin ficha, con su último nick conocido."
            ) : (
              "SteamID sin ficha."
            )}
          </span>
          {ban.steam_id && (
            <span className="font-mono text-xs break-all text-muted-foreground">
              {ban.steam_id}
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Cerrar detalle"
          onClick={onClose}
        >
          <XIcon aria-hidden />
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Motivo</span>
        <p className="leading-relaxed wrap-anywhere">{ban.reason}</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Fact label="Vence">
          <span
            className={cn(ban.permanent && "font-semibold text-destructive")}
          >
            {ban.permanent
              ? "Nunca (permanente)"
              : `${fmtDate(ban.expires_at)}${
                  active ? (days <= 1 ? " (mañana)" : ` (en ${days} días)`) : ""
                }`}
          </span>
        </Fact>
        <Fact label="Puesto el">{fmtDate(ban.created_at)}</Fact>
        <Fact label="Origen">
          {ban.source === "web"
            ? "Web"
            : ban.source === "server"
              ? `!ban en ${ban.server?.name ?? "un servidor"}`
              : "Importado (banned_user.cfg)"}
        </Fact>
        <Fact label="Puesto por">
          {ban.source === "import"
            ? "—"
            : `${ban.created_by?.alias ?? "—"}${ban.source === "server" ? " (admin del juego)" : ""}`}
        </Fact>
      </dl>

      <section className="flex flex-col gap-2.5">
        <h3 className="text-sm font-semibold">Qué pasó</h3>
        <ol className="flex flex-col">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span
                aria-hidden
                className="flex w-3 shrink-0 flex-col items-center"
              >
                <span
                  className={cn(
                    "mt-1 size-2.5 shrink-0 rounded-full",
                    s.tone === "danger" && "bg-destructive",
                    s.tone === "win" && "bg-win",
                    s.tone === "muted" && "bg-muted-foreground"
                  )}
                />
                {i < steps.length - 1 && (
                  <span className="my-1 w-0.5 flex-1 bg-border" />
                )}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5 pb-3.5">
                <span className="text-[13px] font-semibold">
                  {s.title}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {s.at ? fmtDate(s.at) : "permanente"}
                  </span>
                </span>
                <span className="text-[13px] leading-snug wrap-anywhere text-muted-foreground">
                  {s.text}
                </span>
                {s.replacedBy && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1 w-fit"
                    onClick={() => {
                      const id = s.replacedBy!
                      onPick(rest?.find((b) => b.id === id) ?? id)
                    }}
                  >
                    Ver el baneo nuevo
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {canEditBan(ban, canPermanent) && (
          <>
            <Button variant="outline" onClick={() => setEditing(true)}>
              Cambiar motivo o vencimiento
            </Button>
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setLifting(true)}
            >
              Levantar
            </Button>
          </>
        )}
        {active && !canEditBan(ban, canPermanent) && (
          <span className="text-[13px] leading-snug text-muted-foreground">
            Es permanente: solo un admin lo cambia o lo levanta.
          </span>
        )}
        {!active &&
          target &&
          others !== undefined &&
          (hasOtherActive ? (
            <span className="text-[13px] text-muted-foreground">
              Ya tiene otro baneo activo.
            </span>
          ) : (
            <Button
              variant="outline"
              className="border-destructive/50 text-destructive hover:text-destructive"
              onClick={() => setRebanning(true)}
            >
              Banear de nuevo
            </Button>
          ))}
      </div>

      <PanelSection
        title={
          ban.player
            ? `Otros baneos de ${ban.player.alias}`
            : "Otros baneos de este SteamID"
        }
      >
        {rest === undefined ? (
          <Skeleton className="h-14 rounded-lg" />
        ) : rest.length === 0 ? (
          <span className="text-[13px] text-muted-foreground">
            Es el único.
          </span>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {rest.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onPick(b)}
                  className="flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left hover:bg-muted"
                >
                  <Chip tone={BAN_STATUS[b.status].tone}>
                    {BAN_STATUS[b.status].label}
                  </Chip>
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="truncate text-[13px]">{b.reason}</span>
                    <span className="text-xs text-muted-foreground">
                      {fmtDate(b.created_at)}
                      {b.permanent
                        ? " · permanente"
                        : ` → ${fmtDate(b.expires_at)}`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>

      {editing && (
        <BanDialog
          ban={ban}
          canPermanent={canPermanent}
          onClose={() => setEditing(false)}
          onSaved={onChanged}
        />
      )}
      {rebanning && target && (
        <BanDialog
          fixed={target}
          canPermanent={canPermanent}
          onClose={() => setRebanning(false)}
          onSaved={onChanged}
        />
      )}
      <ConfirmDialog
        open={lifting}
        onOpenChange={setLifting}
        title={`¿Levantar el baneo de ${label}?`}
        description="Puede volver a entrar a todos los servidores desde la próxima sincronización. No se borra: queda en la lista como levantado, con tu motivo."
        confirmLabel="Levantar baneo"
        danger
        reason={{
          label: "Motivo",
          help: "Obligatorio. Queda en el historial.",
          required: true,
        }}
        pending={lift.isPending}
        error={lift.error}
        onConfirm={(reason) =>
          lift.mutate(
            { id: ban.id, reason },
            {
              onSuccess: (b) => {
                setLifting(false)
                onChanged(b)
                toast.success("Baneo levantado.")
              },
            }
          )
        }
      />
    </>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
