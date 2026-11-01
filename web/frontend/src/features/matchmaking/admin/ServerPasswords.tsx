import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { HistoryIcon, RefreshCwIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PASSWORD_KIND, fmtDateTime, passwordSetBy } from "../labels"
import { PasswordField } from "../PasswordField"
import {
  adminServersOptions,
  passwordHistoryOptions,
  useMmAdminMutation,
  useRotatePassword,
} from "../queries"
import { useMmSource } from "../source"
import type { MmAdminServer } from "../types"

const STATE_LABEL: Record<MmAdminServer["state"], string> = {
  free: "Libre",
  lobby: "Sala asignada",
  live: "Mix en vivo",
  offline: "Sin conexión",
}

const STATE_TONE: Record<MmAdminServer["state"], string> = {
  free: "bg-win",
  lobby: "bg-sidebar-primary",
  live: "bg-destructive",
  offline: "bg-muted-foreground/40",
}

/**
 * Administración › Matchmaking › Servidores: la contraseña vigente de cada servidor (la del mix o
 * la que se puso al azar al terminar), su historial y "Rotar ahora". Solo admin (plan, sección 6).
 */
export function ServerPasswords() {
  const source = useMmSource()
  const { data, isPending, error } = useQuery(adminServersOptions(source))
  const [historyOf, setHistoryOf] = useState<MmAdminServer | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contraseñas de los servidores</CardTitle>
        <CardDescription>
          Al terminar cada mix el servidor pone una contraseña al azar. Solo los
          admins la ven.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-sm text-destructive">{errorMessage(error)}</p>
        )}
        {isPending && <Skeleton className="h-24 w-full" />}
        {data && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Servidor</TableHead>
                <TableHead>En el matchmaking</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Contraseña vigente</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((s) => (
                <ServerRow
                  key={s.id}
                  server={s}
                  onHistory={() => setHistoryOf(s)}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {historyOf && (
        <HistoryDialog server={historyOf} onClose={() => setHistoryOf(null)} />
      )}
    </Card>
  )
}

function ServerRow({
  server,
  onHistory,
}: {
  server: MmAdminServer
  onHistory: () => void
}) {
  const source = useMmSource()
  const rotate = useRotatePassword(source, server.id)
  const enable = useMmAdminMutation((on: boolean) =>
    source.setServerEnabled(server.id, on)
  )
  const pw = server.password
  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{server.name}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {server.address}
            {server.region && ` · ${server.region}`}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Switch
          aria-label={`${server.name} en el matchmaking`}
          checked={server.mm_enabled}
          disabled={enable.isPending}
          onCheckedChange={(on) =>
            enable.mutate(on, {
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
        />
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 text-sm">
          <span
            aria-hidden
            className={cn("size-1.5 rounded-full", STATE_TONE[server.state])}
          />
          {STATE_LABEL[server.state]}
        </span>
      </TableCell>
      <TableCell>
        {pw ? (
          <div className="flex flex-col gap-0.5">
            <PasswordField value={pw.password} />
            <span className="text-xs text-muted-foreground">
              {PASSWORD_KIND[pw.kind]} · {passwordSetBy(pw)}
            </span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Sin datos</span>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {pw?.applied_at ? fmtDateTime(pw.applied_at) : "—"}
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex gap-1">
          <Button variant="ghost" size="sm" onClick={onHistory}>
            <HistoryIcon aria-hidden />
            Historial
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={server.state !== "free" || rotate.isPending}
            title={
              server.state === "free"
                ? undefined
                : "Solo se rota con el servidor libre"
            }
            onClick={() =>
              rotate.mutate(undefined, {
                onSuccess: () =>
                  toast.success("Pedida: el servidor la pone en unos segundos"),
                onError: (e) => toast.error(errorMessage(e)),
              })
            }
          >
            <RefreshCwIcon aria-hidden />
            Rotar ahora
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function HistoryDialog({
  server,
  onClose,
}: {
  server: MmAdminServer
  onClose: () => void
}) {
  const source = useMmSource()
  const { data, isPending } = useQuery(
    passwordHistoryOptions(source, server.id)
  )
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Historial de contraseñas · {server.name}</DialogTitle>
          <DialogDescription>
            Las últimas 50, de la más nueva a la más vieja.
          </DialogDescription>
        </DialogHeader>
        {isPending && <Skeleton className="h-32 w-full" />}
        {data && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Contraseña</TableHead>
                <TableHead>Puesta por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm">
                    {fmtDateTime(e.created_at)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {PASSWORD_KIND[e.kind]}
                  </TableCell>
                  <TableCell>
                    <PasswordField value={e.password} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.applied_at ? passwordSetBy(e) : "Pendiente"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  )
}
