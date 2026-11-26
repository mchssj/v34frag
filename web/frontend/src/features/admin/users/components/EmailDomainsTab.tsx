import { useQuery } from "@tanstack/react-query"
import { useId, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { ConfirmDialog } from "@/components/brand/ConfirmDialog"
import { FilterChips } from "@/components/brand/FilterChips"
import { SearchBox } from "@/components/brand/SearchBox"
import {
  useServerTable,
  type DataColumn,
} from "@/components/data-table/useServerTable"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AdminTable, Chip } from "../../components/ui"
import { fmtDate } from "../../lib/format"
import {
  EMAIL_DOMAINS_PER,
  emailAccountsOptions,
  emailDomainsOptions,
  useBlockEmailDomain,
  useUnblockEmailDomain,
} from "../api/queries"
import type {
  EmailDomain,
  EmailDomainAccount,
  EmailDomainFilter,
} from "../types"

// Correos temporales bloqueados al registrarse (replanteo 148, docs/bitacora/2026-11-26-correos-bloqueados).

export function EmailDomainsTab({
  onOpenAccount,
}: {
  /** Abre la cuenta en la pestaña Cuentas. */
  onOpenAccount: (a: { id: string; name: string }) => void
}) {
  const id = useId()
  const [q, setQ] = useState<string | undefined>(undefined)
  const [filter, setFilter] = useState<EmailDomainFilter>("all")
  const [page, setPage] = useState(1)
  const [accPage, setAccPage] = useState(1)
  const [domain, setDomain] = useState("")
  const [reason, setReason] = useState("")
  const [target, setTarget] = useState<EmailDomain | null>(null)
  const list = useQuery(emailDomainsOptions(q ?? "", filter, page))
  const accounts = useQuery(emailAccountsOptions(accPage))
  const block = useBlockEmailDomain()
  const unblock = useUnblockEmailDomain()
  const d = domain.trim()

  const columns: DataColumn<EmailDomain>[] = [
    {
      id: "domain",
      header: "Dominio",
      headClassName: "pl-4",
      cellClassName: "pl-4 font-mono text-[13px]",
      cell: ({ row: { original: x } }) => x.domain,
    },
    {
      id: "source",
      header: "Origen",
      cell: ({ row: { original: x } }) =>
        x.source === "admin" ? (
          <Chip tone="primary">Agregado</Chip>
        ) : (
          <Chip>Lista pública</Chip>
        ),
    },
    {
      id: "state",
      header: "Estado",
      cell: ({ row: { original: x } }) =>
        x.blocked ? (
          <Chip tone="danger">Bloqueado</Chip>
        ) : (
          <Chip tone="win">Permitido</Chip>
        ),
    },
    {
      id: "reason",
      header: "Motivo",
      cellClassName: "text-[13px] text-muted-foreground",
      cell: ({ row: { original: x } }) => x.reason ?? "—",
    },
    {
      id: "action",
      header: "",
      cellClassName: "pr-4 text-right",
      cell: ({ row: { original: x } }) =>
        x.blocked ? (
          <Button variant="outline" size="sm" onClick={() => setTarget(x)}>
            Desbloquear
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={block.isPending}
            onClick={() =>
              block.mutate(
                { domain: x.domain },
                {
                  onSuccess: () =>
                    toast.success(`${x.domain} vuelve a estar bloqueado.`),
                  onError: (e) => toast.error(errorMessage(e)),
                }
              )
            }
          >
            Volver a bloquear
          </Button>
        ),
    },
  ]
  const table = useServerTable({
    columns,
    data: list.data?.items,
    total: list.data?.total,
    page,
    per: EMAIL_DOMAINS_PER,
    onPage: setPage,
    getRowId: (x) => x.domain,
  })

  const accountColumns: DataColumn<EmailDomainAccount>[] = [
    {
      id: "account",
      header: "Cuenta",
      headClassName: "pl-4",
      cellClassName: "py-1.5 pl-4",
      cell: ({ row: { original: a } }) => (
        <span className="flex flex-col">
          <span className="font-semibold">{a.alias ?? "Sin alias"}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {a.email}
          </span>
        </span>
      ),
    },
    {
      id: "created",
      header: "Creada",
      cellClassName: "text-[13px]",
      cell: ({ row: { original: a } }) => fmtDate(a.created_at),
    },
    {
      id: "status",
      header: "Estado",
      cell: ({ row: { original: a } }) => (
        <span className="flex flex-wrap gap-1">
          {a.banned ? (
            <Chip tone="danger">Ficha baneada</Chip>
          ) : a.player_id ? (
            <Chip>Con ficha</Chip>
          ) : (
            <Chip>Sin ficha</Chip>
          )}
          {!a.confirmed && <Chip tone="warn">Sin confirmar</Chip>}
        </span>
      ),
    },
    {
      id: "open",
      header: "",
      cellClassName: "pr-4 text-right",
      cell: ({ row: { original: a } }) =>
        a.alias ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenAccount({ id: a.user_id, name: a.alias! })}
          >
            Ver cuenta
          </Button>
        ) : null,
    },
  ]
  const accountsTable = useServerTable({
    columns: accountColumns,
    data: accounts.data?.items,
    total: accounts.data?.total,
    page: accPage,
    per: 10,
    onPage: setAccPage,
    getRowId: (a) => a.user_id,
  })

  return (
    <div className="flex flex-col gap-5">
      <Card variant="outline" className="flex flex-col gap-3.5 p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-[17px] font-bold">Correos temporales</h2>
          <span className="text-[13px] leading-relaxed text-muted-foreground">
            Nadie se puede registrar ni cambiar su correo a uno de estos
            dominios, ni de sus subdominios. Está cargada la lista pública de
            correos temporales; si uno de esa lista es un correo real,
            desbloquéalo y queda permitido.
          </span>
        </div>
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (d.length < 3) return
            block.mutate(
              {
                domain: d,
                ...(reason.trim() ? { reason: reason.trim() } : {}),
              },
              {
                onSuccess: (r) => {
                  setDomain("")
                  setReason("")
                  toast.success(`${r.domain} bloqueado.`)
                },
              }
            )
          }}
        >
          <div className="flex flex-wrap gap-2">
            <Label htmlFor={`${id}-d`} className="sr-only">
              Dominio
            </Label>
            <Input
              id={`${id}-d`}
              value={domain}
              maxLength={260}
              placeholder="anonmart.com"
              className="min-w-0 flex-[2_1_200px]"
              onChange={(e) => {
                setDomain(e.target.value)
                block.reset()
              }}
            />
            <Label htmlFor={`${id}-r`} className="sr-only">
              Motivo (opcional)
            </Label>
            <Input
              id={`${id}-r`}
              value={reason}
              maxLength={200}
              placeholder="Motivo (opcional)"
              className="min-w-0 flex-[3_1_220px]"
              onChange={(e) => setReason(e.target.value)}
            />
            <Button
              type="submit"
              className="h-9"
              disabled={d.length < 3 || block.isPending}
            >
              Bloquear
            </Button>
          </div>
          {block.isError && (
            <span role="alert" className="text-xs text-destructive">
              {errorMessage(block.error)}
            </span>
          )}
        </form>
      </Card>

      <section aria-label="Dominios" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox
            value={q}
            label="Buscar dominios"
            placeholder="Dominio"
            onChange={(v) => {
              setQ(v)
              setPage(1)
            }}
          />
          <FilterChips
            label="Filtrar dominios"
            value={filter}
            onChange={(f) => {
              setFilter(f)
              setPage(1)
            }}
            options={[
              { value: "all", label: "Todos" },
              { value: "admin", label: "Agregados" },
              { value: "lista", label: "Lista pública" },
              { value: "exceptions", label: "Permitidos" },
            ]}
          />
          {list.data && (
            <span className="text-[13px] text-muted-foreground">
              {list.data.total.toLocaleString("es")} dominios
            </span>
          )}
        </div>
        <AdminTable
          table={table}
          query={list}
          className="min-w-[640px]"
          empty="Ningún dominio coincide."
        />
      </section>

      <section
        aria-label="Cuentas con un correo bloqueado"
        className="flex flex-col gap-3"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-[17px] font-bold">
            Cuentas que ya usan un correo bloqueado
          </h2>
          <span className="text-[13px] text-muted-foreground">
            Se crearon antes del bloqueo y siguen funcionando. Revísalas y, si
            corresponde, banea su ficha desde Cuentas.
          </span>
        </div>
        <AdminTable
          table={accountsTable}
          query={accounts}
          className="min-w-[560px]"
          loadingClassName="h-40"
          empty="Ninguna cuenta usa un correo bloqueado."
        />
      </section>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`¿Desbloquear ${target?.domain ?? ""}?`}
        description={
          target?.source === "lista"
            ? "Es de la lista pública: queda permitido y no se vuelve a bloquear cuando se actualice la lista."
            : "Se va a poder usar para registrarse."
        }
        confirmLabel="Desbloquear"
        pending={unblock.isPending}
        error={unblock.error}
        onConfirm={() =>
          target &&
          unblock.mutate(target.domain, {
            onSuccess: () => {
              toast.success(`${target.domain} desbloqueado.`)
              setTarget(null)
            },
          })
        }
      />
    </div>
  )
}
