import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { XIcon } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { AvatarPicker } from "@/features/profile/AvatarPicker"
import { PlayerAvatar } from "@/features/ranking/parts"
import { SearchBox } from "@/features/ranking/SearchBox"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import { ConfirmDialog } from "../dialogs"
import { isBlockedName } from "../errors"
import { fmtDate } from "../format"
import {
  Chip,
  EmptyState,
  FilterChips,
  PanelSection,
  Pager,
  PickHint,
  QueryError,
  SplitLayout,
  TableBox,
  headCell,
} from "../ui"
import {
  PLAYERS_PER,
  freeAccountsOptions,
  medalsOptions,
  playerDetailOptions,
  playersListOptions,
  useAddMedal,
  useCreatePlayer,
  useDeleteMedal,
  useDeletePlayer,
  useMakePrimary,
  useRemoveSteam,
  useUpdatePlayer,
  useUploadPlayerPhoto,
  type FichaFilter,
  type PlayerDetail,
} from "./queries"

type Selection = { kind: "new" } | { kind: "edit"; id: string } | null

export function FichasTab({
  initial,
  creating,
  onCreatingDone,
  onGoUnlinked,
}: {
  /** Ficha que se abre al entrar (la recién creada desde "SteamID sin vincular"). */
  initial: string | null
  creating: boolean
  onCreatingDone: () => void
  onGoUnlinked: () => void
}) {
  const [q, setQ] = useState<string | undefined>(undefined)
  const [filter, setFilter] = useState<FichaFilter>("all")
  const [page, setPage] = useState(1)
  const [sel, setSel] = useState<Selection>(
    initial ? { kind: "edit", id: initial } : null
  )
  const list = useQuery(playersListOptions(q ?? "", filter, page))
  const selection: Selection = creating ? { kind: "new" } : sel
  const close = () => {
    setSel(null)
    onCreatingDone()
  }

  return (
    <SplitLayout
      asideLabel="Detalle de la ficha"
      main={
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox
              value={q}
              label="Buscar fichas"
              placeholder="Nick o SteamID"
              onChange={(v) => {
                setQ(v)
                setPage(1)
              }}
            />
            <FilterChips
              label="Filtrar fichas"
              value={filter}
              onChange={(f) => {
                setFilter(f)
                setPage(1)
              }}
              options={[
                { value: "all", label: "Todas" },
                { value: "account", label: "Con cuenta" },
                { value: "noaccount", label: "Sin cuenta" },
                { value: "nosteam", label: "Sin SteamID" },
              ]}
            />
            <span className="ml-auto text-xs text-muted-foreground">
              {list.data ? `${list.data.total} fichas` : ""}
            </span>
          </div>
          {list.isError ? (
            <QueryError
              error={list.error}
              onRetry={() => void list.refetch()}
            />
          ) : list.isPending ? (
            <Skeleton className="h-80 rounded-xl" />
          ) : list.data.items.length === 0 ? (
            <EmptyState>Ninguna ficha coincide.</EmptyState>
          ) : (
            <TableBox>
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={cn(headCell, "pl-4")}>
                      Ficha
                    </TableHead>
                    <TableHead className={headCell}>SteamID</TableHead>
                    <TableHead className={cn(headCell, "text-right")}>
                      ELO
                    </TableHead>
                    <TableHead className={cn(headCell, "text-right")}>
                      Partidas
                    </TableHead>
                    <TableHead className={headCell}>Avisos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.items.map((p) => {
                    const on =
                      selection?.kind === "edit" && selection.id === p.id
                    return (
                      <TableRow
                        key={p.id}
                        className={cn(on && "bg-primary/[0.08]")}
                      >
                        <TableCell className="py-1.5 pl-2">
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() => {
                              onCreatingDone()
                              setSel({ kind: "edit", id: p.id })
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-muted"
                          >
                            <PlayerAvatar
                              alias={p.alias}
                              photo={p.photo_url}
                              className="size-[34px]"
                            />
                            <span className="flex min-w-0 flex-col gap-0.5">
                              <span className="truncate font-semibold">
                                {p.alias}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {p.has_account ? "Con cuenta" : "Sin cuenta"}
                              </span>
                            </span>
                          </button>
                        </TableCell>
                        <TableCell>
                          {p.has_steam ? (
                            "Vinculado"
                          ) : (
                            <Chip tone="warn">Sin SteamID</Chip>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {p.elo ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {p.elo_matches}
                        </TableCell>
                        <TableCell>
                          {p.vip && <Chip tone="vip">VIP</Chip>}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <Pager
                page={page}
                total={list.data.total}
                per={PLAYERS_PER}
                onPage={setPage}
              />
            </TableBox>
          )}
        </>
      }
      aside={
        selection?.kind === "new" ? (
          <NewFicha
            onClose={close}
            onCreated={(id) => {
              onCreatingDone()
              setSel({ kind: "edit", id })
            }}
          />
        ) : selection?.kind === "edit" ? (
          <FichaPanel
            key={selection.id}
            id={selection.id}
            onClose={close}
            onGoUnlinked={onGoUnlinked}
          />
        ) : (
          <PickHint
            title="Elige una ficha"
            text="Acá editas sus datos, sus SteamID, la cuenta vinculada y las medallas."
          />
        )
      }
    />
  )
}

function PanelHead({
  title,
  sub,
  onClose,
  children,
}: {
  title: string
  sub: string
  onClose: () => void
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      {children}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="text-lg font-bold wrap-anywhere">{title}</h2>
        <span className="text-xs text-muted-foreground">{sub}</span>
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
  )
}

function NewFicha({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const id = useId()
  const [nick, setNick] = useState("")
  const create = useCreatePlayer()
  const ok = nick.trim().length >= 2 && nick.trim().length <= 24
  const blocked = isBlockedName(create.error, "nick")
  const submit = (force: boolean) =>
    create.mutate(
      { nick: nick.trim(), ...(force ? { force: true } : {}) },
      {
        onSuccess: (p) => {
          toast.success("Ficha creada.")
          onCreated(p.id)
        },
      }
    )

  return (
    <>
      <PanelHead
        title="Nueva ficha"
        sub="Para un jugador sin cuenta. Después le sumas SteamID o una cuenta."
        onClose={onClose}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-nick`}>Nick</Label>
        <Input
          id={`${id}-nick`}
          value={nick}
          maxLength={24}
          onChange={(e) => setNick(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">
          Entre 2 y 24 caracteres.
        </span>
      </div>
      {create.isError && (
        <BlockedOrError
          error={create.error}
          blocked={blocked}
          onForce={() => submit(true)}
        />
      )}
      <div className="flex justify-end">
        <Button
          size="md"
          disabled={!ok || create.isPending}
          onClick={() => submit(false)}
        >
          Crear ficha
        </Button>
      </div>
    </>
  )
}

function BlockedOrError({
  error,
  blocked,
  onForce,
}: {
  error: unknown
  blocked: boolean
  onForce: () => void
}) {
  if (!blocked)
    return (
      <p role="alert" className="text-sm text-destructive">
        {errorMessage(error)}
      </p>
    )
  return (
    <Alert variant="warning">
      <AlertDescription>{errorMessage(error)}</AlertDescription>
      <AlertAction>
        <Button variant="outline" size="sm" onClick={onForce}>
          Guardar igual
        </Button>
      </AlertAction>
    </Alert>
  )
}

function FichaPanel({
  id,
  onClose,
  onGoUnlinked,
}: {
  id: string
  onClose: () => void
  onGoUnlinked: () => void
}) {
  const detail = useQuery(playerDetailOptions(id))
  if (detail.isError)
    return (
      <QueryError error={detail.error} onRetry={() => void detail.refetch()} />
    )
  if (detail.isPending) return <Skeleton className="h-96 rounded-lg" />
  return (
    <FichaForm
      key={detail.dataUpdatedAt}
      p={detail.data}
      onClose={onClose}
      onGoUnlinked={onGoUnlinked}
    />
  )
}

type Draft = {
  nick: string
  privacy: "public" | "private"
  bio: string
  achievements: string
}

function FichaForm({
  p,
  onClose,
  onGoUnlinked,
}: {
  p: PlayerDetail
  onClose: () => void
  onGoUnlinked: () => void
}) {
  const uid = useId()
  const initial: Draft = {
    nick: p.alias,
    privacy: p.privacy,
    bio: p.bio ?? "",
    achievements: p.achievements ?? "",
  }
  const [d, setD] = useState<Draft>(initial)
  const update = useUpdatePlayer(p.id)
  const photo = useUploadPlayerPhoto(p.id)
  const [confirm, setConfirm] = useState<"delete" | "unlink" | null>(null)
  const del = useDeletePlayer()
  const nickOk = d.nick.trim().length >= 2 && d.nick.trim().length <= 24
  const dirty = JSON.stringify(d) !== JSON.stringify(initial)

  function save(force: boolean) {
    update.mutate(
      {
        ...(!p.has_account && d.nick.trim() !== p.alias
          ? { nick: d.nick.trim() }
          : {}),
        privacy: d.privacy,
        bio: d.bio.trim() || null,
        achievements: d.achievements.trim() || null,
        ...(force ? { force: true } : {}),
      },
      { onSuccess: () => toast.success("Cambios guardados.") }
    )
  }

  const seg = (on: boolean) =>
    cn(
      "h-8 rounded-md px-3 text-[13px] transition-colors",
      on
        ? "bg-card font-semibold text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    )

  return (
    <>
      <PanelHead
        title={p.alias}
        sub={`ELO ${p.elo ?? "—"} · ${p.elo_matches} mixes · ${p.has_account ? "con cuenta" : "sin cuenta"}`}
        onClose={onClose}
      />
      <div className="flex gap-3 text-[13px]">
        <Link
          to="/player/$nick"
          params={{ nick: p.alias }}
          className="text-primary hover:underline"
        >
          Ver perfil público
        </Link>
      </div>

      {p.ban && (
        <Alert variant="destructive">
          <AlertDescription>
            {p.ban.expires_at
              ? `Baneado hasta el ${fmtDate(p.ban.expires_at)}`
              : "Baneado de forma permanente"}
            : {p.ban.reason}
          </AlertDescription>
          <AlertAction>
            <Link
              to="/admin/bans"
              search={{ q: p.alias, ban: p.ban.id }}
              className="text-[13px] font-semibold underline"
            >
              Ver en Baneos
            </Link>
          </AlertAction>
        </Alert>
      )}

      <AvatarPicker
        url={p.photo_url}
        initial={p.alias.slice(0, 1).toUpperCase()}
        size="md"
        title="Foto de la ficha"
        hint="JPEG, PNG o WebP. Se recorta a 256×256."
        upload={photo}
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-nick`}>Nick</Label>
          <Input
            id={`${uid}-nick`}
            value={d.nick}
            maxLength={24}
            disabled={p.has_account}
            onChange={(e) => setD((x) => ({ ...x, nick: e.target.value }))}
          />
          <span className="text-xs text-muted-foreground">
            {p.has_account
              ? "Manda el alias de la cuenta: se cambia en Usuarios y moderación."
              : "Entre 2 y 24 caracteres."}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span id={`${uid}-priv`} className="text-sm font-medium">
            Datos personales
          </span>
          <div
            role="radiogroup"
            aria-labelledby={`${uid}-priv`}
            className="inline-flex gap-1 self-start rounded-lg bg-muted p-1"
          >
            {(["public", "private"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={d.privacy === v}
                className={seg(d.privacy === v)}
                onClick={() => setD((x) => ({ ...x, privacy: v }))}
              >
                {v === "public" ? "Públicos" : "Privados"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-bio`}>Biografía</Label>
          <Textarea
            id={`${uid}-bio`}
            rows={2}
            maxLength={500}
            value={d.bio}
            onChange={(e) => setD((x) => ({ ...x, bio: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-ach`}>Logros</Label>
          <Textarea
            id={`${uid}-ach`}
            rows={2}
            maxLength={500}
            value={d.achievements}
            onChange={(e) =>
              setD((x) => ({ ...x, achievements: e.target.value }))
            }
          />
        </div>
        {update.isError && (
          <BlockedOrError
            error={update.error}
            blocked={isBlockedName(update.error, "nick")}
            onForce={() => save(true)}
          />
        )}
        <div className="flex justify-end">
          <Button
            size="md"
            disabled={!dirty || !nickOk || update.isPending}
            onClick={() => save(false)}
          >
            Guardar cambios
          </Button>
        </div>
      </div>

      <PanelSection title="Cuenta vinculada">
        {p.has_account ? (
          <div className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5">
            <span className="flex-1">
              <span className="font-semibold">{p.alias}</span>{" "}
              <span className="text-xs text-muted-foreground">
                · su alias es el nombre de la ficha
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirm("unlink")}
            >
              Desvincular
            </Button>
          </div>
        ) : (
          <LinkAccount playerId={p.id} />
        )}
      </PanelSection>

      <SteamIds p={p} onGoUnlinked={onGoUnlinked} />
      <Medals playerId={p.id} />

      <PanelSection title="Borrar">
        <Button
          variant="outline"
          className="self-start border-destructive/50 text-destructive hover:text-destructive"
          disabled={p.elo_matches > 0}
          onClick={() => setConfirm("delete")}
        >
          Borrar ficha
        </Button>
        {p.elo_matches > 0 && (
          <span className="text-xs text-muted-foreground">
            No se puede borrar porque tiene partidas.
          </span>
        )}
      </PanelSection>

      <ConfirmDialog
        open={confirm === "unlink"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`¿Desvincular la cuenta ${p.alias}?`}
        description="La ficha queda sin cuenta, con sus partidas y su ELO. La cuenta deja de verlas en Mi perfil."
        confirmLabel="Desvincular"
        danger
        pending={update.isPending}
        error={update.error}
        onConfirm={() =>
          update.mutate(
            { user_id: null },
            {
              onSuccess: () => {
                setConfirm(null)
                toast.success("Cuenta desvinculada.")
              },
            }
          )
        }
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`¿Borrar la ficha ${p.alias}?`}
        description="No tiene partidas, así que se borra del todo."
        confirmLabel="Borrar ficha"
        danger
        pending={del.isPending}
        error={del.error}
        onConfirm={() =>
          del.mutate(p.id, {
            onSuccess: () => {
              setConfirm(null)
              onClose()
              toast.success("Ficha borrada.")
            },
          })
        }
      />
    </>
  )
}

function LinkAccount({ playerId }: { playerId: string }) {
  const [q, setQ] = useState("")
  const debounced = useDebouncedValue(q.trim(), 250)
  const accounts = useQuery(freeAccountsOptions(debounced))
  const update = useUpdatePlayer(playerId)
  const [target, setTarget] = useState<{ id: string; alias: string } | null>(
    null
  )

  return (
    <>
      <Input
        aria-label="Buscar una cuenta sin ficha"
        placeholder="Buscar una cuenta sin ficha por alias"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {debounced &&
        (accounts.data?.items.length ? (
          <ul className="flex flex-col gap-1.5">
            {accounts.data.items.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setTarget({ id: a.id, alias: a.alias })}
                  className="flex h-10 w-full items-center justify-between rounded-lg border px-3 hover:bg-muted"
                >
                  <span>{a.alias}</span>
                  <span className="text-xs font-semibold text-primary">
                    Vincular
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : accounts.data ? (
          <span className="text-xs text-muted-foreground">
            Ninguna cuenta sin ficha coincide.
          </span>
        ) : null)}
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`¿Vincular la cuenta ${target?.alias ?? ""}?`}
        description={`La ficha pasa a llamarse ${target?.alias ?? ""} (manda el alias de la cuenta) y la cuenta ve sus partidas y su ELO.`}
        confirmLabel="Vincular"
        pending={update.isPending}
        error={update.error}
        onConfirm={() =>
          target &&
          update.mutate(
            { user_id: target.id },
            {
              onSuccess: () => {
                setTarget(null)
                setQ("")
                toast.success("Cuenta vinculada.")
              },
            }
          )
        }
      />
    </>
  )
}

function SteamIds({
  p,
  onGoUnlinked,
}: {
  p: PlayerDetail
  onGoUnlinked: () => void
}) {
  const remove = useRemoveSteam(p.id)
  const primary = useMakePrimary(p.id)
  const [target, setTarget] = useState<string | null>(null)
  const ids = p.steam_ids
  const only = ids.length === 1

  return (
    <PanelSection
      title={`SteamID ${ids.length}/4`}
      aside={
        ids.length < 4 && (
          <Button variant="link" size="sm" onClick={onGoUnlinked}>
            Sumar uno sin vincular
          </Button>
        )
      }
    >
      {ids.length === 0 && (
        <span className="text-[13px] text-muted-foreground">
          Sin SteamID: sus partidas no se reconocen hasta que vincule uno con
          !claim o se lo sumes acá.
        </span>
      )}
      <ul className="flex flex-col gap-2">
        {ids.map((s, i) => (
          <li
            key={s}
            className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5"
          >
            <span className="flex-1 font-mono text-[13px]">{s}</span>
            {i === 0 ? (
              <Chip tone="primary">Principal</Chip>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={primary.isPending}
                onClick={() =>
                  primary.mutate(s, {
                    onSuccess: () =>
                      toast.success(
                        "SteamID principal cambiado. El ELO queda igual."
                      ),
                    onError: (e) => toast.error(errorMessage(e)),
                  })
                }
              >
                Hacer principal
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Quitar ${s}`}
              className="text-destructive hover:text-destructive"
              onClick={() => setTarget(s)}
            >
              Quitar
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`¿Quitar este SteamID de ${p.alias}?`}
        description={
          <>
            <span className="font-mono">{target}</span>
            <span>
              {only
                ? "Es su único SteamID: sus partidas vuelven a quedar sin ficha."
                : "Sus partidas vuelven a quedar sin ficha y se recalcula el ELO de esta ficha; los demás no cambian."}
              {!only && target === ids[0]
                ? " El adicional más viejo pasa a ser el principal."
                : ""}
            </span>
          </>
        }
        confirmLabel="Quitar SteamID"
        danger
        pending={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          target &&
          remove.mutate(target, {
            onSuccess: () => {
              setTarget(null)
              toast.success("SteamID quitado.")
            },
          })
        }
      />
    </PanelSection>
  )
}

function Medals({ playerId }: { playerId: string }) {
  const id = useId()
  const medals = useQuery(medalsOptions(playerId))
  const add = useAddMedal(playerId)
  const del = useDeleteMedal(playerId)
  const [icon, setIcon] = useState("")
  const [title, setTitle] = useState("")

  return (
    <PanelSection title="Medallas">
      {medals.data?.items.length === 0 && (
        <span className="text-[13px] text-muted-foreground">Sin medallas.</span>
      )}
      <ul className="flex flex-col gap-2">
        {medals.data?.items.map((m) => (
          <li key={m.id} className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-[15px]"
            >
              {m.icon ?? "·"}
            </span>
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="font-medium">{m.title}</span>
              <span className="text-xs text-muted-foreground">
                {m.season
                  ? `Por la ${m.season.name}${m.rank ? ` (puesto ${m.rank})` : ""}`
                  : `Dada a mano el ${fmtDate(m.created_at)}`}
              </span>
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Quitar la medalla ${m.title}`}
              disabled={del.isPending}
              onClick={() =>
                del.mutate(m.id, {
                  onSuccess: () => toast.success("Medalla quitada."),
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              <XIcon aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label
            htmlFor={`${id}-icon`}
            className="text-xs font-normal text-muted-foreground"
          >
            Ícono
          </Label>
          <Input
            id={`${id}-icon`}
            value={icon}
            maxLength={8}
            placeholder="Emoji"
            className="text-center"
            onChange={(e) => setIcon(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label
            htmlFor={`${id}-title`}
            className="text-xs font-normal text-muted-foreground"
          >
            Título
          </Label>
          <Input
            id={`${id}-title`}
            value={title}
            maxLength={80}
            placeholder="Campeón Copa Andes 2026"
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          className="h-9"
          disabled={!title.trim() || add.isPending}
          onClick={() =>
            add.mutate(
              {
                title: title.trim(),
                ...(icon.trim() ? { icon: icon.trim() } : {}),
              },
              {
                onSuccess: () => {
                  setIcon("")
                  setTitle("")
                  toast.success("Medalla dada.")
                },
                onError: (e) => toast.error(errorMessage(e)),
              }
            )
          }
        >
          Dar
        </Button>
      </div>
    </PanelSection>
  )
}
